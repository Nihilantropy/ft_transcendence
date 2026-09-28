# Merge Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command, `make gate`, that runs unit + integration + e2e tests against the real running stack and must be green before any merge.

**Architecture:** A pytest suite in `tests/` at the repo root runs inside a throwaway `tester` container (compose profile `test`) that sits on both docker networks: `tests/integration/` talks to the gateway over HTTP, `tests/e2e/` talks to nginx over HTTPS verifying nginx's real certificate (shared through a named volume). A `user` fixture creates a unique throwaway account per test and deletes it in teardown.

**Tech Stack:** Python 3.12, pytest 8.3.4, httpx 0.28.1, Docker Compose, GNU make.

**Spec:** `docs/superpowers/specs/2026-09-26-merge-gate-design.md`

## Global Constraints

- Gate is local only: `make gate`; no CI.
- Merge rule: `make gate` green. No tooling checks whether a PR added tests.
- Runs on the dev stack; every test user is `gate-<hex>@example.com` and is deleted in teardown.
- e2e verifies TLS for real — never `verify=False`.
- No rate-limit exemptions for the tester; 429s are retried honouring `Retry-After`.
- Notebooks (`scripts/jupyter/`) and `scripts/e2e-vision.py` / `make e2e` stay untouched and are not part of the gate.
- recommendation-service integration tests stay in `srcs/recommendation-service/tests/integration/`; the gate calls `scripts/run-integration-tests.sh`.
- Adding a test = adding a file under `tests/integration/` or `tests/e2e/`; no rebuild, no registration.

## Review Focus

1. **Stack still booting when the gate starts** (classification-service has a 300 s `start_period`) → gate must wait for healthchecks, not fail on the first vision call. Pinned in Task 4 (`up -d --wait`).
2. **A test that invalidates its own session** (logout, delete, password change) → teardown must still remove the user, or recognise it is already gone, without erroring. Pinned in Task 2 (`test_logout_then_login_again`, `test_delete_account`).
3. **Stack down / wrong network** → one clear failure, not N connection errors. Pinned in Task 2 (session `stack_up` fixture, checked by running the tester with the stack stopped).
4. **nginx restarted between runs** (certificate regenerated) → e2e must trust the new certificate without manual steps. Pinned in Task 1 (shared volume) and Task 3 (restart nginx, rerun e2e).
5. **Gate exit code** → any failing stage must make `make gate` exit non-zero. Pinned in Task 5 (deliberately broken test).

---

### Task 1: nginx certificate valid for `nginx` and shared via volume

**Files:**
- Modify: `srcs/nginx/docker-entrypoint.sh:31`
- Modify: `docker-compose.yml` (nginx service `volumes:`; top-level `volumes:` block at ~line 520)

**Interfaces:**
- Produces: named volume `nginx-ssl` containing `selfsigned.crt` whose SAN includes `DNS:nginx`.

- [ ] **Step 1: Check current state (expected to fail)**

Run: `docker exec ft_transcendence_nginx openssl x509 -noout -ext subjectAltName -in /etc/nginx/ssl/selfsigned.crt`
Expected: SAN lists `ft-transcendence.local, localhost, 127.0.0.1` — no `nginx`.

- [ ] **Step 2: Add `DNS:nginx` to the SAN**

In `srcs/nginx/docker-entrypoint.sh` replace the `-addext` line with:

```sh
    -addext "subjectAltName=DNS:${HOST_DOMAIN},DNS:localhost,DNS:nginx,IP:127.0.0.1"
```

and append to the comment block above it (after the line ending `certificate could not be verified by a test client either.`):

```sh
# DNS:nginx is for the `tester` container (make gate), which reaches nginx by its
# compose service name and verifies this certificate from the nginx-ssl volume.
```

- [ ] **Step 3: Share `/etc/nginx/ssl` through a named volume**

In `docker-compose.yml`, nginx service, add after `env_file:`:

```yaml
    volumes:
      # Shared read-only with the `tester` service (make gate), which uses the
      # certificate as its trust anchor. Regenerated on every nginx start.
      - nginx-ssl:/etc/nginx/ssl
```

In the top-level `volumes:` block add:

```yaml
  nginx-ssl:
    driver: local
```

Also add `$(PROJECT_NAME)_nginx-ssl` to `TRANSCENDENCE_VOLUMES` in `Makefile:28` so `make purge` removes it.

