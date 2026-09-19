#!/usr/bin/env python3
"""End-to-end check of the vision pipeline, through the same path the frontend uses.

    make e2e                                   # the three bundled test images
    python3 scripts/e2e-vision.py IMG [IMG ...]
    python3 scripts/e2e-vision.py --base https://localhost:8443 --ca path/to/cert.pem IMG

What it does, per run: registers a throwaway user, logs in, sends each image to
POST /api/v1/vision/analyze, prints what every stage of the pipeline decided, then
deletes the user again — so it leaves the database as it found it.

Why it exists: the unit suites mock the LLM with clean JSON, so they stayed green
while the real pipeline was broken. This script found two bugs the tests could not:
nginx rejecting any photo over ~750 KB with a 413, and small hosted models' JSON
(literal newlines inside strings) turning every analysis into a 422. It is also a
ready-made demo of the AI modules for the peer evaluation.

It deliberately goes through nginx over HTTPS on 8443 — not the gateway on 8001 —
and verifies TLS for real, using nginx's own self-signed certificate as the trust
anchor. That exercises the body-size limit, the read timeout and the certificate's
subjectAltName along with the application code.

Standard library only: runs with any python3 on the host, no venv needed.
Requires the stack to be up (`make up`), including classification-service and a
MISTRAL_API_KEY in the root .env. Exits non-zero if any image fails.
"""
import argparse
import base64
import http.cookiejar
import json
import os
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_IMAGES = [
    os.path.join(REPO_ROOT, "scripts/jupyter/test_data", name)
    for name in ("golden_retriever_1.jpg",                      # purebred dog
                 "german_shepherd_golder_retriever_1.jpg",      # crossbreed
                 "micio_1.jpeg")                                # cat
]
NGINX_CONTAINER = "ft_transcendence_nginx"
NGINX_CERT = "/etc/nginx/ssl/selfsigned.crt"


def extract_nginx_cert() -> str:
    """Copy nginx's self-signed certificate out of the container.

    It is regenerated every time the container starts, so it cannot be stored in
    the repo — it has to be read from the running container.
    """
    fd, path = tempfile.mkstemp(prefix="nginx-ca-", suffix=".crt")
    os.close(fd)
    try:
        subprocess.run(["docker", "cp", f"{NGINX_CONTAINER}:{NGINX_CERT}", path],
                       check=True, capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError) as e:
        detail = getattr(e, "stderr", "") or str(e)
        sys.exit(f"Could not read the nginx certificate ({detail.strip()}).\n"
                 f"Is the stack up? Or pass one explicitly with --ca.")
    return path


class Client:
    """Minimal JSON-over-HTTPS client that keeps cookies, like a browser tab."""

    def __init__(self, base: str, ca_file: str):
        self.base = base.rstrip("/")
        ctx = ssl.create_default_context(cafile=ca_file)
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ctx),
            urllib.request.HTTPCookieProcessor(self.cookies))

    def call(self, method: str, path: str, body=None, timeout: int = 320):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        try:
            with self.opener.open(req, timeout=timeout) as resp:
                raw = resp.read()
                return resp.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, raw.decode(errors="replace")[:300]


def error_of(body) -> str:
    """Pull the error out of either envelope shape the API returns.

    Most errors are {"success": false, "error": {...}}, but the vision route raises
    HTTPException, which FastAPI wraps as {"detail": {"success": false, "error": {...}}}.
    """
    if not isinstance(body, dict):
        return str(body)
    inner = body.get("detail") if isinstance(body.get("detail"), dict) else body
    err = inner.get("error") or inner.get("detail") or inner
    return json.dumps(err)[:300]


def analyse(client: Client, path: str) -> bool:
    raw = open(path, "rb").read()
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    uri = f"data:{mime};base64," + base64.b64encode(raw).decode()

    started = time.time()
    status, body = client.call("POST", "/api/v1/vision/analyze", {"image": uri})
    elapsed = time.time() - started

    print(f"\n=== {os.path.basename(path)}  ({len(raw) // 1024} KB)  "
          f"HTTP {status}  {elapsed:.1f}s ===")
    if status != 200 or not (isinstance(body, dict) and body.get("success")):
        print(f"  FAILED: {error_of(body)}")
        return False

    d = body["data"]
    breed = d.get("breed_analysis") or {}
    kind = "crossbreed" if breed.get("is_likely_crossbreed") else "purebred"
    description = (d.get("description") or "").strip()
    print(f"  species:      {d.get('species')}")
    print(f"  breed:        {breed.get('primary_breed')}  "
          f"(confidence {breed.get('confidence')}, {kind})")
    print(f"  description:  {description[:240]}{'…' if len(description) > 240 else ''}")
    print(f"  traits:       {d.get('traits')}")
    for obs in d.get("health_observations") or []:
        print(f"  health:       {obs}")
    print(f"  RAG context:  {'used' if d.get('enriched_info') else 'none'}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("images", nargs="*", default=DEFAULT_IMAGES,
                        help="images to analyse (default: the three bundled test images)")
    parser.add_argument("--base", default="https://localhost:8443",
                        help="application URL (default: %(default)s)")
    parser.add_argument("--ca", help="CA/certificate to trust (default: read from the nginx container)")
    args = parser.parse_args()

    ca_file = args.ca or extract_nginx_cert()
    client = Client(args.base, ca_file)
    email = f"e2e-{uuid.uuid4().hex[:10]}@example.com"
    password = "E2e-Test-Pass-123!"

    status, body = client.call("POST", "/api/v1/auth/register", {
        "email": email, "password": password, "password_confirm": password,
        "first_name": "E2E", "last_name": "Vision"})
    print(f"register:  HTTP {status}")
    if status != 201:
        print(f"  {error_of(body)}")
        return 1
    status, body = client.call("POST", "/api/v1/auth/login", {"email": email, "password": password})
    print(f"login:     HTTP {status}  (cookies: {sorted(c.name for c in client.cookies)})")
    if status != 200:
        print(f"  {error_of(body)}")
        return 1

    results = []
    try:
        for path in args.images:
            results.append(analyse(client, path))
    finally:
        status, _ = client.call("DELETE", "/api/v1/auth/delete")
        print(f"\ncleanup:   HTTP {status}  (throwaway user deleted)")
        if not args.ca:
            os.unlink(ca_file)

    passed = sum(results)
    print(f"\n{passed}/{len(results)} images analysed successfully")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
