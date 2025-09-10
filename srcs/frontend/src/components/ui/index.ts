/**
 * @brief Generic UI components library
 * 
 * @description Barrel export for reusable UI components.
 * Includes buttons, modals, forms, and navigation elements.
 * 
 * Phase B3 implementation - Basic UI Components
 */

// UI Components - Phase B3 implementations
export { Button } from './Button'
export type { ButtonVariant, ButtonSize } from './Button'

export { Modal } from './Modal'
export type { ModalSize } from './Modal'

export { Input } from './Input'
export type { InputType, ValidationState } from './Input'

export { Label } from './Label'

export { Navigation } from './Navigation'
export type { NavigationLayout, NavigationItem } from './Navigation'

// Future UI Components (to be implemented in remaining Phase B3)
// export { Card } from './Card'

// i18n Components (to be implemented in Phase C3)
// export { LanguageSwitcher } from './LanguageSwitcher'

// Accessibility Components (to be implemented in Phase D2)
// export { AccessibleButton } from './AccessibleButton'
// export { SkipLink } from './SkipLink'