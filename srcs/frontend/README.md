# SmartBreeds frontend

React + Vite + TypeScript + Tailwind SPA. Served in production by nginx (the nginx image builds it:
`srcs/nginx/Dockerfile`), same origin as the API.

- `npm install` — once.
- `npm run dev` — http://localhost:5173 with `/api` proxied to `https://localhost:8443`
  (the stack must be up: `make up`).
- `npm test` — Vitest (pure logic: `api.ts`, `i18n.tsx`, `image.ts`). Also runs in the nginx build.
- UI tests: Playwright in `tests/e2e/ui/`, run by `make gate`.

Strings live in `src/locales/{it,en,es}.json` — every file must have the same keys
(`i18n.test.ts` enforces it). A new language = one JSON file + one entry in `LANGS`.

## Accessibility & motion

- Every form uses `validation.ts` + `useForm` for client-side validation and translated field
  errors; backend field text is never rendered verbatim.
- `--field` (`index.css`) is the border color for form controls, chosen to hit ≥ 3:1 contrast
  against both `--card` and `--bg` in light and dark (covered by a contrast test).
- Illustrations (`Illustration.tsx`) animate via `ill-*` classes — CSS keyframes only, no JS/canvas.
  `useMotion` reflects the user's choice (or `prefers-reduced-motion`) as `data-motion` on `<html>`,
  which pauses every `ill-*` animation and the flying-cats sky.
  The line art is Tabler Icons (MIT); the notice lives at the top of `Illustration.tsx`.

## Two-factor authentication

- Log in has a second step when the account has 2FA on (`auth.tsx` `login()` returns `{ mfaToken }`;
  `loginWithCode()` finishes). `TOKEN_EXPIRED`/`INVALID_TOKEN` there send the user back to the password step.
- Profile → Two-factor authentication (`components/TwoFactorSection.tsx`): the QR is rendered in the
  browser by the `qrcode` package (MIT) into an SVG `data:` URI (CSP `img-src data:`); the key is also
  shown in groups of four with a Copy button. Recovery codes are shown once, with Copy, Download .txt
  (Blob, no server call) and a required "I've saved them" checkbox.
- Every 2FA input is `components/CodeField.tsx` (`kind`: `totp` | `recovery` | `any`), validated by
  `CODE_RULES` in `validation.ts`. A wrong code or the lockout is shown on the code field
  (`serverFieldKey`).
- Two forms with the same field names on one page: pass an id prefix, `useForm(schema, 'details')`,
  and `id={form.id('field')}` on each input (ids must stay unique for axe and for the error summary links).

## Log in with 42

- "Log in with 42" on Log in and Register is a plain `<a href="/api/v1/auth/oauth/42/start">`: the browser
  itself follows auth-service's redirects to the intra and back (fetch could not).
- Returns are read once by `src/oauth.ts`: `/analyze?oauth=ok` makes `auth.tsx` call `/auth/verify` even
  without the `session` hint; `/login?oauth=error|unavailable|exists` shows `error.OAUTH_FAILED` /
  `error.OAUTH_UNAVAILABLE` / `error.OAUTH_EXISTS` (an intra email already belongs to a local account that
  has a password — no auto-link, log in with the password instead); `/login?oauth=mfa#<token>` opens the
  2FA code step with that challenge. The marker and the fragment are then removed from the address bar
  with a replace navigation.
- `user.has_password === false` (account created with 42): Profile shows "Set a password" (no current
  password), a read-only email with a hint, and "Set a password first" instead of turning 2FA on.
