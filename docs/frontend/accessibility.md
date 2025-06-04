# Accessibility Requirements Specification

## 🎯 Overview & Compliance Goals

### Module Requirement
- **Accessibility Features for Visually Impaired Users (Minor Module)**
- **WCAG 2.1 AA Compliance**: Meet Web Content Accessibility Guidelines
- **Screen Reader Support**: Full compatibility with assistive technologies
- **Keyboard Navigation**: Complete keyboard-only operation
- **High Contrast**: Support for users with visual impairments

### Target User Groups
1. **Visually Impaired Users**: Blind and low-vision users
2. **Motor Impaired Users**: Users with limited mobility
3. **Cognitive Impaired Users**: Users with cognitive disabilities
4. **Elderly Users**: Age-related accessibility needs

## 🔍 WCAG 2.1 AA Requirements

### Principle 1: Perceivable
Information and UI components must be presentable in ways users can perceive.

#### 1.1 Text Alternatives
- **Alt Text**: All images have descriptive alt attributes
- **Game Elements**: Screen reader descriptions for game state
- **Icons**: Meaningful labels for icon-only buttons

#### 1.2 Time-based Media
- **Game Audio**: Audio descriptions for game events
- **Sound Alternatives**: Visual indicators for audio cues

#### 1.3 Adaptable
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **Responsive Design**: Content adapts to different presentations
- **Reading Order**: Logical content sequence

#### 1.4 Distinguishable
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Color Independence**: Information not conveyed by color alone
- **Text Resize**: Text can be resized to 200% without horizontal scrolling
- **High Contrast Mode**: Support for high contrast themes

### Principle 2: Operable
UI components and navigation must be operable.

#### 2.1 Keyboard Accessible
- **Keyboard Only**: All functionality available via keyboard
- **No Keyboard Traps**: Focus can always be moved away
- **Game Controls**: Keyboard alternatives for mouse actions

#### 2.2 Enough Time
- **No Time Limits**: Or provide controls to extend/disable
- **Pause Game**: Ability to pause during gameplay
- **Session Extension**: Warn before session timeout

#### 2.3 Seizures and Physical Reactions
- **Flashing Content**: No content flashes more than 3 times per second
- **Motion Controls**: Alternatives to motion-based controls

#### 2.4 Navigable
- **Skip Links**: Bypass repetitive content
- **Page Titles**: Descriptive and unique page titles
- **Focus Order**: Logical focus sequence
- **Link Purpose**: Clear link destinations

### Principle 3: Understandable
Information and UI operation must be understandable.

#### 3.1 Readable
- **Language**: Page language specified
- **Unusual Words**: Definitions for technical terms
- **Reading Level**: Appropriate for general audience

#### 3.2 Predictable
- **Consistent Navigation**: Same navigation across pages
- **Consistent Identification**: Same functionality labeled consistently
- **No Context Changes**: On focus or input without warning

#### 3.3 Input Assistance
- **Error Identification**: Errors clearly described
- **Error Suggestions**: Helpful error correction suggestions
- **Error Prevention**: Prevent errors on important actions

### Principle 4: Robust
Content must be robust enough for various assistive technologies.

#### 4.1 Compatible
- **Valid HTML**: Well-formed markup
- **ARIA Labels**: Proper ARIA implementation
- **Assistive Technology**: Compatible with screen readers

## 🛠️ Implementation Strategy

### Semantic HTML Foundation
```html
<!-- Proper document structure -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ft_transcendence - The Ultimate Pong Experience</title>
</head>
<body>
  <!-- Skip navigation link -->
  <a href="#main" class="skip-link">Skip to main content</a>
  
  <!-- Main navigation -->
  <nav role="navigation" aria-label="Main navigation">
    <ul role="menubar">
      <li role="none">
        <a href="/" role="menuitem" aria-current="page">Home</a>
      </li>
      <li role="none">
        <a href="/game" role="menuitem">Game</a>
      </li>
    </ul>
  </nav>
  
  <!-- Main content -->
  <main id="main" role="main">
    <h1>Welcome to ft_transcendence</h1>
    <!-- Content -->
  </main>
  
  <!-- Footer -->
  <footer role="contentinfo">
    <!-- Footer content -->
  </footer>
</body>
</html>
```

