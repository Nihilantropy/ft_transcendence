# Merge gate: integration + e2e tests before every merge

Date: 2026-09-26
Status: approved design, pending implementation plan

## Goal

No PR is merged into `develop` or `main` unless the full test gate is green: unit tests,
integration tests and end-to-end tests, run against the real stack. Unit tests alone mock the
LLM, the network and the other services, and have stayed green while the real pipeline was
broken (see the docstring of `scripts/e2e-vision.py`).

The mechanism must be simple (one command) and scalable (a new feature adds a test file and
nothing else).

## Decisions

| Question | Decision |
|---|---|
| Who enforces the gate | Local only. `make gate` is run before merging; its summary is pasted into the PR. No CI for now. |
| Test format | One pytest suite in `tests/` at the repo root, run in a throwaway `tester` container. Jupyter notebooks stay as demos, outside the gate. |
| Merge rule | `make gate` green. Whether a PR needs new tests is decided by the reviewers, not by tooling. |
| Stack | The running dev stack. Tests use unique throwaway users and delete them in teardown. |
| First delivery scope | Infrastructure + `test_vision` (port of `e2e-vision.py`) + auth and user smoke tests + existing recommendation integration tests wired in. 2FA and `image_url` tests belong to PRs #12 and #20. |

## Layout

```
tests/
  Dockerfile            # python:3.12-slim + pytest + httpx
  requirements.txt
  README.md             # how to add a test
  conftest.py           # fixtures: gw, edge, user; helper ok()
  integration/          # through the gateway: http://api-gateway:8001
    test_auth.py        # register → login → verify → logout → delete
    test_user.py        # profile + pet CRUD
  e2e/                  # through nginx over real TLS: https://nginx
    test_vision.py      # port of scripts/e2e-vision.py
.github/pull_request_template.md
```

- `integration/` = one real service reached through the gateway (auth, routing, headers applied).
- `e2e/` = a user flow through nginx over HTTPS, exactly the path the frontend will use.

## Components

### `tester` compose service

- Compose profile `test`: `make up` never starts it.
- Networks: `backend-network` (gateway) and `proxy` (nginx).
- `./tests` bind-mounted: adding or editing a test needs no rebuild.
- Mounts the `nginx-ssl` volume read-only.
- Run: `docker compose --profile test run --rm tester [pytest args]`. It joins the networks of the
  already-running stack, so service hostnames resolve (to be confirmed on the first run).

### TLS, verified for real

The e2e tests verify nginx's certificate instead of disabling verification. Two changes:

1. `srcs/nginx/docker-entrypoint.sh:31`: add `DNS:nginx` to the subjectAltName, so the
   certificate is valid for the hostname the tester uses.
2. A named volume `nginx-ssl` on `/etc/nginx/ssl`: read-write in nginx, read-only in the tester.
   nginx regenerates the certificate on every start; the tester always reads the current one and
   uses it as the trust anchor.

### Fixtures (`tests/conftest.py`)

- `gw`: `httpx.Client` on `http://api-gateway:8001`.
- `edge`: `httpx.Client` on `https://nginx`, `verify=` the certificate from `nginx-ssl`.
- Both retry HTTP 429 honouring `Retry-After`. The nginx limit (200 r/m per IP, burst 20) is not
  relaxed for tests; the gate tests the real configuration. Marked with a `ponytail:` comment:
  retrying keeps a growing suite green at the cost of wall-clock time.
- `user(client)`: registers `gate-<uuid4>@example.com` with a fixed password, logs in, yields
  `{"client", "email", "password"}` with cookies set. Teardown calls
  `DELETE /api/v1/auth/delete`, which cascades to tokens, profile, pets and analyses
  (`srcs/auth-service/apps/authentication/views.py:348`). If that returns 401 (the test logged
  out, changed password or enabled 2FA), teardown logs in again with `user["password"]` and
  retries. A test that changes the password updates `user["password"]`. Teardown runs on failure
  too (`yield` fixture).
- Session fixture: checks `/health` of gateway and nginx once; if either is down, the run fails
  immediately with a clear message instead of one error per test.
- Helper `ok(resp, status)`: asserts the status and includes the response body in the failure
  message, so a failure shows the service's error `code`.

### `make gate`

Runs in order, stopping at the first failure:

1. `make up` + `make migration` + `make superuser` (idempotent)
2. unit tests: `scripts/run-unit-tests.sh`
3. `make test-integration`: the 23 recommendation-service integration tests, left in place
4. `tester`: `tests/integration` + `tests/e2e`
5. prints a summary block to paste into the PR

### PR template

`.github/pull_request_template.md` with a required "make gate output" section and a short
description section.

## Error handling

- Stack unhealthy → session fixture fails the run up front.
- HTTP failures → `ok()` shows status and body.
- Vision: client timeout 320 s (nginx and gateway allow 300 s). A Mistral 429 that survives
  LiteLLM's fallback fails the test; it is never skipped. A red gate is the correct answer.
- An interrupted run can leave `gate-*` users behind. Harmless (unique emails), and visible with
  a query on `auth_schema.users`.

## Adding a test

1. Create a file in `tests/integration/` (gateway) or `tests/e2e/` (nginx, user flow).
2. Use the `user` fixture: no fixed accounts, no manual cleanup.
3. Run `make gate`, or one file with
   `docker compose --profile test run --rm tester pytest tests/e2e/test_x.py`.

No rebuild, no new make target, no registration anywhere.

## Documentation updates

- Root `CLAUDE.md`, Testing section: the gate, the `tests/` suite, the `tester` service.
- `scripts/jupyter/README.md`: one line saying notebooks are not part of the gate.
- Project memory "PR flow": branch from develop → `make gate` → PR with gate output → review → merge.

## Out of scope

- CI (GitHub Actions). `make gate` is the single entry point, so CI can call it later.
- Porting the Jupyter notebooks.
- Moving recommendation-service's integration tests into `tests/`.
- Automatic checks that a PR added tests.
- An isolated stack with fresh volumes.

## Acceptance

- `make gate` green on a clean `develop`.
- A deliberately broken test makes `make gate` exit non-zero.
- After a run, no `gate-*` users remain in `auth_schema.users`.
