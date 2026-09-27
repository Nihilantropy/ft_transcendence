import time

import httpx
from axe_playwright_python.sync_playwright import Axe

PASSWORD = "Gate-Test-Pass-123"
_AXE = Axe()
WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]


def axe_scan(page):
    """axe-core violations (WCAG 2.1 A/AA) on the current page, as a list of rule dicts."""
    result = _AXE.run(page, options={"runOnly": {"type": "tag", "values": WCAG_TAGS}})
    return result.response["violations"]


def describe_violations(violations):
    return "\n".join(f"{v['id']}: {v['help']} -> {[n['target'] for n in v['nodes']][:5]}" for v in violations)


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
            # The gateway sends Redis TTL, which is -2/-1 if the key expired meanwhile; an
            # HTTP-date or missing header falls back to 5 s.
            after = resp.headers.get("Retry-After", "")
            time.sleep(max(1, int(after)) if after.lstrip("-").isdigit() else 5)
        return resp


def ok(resp, status=200):
    assert resp.status_code == status, (
        f"{resp.request.method} {resp.request.url.path} -> {resp.status_code}: {resp.text[:500]}")
    return resp.json() if resp.content else None


def retry_429(request_fn, tries=12):
    """Same retry as Client.send above, for Playwright's APIRequestContext (tests/e2e/ui/*), which
    has no client-level hook to install it on. request_fn is a zero-arg callable making one call
    (e.g. `lambda: req.delete(url)`); returns the final APIResponse."""
    for _ in range(tries):
        resp = request_fn()
        if resp.status != 429:
            return resp
        after = resp.headers.get("retry-after", "")
        time.sleep(max(1, int(after)) if after.lstrip("-").isdigit() else 5)
    return resp
