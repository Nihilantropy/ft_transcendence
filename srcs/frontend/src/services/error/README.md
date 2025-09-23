# Error Handling System

This directory contains the centralized error handling system for the ft_transcendence frontend application. The system is designed to provide consistent, user-friendly error handling across the entire application using a simplified approach with generic Error types.

## Overview

The error handling system consists of:
- **catchErrorTyped function**: A utility for graceful error handling with Go-style error returns
- **Generic Error handling**: Services throw standard JavaScript Error objects with meaningful messages
- **Page-level error handling**: Individual pages catch and display errors to users

## catchErrorTyped Function

The `catchErrorTyped` function is the main error wrapper for our application. It transforms Promise-based operations into a Go-style error handling pattern, returning a tuple `[error, data]` instead of throwing exceptions.

### Function Signature

```typescript
function catchErrorTyped<T, E extends Error>(
	promise: Promise<T>,
	errorToCatch?: (new (message?: string) => E)[]
): Promise<[E | undefined, T | undefined]>
```

### Parameters

- `promise`: The Promise to execute and catch errors from
- `errorToCatch` (optional): Array of Error constructors to specifically catch. **When omitted, catches all errors**

### Return Value

Returns a Promise that resolves to a tuple:
- `[error, undefined]` if an error occurred
- `[undefined, data]` if the operation was successful

### How It Works

1. **Success Case**: If the promise resolves successfully, returns `[undefined, data]`
2. **Error Case**: If the promise rejects, returns `[error, undefined]`
3. **Fallback**: Unknown errors become a generic InternalServerError object

## Basic Usage Example

```typescript
import { catchErrorTyped } from './catchError';

// Basic usage - catch all errors (most common pattern)
const [error, user] = await catchErrorTyped(createUser(userData));

if (error) {
    console.error('User creation failed:', error.message);
    showErrorPopup(error.message); // Display to user
    return;
}

// Success case
console.log('User created successfully:', user);
```

## Service Layer Implementation

Services use catchErrorTyped and throw generic Error objects when API requests fail:

```typescript
// In AuthService
async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User }> {
    const [error, response] = await catchErrorTyped(
        this.apiService.post('/auth/login', credentials)
    );

    if (error) {
        // Service throws generic Error - pages will catch it
        throw new Error(error.message || 'Login failed');
    }

    if (!response.data.success) {
        // API returned error response
        throw new Error(response.data.message || 'Login failed');
    }

    return { 
        success: true, 
        user: response.data.user 
    };
}
```

## Page-Level Error Handling

Pages catch errors from services and display them to users:

```typescript
// In LoginPage component
private async performLogin(credentials: LoginCredentials): Promise<void> {
    try {
        const result = await authService.login(credentials);
        
        if (result.success) {
            showPopup('Login successful!');
            router.navigate('/');
        }
    } catch (error: unknown) {
        // Simple error display
        this.handleError(error);
    }
}

private handleError(error: unknown): void {
    console.error('❌ Error occurred:', error);
    
    // Show error popup with user-friendly message
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    showPopup(errorMessage);
}
```

## API Service Implementation

The BaseApiService throws generic Error objects based on HTTP status:

```typescript
// In BaseApiService
private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const message = responseData?.message || response.statusText;
            throw new Error(message); // Generic Error with meaningful message
        }
        
        return { data: responseData, success: true };
        
    } catch (error) {
        if (error instanceof Error) {
            throw error; // Re-throw existing Error
        }
        throw new Error('Network request failed'); // Generic network error
    }
}
```

## Error Flow Pattern

The complete error flow follows this simple pattern:

1. **API Request**: Service makes HTTP request via BaseApiService
2. **HTTP Error**: BaseApiService throws Error with response message
3. **Service Layer**: Service catches error via catchErrorTyped
4. **Service Response**: Service throws Error or returns success data
5. **Page Layer**: Page catches service Error and displays to user

```typescript
// Complete flow example
try {
    // 1. Page calls service
    const result = await authService.register(userData);
    
    // Handle success
    showPopup('Registration successful!');
    
} catch (error) {
    // 5. Page catches any Error and shows to user
    const message = error instanceof Error ? error.message : 'Something went wrong';
    showPopup(message);
}

// Inside authService.register():
async register(userData): Promise<{ success: boolean }> {
    // 2. Service uses catchErrorTyped
    const [error, response] = await catchErrorTyped(
        this.apiService.post('/auth/register', userData)
    );
    
    if (error) {
        // 4. Service throws generic Error
        throw new Error(error.message || 'Registration failed');
    }
    
    return { success: true };
}
```

## Benefits of This Approach

1. **Simplicity**: No complex error hierarchies or custom error classes
2. **Consistency**: All errors are standard JavaScript Error objects
3. **User-Friendly**: Error messages are crafted for end-user display
4. **Type Safety**: catchErrorTyped provides type-safe error handling
5. **Linear Flow**: Clear path from service → page → user display
6. **No Redundancy**: Single error handling at the page level

## Error Message Guidelines

When creating error messages in services:
- **Be user-friendly**: "Invalid email or password" instead of "Authentication failed"
- **Be specific**: "Email already exists" instead of "Conflict error"
- **Be actionable**: "Please check your internet connection" for network errors
- **Use consistent tone**: Professional but friendly language

## Best Practices

1. **Services throw, Pages catch**: Services throw Error objects, pages handle display
2. **Use catchErrorTyped in services**: Wrap all async operations that can fail
3. **Generic Error objects**: Don't create custom error classes unless absolutely necessary
4. **Meaningful messages**: Error messages should be ready for user display
5. **Single error point**: Handle errors once at the page level, not multiple times

## WebSocket Error Handling

For real-time features like WebSocket connections, use the specialized WebSocket error handlers that extend this same pattern with game-specific error types.

This simplified system ensures consistent, maintainable error handling across the entire application while providing excellent user experience.