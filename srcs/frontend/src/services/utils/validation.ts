import { z } from 'zod'

/**
 * @brief Safe parsing with error handling
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: true; data: T 
} | { 
  success: false; errors: string[] 
} {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return {
    success: false,
    errors: result.error.issues.map(err => 
      `${err.path.join('.')}: ${err.message}`
    )
  }
}