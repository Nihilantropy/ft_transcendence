import { unwrap, type ApiResponse } from '@/lib/utils'
import { api } from './ky'
import type {
  ChangePasswordPayload,
  LoginPayload,
  Pet,
  PetAnalysis,
  PetPayload,
  RegisterPayload,
  User,
} from './types'

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

export async function login(data: LoginPayload): Promise<User> {
  const response: ApiResponse<{ user: User }> = await api
    .post('v1/auth/login', { json: data })
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
