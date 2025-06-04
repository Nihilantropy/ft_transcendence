# TypeScript Project Structure

## 🎯 Project Organization Philosophy

### Core Principles
- **Feature-Based Structure**: Group related functionality together
- **Separation of Concerns**: Clear boundaries between different layers
- **Scalability**: Easy to add new features without restructuring
- **Type Safety**: Comprehensive TypeScript coverage
- **Import Clarity**: Clear, absolute imports using path mapping

## 📁 Directory Structure

```
src/
├── components/           # Reusable UI components
│   ├── base/            # Base component classes
│   ├── ui/              # Generic UI components
│   ├── game/            # Game-specific components
│   └── layout/          # Layout components
├── pages/               # Page-level components (routes)
│   ├── home/
│   ├── game/
│   ├── profile/
│   └── settings/
├── services/            # Business logic and API calls
│   ├── api/             # API communication
│   ├── auth/            # Authentication logic
│   ├── game/            # Game logic
│   └── websocket/       # Real-time communication
├── stores/              # State management
│   ├── app.store.ts     # Global app state
│   ├── auth.store.ts    # Authentication state
│   ├── game.store.ts    # Game state
│   └── ui.store.ts      # UI state
├── types/               # TypeScript type definitions
│   ├── api.types.ts     # API response types
│   ├── game.types.ts    # Game-related types
│   ├── user.types.ts    # User-related types
│   └── global.types.ts  # Global types
├── utils/               # Utility functions
│   ├── helpers.ts       # General helpers
│   ├── validators.ts    # Input validation
│   ├── formatters.ts    # Data formatting
│   └── constants.ts     # App constants
├── router/              # Routing system
│   ├── router.ts        # Main router class
│   ├── routes.ts        # Route definitions
│   └── guards.ts        # Route guards
├── i18n/                # Internationalization
│   ├── locales/         # Translation files
│   ├── i18n.ts          # i18n system
│   └── types.ts         # i18n types
├── assets/              # Static assets
│   ├── images/
│   ├── fonts/
│   └── icons/
├── styles/              # Global styles
│   ├── base.css         # Base styles
│   ├── components.css   # Component styles
│   └── utilities.css    # Utility classes
├── main.ts              # Application entry point
└── vite-env.d.ts        # Vite type declarations
```

## 🧩 Component Architecture

### Base Component System
```typescript
// src/components/base/Component.ts

/**
 * @brief Base component class providing common functionality
 * 
 * @description Abstract base class that all components extend.
 * Provides lifecycle methods, event handling, and type safety.
 */
export abstract class Component<TProps = {}, TState = {}> {
  protected element: HTMLElement | null = null
  protected props: TProps
  protected state: TState
  protected mounted: boolean = false

  constructor(props: TProps, initialState: TState) {
    this.props = props
    this.state = initialState
  }

  /**
   * @brief Render component to HTML string
   * @return HTML string representation
   */
  abstract render(): string

  /**
   * @brief Mount component to DOM
   * @param parent Parent element to mount to
   */
  mount(parent: HTMLElement): void {
    const html = this.render()
    const template = document.createElement('template')
    template.innerHTML = html.trim()
    this.element = template.content.firstElementChild as HTMLElement
    
    parent.appendChild(this.element)
    this.mounted = true
    this.afterMount()
  }

  /**
   * @brief Cleanup and unmount component
   */
  unmount(): void {
    if (this.element && this.element.parentNode) {
      this.beforeUnmount()
      this.element.parentNode.removeChild(this.element)
      this.mounted = false
    }
  }

  /**
   * @brief Update component props and re-render
   * @param newProps New props to merge
   */
  updateProps(newProps: Partial<TProps>): void {
    this.props = { ...this.props, ...newProps }
    this.rerender()
  }

  /**
   * @brief Update component state and re-render
   * @param stateUpdates State updates to apply
   */
  protected setState(stateUpdates: Partial<TState>): void {
    this.state = { ...this.state, ...stateUpdates }
    this.rerender()
  }

  protected afterMount(): void {}
  protected beforeUnmount(): void {}
  protected rerender(): void {
    if (this.mounted && this.element) {
      const newHtml = this.render()
      this.element.outerHTML = newHtml
    }
  }
}
```

### Component Categories

#### UI Components
```typescript
// src/components/ui/Button.ts
export interface ButtonProps {
  text: string
  variant: 'primary' | 'secondary' | 'game'
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// src/components/ui/Modal.ts
export interface ModalProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: string
}
```

#### Game Components
```typescript
// src/components/game/PongCanvas.ts
export interface PongCanvasProps {
  width: number
  height: number
  gameState: GameState
  onPaddleMove: (player: number, direction: 'up' | 'down') => void
}

// src/components/game/Scoreboard.ts
export interface ScoreboardProps {
  player1Score: number
  player2Score: number
  gameTime: number
}
```

## 📄 Page Structure

