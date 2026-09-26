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
