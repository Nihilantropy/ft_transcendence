# Frontend Development Roadmap

## 🎯 Overview
Simple step-by-step guide for developing the ft_transcendence frontend (Phase 2 from main RoadMap.md).

**Reference Documents**: See `/docs/frontend/` for detailed specifications.

**Goal**: TypeScript SPA with Tailwind CSS covering 5 minor modules.

---

## 📋 Development Phases

### Phase A: Foundation Setup (Day 1)
> **Goal**: Basic TypeScript architecture and Tailwind configuration

#### A1. Project Structure Setup
- [x] Create directory structure (`src/components/`, `src/pages/`, `src/services/`, etc.)
- [x] Configure TypeScript path mapping (`@/components`, `@/utils`, etc.)
- [x] Set up base CSS with Tailwind imports

*Reference: [TypeScript Project Structure](./docs/frontend/project-structure.md)*

#### A2. Tailwind Configuration
- [x] Create `tailwind.config.js` with custom theme
- [x] Add gaming color palette (matrix green, neon accents)
- [x] Set up component base classes (`.btn-base`, `.card`, `.input-base`)

*Reference: [Tailwind CSS Strategy](./docs/frontend/tailwindcss.md)*

#### A3. Base Component System
- [x] Implement `Component<TProps, TState>` base class
- [x] Create component lifecycle methods (`mount`, `unmount`, `render`)
- [x] Add event handling utilities

*Reference: [Frontend Architecture](./docs/frontend/architecture.md)*

---

### Phase B: Core Systems (Day 2)

#### B1. SPA Routing System
- [x] Create `Router` class using History API
- [x] Implement route registration and matching
- [x] Add browser back/forward button support
- [x] Set up basic route guards