### ARIA Implementation
```typescript
// src/utils/accessibility.ts

/**
 * @brief Accessibility utility functions
 * 
 * @description Helper functions for implementing ARIA attributes
 * and accessibility features throughout the application.
 */
export class AccessibilityUtils {
  /**
   * @brief Generate unique ID for ARIA relationships
   * @param prefix ID prefix
   * @return Unique ID string
   */
  static generateId(prefix: string = 'element'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * @brief Set up ARIA live region for dynamic content
   * @param element Element to make live region
   * @param politeness Live region politeness level
   */
  static setupLiveRegion(
    element: HTMLElement, 
    politeness: 'polite' | 'assertive' = 'polite'
  ): void {
    element.setAttribute('aria-live', politeness)
    element.setAttribute('aria-atomic', 'true')
  }

  /**
   * @brief Announce text to screen readers
   * @param message Message to announce
   * @param priority Announcement priority
   */
  static announce(
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ): void {
    const announcer = this.getOrCreateAnnouncer(priority)
    announcer.textContent = message
    
    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = ''
    }, 1000)
  }

  private static getOrCreateAnnouncer(priority: 'polite' | 'assertive'): HTMLElement {
    const id = `announcer-${priority}`
    let announcer = document.getElementById(id)
    
    if (!announcer) {
      announcer = document.createElement('div')
      announcer.id = id
      announcer.className = 'sr-only'
      announcer.setAttribute('aria-live', priority)
      announcer.setAttribute('aria-atomic', 'true')
      document.body.appendChild(announcer)
    }
    
    return announcer
  }

  /**
   * @brief Set up keyboard event handling
   * @param element Element to handle keyboard events
   * @param handlers Keyboard event handlers
   */
  static setupKeyboardHandling(
    element: HTMLElement,
    handlers: {
      onEnter?: () => void
      onSpace?: () => void
      onEscape?: () => void
      onArrowUp?: () => void
      onArrowDown?: () => void
      onArrowLeft?: () => void
      onArrowRight?: () => void
    }
  ): void {
    element.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'Enter':
          handlers.onEnter?.()
          break
        case ' ':
          event.preventDefault() // Prevent page scroll
          handlers.onSpace?.()
          break
        case 'Escape':
          handlers.onEscape?.()
          break
        case 'ArrowUp':
          event.preventDefault()
          handlers.onArrowUp?.()
          break
        case 'ArrowDown':
          event.preventDefault()
          handlers.onArrowDown?.()
          break
        case 'ArrowLeft':
          handlers.onArrowLeft?.()
          break
        case 'ArrowRight':
          handlers.onArrowRight?.()
          break
      }
    })
  }
}
```

### Screen Reader Optimized Components

#### Accessible Button Component
```typescript
// src/components/ui/AccessibleButton.ts

export interface AccessibleButtonProps {
  text: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'game'
  disabled?: boolean
  ariaLabel?: string
  ariaDescribedBy?: string
  icon?: string
  iconPosition?: 'left' | 'right'
}

export class AccessibleButton extends I18nComponent<AccessibleButtonProps> {
  private buttonId: string

  constructor(props: AccessibleButtonProps) {
    super(props, {})
    this.buttonId = AccessibilityUtils.generateId('btn')
  }

  render(): string {
    const {
      text,
      variant = 'primary',
      disabled = false,
      ariaLabel,
      ariaDescribedBy,
      icon,
      iconPosition = 'left'
    } = this.props

    const iconHtml = icon ? `
      <span aria-hidden="true" class="icon icon-${icon}"></span>
    ` : ''

    const buttonText = iconPosition === 'left' 
      ? iconHtml + text 
      : text + iconHtml

    return `
      <button
        id="${this.buttonId}"
        type="button"
        class="btn-base btn-${variant} focus-visible"
        ${disabled ? 'disabled' : ''}
        ${ariaLabel ? `aria-label="${ariaLabel}"` : ''}
        ${ariaDescribedBy ? `aria-describedby="${ariaDescribedBy}"` : ''}
        data-action="click"
      >
        ${buttonText}
      </button>
    `
  }

  protected afterMount(): void {
    this.element?.addEventListener('click', this.handleClick)
    
    // Set up keyboard handling
    if (this.element) {
      AccessibilityUtils.setupKeyboardHandling(this.element, {
        onEnter: this.handleActivate,
        onSpace: this.handleActivate
      })
    }
  }

  private handleClick = (event: Event) => {
    event.preventDefault()
    this.handleActivate()
  }

  private handleActivate = () => {
    if (!this.props.disabled) {
      this.props.onClick()
    }
  }
}
```

