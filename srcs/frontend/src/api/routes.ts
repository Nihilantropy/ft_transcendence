import { unwrap, type ApiResponse } from '@/lib/utils'
import { api } from './ky'
import type { ChangePasswordPayload, LoginPayload, RegisterPayload, User } from './types'

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