*Reference: [Frontend Architecture - SPA Routing](./docs/frontend/architecture.md#spa-routing-system)*

#### B2. State Management
- [x] Implement `BaseStore<T>` with subscription system
- [x] Create app-specific stores (`AuthStore`, `GameStore`, `UIStore`)
- [x] Add state persistence for user preferences

*Reference: [Frontend Architecture - State Management](./docs/frontend/architecture.md#state-management-system)*

#### B3. Basic UI Components
- [x] Create `Button` component with variants
- [x] Implement `Modal` component
- [ ] Add `Form` input components
- [ ] Build `Navigation` component

*Reference: [TypeScript Project Structure - Components](./docs/frontend/project-structure.md#component-architecture)*

---

### Phase C: Internationalization (Day 2-3)

#### C1. i18n Core System
- [ ] Implement `I18n` class with translation loading
- [ ] Create translation file structure (`/locales/en.json`, `/locales/fr.json`)
- [ ] Add parameter interpolation (`{{player}}` syntax)

*Reference: [i18n Implementation Plan](./docs/frontend/i18n.md)*

#### C2. Language Support
- [ ] Complete English translations (base language)
- [ ] Add French translations
- [ ] Add Spanish and Italian translations
- [ ] Implement locale detection and persistence

#### C3. Component Integration
- [ ] Create `I18nComponent` base class
- [ ] Implement `LanguageSwitcher` component
- [ ] Update existing components to use translations

---

### Phase D: Accessibility Features (Day 3)

#### D1. Semantic HTML Foundation
- [ ] Add proper ARIA landmarks (`role="navigation"`, `role="main"`)
- [ ] Implement skip navigation links
- [ ] Set up proper heading hierarchy

*Reference: [Accessibility Requirements](./docs/frontend/accessibility.md)*

#### D2. Keyboard Navigation
- [ ] Implement keyboard event handling utilities
- [ ] Add focus management system
- [ ] Create keyboard-accessible game controls

#### D3. Screen Reader Support
- [ ] Add ARIA labels and descriptions
- [ ] Implement live regions for dynamic content
- [ ] Create screen reader announcements for game events

#### D4. Visual Accessibility
- [ ] Add high contrast mode support
- [ ] Implement reduced motion preferences
- [ ] Ensure proper color contrast ratios (4.5:1 minimum)

---

### Phase E: Responsive Design (Day 3-4)

#### E1. Mobile-First Layout
- [ ] Implement responsive grid system using Tailwind
- [ ] Create mobile navigation patterns
- [ ] Add touch-friendly interactions (44px minimum targets)

*Reference: [Tailwind CSS Strategy - Responsive Design](./docs/frontend/tailwindcss.md#responsive-design-strategy)*

#### E2. Device Adaptation
- [ ] Test and optimize for tablets
- [ ] Ensure touch gesture support
- [ ] Add device-specific optimizations

#### E3. Browser Compatibility
- [ ] Test in Firefox (required)
- [ ] Add Chrome/Safari support
- [ ] Implement progressive enhancement fallbacks

---

### Phase F: Application Pages (Day 4)

#### F1. Core Pages Implementation
- [ ] Create `HomePage` component
- [ ] Implement `GameLobbyPage`
- [ ] Build `ProfilePage` layout
- [ ] Add `SettingsPage` with language switcher

*Reference: [TypeScript Project Structure - Pages](./docs/frontend/project-structure.md#page-structure)*

#### F2. Page Integration
- [ ] Connect pages to router system
- [ ] Add page transition handling
- [ ] Implement route-based title updates

#### F3. Navigation Flow
- [ ] Create main navigation component
- [ ] Add breadcrumb navigation
- [ ] Implement user authentication flow

---

### Phase G: Game Interface Preparation (Day 4-5)

#### G1. Game Layout Components
- [ ] Create `GameContainer` layout
- [ ] Implement `Scoreboard` component
- [ ] Build `GameControls` interface
- [ ] Add `GameStatus` display

*Note: Actual Pong game logic will be server-side (Phase 6)*

#### G2. Accessibility for Gaming
- [ ] Add keyboard controls for game interface
- [ ] Implement game state announcements
- [ ] Create accessible score display

#### G3. Game UI Styling
- [ ] Apply retro/gaming theme to game components
- [ ] Add game-specific animations
- [ ] Implement visual feedback systems

---

### Phase H: Integration & Testing (Day 5)

#### H1. Component Integration
- [ ] Test all components work together
- [ ] Verify state management across app
- [ ] Check routing between all pages

#### H2. Accessibility Testing
- [ ] Run automated accessibility tests
- [ ] Test with screen readers
- [ ] Verify keyboard-only navigation

#### H3. Responsive Testing
- [ ] Test on mobile devices
- [ ] Verify tablet layout
- [ ] Check desktop responsiveness

#### H4. i18n Testing
- [ ] Test all language switches
- [ ] Verify translation completeness
- [ ] Check text layout in all languages

---

## ✅ Module Completion Checklist

### Frontend Framework - Tailwind CSS (Minor)
- [ ] Tailwind properly configured with custom theme
- [ ] Component library implemented
- [ ] Gaming aesthetic applied

### Multiple Language Support (Minor)
- [ ] 4 languages implemented (EN, FR, ES, IT)
- [ ] Language switcher working
- [ ] All UI text translated

### Accessibility Features (Minor)
- [ ] WCAG 2.1 AA compliance
- [ ] Screen reader support
- [ ] Keyboard navigation complete

### All Devices Support (Minor)
- [ ] Mobile responsive design
- [ ] Tablet optimization
- [ ] Touch interaction support

### Browser Compatibility (Minor)
- [ ] Firefox compatibility (required)
- [ ] Chrome/Safari support
- [ ] Progressive enhancement

---

## 🔄 Daily Progress Tracking

### Day 1: Foundation
- [ ] Phase A complete

### Day 2: Core Systems + i18n Start
- [ ] Phase B complete
- [ ] Phase C1-C2 complete

### Day 3: i18n + Accessibility
- [ ] Phase C3 complete
- [ ] Phase D complete

### Day 4: Responsive + Pages
- [ ] Phase E complete
- [ ] Phase F complete

### Day 5: Game Interface + Polish
- [ ] Phase G complete
- [ ] Phase H complete

---

## 📚 Quick Reference

- **Detailed Architecture**: `/docs/frontend/architecture.md`
- **Component Patterns**: `/docs/frontend/project-structure.md`
- **Styling Guide**: `/docs/frontend/tailwindcss.md`
- **i18n Implementation**: `/docs/frontend/i18n.md`
- **Accessibility Spec**: `/docs/frontend/accessibility.md`
- **Main Project Roadmap**: `/RoadMap.md`