#### Accessible Game Component
```typescript
// src/components/game/AccessiblePongGame.ts

export interface AccessiblePongGameProps {
  gameState: GameState
  onPaddleMove: (player: number, direction: 'up' | 'down') => void
}

export class AccessiblePongGame extends I18nComponent<AccessiblePongGameProps> {
  private gameAreaId: string
  private scoreAnnouncementTimer?: NodeJS.Timeout

  constructor(props: AccessiblePongGameProps) {
    super(props, {})
    this.gameAreaId = AccessibilityUtils.generateId('game-area')
  }

  render(): string {
    const { gameState } = this.props
    
    return `
      <div class="pong-game-container" role="application" aria-label="${this.t('game.pong')}">
        <!-- Game status announcement -->
        <div id="game-status" class="sr-only" aria-live="polite" aria-atomic="true">
          ${this.getGameStatusText()}
        </div>
        
        <!-- Score display -->
        <div class="scoreboard" role="banner" aria-label="${this.t('game.score')}">
          <div class="score-player1">
            <span class="sr-only">${this.t('game.player1')} ${this.t('game.score')}: </span>
            <span aria-live="polite">${gameState.score.player1}</span>
          </div>
          <div class="score-separator" aria-hidden="true">-</div>
          <div class="score-player2">
            <span class="sr-only">${this.t('game.player2')} ${this.t('game.score')}: </span>
            <span aria-live="polite">${gameState.score.player2}</span>
          </div>
        </div>
        
        <!-- Game area -->
        <div 
          id="${this.gameAreaId}"
          class="pong-field"
          role="img"
          aria-label="${this.getGameAreaDescription()}"
          tabindex="0"
        >
          ${this.renderGameElements()}
        </div>
        
        <!-- Game controls instructions -->
        <div class="game-instructions" role="complementary">
          <h3>${this.t('game.controls.title')}</h3>
          <ul>
            <li>${this.t('game.controls.up')}: ${this.t('game.controls.upKey')}</li>
            <li>${this.t('game.controls.down')}: ${this.t('game.controls.downKey')}</li>
            <li>${this.t('game.controls.pause')}: ${this.t('game.controls.pauseKey')}</li>
          </ul>
        </div>
      </div>
    `
  }

  private getGameStatusText(): string {
    const { gameState } = this.props
    
    if (gameState.status === 'waiting') {
      return this.t('game.waiting')
    }
    
    if (gameState.status === 'finished') {
      const winner = gameState.winner
      return this.t('game.winner', { player: winner?.name || 'Unknown' })
    }
    
    return this.t('game.playing')
  }

  private getGameAreaDescription(): string {
    const { gameState } = this.props
    const { ball, paddles } = gameState
    
    return this.t('game.areaDescription', {
      ballX: Math.round(ball.x),
      ballY: Math.round(ball.y),
      paddle1Y: Math.round(paddles.player1.y),
      paddle2Y: Math.round(paddles.player2.y)
    })
  }

  protected afterMount(): void {
    const gameArea = document.getElementById(this.gameAreaId)
    if (gameArea) {
      AccessibilityUtils.setupKeyboardHandling(gameArea, {
        onArrowUp: () => this.props.onPaddleMove(1, 'up'),
        onArrowDown: () => this.props.onPaddleMove(1, 'down'),
        onEscape: this.pauseGame
      })
    }

    // Announce score changes
    this.watchScoreChanges()
  }

  private watchScoreChanges(): void {
    // This would integrate with the game state management system
    // to announce score changes to screen readers
  }

  private pauseGame = (): void => {
    // Implement game pause functionality
    AccessibilityUtils.announce(this.t('game.paused'), 'polite')
  }
}
```

## 🎨 High Contrast & Visual Accessibility

### High Contrast CSS
```css
/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --color-background: #000000;
    --color-text-primary: #ffffff;
    --color-primary: #ffff00;
    --color-secondary: #ff00ff;
    --color-border: #ffffff;
  }
  
  .btn-primary {
    @apply 
      border-2 border-white
      text-black bg-white
      hover:bg-yellow-400 hover:border-yellow-400;
  }
  
  .card {
    @apply border-2 border-white;
  }
  
  .pong-field {
    @apply border-4 border-white;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    @apply !transition-none !animate-none;
  }
  
  .pong-ball {
    @apply !transition-none;
  }
}

/* Focus indicators */
.focus-visible {
  @apply 
    focus:outline-none 
    focus-visible:ring-4 focus-visible:ring-yellow-400 
    focus-visible:ring-offset-2 focus-visible:ring-offset-black;
}

/* Screen reader only content */
.sr-only {
  @apply 
    absolute w-px h-px p-0 -m-px 
    overflow-hidden clip-[rect(0,0,0,0)] 
    whitespace-nowrap border-0;
}

/* Skip link */
.skip-link {
  @apply 
    sr-only 
    focus:not-sr-only focus:absolute focus:top-0 focus:left-0 
    focus:z-50 focus:p-4 focus:bg-primary focus:text-black;
}
```

