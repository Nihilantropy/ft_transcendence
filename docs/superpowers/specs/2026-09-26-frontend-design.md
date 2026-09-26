# Frontend design — SmartBreeds web app

Date: 2026-09-26
Status: **spec reviewed 2026-09-26** (findings folded in below). Next: `superpowers:writing-plans`,
then implement. No frontend code exists yet.

## Handoff — start here

- Backend prerequisites are **done and on `main`** (#26 catalog + unknown age/weight + admin role,
  #27 logout, #28 gateway identity headers / access-token-only). Recommendations return real
  products; logout really ends the session.
- Every PR must pass `make gate` (unit + integration + e2e on the live stack; see `tests/README.md`).
  The frontend PR therefore needs the Playwright e2e tests described below.
- The stack was left running (`make up`); `https://localhost:8443` serves the API.
- Open PRs from teammates, not blocking the frontend: #12 (2FA — needs e2e tests, rebase; will
  conflict with #28 in `srcs/api-gateway/auth/jwt_utils.py`), #20 (`image_url` on pet create —
  needs tests and URL-scheme validation).

## Goal

A web app that is clean, minimal, very easy to use, with a warm animal theme, covering the core
journey: **upload a photo → learn breed and health notes → save it as my pet → see recommended food.**

It also satisfies subject requirements that reject the project if missing: a frontend exists,
Privacy Policy and Terms of Service pages, works on the latest stable Chrome, all traffic over
HTTPS through nginx.

## Decisions