- [ ] **Step 4: Rebuild nginx and verify**

Run:
```bash
docker compose build nginx && docker compose up -d nginx
docker exec ft_transcendence_nginx openssl x509 -noout -ext subjectAltName -in /etc/nginx/ssl/selfsigned.crt
curl -sk https://localhost:8443/health
```
Expected: SAN contains `DNS:nginx`; curl prints `healthy`.

- [ ] **Step 5: Commit**

```bash
git add srcs/nginx/docker-entrypoint.sh docker-compose.yml Makefile
git commit -m "feat(nginx): add DNS:nginx to the cert SAN and share it via the nginx-ssl volume"
```

---

### Task 2: `tester` service, fixtures and auth integration tests

**Files:**
- Create: `tests/Dockerfile`, `tests/requirements.txt`, `tests/pytest.ini`, `tests/helpers.py`, `tests/conftest.py`, `tests/integration/test_auth.py`
- Modify: `docker-compose.yml` (new `tester` service)

**Interfaces:**
- Consumes: `nginx-ssl` volume (Task 1).
- Produces (used by Tasks 3-4):
  - `helpers.ok(resp: httpx.Response, status: int = 200) -> dict | None` — asserts status, returns parsed JSON; failure message includes method, path, status and body.
  - `helpers.PASSWORD: str`
  - fixtures `gw` / `edge` → `helpers.Client` (httpx.Client subclass retrying 429) on `http://api-gateway:8001` / `https://nginx`.
  - fixtures `gw_user` / `edge_user` → `{"client": Client, "email": str, "password": str}`, registered and logged in (cookies set), deleted in teardown.
  - Run command: `docker compose --profile test run --rm tester [pytest args]`.

- [ ] **Step 1: Write the failing test**

`tests/integration/test_auth.py`:

```python
"""Auth flows through the API gateway (real auth-service, real DB, real JWT)."""
from helpers import ok


def test_register_gives_a_valid_session(gw_user):
    body = ok(gw_user["client"].get("/api/v1/auth/verify"))
    assert body["data"]["user"]["email"] == gw_user["email"]


def test_logout_then_login_again(gw_user):
    c = gw_user["client"]
    ok(c.post("/api/v1/auth/logout"))
    assert c.get("/api/v1/auth/verify").status_code == 401
    body = ok(c.post("/api/v1/auth/login",
                     json={"email": gw_user["email"], "password": gw_user["password"]}))
    assert body["data"]["user"]["email"] == gw_user["email"]


def test_wrong_password_is_rejected(gw_user):
    resp = gw_user["client"].post("/api/v1/auth/login",
                                  json={"email": gw_user["email"], "password": "Wrong-Pass-999"})
    assert resp.status_code == 401, resp.text
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_protected_route_needs_a_session(gw):
    assert gw.get("/api/v1/users/me").status_code == 401


def test_delete_account(gw_user):
    c = gw_user["client"]
    ok(c.post("/api/v1/pets", json={"name": "Gate", "species": "dog"}), 201)
    body = ok(c.delete("/api/v1/auth/delete"))
    assert body["data"]["deleted"]["user_service"]["pets"] == 1
    resp = c.post("/api/v1/auth/login",
                  json={"email": gw_user["email"], "password": gw_user["password"]})
    assert resp.status_code == 401
```

- [ ] **Step 2: Add the `tester` service and image**

`tests/requirements.txt`:
```
pytest==8.3.4
httpx==0.28.1
```

`tests/Dockerfile`:
```dockerfile
FROM python:3.12-slim
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
# Non-root: the nginx-ssl volume also holds the private key (mode 600, root) — keep it unreadable.
RUN useradd -u 1000 -m tester
USER tester
WORKDIR /tests
CMD ["pytest"]
```

`tests/pytest.ini`:
```ini
[pytest]
testpaths = integration e2e
pythonpath = .
# tests/ is mounted read-only
addopts = -ra -p no:cacheprovider
```

In `docker-compose.yml`, add after the api-gateway service:

