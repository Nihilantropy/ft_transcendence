# Input Focus Loss Fix - ProfilePage & UsernameSelectionPage

## Issue Analysis

### 🐛 **The Problem**

When typing in input fields in ProfilePage or UsernameSelectionPage:
- User types a character
- Input loses focus immediately
- User must click back into the input to continue typing
- **Very frustrating UX!**

### 🔍 **Root Cause Analysis**

**1. What Happens on Each Keystroke:**

```
User types 'a' →
  input event fires →
    handleSearchChange('a') →
      setState({ searchQuery: 'a' }) →
        Component.rerender() → (base class)
          parent.replaceChild(newElement, oldElement) →
            ❌ Focus lost! Old input destroyed, new input has no focus
```

**2. Why Component Re-renders:**

ProfilePage stores input values in state:
```typescript
// ProfilePage state
interface ProfilePageState {
  editUsername: string      // 🔴 Stored in state
  editAvatarUrl: string     // 🔴 Stored in state
  searchQuery: string       // 🔴 Stored in state
  deletePassword: string    // 🔴 Stored in state
  // ...
}

// Every keystroke triggers setState()
private handleSearchChange(query: string): void {
  this.setState({ searchQuery: query })  // 🔴 Re-renders entire component
}
```

**3. Component Lifecycle During Re-render:**

```typescript
// Component.ts base class
protected rerender(): void {
  const newHtml = this.render()
  const newElement = createElementFromHTML(newHtml)
  
  // 🔴 PROBLEM: Completely replaces DOM element
  parent.replaceChild(newElement, this.element)
  
  this.element = newElement
  this.afterMount()  // Re-setup event listeners
}
```

**Result:** The old input element (with focus) is destroyed and replaced with a new one (without focus).

### 🤔 **Why LoginPage Doesn't Have This Issue**

**LoginPage uses native form behavior:**
```typescript
// LoginPage - NO state for input values
private renderLoginForm(): string {
  return `
    <form data-login-form="true">
      <input
        type="text"
        name="identifier"
        <!-- 🟢 Value NOT stored in state -->
        <!-- 🟢 No setState() on input change -->
      />
      <input
        type="password"
        name="password"
        <!-- 🟢 Value NOT stored in state -->
      />
    </form>
  `
}

// Values read on submit, not during typing
private async handleLogin(event: Event): Promise<void> {
  const form = event.target as HTMLFormElement
  const formData = new FormData(form)
  
  const credentials = {
    identifier: formData.get('identifier'),  // 🟢 Read once on submit
    password: formData.get('password')
  }
}
```

**Exception:** LoginPage DOES call setState for password validation in register form, which would have the same issue, but most forms don't need real-time validation.

## ✅ Solution

### **Focus Preservation Pattern**

Instead of preventing re-renders (which would break reactivity), we:
1. **Save focus** before re-render
2. **Restore focus** after re-render

### **Implementation**

**1. Track Focused Element:**
```typescript
export class ProfilePage extends Component<Props, State> {
  private lastFocusedElement: string | null = null
  
  // Save focus before every setState
  protected setState(stateUpdates: Partial<State>): void {
    this.saveFocus()
    super.setState(stateUpdates)
  }
  
  private saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && this.element?.contains(activeElement)) {
      // Save data attribute identifier (not DOM reference)
      this.lastFocusedElement = 
        activeElement.getAttribute('data-edit-username') !== null ? 'data-edit-username' :
        activeElement.getAttribute('data-search-input') !== null ? 'data-search-input' :
        // ... other inputs
        null
    }
  }
}
```

**2. Restore Focus After Re-render:**
```typescript
protected afterMount(): void {
  if (!this.element) return
  
  this.setupEventListeners(this.element)
  this.restoreFocus()  // ✅ Restore focus after re-render
}

private restoreFocus(): void {
  if (this.lastFocusedElement && this.element) {
    const elementToFocus = this.element.querySelector(`[${this.lastFocusedElement}]`) as HTMLElement
    
    if (elementToFocus) {
      setTimeout(() => {
        elementToFocus.focus()
        
        // ✅ Restore cursor position to end
        if (elementToFocus instanceof HTMLInputElement) {
          const len = elementToFocus.value.length
          elementToFocus.setSelectionRange(len, len)
        }
      }, 0)
    }
  }
}
```

**3. Use Data Attributes for Identification:**
```typescript
// In render()
<input
  type="text"
  data-search-input    // ✅ Unique identifier
  value="${searchQuery}"
  class="..."
/>
```

### **Why This Works**

1. **Before re-render:** `saveFocus()` saves which input had focus (by data attribute)
2. **During re-render:** Component base class replaces DOM element
3. **After re-render:** `restoreFocus()` finds the new input and restores focus
4. **Cursor position:** `setSelectionRange()` moves cursor to end of text

### **Why We Use Data Attributes (Not DOM References)**

❌ **Don't save DOM reference:**
```typescript
// ❌ BAD: DOM element will be destroyed
this.lastFocusedElement = document.activeElement
```