### Color Accessibility
```typescript
// src/utils/colorAccessibility.ts

/**
 * @brief Color accessibility utilities
 */
export class ColorAccessibility {
  /**
   * @brief Check if color combination meets WCAG contrast requirements
   * @param foreground Foreground color hex
   * @param background Background color hex
   * @param level WCAG level (AA or AAA)
   * @return Whether contrast is sufficient
   */
  static checkContrast(
    foreground: string, 
    background: string, 
    level: 'AA' | 'AAA' = 'AA'
  ): boolean {
    const ratio = this.getContrastRatio(foreground, background)
    const minRatio = level === 'AAA' ? 7 : 4.5
    return ratio >= minRatio
  }

  /**
   * @brief Calculate contrast ratio between two colors
   * @param color1 First color hex
   * @param color2 Second color hex
   * @return Contrast ratio
   */
  static getContrastRatio(color1: string, color2: string): number {
    const l1 = this.getLuminance(color1)
    const l2 = this.getLuminance(color2)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }

  private static getLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex)
    const [r, g, b] = rgb.map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  private static hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0]
  }
}
```

## 🧪 Accessibility Testing

### Automated Testing
```typescript
// src/__tests__/accessibility/a11y.test.ts

import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  test('should have no accessibility violations on home page', async () => {
    const { container } = renderComponent(HomePage, {})
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  test('should have proper heading hierarchy', () => {
    const { container } = renderComponent(GamePage, {})
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    
    // Check that h1 comes first
    expect(headings[0].tagName).toBe('H1')
    
    // Check no heading levels are skipped
    let currentLevel = 1
    Array.from(headings).forEach(heading => {
      const level = parseInt(heading.tagName.substring(1))
      expect(level).toBeLessThanOrEqual(currentLevel + 1)
      currentLevel = level
    })
  })

  test('should have proper ARIA labels', () => {
    const { container } = renderComponent(AccessibleButton, {
      text: 'Start Game',
      onClick: jest.fn(),
      ariaLabel: 'Start new Pong game'
    })
    
    const button = container.querySelector('button')
    expect(button).toHaveAttribute('aria-label', 'Start new Pong game')
  })

  test('should announce game state changes', async () => {
    const announcer = jest.spyOn(AccessibilityUtils, 'announce')
    
    const { component } = renderComponent(AccessiblePongGame, {
      gameState: mockGameState,
      onPaddleMove: jest.fn()
    })
    
    // Simulate score change
    component.updateProps({
      gameState: { ...mockGameState, score: { player1: 1, player2: 0 } }
    })
    
    expect(announcer).toHaveBeenCalledWith('Player 1 scores!', 'polite')
  })
})
```

### Manual Testing Checklist
```markdown
## Manual Accessibility Testing Checklist

### Keyboard Navigation
- [ ] Can navigate entire site using only keyboard
- [ ] Tab order is logical and predictable
- [ ] Focus indicators are clearly visible
- [ ] No keyboard traps exist
- [ ] Game controls work with keyboard

### Screen Reader Testing
- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS)
- [ ] All content is readable
- [ ] Interactive elements are properly announced
- [ ] Game state changes are announced

### Visual Testing
- [ ] Text can be zoomed to 200% without horizontal scrolling
- [ ] High contrast mode works properly
- [ ] Color is not the only way information is conveyed
- [ ] Focus indicators meet contrast requirements

### Motor Accessibility
- [ ] Click targets are at least 44x44 pixels
- [ ] Timeouts can be extended or disabled
- [ ] No rapid flashing content
- [ ] Drag and drop has keyboard alternatives
```

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Day 1)
- [ ] Set up accessibility utilities
- [ ] Implement semantic HTML structure
- [ ] Add ARIA landmarks and roles
- [ ] Create skip navigation links

### Phase 2: Component Accessibility (Day 1-2)
- [ ] Make all buttons keyboard accessible
- [ ] Add proper ARIA labels and descriptions
- [ ] Implement focus management
- [ ] Create accessible form components

### Phase 3: Game Accessibility (Day 2)
- [ ] Add keyboard controls for game
- [ ] Implement game state announcements
- [ ] Create audio descriptions for visual elements
- [ ] Add pause/resume functionality

### Phase 4: Visual Accessibility (Day 2-3)
- [ ] Implement high contrast mode
- [ ] Ensure proper color contrast ratios
- [ ] Add text sizing controls
- [ ] Support reduced motion preferences

### Phase 5: Testing & Polish (Day 3)
- [ ] Run automated accessibility tests
- [ ] Conduct screen reader testing
- [ ] Manual keyboard navigation testing
- [ ] Performance optimization for assistive technologies

## 📈 Success Metrics

### Compliance Targets
- **WCAG 2.1 AA**: 100% compliance
- **Automated Testing**: Zero critical accessibility violations
- **Screen Reader**: All content accessible
- **Keyboard Navigation**: All functionality available
- **Color Contrast**: Minimum 4.5:1 ratio for all text