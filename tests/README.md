# Merge-gate suite

Integration and e2e tests against the real running stack. Run everything with `make gate`
(unit + recommendation integration + this suite); it must be green before any merge.

- `integration/` — one service through the gateway (`http://api-gateway:8001`).
- `e2e/` — a user flow through nginx over verified HTTPS (`https://nginx`).
- 2FA: `helpers.totp(secret, step=1)` is the next valid TOTP (stdlib RFC 6238; a step is never
  accepted twice). Store `totp_secret` / `recovery_codes` on the fixture user when a test turns 2FA
  on; `pop()` a recovery code when you use one. The teardowns complete a 2FA
  login with what is left, so a test may end mid-login.

## Add a test
1. Create `tests/integration/test_x.py` or `tests/e2e/test_x.py`.
2. Use the `gw_user` / `edge_user` fixture: a unique `gate-…@example.com` account, deleted after
   the test. Changing the password? Set `user["password"]` so teardown can log back in.
3. Assert with `helpers.ok(resp, status)` — failures show the response body.

No rebuild needed for test files: `tests/` is bind-mounted. Changing `tests/requirements.txt`
or `tests/Dockerfile` needs `--build` when you run the tester directly (`make gate` always builds).
One file:
`docker compose --profile test run --rm tester pytest e2e/test_x.py -v`
