# Frontend Architecture - SPA Routing & State Management

## 🎯 Architecture Overview

### Core Principles
- **Single Page Application (SPA)**: Dynamic content loading without full page refreshes
- **Browser History API**: Native routing without external libraries
- **Component-Based**: Modular, reusable UI components
- **Event-Driven**: Loose coupling through custom events
- **Progressive Enhancement**: Works without JavaScript, enhanced with it

## 🧭 SPA Routing System

### Router Implementation Strategy
```typescript
// Core router using History API
class Router {
  private routes: Map<string, RouteHandler>
  private currentRoute: string
  
  // Navigate without page refresh
  navigate(path: string): void
  
  // Handle browser back/forward buttons
  onPopState(event: PopStateEvent): void
  
  // Route registration and matching
  addRoute(pattern: string, handler: RouteHandler): void
}
```

### Route Structure
```
/                    -> Home/Landing page
/game               -> Game lobby/selection
/game/play          -> Active game session
/game/tournament    -> Tournament management
/profile            -> User profile
/profile/friends    -> Friends management
/settings           -> User settings
/leaderboard        -> Game statistics
/chat               -> Live chat interface
```

### Route Handling Approach
- **Hash-free URLs**: Use pushState() for clean URLs
- **Route Guards**: Authentication checks before route access
- **Lazy Loading**: Load components only when needed
- **404 Handling**: Fallback for unknown routes

## 🔄 State Management System

### Lightweight State Architecture
```typescript
// Central state store without heavy dependencies
interface AppState {
  user: UserState | null
  game: GameState | null
  ui: UIState
  settings: SettingsState
}

class StateManager {
  private state: AppState
  private listeners: Map<string, StateListener[]>
  
  // Subscribe to state changes
  subscribe(key: string, listener: StateListener): void
  
  // Update state and notify listeners
  setState(updates: Partial<AppState>): void
  
  // Get current state slice
  getState<T extends keyof AppState>(key: T): AppState[T]
}
```

### State Management Patterns
- **Centralized Store**: Single source of truth
- **Immutable Updates**: Always create new state objects
- **Selective Subscriptions**: Components subscribe only to needed state slices
- **Local State**: Component-level state for UI-only concerns

## 🏗️ Component Architecture

### Component Base Class
```typescript
abstract class Component {
  protected element: HTMLElement
  protected state: any
  protected props: any
  
  abstract render(): string
  abstract mount(parent: HTMLElement): void
  abstract unmount(): void
  
  // Event handling
  protected addEventListener(event: string, handler: EventListener): void
  protected removeEventListener(event: string, handler: EventListener): void
}
```

### Component Categories
1. **Pages**: Top-level route components
2. **Layouts**: Common page structures (header, footer, sidebar)
3. **Widgets**: Interactive UI components (buttons, forms, modals)
4. **Game**: Pong-specific components (paddle, ball, scoreboard)

### Component Communication
- **Props**: Parent to child data flow
- **Events**: Child to parent communication
- **State Store**: Global state access
- **Custom Events**: Cross-component communication

## 🌐 Application Flow

### Initialization Sequence
1. **DOM Ready**: Initialize core systems
2. **Router Setup**: Register routes and start listening
3. **State Initialization**: Load user preferences and auth state
4. **UI Bootstrap**: Mount initial components
5. **Service Workers**: Register for offline functionality

### Navigation Flow
```
User Action -> Router.navigate() -> Route Guard Check -> 
Component Unmount -> New Component Mount -> State Update -> UI Render
```

### Data Flow
```
User Interaction -> Component Event -> State Update -> 
State Listeners Notify -> Component Re-render -> DOM Update
```

## 🔒 Authentication Integration

### Auth State Management
```typescript
interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  expiresAt: number | null
}
```

### Route Protection
- **Public Routes**: Accessible without authentication
- **Protected Routes**: Require valid authentication
- **Role-Based**: Different access levels (admin, user)
- **Redirect Logic**: Send unauthorized users to login

## 🎮 Game State Integration

### Real-time Game State
```typescript
interface GameState {
  currentGame: Game | null
  gameMode: 'singleplayer' | 'multiplayer' | 'tournament'
  isPlaying: boolean
  score: Score
  players: Player[]
}
```

### WebSocket Integration
- **Connection Management**: Automatic reconnection
- **Event Handling**: Game updates, chat messages, notifications
- **State Synchronization**: Keep UI in sync with server

## 📱 Responsive Architecture

### Breakpoint Strategy
- **Mobile First**: Start with mobile design
- **Tailwind Breakpoints**: sm: 640px, md: 768px, lg: 1024px, xl: 1280px
- **Component Adaptation**: Components adapt to screen size
- **Touch Support**: Touch-friendly interactions on mobile

## 🧪 Testing Strategy

### Testing Levels
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Full user workflow testing
- **Accessibility Tests**: Screen reader and keyboard navigation

### Testing Tools
- **Jest**: Unit testing framework
- **Testing Library**: DOM testing utilities
- **Cypress**: E2E testing
- **axe-core**: Accessibility testing

## 🚀 Performance Considerations

### Optimization Strategies
- **Code Splitting**: Load components on demand
- **Image Optimization**: Responsive images and lazy loading
- **Service Workers**: Cache static assets
- **Debouncing**: Limit expensive operations
- **Virtual Scrolling**: Handle large lists efficiently

### Bundle Management
- **Tree Shaking**: Remove unused code
- **Chunk Splitting**: Separate vendor and app code
- **Asset Optimization**: Minimize CSS and JavaScript
- **CDN Strategy**: Serve static assets from CDN