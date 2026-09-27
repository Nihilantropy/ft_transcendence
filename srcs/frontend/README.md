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
