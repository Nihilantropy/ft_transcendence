import type { Language } from '@/i18n/i18n'

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
  two_factor_enabled?: boolean
  // false for an account created through 42 until the user sets a password
  has_password?: boolean
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
  current_password?: string
  new_password: string
  new_password_confirm: string
  code?: string
}

// POST /auth/login answers with a session, or with a 2FA challenge when 2FA is on
export type LoginResult = { user: User } | { mfa_required: true; mfa_token: string }

export type TwoFactorLoginPayload = {
  mfa_token: string
  code: string
}

// PATCH /auth/me: an email change needs current_password (+ code when 2FA is on)
export type UpdateProfilePayload = {
  first_name?: string
  last_name?: string
  email?: string
  current_password?: string
  code?: string
}

export type TwoFactorSetup = {
  secret: string
  otpauth_uri: string
}

// 2fa/enable and 2fa/disable: current password + a code
export type TwoFactorConfirmPayload = {
  current_password: string
  code: string
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
  language?: Language
  translations?: Partial<Record<Language, ReportTranslation>>
}

// the report's free text: what changes with the language
export type ReportTranslation = {
  description: string
  temperament: string
  health_observations: string[]
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type NutritionalHighlights = {
  protein_percentage: number | null
  fat_percentage: number | null
  calories_per_100g: number | null
}

export type RecommendationItem = {
  product_id: number
  name: string
  brand: string
  price: number | null
  product_url: string | null
  image_url: string | null
  similarity_score: number
  rank_position: number
  match_reasons: string[]
  nutritional_highlights: NutritionalHighlights
}

export type FoodRecommendations = {
  recommendations: RecommendationItem[]
  metadata: Record<string, unknown>
  algorithm_version: string
}