| Question | Decision |
|---|---|
| Visual character | Warm and friendly: minimal structure, affectionate details |
| Information architecture | Photo-first. Landing (logged out); logged in: **Analyze** (home) / **My pets** / **Profile** |
| Pet photos | Not stored in the MVP. Pet cards show a species line illustration. Upload = separate later PR |
| Languages | IT + EN + ES from day one (three languages, for the subject's "multiple languages" module — verify its wording), strings in JSON dictionaries, IT default, language in `localStorage` only; the chosen language is always passed to the vision API. Backend: add `"es": "Spanish"` to `LANGUAGE_NAMES` (`srcs/ai/src/services/ollama_client.py:10`) and `"es"` to the `language` `Literal` (`srcs/ai/src/routes/vision.py:18`), plus one test |
| Stack | React + Vite + TypeScript + Tailwind, static SPA served by nginx, same origin as the API |
| E2E | Playwright in the gate |

## Visual system

- Palette: cream `#FBF6EF` background, terracotta `#C8664A` accent (primary buttons, links), sage
  `#7A9E7E` success / health notes, dark brown `#3B2F2A` text. Dark theme: deep brown + muted cream.
- Type: Nunito, **self-hosted** (`@fontsource/nunito`, no Google Fonts request: strict CSP, simpler
  Privacy Policy), two sizes only (title / body).
- Shapes: 16–24 px radii, faint shadows, generous whitespace.
- Illustrations: six thin-line inline SVGs — dog, cat, waiting (sniffing), empty (kennel), error
  (puzzled), success (wagging tail).
- Mobile-first; nav bar at the bottom on mobile, top on desktop.

## Screens

- **Landing** (logged out): one headline ("Discover your pet's breed from a photo"), illustration,
  Register / Log in, footer with Privacy · Terms · IT/EN/ES.
- **Log in / Register**: one column, field-level errors.
- **Analyze** (home):
  - big dashed drop zone "Drag or take a photo" (`capture` on mobile)
  - preview → waiting state with the sniffing animal and rotating lines ("Looking at the ears…"),
    5–60 s
  - result card: breed + confidence bar, "likely crossbreed" badge, description, traits as chips,
    health notes in sage
  - actions: **Save as my pet** (small modal asks the name), **Analyze another photo**
  - API errors become friendly copy, e.g. `UNSUPPORTED_SPECIES` → "For now I only recognise dogs
    and cats 🐾"
- **My pets**: grid of cards (species illustration, name, breed); empty state invites the first
  analysis. **Pet detail**: editable age / weight / health conditions + "Recommended food".
- **Profile**: language, change password, delete account (double confirmation), log out.
- **Privacy / Terms**: static SPA routes, reachable logged out.

## Code structure (`srcs/frontend/`)

```
src/
  api.ts          # fetch wrapper: same-origin, credentials; unwraps {success,data,error};
                  # throws ApiError(code, message, details)
  auth.tsx        # AuthContext: verify on start; login / register / logout
  i18n.ts         # t() hook + it.json / en.json / es.json; language in localStorage
  pages/          # Landing, Login, Register, Analyze, Pets, PetDetail, Profile, Privacy, Terms
  components/     # Button, Card, Field, Dropzone, Illustration, NavBar
```

No `Dockerfile` in `srcs/frontend/`: nginx builds it (see Serving). Delete the 0-byte placeholders.

Dependencies: `react`, `react-router`, `tailwindcss`, `@fontsource/nunito`. No component library, no global store.

## Data flow (all paths are same-origin `/api/v1/...`)

- **Session**: on start `GET /auth/verify`. On 401 → one `POST /auth/refresh` → retry once; if
  refresh fails the user is logged out. Any 401 mid-session takes the same path. `api.ts` keeps a
  **single in-flight refresh promise** (parallel 401s, e.g. pet detail + recommendations, share it);
  a 401 from `/auth/refresh` itself logs out, never retries.
- **Analyze**: resize in the browser (long side 1600 px, JPEG 0.85) to stay under nginx's 8 MB
  body limit (base64 inflates ~1.33×) → `POST /vision/analyze {image: dataURL, language}`,
  client timeout 300 s (nginx and gateway allow 300 s).
- **Save as my pet**: `POST /pets {name, species, breed: breed_analysis.primary_breed}` (`breed` is
  `max_length=100`, so never a composed crossbreed string) then `PATCH /pets/{id} {breed_confidence}`
  (`breed_confidence` is ignored on create by design).
- **Pet detail**: `GET /pets/{id}` + `GET /recommendations/food?pet_id=…&limit=6`.
- **Profile**: `PUT /auth/change-password`, `DELETE /auth/delete`, `POST /auth/logout` (public at
  the gateway since #27, works with an expired access token).
- Cookies are HttpOnly, SameSite=Strict, same origin: no CORS, no token handling in JS.
- Set `COOKIE_SECURE=True` in `srcs/auth-service/.env` and `.env.example` (today `False`). The Vite
  dev loop on `http://localhost` still works: Chrome treats localhost as a secure context.

## Errors

- One `code → message` table per language in `it.json` / `en.json`: `UNSUPPORTED_SPECIES`,
  `CONTENT_POLICY_VIOLATION`, `SPECIES_DETECTION_FAILED`, `BREED_DETECTION_FAILED`,
  `INVALID_IMAGE_FORMAT`, `IMAGE_TOO_LARGE`, `IMAGE_TOO_SMALL`, `INVALID_CREDENTIALS`,
  `EMAIL_ALREADY_EXISTS`, `RATE_LIMIT_EXCEEDED`, `VALIDATION_ERROR`, `VISION_SERVICE_UNAVAILABLE`,
  `INTERNAL_ERROR`, …
- Unknown code → "Something went wrong, try again" + the error illustration.
- Network failure → non-blocking banner.
- `VALIDATION_ERROR.details` → messages under the matching form fields.
- The vision route wraps errors as `{"detail": {"success": false, "error": {...}}}` (FastAPI
  HTTPException); `api.ts` must unwrap both shapes (see `error_of` in `scripts/e2e-vision.py`).
- **Non-JSON bodies**: nginx answers 413 (body > 8 MB), 502/504 and its `50x.html` page as HTML.
  `api.ts` must not assume JSON: map by status (413 → `IMAGE_TOO_LARGE`, else generic).

## Serving

- nginx Dockerfile becomes multi-stage: `FROM node:22 AS web` builds the frontend, the runner copies
  `dist/` to `/usr/share/nginx/html`. nginx's build context is `./srcs/nginx`, so compose adds
  `additional_contexts: {frontend: ./srcs/frontend}` and the stage uses `COPY --from=frontend`.
- `location /` → `try_files $uri /index.html` (replaces today's hardcoded JSON blob);
  `/api` unchanged.
- Enable the commented-out CSP (`default.conf.template:154`), tightened for a built SPA:
  `script-src 'self'` (no `unsafe-eval`), `font-src 'self'`, `img-src 'self' data: blob:`,
  `connect-src 'self'`. Beware nginx `add_header` inheritance: a location that declares its own
  `add_header` drops every server-level one, so the security headers must be repeated there (or
  moved into an include).
- Remove the commented-out `frontend` service in `docker-compose.yml`.
- Dev loop: `npm run dev` with a Vite proxy `/api` → `https://localhost:8443` (`secure: false`),
  so the browser still sees one origin.

## Tests (gate)

- `tests/e2e/ui/` with Playwright. **One tester, not a new service**: `tests/Dockerfile` switches its
  base to `mcr.microsoft.com/playwright/python` (keep the non-root uid 1000 user), so `make gate`
  is unchanged. Against `https://nginx` with `ignore_https_errors=True` — Chromium does not take a
  CA file the way httpx does; TLS verification stays covered by the API e2e suite.
- Flows: register → lands on Analyze; analyze `golden_retriever_1.jpg` → breed visible; save as my
  pet → pet in the list → recommended products visible; log out → `/pets` redirects to landing.
- Privacy and Terms reachable logged out.
- Throwaway users as in the API suite (`gate-…@example.com`), deleted in teardown.
- Language: switch to ES → UI strings change and the analysis is requested with `language: "es"`.

## Known backend limits (accepted for the MVP)

- Analysis history is not persisted: the vision service is stateless and `/api/v1/analyses` is not
  routed by the gateway (ROADMAP GW-02 / USER-01). The pet detail shows no history.
- Only food recommendations exist (`/recommendations/food`).
- No photo upload / storage.

## Out of scope for this spec (separate brainstorms)

- LLM streaming (subject LLM module requires it; would change the Analyze waiting state).
- Recommendation feedback loop (subject recommendation module; would add like/dislike on products).
- 2FA UI (after #12 lands).
