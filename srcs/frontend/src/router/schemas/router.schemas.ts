/**
 * @brief Router schemas and types with Zod validation
 * 
 * @description Zod schemas and TypeScript types for router configuration.
 * Migrated from old types system to Zod schema architecture.
 */

import { z } from 'zod'

// =============================================================================
// ROUTE HANDLER TYPE
// =============================================================================

/**
 * @brief Route handler function signature
 * @param params - Dynamic route parameters (e.g., { id: '123' })
 * @param query - Query string parameters (e.g., { search: 'term' })
 */
export type RouteHandler = (
  params: Record<string, string>,
  query: Record<string, string>
) => Promise<void> | void

/**
 * @brief Route change event listener function signature
 * @param event - Route change event containing from/to paths and params
 */
export type RouteChangeListener = (event: RouteChangeEvent) => void

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * @brief Route configuration schema
 * 
 * Note: Handler is typed as 'any' in schema but has a proper TypeScript type
 * because Zod function validation is limited and doesn't support our exact signature.
 */
export const RouteConfigSchema = z.object({
  path: z.string()
    .min(1, "Route path cannot be empty")
    .describe("Route path pattern (e.g., '/profile', '/game/:id')"),
  
  handler: z.any()
    .describe("Function to execute when route is matched"),
  
  requiresAuth: z.boolean()
    .default(false)
    .describe("Whether the route requires authentication"),
  
  redirect: z.string()
    .optional()
    .describe("Path to redirect to if access is denied"),
  
  meta: z.record(z.string(), z.any())
    .optional()
    .describe("Additional metadata for the route"),
  
  title: z.string()
    .optional()
    .describe("Page title to set when route is active")
})

/**
 * @brief Navigation options schema
 */
export const NavigationOptionsSchema = z.object({
  replace: z.boolean()
    .optional()
    .describe("Replace current history entry instead of pushing new one"),
  
  state: z.any()
    .optional()
    .describe("State object to pass with navigation")
})

/**
 * @brief Route change event schema
 */
export const RouteChangeEventSchema = z.object({
  from: z.string()
    .nullable()
    .describe("Previous route path"),
  
  to: z.string()
    .describe("New route path"),
  
  params: z.record(z.string(), z.string())
    .describe("Route parameters extracted from path"),
  
  query: z.record(z.string(), z.string())
    .describe("Query string parameters")
})

/**
 * @brief Router initialization options schema
 */
export const RouterOptionsSchema = z.object({
  basePath: z.string()
    .optional()
    .describe("Base path prefix for all routes"),
  
  fallbackRoute: z.string()
    .optional()
    .describe("Default route to navigate to when no match is found")
})

// =============================================================================
// TYPESCRIPT TYPES (inferred from schemas)
// =============================================================================

/**
 * @brief Route configuration type
 */
export type RouteConfig = z.infer<typeof RouteConfigSchema>

/**
 * @brief Navigation options type
 */
export type NavigationOptions = z.infer<typeof NavigationOptionsSchema>

/**
 * @brief Route change event type
 */
export type RouteChangeEvent = z.infer<typeof RouteChangeEventSchema>

/**
 * @brief Router options type
 */
export type RouterOptions = z.infer<typeof RouterOptionsSchema>

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * @brief Validate route configuration
 * @param config - Route configuration to validate
 * @returns Validated route configuration or throws error
 */
export function validateRouteConfig(config: unknown): RouteConfig {
  return RouteConfigSchema.parse(config)
}

/**
 * @brief Validate navigation options
 * @param options - Navigation options to validate
 * @returns Validated navigation options or throws error
 */
export function validateNavigationOptions(options: unknown): NavigationOptions {
  return NavigationOptionsSchema.parse(options)
}

/**
 * @brief Validate router options
 * @param options - Router options to validate
 * @returns Validated router options or throws error
 */
export function validateRouterOptions(options: unknown): RouterOptions {
  return RouterOptionsSchema.parse(options)
}

/**
 * @brief Safe parse route configuration
 * @param config - Route configuration to validate
 * @returns Validation result with data or error
 */
export function safeParseRouteConfig(config: unknown) {
  return RouteConfigSchema.safeParse(config)
}

/**
 * @brief Safe parse navigation options
 * @param options - Navigation options to validate
 * @returns Validation result with data or error
 */
export function safeParseNavigationOptions(options: unknown) {
  return NavigationOptionsSchema.safeParse(options)
}

/**
 * @brief Safe parse router options
 * @param options - Router options to validate
 * @returns Validation result with data or error
 */
export function safeParseRouterOptions(options: unknown) {
  return RouterOptionsSchema.safeParse(options)
}