```yaml
  ### TESTER (make gate) ###
  # Integration + e2e suite in tests/. Profile `test`: never started by `make up`.
  # Run: docker compose --profile test run --rm tester [pytest args]
  tester:
    build:
      context: ./tests
    profiles: ["test"]
    volumes:
      - ./tests:/tests:ro
      - ./scripts/jupyter/test_data:/test_data:ro
      - nginx-ssl:/nginx-ssl:ro
    networks:
      - backend-network  # api-gateway:8001 (integration)
      - proxy            # nginx:443 (e2e)
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `docker compose --profile test run --rm --build tester pytest integration/test_auth.py`
Expected: ERROR — `fixture 'gw_user' not found` (and `ModuleNotFoundError: helpers`).

- [ ] **Step 4: Write `helpers.py` and `conftest.py`**

`tests/helpers.py`:
```python
import time

import httpx

PASSWORD = "Gate-Test-Pass-123"


class Client(httpx.Client):
    # ponytail: retries 429 by sleeping Retry-After (default 5 s, 12 tries ≈ one gateway window).
    # Keeps a growing suite green against the real nginx (200 r/m, burst 20) and gateway
    # (60 r/m) limits at the cost of wall-clock time; exempting the tester would stop the gate
    # testing the real config. Revisit if gate runtime becomes a problem.
    def send(self, request, **kwargs):
        for _ in range(12):
            resp = super().send(request, **kwargs)
            if resp.status_code != 429:
                return resp
            resp.close()
            time.sleep(float(resp.headers.get("Retry-After", 5)))
        return resp


def ok(resp, status=200):
    assert resp.status_code == status, (
        f"{resp.request.method} {resp.request.url.path} -> {resp.status_code}: {resp.text[:500]}")
    return resp.json() if resp.content else None
```

`tests/conftest.py`:
```python
import os
import ssl
import uuid

import httpx
import pytest

from helpers import PASSWORD, Client, ok

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://api-gateway:8001")
EDGE_URL = os.environ.get("EDGE_URL", "https://nginx")
NGINX_CERT = os.environ.get("NGINX_CERT", "/nginx-ssl/selfsigned.crt")


def _tls():
    # nginx regenerates its self-signed cert on every start; trust exactly the current one.
    return ssl.create_default_context(cafile=NGINX_CERT)


@pytest.fixture(scope="session", autouse=True)
def stack_up():
    try:
        httpx.get(f"{GATEWAY_URL}/health", timeout=10).raise_for_status()
        httpx.get(f"{EDGE_URL}/health", verify=_tls(), timeout=10).raise_for_status()
    except (httpx.HTTPError, OSError) as e:
        pytest.exit(f"Stack not ready ({e!r}). Start it with `make up` (or run `make gate`).",
                    returncode=2)


@pytest.fixture
def gw():
    with Client(base_url=GATEWAY_URL, timeout=30) as c:
        yield c


@pytest.fixture
def edge():
    with Client(base_url=EDGE_URL, verify=_tls(), timeout=320) as c:
        yield c


def _throwaway_user(client):
    """Register a unique user (register already sets the session cookies), delete it after."""
    user = {"client": client, "email": f"gate-{uuid.uuid4().hex[:12]}@example.com",
            "password": PASSWORD}
    ok(client.post("/api/v1/auth/register", json={
        "email": user["email"], "password": PASSWORD, "password_confirm": PASSWORD}), 201)
    yield user
    resp = client.delete("/api/v1/auth/delete")
    if resp.status_code == 401:  # the test ended the session: log back in
        login = client.post("/api/v1/auth/login",
                            json={"email": user["email"], "password": user["password"]})
        if login.status_code == 401:  # the test already deleted the account
            return
        resp = client.delete("/api/v1/auth/delete")
    ok(resp)


@pytest.fixture
def gw_user(gw):
    yield from _throwaway_user(gw)


@pytest.fixture
def edge_user(edge):
    yield from _throwaway_user(edge)
```

A test that changes the password must set `user["password"] = new` so teardown can log back in.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `docker compose --profile test run --rm tester pytest integration/test_auth.py -v`
Expected: 5 passed. If cookies are not sent back over `http://api-gateway`, check `COOKIE_SECURE=False` and `COOKIE_DOMAIN=localhost` in `srcs/auth-service/.env`.

- [ ] **Step 6: Check the "stack down" path**

Run:
```bash
docker compose stop api-gateway
docker compose --profile test run --rm tester pytest integration/test_auth.py; echo "exit=$?"
docker compose start api-gateway
```
Expected: single line `Stack not ready (...)`, `exit=2`, no per-test errors.

- [ ] **Step 7: Check no users leaked**

