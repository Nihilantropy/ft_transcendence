import type { Language } from '@/i18n/i18n'
import { unwrap, type ApiResponse } from '@/lib/utils'
import { api, BASE_URL } from './ky'
import type {
  AnalysisPayload,
  ChangePasswordPayload,
  FoodRecommendations,
  LoginPayload,
  LoginResult,
  Pet,
  PetAnalysis,
  PetPayload,
  RegisterPayload,
  ReportTranslation,
  TwoFactorConfirmPayload,
  TwoFactorLoginPayload,
  TwoFactorSetup,
  UpdateProfilePayload,
  User,
  VisionAnalysisData,
} from './types'

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

// "Log in with 42": a full-page navigation, the backend redirects to the intra and back to / (or /login?oauth=… on failure)
export const OAUTH_42_START_URL = `${BASE_URL}/v1/auth/oauth/42/start`

// with 2FA on, the password alone returns a challenge instead of a session
export async function login(data: LoginPayload): Promise<LoginResult> {
  const response: ApiResponse<LoginResult> = await api.post('v1/auth/login', { json: data }).json()
  return unwrap(response)
}

// second login step: the challenge token + a TOTP or recovery code
export async function loginTwoFactor(data: TwoFactorLoginPayload): Promise<User> {
  const response: ApiResponse<{ user: User }> = await api
    .post('v1/auth/login/2fa', { json: data })
    .json()
  return unwrap(response).user
}

export async function register(data: RegisterPayload): Promise<User> {
  const response: ApiResponse<{ user: User }> = await api
    .post('v1/auth/register', { json: data })
    .json()
  return unwrap(response).user
}

export async function verify(): Promise<User> {
  const response: ApiResponse<{ user: User }> = await api.get('v1/auth/verify').json()
  return unwrap(response).user
}

export async function logout(): Promise<void> {
  await api.post('v1/auth/logout')
}

export async function refresh(): Promise<void> {
  await api.post('v1/auth/refresh')
}

export async function changePassword(data: ChangePasswordPayload): Promise<void> {
  await api.put('v1/auth/change-password', { json: data })
}

export async function updateProfile(data: UpdateProfilePayload): Promise<User> {
  const response: ApiResponse<{ user: User }> = await api.patch('v1/auth/me', { json: data }).json()
  return unwrap(response).user
}

/* -------------------------------------------------------------------------- */
/*                         Two-factor authentication                          */
/* -------------------------------------------------------------------------- */

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  const response: ApiResponse<TwoFactorSetup> = await api.post('v1/auth/2fa/setup').json()
  return unwrap(response)
}

export async function enableTwoFactor(data: TwoFactorConfirmPayload): Promise<string[]> {
  const response: ApiResponse<{ recovery_codes: string[] }> = await api
    .post('v1/auth/2fa/enable', { json: data })
    .json()
  return unwrap(response).recovery_codes
}

export async function disableTwoFactor(data: TwoFactorConfirmPayload): Promise<void> {
  await api.post('v1/auth/2fa/disable', { json: data })
}

/* -------------------------------------------------------------------------- */
/*                                    Pets                                    */
/* -------------------------------------------------------------------------- */

export async function listPets(): Promise<Pet[]> {
  const response: ApiResponse<Pet[]> = await api.get('v1/pets').json()
  return unwrap(response)
}

export async function getPet(id: string): Promise<Pet> {
  const response: ApiResponse<Pet> = await api.get(`v1/pets/${id}`).json()
  return unwrap(response)
}

export async function createPet(payload: PetPayload): Promise<Pet> {
  const response: ApiResponse<Pet> = await api.post('v1/pets', { json: payload }).json()
  return unwrap(response)
}

export async function updatePet(id: string, payload: Partial<PetPayload>): Promise<Pet> {
  const response: ApiResponse<Pet> = await api.patch(`v1/pets/${id}`, { json: payload }).json()
  return unwrap(response)
}

export async function deletePet(id: string): Promise<void> {
  await api.delete(`v1/pets/${id}`)
}

export async function listPetAnalyses(petId: string): Promise<PetAnalysis[]> {
  const response: ApiResponse<PetAnalysis[]> = await api.get(`v1/pets/${petId}/analyses`).json()
  return unwrap(response)
}

/* -------------------------------------------------------------------------- */
/*                               Vision analysis                              */
/* -------------------------------------------------------------------------- */

// the owner's optional note
export const USER_CONTEXT_MAX_LENGTH = 1000

export async function analyzeImage(
  imageDataUri: string,
  language: Language,
  userContext: string,
  signal?: AbortSignal,
): Promise<VisionAnalysisData> {
  const response: ApiResponse<VisionAnalysisData> = await api
    .post('v1/vision/analyze', {
      // an empty note is left out, like before the field existed
      json: { image: imageDataUri, language, user_context: userContext || undefined },
      timeout: 300_000,
      signal,
    })
    .json()
  // saved with the report, so it can be translated when the interface changes language
  return { ...unwrap(response), language }
}

export async function createAnalysis(payload: AnalysisPayload): Promise<PetAnalysis> {
  const response: ApiResponse<PetAnalysis> = await api.post('v1/analyses', { json: payload }).json()
  return unwrap(response)
}

export async function translateReport(texts: string[], language: Language): Promise<string[]> {
  const response: ApiResponse<{ texts: string[] }> = await api
    .post('v1/vision/translate', { json: { texts, language }, timeout: 120_000 })
    .json()
  return unwrap(response).texts
}

export async function saveReportTranslation(
  analysisId: string,
  language: Language,
  translation: ReportTranslation,
): Promise<PetAnalysis> {
  const response: ApiResponse<PetAnalysis> = await api
    .post(`v1/analyses/${analysisId}/translations`, { json: { language, ...translation } })
    .json()
  return unwrap(response)
}

/* -------------------------------------------------------------------------- */
/*                               Recommendations                              */
/* -------------------------------------------------------------------------- */

// foods ranked for one pet
export async function getFoodRecommendations(
  petId: string,
  limit?: number,
): Promise<FoodRecommendations> {
  const searchParams = limit ? { pet_id: petId, limit } : { pet_id: petId }
  const response: ApiResponse<FoodRecommendations> = await api
    .get('v1/recommendations/food', { searchParams })
    .json()
  return unwrap(response)
}
