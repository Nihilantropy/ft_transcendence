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
            # The gateway sends Redis TTL, which is -2/-1 if the key expired meanwhile; an
            # HTTP-date or missing header falls back to 5 s.
            after = resp.headers.get("Retry-After", "")
            time.sleep(max(1, int(after)) if after.lstrip("-").isdigit() else 5)
        return resp


def ok(resp, status=200):
    assert resp.status_code == status, (
        f"{resp.request.method} {resp.request.url.path} -> {resp.status_code}: {resp.text[:500]}")
    return resp.json() if resp.content else None