✅ **Do save identifier:**
```typescript
// ✅ GOOD: Can query new element by attribute
this.lastFocusedElement = 'data-search-input'
```

## Files Modified

### 1. ProfilePage.ts

**Added:**
```typescript
// Track focus
private lastFocusedElement: string | null = null

// Save focus before re-render
protected setState(stateUpdates: Partial<ProfilePageState>): void {
  this.saveFocus()
  super.setState(stateUpdates)
}

// Save currently focused element
private saveFocus(): void { /* ... */ }

// Restore focus after re-render
private restoreFocus(): void { /* ... */ }

// Call restore in afterMount
protected afterMount(): void {
  if (!this.element) return
  this.setupEventListeners(this.element)
  this.restoreFocus()  // ✅ NEW
}
```

**Tracked inputs:**
- `data-edit-username` - Username edit field
- `data-edit-avatar` - Avatar URL field
- `data-search-input` - User search field
- `data-delete-password` - Delete password field
- `data-delete-confirmation` - Delete confirmation field

### 2. UsernameSelectionPage.ts

**Added:**
- Same focus preservation pattern
- Tracks `data-username-input` field

## Testing Checklist

- [x] Can type continuously in username edit field
- [x] Can type continuously in avatar URL field
- [x] Can type continuously in search field
- [x] Can type continuously in delete password field
- [x] Can type continuously in delete confirmation field
- [x] Cursor stays at end of text while typing
- [x] Tab navigation works
- [x] Focus preserved when switching between inputs
- [x] Real-time validation still works
- [x] Debounced API calls still work

## Alternative Solutions (Not Used)

### ❌ Option 1: Don't Store Values in State
```typescript
// Read from DOM directly
const input = document.querySelector('[data-search]') as HTMLInputElement
const value = input.value
```
**Why not:** Breaks React-like state management, harder to debug

### ❌ Option 2: Prevent Re-renders on Input
```typescript
private handleSearchChange(query: string): void {
  // Don't call setState
  this.searchQuery = query  // Direct assignment
}
```
**Why not:** Breaks reactivity, UI won't update (indicators, validation messages)

### ❌ Option 3: Debounce setState
```typescript
private handleSearchChange(query: string): void {
  clearTimeout(this.debounceTimeout)
  this.debounceTimeout = setTimeout(() => {
    this.setState({ searchQuery: query })
  }, 300)
}
```
**Why not:** UI feels laggy, input value not displayed until debounce completes

### ✅ Option 4: Focus Preservation (CHOSEN)
**Why:** Best UX - immediate updates + no focus loss

## Performance Considerations

### Overhead
- Minimal: 2 extra method calls per setState
- `saveFocus()`: O(1) - single DOM query
- `restoreFocus()`: O(1) - single query + focus

### Optimization
```typescript
// Only restore focus if element changed
if (this.lastFocusedElement && this.element) {
  const elementToFocus = this.element.querySelector(...)
  
  // setTimeout ensures DOM is fully updated
  setTimeout(() => elementToFocus.focus(), 0)
}
```

## Best Practices for Future Components

### ✅ DO: Preserve Focus for Forms with Real-time Updates
```typescript
export class MyFormPage extends Component<Props, State> {
  private lastFocusedElement: string | null = null
  
  protected setState(updates: Partial<State>): void {
    this.saveFocus()
    super.setState(updates)
  }
  
  protected afterMount(): void {
    this.setupEventListeners(this.element!)
    this.restoreFocus()
  }
}
```

### ✅ DO: Use Data Attributes for Input Identification
```html
<input data-my-input value="${state.value}" />
```

### ❌ DON'T: Store Input Values in State Unless Needed
```typescript
// ❌ BAD: Unnecessary re-renders
interface State {
  inputValue: string
}

// ✅ GOOD: Read on submit
private handleSubmit(event: Event): void {
  const form = event.target as HTMLFormElement
  const value = new FormData(form).get('myInput')
}
```

## Related Issues

- Component re-rendering lifecycle: `/srcs/frontend/src/components/base/Component.ts`
- State management patterns: `/docs/frontend/PROFILE_PAGE_RERENDER_FIX.md`

## Summary

**Problem:** Input fields lose focus on every keystroke due to DOM replacement during re-render

**Root Cause:** `setState()` triggers `rerender()` which replaces entire DOM element

**Solution:** Save focused element identifier before re-render, restore focus after

**Result:** ✅ Seamless typing experience with reactive state updates

## Code Example

```typescript
// Before (broken)
private handleSearchChange(query: string): void {
  this.setState({ searchQuery: query })
  // 🔴 Focus lost after setState
}

// After (fixed)
private lastFocusedElement: string | null = null

protected setState(updates: Partial<State>): void {
  this.saveFocus()        // ✅ Save before re-render
  super.setState(updates)
}

protected afterMount(): void {
  this.setupEventListeners(this.element!)
  this.restoreFocus()     // ✅ Restore after re-render
}

// Now typing works smoothly! ✅
```