Run: `docker exec ft_transcendence_db psql -U "$(docker exec ft_transcendence_db printenv POSTGRES_USER)" -d smartbreeds -tAc "select count(*) from auth_schema.users where email like 'gate-%'"`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add tests/ docker-compose.yml
git commit -m "test: add tester service, throwaway-user fixtures and auth integration tests"
```

---

### Task 3: user integration tests and vision e2e test

**Files:**
- Create: `tests/integration/test_user.py`, `tests/e2e/test_vision.py`

**Interfaces:**
- Consumes: `helpers.ok`, fixtures `gw_user`, `edge_user` (Task 2); images mounted at `/test_data` (Task 2 compose).

- [ ] **Step 1: Write `tests/integration/test_user.py`**

```python
"""user-service through the API gateway: profile and pet CRUD, ownership enforced."""
from helpers import ok


def test_profile_read_and_update(gw_user):
    c = gw_user["client"]
    ok(c.get("/api/v1/users/me"))
    body = ok(c.patch("/api/v1/users/me", json={"phone": "+39 333 1234567"}))
    assert body["data"]["phone"] == "+39 333 1234567"


def test_pet_crud(gw_user):
    c = gw_user["client"]
    pet = ok(c.post("/api/v1/pets", json={"name": "Gate", "species": "cat", "age": 3}), 201)["data"]
    assert [p["id"] for p in ok(c.get("/api/v1/pets"))["data"]] == [pet["id"]]
    assert ok(c.patch(f"/api/v1/pets/{pet['id']}", json={"weight": 4.2}))["data"]["weight"] == 4.2
    ok(c.delete(f"/api/v1/pets/{pet['id']}"))
    assert ok(c.get("/api/v1/pets"))["data"] == []


def test_pet_of_another_user_is_not_found(gw_user, edge_user):
    pet = ok(gw_user["client"].post("/api/v1/pets", json={"name": "Mine", "species": "dog"}), 201)
    resp = edge_user["client"].get(f"/api/v1/pets/{pet['data']['id']}")
    assert resp.status_code == 404, resp.text
```

(`edge_user` is simply a second, independent account here — via nginx, which also proves the two paths share one backend.)

- [ ] **Step 2: Run them**

Run: `docker compose --profile test run --rm tester pytest integration/test_user.py -v`
Expected: 3 passed. If `weight` comes back as a string, compare with `float(...)`. If the envelope differs from `{"data": ...}`, read the actual body in the `ok()` failure message and fix the test, not the service.

- [ ] **Step 3: Write `tests/e2e/test_vision.py`**

```python
"""Vision pipeline end to end, through nginx over verified HTTPS — the frontend's path.

Port of scripts/e2e-vision.py (which stays as a verbose demo). Needs the full stack:
classification-service, litellm and MISTRAL_API_KEY. A hosted-LLM 429 that survives
LiteLLM's fallback fails the test on purpose.
"""
import base64

import pytest

from helpers import ok

IMAGES = {
    "golden_retriever_1.jpg": "dog",                     # purebred
    "german_shepherd_golder_retriever_1.jpg": "dog",     # crossbreed
    "micio_1.jpeg": "cat",
}


@pytest.mark.parametrize("name,species", IMAGES.items())
def test_analyze(edge_user, name, species):
    with open(f"/test_data/{name}", "rb") as f:
        uri = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
    body = ok(edge_user["client"].post("/api/v1/vision/analyze", json={"image": uri}))
    data = body["data"]
    assert data["species"] == species
    assert data["breed_analysis"]["primary_breed"]
    assert data["description"].strip()
