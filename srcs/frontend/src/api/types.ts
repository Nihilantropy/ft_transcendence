// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type User = {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role?: string
  is_verified?: boolean
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type LoginPayload = {
  email: string
  password: string
}

export type RegisterPayload = {
  email: string
  password: string
  password_confirm: string
  first_name?: string
}

export type ChangePasswordPayload = {
  old_password: string
  new_password: string
  password_confirm: string
}

// ---------------------------------------------------------------------------
// Pet
// ---------------------------------------------------------------------------

export type Species = 'dog' | 'cat' | 'other'

// list-filter variant: every species plus the "no filter" sentinel
export type SpeciesFilter = Species | 'all'

export type Pet = {
  id: string
  user_id: string
  name: string
  breed: string
  breed_confidence: number | null
  species: Species
  age: number | null
  weight: number | null
  health_conditions: string[]
  image_url: string | null
  created_at: string
  updated_at: string
}

// input shape for create / update
export type PetPayload = Pick<Pet, 'name' | 'species'> &
  Partial<Pick<Pet, 'breed' | 'age' | 'weight' | 'health_conditions'>>

// ---------------------------------------------------------------------------
// Pet analyses
// ---------------------------------------------------------------------------

export type PetAnalysis = {
  id: string
  pet_id: string
  user_id: string
  image_url: string
  breed_detected: string
  confidence: number
  traits: Record<string, unknown>
  raw_response: Record<string, unknown> | null
  created_at: string
}
