# smartbreeds.

AI-powered pet insights. One photo of your pet and the AI tells you its breed,
traits and health notes, then suggests products that suit it best.

## Features

- Photo analysis in a chat: breed (crossbreeds included), traits and visible health notes, with
  optional notes for the AI
- Pet profiles with photo, age, weight and health conditions, plus their analysis history
- Product recommendations matched to each pet
- Available in Italian, English and Japanese
- Light and dark theme, responsive down to mobile

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4 + Radix UI
- React Router v7
- TanStack Query + Zustand
- React Hook Form + Zod
- ky
- i18next

## Getting started

```bash
pnpm install
pnpm dev
```

The dev server proxies `/api` to the backend at `https://localhost:8443`, so start the stack first.

enjoy.

<p>
  <img src="screenshots/analyze.png" alt="Analysis chat" width="720" />
</p>
<p>
  <img src="screenshots/dashboard.png" alt="Dashboard" width="720" />
</p>
<p>
  <img src="screenshots/not-found.png" alt="Page not found" width="720" />
</p>