```

- [ ] **Step 4: Run it**

Run: `docker compose --profile test run --rm tester pytest e2e -v`
Expected: 3 passed (each call 2-60 s). If `species` casing differs (e.g. `Dog`), compare lowercased.

- [ ] **Step 5: Certificate survives an nginx restart**

Run:
```bash
docker compose restart nginx
docker compose --profile test run --rm tester pytest e2e -v -k golden
```
Expected: 1 passed (new certificate picked up from the volume).

- [ ] **Step 6: Commit**

```bash
git add tests/integration/test_user.py tests/e2e/test_vision.py
git commit -m "test: add user integration tests and vision e2e test"
```

---

### Task 4: `make gate`, PR template, docs

**Files:**
- Modify: `Makefile` (new `gate` target near `test-integration`, `.PHONY`)
- Create: `.github/pull_request_template.md`, `tests/README.md`
- Modify: `CLAUDE.md` (Essential Commands + Testing), `scripts/jupyter/README.md` (one line)

**Interfaces:**
- Consumes: `tester` service (Task 2), `scripts/run-unit-tests.sh`, `scripts/run-integration-tests.sh`, `scripts/run-migrations.sh`, `scripts/seed-db.sh`, `scripts/create-superuser.sh`.

- [ ] **Step 1: Add the target**

In `Makefile`, add `gate` to `.PHONY` and after `test-integration`:

```make
## gate: Merge gate — unit + integration + e2e on the running stack. Must be green before any merge;
##       paste the last lines into the PR.
gate:
	@echo "Starting the stack and waiting for healthchecks (classification can take ~5 min cold)..."
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) up -d --wait --wait-timeout 600
	@scripts/run-migrations.sh
	@scripts/seed-db.sh
	@scripts/create-superuser.sh
	@scripts/run-unit-tests.sh
	@scripts/run-integration-tests.sh
	@$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --profile test run --rm --build tester
	@echo ""
	@echo "✅ GATE PASSED — $$(git rev-parse --abbrev-ref HEAD) @ $$(git rev-parse --short HEAD)$$(git diff --quiet HEAD || echo ' (uncommitted changes)')"
```

Make stops at the first failing line, so any red stage makes `make gate` exit non-zero.

- [ ] **Step 2: PR template**

`.github/pull_request_template.md`:
```markdown
## What / why


## make gate
<!-- Required. Paste the final lines of `make gate` (must end with "✅ GATE PASSED" on this branch's HEAD).
     Reviewers decide whether this PR needed new tests in tests/integration or tests/e2e. -->
```

- [ ] **Step 3: `tests/README.md`**

```markdown
# Merge-gate suite

Integration and e2e tests against the real running stack. Run everything with `make gate`
(unit + recommendation integration + this suite); it must be green before any merge.

- `integration/` — one service through the gateway (`http://api-gateway:8001`).
- `e2e/` — a user flow through nginx over verified HTTPS (`https://nginx`).

## Add a test
1. Create `tests/integration/test_x.py` or `tests/e2e/test_x.py`.
2. Use the `gw_user` / `edge_user` fixture: a unique `gate-…@example.com` account, deleted after
   the test. Changing the password? Set `user["password"]` so teardown can log back in.
3. Assert with `helpers.ok(resp, status)` — failures show the response body.

No rebuild needed: `tests/` is bind-mounted. One file:
`docker compose --profile test run --rm tester pytest e2e/test_x.py -v`
```

- [ ] **Step 4: Docs**

- `CLAUDE.md` Essential Commands block: add `make gate          # Merge gate: unit + integration + e2e on the live stack — required before merging`.
- `CLAUDE.md` Testing section: a short paragraph "**Merge gate**" pointing at `tests/README.md`, the `tester` service (profile `test`, networks `backend-network` + `proxy`, `nginx-ssl` volume) and the rule "no merge without a green `make gate`; notebooks and unit tests alone do not count".
- `scripts/jupyter/README.md`, top: `> Not part of the merge gate — see tests/README.md and make gate.`

- [ ] **Step 5: Commit**

```bash
git add Makefile .github/pull_request_template.md tests/README.md CLAUDE.md scripts/jupyter/README.md
git commit -m "feat: add make gate (unit + integration + e2e) and PR template"
```

---

### Task 5: Acceptance

- [ ] **Step 1: Green run**

Run: `make gate; echo "exit=$?"`
Expected: ends with `✅ GATE PASSED — feat/merge-gate @ <sha>`, `exit=0`.

- [ ] **Step 2: Red run**

Temporarily add `tests/integration/test_zz_broken.py` containing `def test_broken(): assert False`, run `make gate; echo "exit=$?"`, expect `exit=2` (make) with the failure shown and no `GATE PASSED` line. Delete the file.

- [ ] **Step 3: No leaks**

Rerun the query from Task 2 Step 7. Expected: `0`.

- [ ] **Step 4: Memory**

Update memory `pr-flow-develop.md`: branch from develop → `make gate` green → PR with gate output → review (reviewers decide if new integration/e2e tests are needed) → merge → PR main → `make gate` → merge.
