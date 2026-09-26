# Frontend round 2 (A) — WCAG 2.1 AA, QoL, validation, animated line art

Date: 2026-09-26
Status: **design agreed in brainstorming, spec awaiting review.** Builds on `feat/frontend` (PR #32);
branch `feat/frontend-a11y`.

This is sub-project **A** of three. B (2FA + profile editing, taking over PR #12) and C (OAuth 2.0
with 42 Intra) get their own specs. Password reset is out: the subject does not require it.

## Goal

Make the app warm, alive and fully accessible, and close the mandatory-part gaps, so that it can
claim the **Major "WCAG 2.1 AA accessibility"** module and keep the **Minor "multiple languages"**
module honest ("all user-facing text must be translatable").

## Subject requirements this spec answers

| Source (en.subject.pdf) | Requirement | Where |
|---|---|---|
| III.3 mandatory | "All forms and user inputs must be properly validated in both the frontend and backend" | §4 |
| III.3 mandatory | "A frontend that is clear, responsive, and accessible across all devices" | §5, §6 |
| IV.2 Major | "Complete accessibility compliance (WCAG 2.1 AA) with screen reader support, keyboard navigation, and assistive technologies" | §5, §7 |
| IV.2 Minor | "All user-facing text must be translatable" | §3 |

Constraints from the user: evaluation runs on Linux, possibly **without a GPU**; keep the stack
simple and minimal — no optimisation work beyond "cheap by construction". No multi-arch work.

## Decisions

| Question | Decision |
|---|---|
| Illustrations | **Tabler Icons** (MIT) line art, SVG paths copied inline into `Illustration.tsx` with the MIT notice; no npm dependency |
| Animation tech | CSS keyframes on inline SVG (transform/opacity only). No GIF, no Lottie, no JS animation, no canvas/WebGL |
| Background | "Flying cats": 5 Tabler cats with hand-drawn wings crossing the screen at different heights and speeds, flapping and bobbing; faint (≈0.2 opacity), behind all content |
| Motion control | Footer toggle "Pause animations / Resume animations" (WCAG 2.2.2), remembered in `localStorage`; starts paused under `prefers-reduced-motion: reduce` |
| a11y verification | axe-core in every Playwright UI test (autouse watchdog, WCAG 2.1 A + AA tags) + dedicated keyboard / reflow / dark-mode / motion tests + a token-contrast unit test |
| Backend field messages | Never rendered verbatim; mapped by field name to translated copy |
| Breed names | Stay as proper names in English (same convention in IT/ES) |

## 1. Line art and state animations

`components/Illustration.tsx` keeps its API (`name`, `className`) and gains the Tabler drawings.
Names: `dog`, `cat`, `waiting`, `empty`, `error`, `success`, plus `flyingCat` for the background.
Stroke width 1.25 at large sizes. The dog SVG is split into groups (`head`, `eyes`, `earL`, `earR`)
so parts can move.

| State | Where | Animation | Runs |
|---|---|---|---|
| hello | Landing | dog draws itself (stroke-dashoffset), ears flap, eyes blink | once |
| waiting | Analyze, while waiting | head sniffs, three paw prints walk underneath | loop while waiting (loading indicator) |
| success | "Salvato" / pet saved | hop + heart pops + sparkles | once |
| error | ErrorNote | head tilts, question mark bounces in | once |
| empty | My pets empty state | dog-bowl wobbles, a bone drops in | once |
| hover | pet cards | ears flap on `:hover` and `:focus-visible` | on interaction |

All keyframes live in `index.css`, animate only `transform`/`opacity`, and use Tailwind's
`motion-safe:` or the global pause rule (§2), so they stop under reduced motion.

## 2. Flying-cats background + pause control

- `components/Sky.tsx`: a fixed, full-viewport layer, `aria-hidden="true"`, `pointer-events: none`,
  `z-index: -1`, rendered once in `Layout`. Five `flyingCat` SVGs with per-cat top, size, duration
  (60–90 s to cross) and negative delay so the sky is populated on first paint. Wings flap
  (`rotate`), body bobs (`translateY`). Opacity ≈ 0.2 light / 0.25 dark; colour follows `--accent`.
- `motion.ts`: `useMotion()` → `{ paused, setPaused }`. Initial value: `localStorage['motion']`
  if set, else `matchMedia('(prefers-reduced-motion: reduce)').matches`. Writes wrapped in
  try/catch (same pattern as `i18n.tsx`). Sets `document.documentElement.dataset.motion =
  'paused' | 'running'`.
- CSS: `[data-motion="paused"] *, [data-motion="paused"] *::before { animation-play-state: paused !important }`.
  Pausing freezes every animation in the app, not only the sky (one control, predictable).
- Footer: a `<button aria-pressed>` "Ferma animazioni" / "Riprendi animazioni" next to the
  language select.

## 3. Everything translatable

- `match_reasons`: the three fixed recommender strings map to keys
  `reason.joint_health`, `reason.sensitive_stomach`, `reason.compatible`; an unknown string falls
  back to itself (no backend change).
- Page titles: `usePageTitle(key)` sets `document.title = "<page> · SmartBreeds"` in the current
  language, for every route.
- Backend field errors: `fieldError()` no longer returns backend text. A new
  `fieldMessage(e, field)` returns the translated key `field.<field>.invalid` if the field has a
  backend error (fallback `field.invalid`). Known backend-only rules get their own copy:
  `field.email.taken` (EMAIL_ALREADY_EXISTS), `field.password.similar` (password too similar to
  the email — only the backend can check it), `field.current_password.wrong`.
- Breed names stay English (proper names).

## 4. Frontend validation (mandatory)

`validation.ts` — pure functions returning an i18n key or `null`, unit-tested with Vitest:
`email`, `passwordRules` (≥ 8 chars, ≥ 1 letter, ≥ 1 digit — mirrors auth-service's
`MinimumLengthValidator(8)` + `PasswordValidator`), `matches`, `required`, `maxLength(100)`,
`intMin(0)` (age, months), `positive` (weight, kg).

Forms (Register, Log in, Change password, Save pet, Pet detail): validate on submit and on blur
after the first submit. When invalid, the request is **not** sent; an error summary
(`role="alert"`, list of links to the fields) appears above the button and focus moves to the
first invalid field. Fields get `aria-invalid` + `aria-describedby` (already in `Field`) and
`aria-required`. `noValidate` stays, so the browser's untranslated native bubbles never show.

## 5. QoL

- **Password reveal**: `PasswordField` wraps `Field` with a toggle button (eye / eye-off Tabler
  icons), `aria-pressed`, translated `aria-label` ("Mostra password" / "Nascondi password"), keeps
  the caret and focus, does not submit the form. Used by every password input.
- **Live requirements**: under new-password fields, a checklist (8 characters, a letter, a number)
  ticks as you type; `aria-live="polite"`, announced only when a rule changes state.
- **Caps Lock warning** on password fields (`getModifierState('CapsLock')`), `role="status"`.
- **Busy buttons**: submit buttons show a spinner + "…" label and `aria-busy` while the request
  runs, and are disabled against double submits.
- Profile buttons no longer stretch full width (`self-start`).

## 6. WCAG 2.1 AA checklist (what we build, criterion in brackets)

- Skip link "Vai al contenuto" as the first focusable element [2.4.1].
- Route change: focus moves to the page `h1` (`tabIndex={-1}`) and the title updates, so screen
  readers announce the new page [2.4.3, 2.4.2].
- Landmarks: `header` (nav), `main`, `footer`; `aria-current="page"` on the active nav link
  (NavLink default) [1.3.1].
- Dialog (Save pet): native `<dialog>`; focus returns to the opener on close [2.4.3].
- Live regions: waiting status, analysis result (focus to the result heading), "Salvato",
  password changed, errors (`role="alert"`) [4.1.3].
- Contrast: text ≥ 4.5:1 and UI component borders/focus ring ≥ 3:1 in both themes [1.4.3,
  1.4.11]. Today's input border `--line` (#E8DDD0 on #FFFFFF ≈ 1.3:1) fails: add a `--field`
  token for form-control borders, ≥ 3:1 against `--card`, and keep `--line` for decorative
  dividers only.
- Focus visible everywhere, including the file drop zone and the reveal toggle [2.4.7].
- Target size ≥ 24×24 px for icon buttons [2.5.8-aligned, cheap to meet].
- Reflow: no horizontal scroll at 320 CSS px; text resizes to 200% [1.4.10, 1.4.4].
- Images: the preview has alt text ("La tua foto"); illustrations stay `aria-hidden` [1.1.1].
- Motion: pause control + reduced-motion default [2.2.2, 2.3.3-aligned].
- `lang` on `<html>` follows the language [3.1.1] (already done).
- **Accessibility statement** page `/accessibility`, public, linked in the footer, in the three
  languages: conformance target (WCAG 2.1 AA), what was tested and how, known limitations
  (LLM-written descriptions, breed names in English), contact.

## 7. Tests

- **axe watchdog** (autouse, like the CSP one): after each UI test, run axe-core on the current
  page with tags `wcag2a, wcag2aa, wcag21a, wcag21aa`; any violation fails the test with the rule
  id and target. Added to the tester via `axe-playwright-python` (pip; bundles axe-core).
  Multi-page tests also scan at every `expect(page).to_have_url(...)` checkpoint they already have.
- **Dark mode**: axe on Landing, Analyze (result), Pet detail, Profile with
  `color_scheme="dark"`.
- **Keyboard journey**: register → analyze (drop zone focused and activated with Enter, file chosen
  via `expect_file_chooser`) → save pet (dialog, Esc returns focus) → pet detail, using only
  `keyboard.press`; plus skip-link test.
- **Reflow**: every public and logged-in page at 320×640 has
  `document.documentElement.scrollWidth <= 320`.
- **Motion**: the toggle sets `data-motion="paused"`, persists across reload, and is on by
  default with `reduced_motion="reduce"`.
- **Validation**: Vitest for every rule; Playwright: invalid register form sends **no** request
  (route spy), shows the summary, focuses the first invalid field; password reveal toggles
  `type`.
- **Contrast unit test** (Vitest): parses the tokens in `src/index.css` for both themes and
  asserts the pairs above (fg/bg, fg/card, card-on-accent, card-on-danger, accent/bg for links,
  field/card ≥ 3:1).
- Existing tests keep passing; selectors change only where copy changes.

## 8. Files (expected)

```
src/components/Illustration.tsx   # Tabler art, split groups, MIT notice
src/components/Sky.tsx            # flying cats background
src/components/PasswordField.tsx  # reveal toggle, caps lock, optional live rules
src/components/ErrorSummary.tsx   # form error summary
src/components/SkipLink.tsx
src/motion.ts                     # useMotion
src/validation.ts + validation.test.ts
src/contrast.test.ts
src/usePageTitle.ts
src/pages/Accessibility.tsx
src/locales/{it,en,es}.json       # new keys
src/index.css                     # keyframes, --field token, pause rule
tests/e2e/ui/conftest.py          # axe watchdog
tests/e2e/ui/test_ui_a11y.py      # keyboard, reflow, dark, motion, skip link
tests/requirements.txt            # + axe-playwright-python
```

## Out of scope

- 2FA UI and profile editing (B), OAuth (C), password reset (not in the subject).
- RTL, additional browsers, multi-arch/ARM images, performance tuning beyond transform/opacity.
- Translating LLM output beyond what the `language` parameter already does.
