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
