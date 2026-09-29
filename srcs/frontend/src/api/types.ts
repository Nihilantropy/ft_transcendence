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
  photo: string
  created_at: string
  updated_at: string
}

// input shape for create / update
export type PetPayload = Pick<Pet, 'name' | 'species'> &
  Partial<
    Pick<Pet, 'breed' | 'breed_confidence' | 'age' | 'weight' | 'health_conditions' | 'photo'>
  >

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

export type AnalysisPayload = Omit<PetAnalysis, 'id' | 'created_at'>

export const ANALYSIS_IMAGE_PLACEHOLDER = 'placeholder://no-storage'

// ---------------------------------------------------------------------------
// Vision analysis (AI service)
// ---------------------------------------------------------------------------

export type BreedProbability = {
  breed: string
  probability: number
}

export type CrossbreedAnalysis = {
  detected_breeds: string[]
  common_name?: string | null
  confidence_reasoning: string
}

export type BreedAnalysisResult = {
  primary_breed: string
  confidence: number
  is_likely_crossbreed: boolean
  breed_probabilities: BreedProbability[]
  crossbreed_analysis: CrossbreedAnalysis | null
}

export type EnrichedInfo = {
  breed?: string | null
  parent_breeds?: string[] | null
  description: string
  care_summary: string
  health_info: string
  sources: string[]
}

export type BreedTraits = {
  size?: 'small' | 'medium' | 'large' | null
  energy_level?: 'low' | 'medium' | 'high' | null
  temperament?: string
}

export type VisionAnalysisData = {
  species: string
  breed_analysis: BreedAnalysisResult
  description: string
  traits: BreedTraits
  health_observations: string[]
  enriched_info: EnrichedInfo | null
}