### Page Base Class
```typescript
// src/pages/BasePage.ts

/**
 * @brief Base page class for route components
 * 
 * @description Provides common page functionality including
 * authentication checks, loading states, and error handling.
 */
export abstract class BasePage extends Component {
  protected loading: boolean = false
  protected error: string | null = null

  /**
   * @brief Initialize page data
   */
  async init(): Promise<void> {
    this.setLoading(true)
    try {
      await this.loadData()
    } catch (error) {
      this.setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      this.setLoading(false)
    }
  }

  protected abstract loadData(): Promise<void>
  
  protected setLoading(loading: boolean): void {
    this.setState({ loading } as Partial<any>)
  }

  protected setError(error: string | null): void {
    this.setState({ error } as Partial<any>)
  }
}
```

### Route Definitions
```typescript
// src/router/routes.ts

export interface RouteConfig {
  path: string
  component: string
  requiresAuth?: boolean
  title?: string
  meta?: Record<string, any>
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    component: 'HomePage',
    title: 'ft_transcendence - Home'
  },
  {
    path: '/game',
    component: 'GameLobbyPage',
    requiresAuth: true,
    title: 'Game Lobby'
  },
  {
    path: '/game/play',
    component: 'GamePlayPage',
    requiresAuth: true,
    title: 'Playing Pong'
  },
  {
    path: '/profile',
    component: 'ProfilePage',
    requiresAuth: true,
    title: 'Profile'
  }
]
```

## 🔧 Service Layer

### API Service Structure
```typescript
// src/services/api/BaseApiService.ts

/**
 * @brief Base API service with common HTTP functionality
 */
export class BaseApiService {
  protected baseUrl: string
  protected headers: Record<string, string>

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.headers = {
      'Content-Type': 'application/json'
    }
  }

  /**
   * @brief Make authenticated API request
   * @param endpoint API endpoint
   * @param options Request options
   * @return Promise with response data
   */
  protected async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const token = authStore.getToken()
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }
}
```

### Specific Services
```typescript
// src/services/auth/AuthService.ts
export class AuthService extends BaseApiService {
  async login(credentials: LoginCredentials): Promise<AuthResponse>
  async register(userData: RegisterData): Promise<AuthResponse>
  async logout(): Promise<void>
  async refreshToken(): Promise<string>
}

// src/services/game/GameService.ts
export class GameService extends BaseApiService {
  async createGame(settings: GameSettings): Promise<Game>
  async joinGame(gameId: string): Promise<void>
  async getGameHistory(): Promise<GameHistory[]>
}
```

## 📊 State Management

### Store Architecture
```typescript
// src/stores/BaseStore.ts

/**
 * @brief Base store class with subscription mechanism
 */
export class BaseStore<T> {
  private state: T
  private listeners: Set<(state: T) => void> = new Set()

  constructor(initialState: T) {
    this.state = initialState
  }

  /**
   * @brief Subscribe to state changes
   * @param listener Callback function for state updates
   * @return Unsubscribe function
   */
  subscribe(listener: (state: T) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * @brief Update state and notify listeners
   * @param updates Partial state updates
   */
  protected setState(updates: Partial<T>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  /**
   * @brief Get current state
   * @return Current state object
   */
  getState(): T {
    return this.state
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state))
  }
}
```

## 🔍 Type Definitions

### Global Types
```typescript
// src/types/global.types.ts

export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  isOnline: boolean
  createdAt: Date
}

export interface Game {
  id: string
  type: 'classic' | 'tournament' | 'ai'
  status: 'waiting' | 'playing' | 'finished'
  players: Player[]
  settings: GameSettings
  createdAt: Date
}

export interface Tournament {
  id: string
  name: string
  status: 'registration' | 'active' | 'finished'
  participants: User[]
  bracket: TournamentBracket
  startDate: Date
}
```

### API Types
```typescript
// src/types/api.types.ts

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}
```

## 🛠️ Utility Functions

### Common Utilities
```typescript
// src/utils/helpers.ts

/**
 * @brief Debounce function execution
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 * @return Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * @brief Format date for display
 * @param date Date to format
 * @param locale Locale for formatting
 * @return Formatted date string
 */
export function formatDate(date: Date, locale: string = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
```

## 📝 Import Path Configuration

### TypeScript Path Mapping
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/pages/*": ["pages/*"],
      "@/services/*": ["services/*"],
      "@/stores/*": ["stores/*"],
      "@/types/*": ["types/*"],
      "@/utils/*": ["utils/*"]
    }
  }
}
```

### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils')
    }
  }
})
```

## 🧪 Testing Structure

### Test Organization
```
src/
├── __tests__/           # Test files
│   ├── components/      # Component tests
│   ├── services/        # Service tests
│   ├── stores/          # Store tests
│   └── utils/           # Utility tests
├── __mocks__/           # Mock files
└── test-utils/          # Testing utilities
```

### Test Utilities
```typescript
// src/test-utils/render.ts

/**
 * @brief Render component for testing
 * @param component Component to render
 * @param props Component props
 * @return Testing utilities
 */
export function renderComponent<T>(
  ComponentClass: new (props: T) => Component,
  props: T
): {
  container: HTMLElement
  component: Component
  rerender: (newProps: Partial<T>) => void
} {
  const container = document.createElement('div')
  const component = new ComponentClass(props)
  
  component.mount(container)
  
  return {
    container,
    component,
    rerender: (newProps: Partial<T>) => {
      component.updateProps(newProps)
    }
  }
}
```