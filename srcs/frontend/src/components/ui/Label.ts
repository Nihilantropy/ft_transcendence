/**
 * @brief Gaming-themed Label component for ft_transcendence
 * 
 * @description Form label component for proper input associations and accessibility.
 * Extends base Component class with simple rendering and gaming theme styling.
 * 
 * Phase B3.3 implementation - Label Component
 * 
 * FILE: src/components/ui/Label.ts
 */

import { Component } from '../base/Component'

/**
 * @brief Label component properties interface
 * 
 * @description Type-safe props for Label component configuration.
 */
export interface LabelProps {
  /** Label text content */
  text: string
  
  /** HTML for attribute - links to input ID */
  htmlFor: string
  
  /** Whether associated input is required (default: false) */
  required?: boolean
  
  /** Additional CSS classes */
  className?: string
  
  /** Whether to show required indicator (default: true when required) */
  showRequiredIndicator?: boolean
}

/**
 * @brief Gaming-themed Label component class
 * 
 * @description Implements form label with proper input associations,
 * required field indicators, and gaming aesthetics.
 */
export class Label extends Component<LabelProps, {}> {
  /**
   * @brief Initialize Label component
   * 
   * @param props - Label configuration properties
   * 
   * @description Creates label instance and validates required props.
   */
  constructor(props: LabelProps) {
    super(props, {})
    
    // Validate required props
    if (!props.text) {
      throw new Error('Label component requires text prop')
    }
    
    if (!props.htmlFor) {
      throw new Error('Label component requires htmlFor prop for accessibility')
    }
  }

  /**
   * @brief Render label to HTML string
   * 
   * @return HTML string representation of label
   * 
   * @description Generates label HTML with proper associations and styling.
   */
  render(): string {
    const {
      text,
      htmlFor,
      required = false,
      className = '',
      showRequiredIndicator = true
    } = this.props

    // Build CSS classes
    const labelClasses = this.getLabelClasses(className)
    
    // Build label content with optional required indicator
    const labelContent = this.buildLabelContent(text, required, showRequiredIndicator)

    return `
      <label 
        for="${htmlFor}"
        class="${labelClasses}"
        data-label
      >
        ${labelContent}
      </label>
    `
  }

  /**
   * @brief Get label CSS classes
   * 
   * @param className - Additional custom classes
   * @return Label CSS classes string
   * 
   * @description Returns label classes using existing Tailwind theme.
   */
  private getLabelClasses(className: string): string {
    const baseClasses = 'label-base' // Uses existing .label-base from components.css
    
    return `${baseClasses} ${className}`.trim()
  }

  /**
   * @brief Build label content with required indicator
   * 
   * @param text - Label text
   * @param required - Whether field is required
   * @param showRequiredIndicator - Whether to show required asterisk
   * @return Label content HTML string
   * 
   * @description Constructs label content with optional required field indicator.
   */
  private buildLabelContent(
    text: string, 
    required: boolean, 
    showRequiredIndicator: boolean
  ): string {
    const escapedText = this.escapeHtml(text)
    
    if (required && showRequiredIndicator) {
      return `
        ${escapedText}
        <span class="text-red-400 ml-1" aria-label="required">*</span>
      `
    }
    
    return escapedText
  }

  /**
   * @brief Escape HTML characters for security
   * 
   * @param str - String to escape
   * @return Escaped string
   * 
   * @description Prevents XSS by escaping HTML characters.
   */
  private escapeHtml(str: string): string {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  /**
   * @brief Get associated input ID (convenience method)
   * 
   * @return Input ID that this label is associated with
   * 
   * @description Helper to get the htmlFor value.
   */
  public getAssociatedInputId(): string {
    return this.props.htmlFor
  }

  /**
   * @brief Check if label is for required field (convenience method)
   * 
   * @return True if associated field is required
   * 
   * @description Helper to check required state.
   */
  public isRequired(): boolean {
    return this.props.required || false
  }
}