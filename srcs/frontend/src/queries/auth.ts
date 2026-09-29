import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  login,
  loginTwoFactor,
  logout,
  register,
  setupTwoFactor,
  updateProfile,
  verify,
} from '@/api/routes'
import type { User } from '@/api/types'
import { queryClient } from '@/providers/queryClient'
import { useAuthStore } from '@/stores/auth'
import { useMutation } from '@tanstack/react-query'

// a fresh session: drop every cached query of the previous user
const startSession = (user: User) => {
  queryClient.clear()
  useAuthStore.getState().setUser(user)
}

// re-read the user after a change the backend only reflects in /verify
const refreshUser = async () => {
  useAuthStore.getState().setUser(await verify())
}

// resolves to the user, or to the 2FA challenge token when a code is needed
export const useLoginMutation = () =>
  useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      if ('user' in result) startSession(result.user)
    },
  })

export const useLoginTwoFactorMutation = () =>
  useMutation({
    mutationFn: loginTwoFactor,
    onSuccess: startSession,
  })

export const useRegisterMutation = () =>
  useMutation({
    mutationFn: register,
    onSuccess: startSession,
  })

// the caller reloads the app on /login afterwards, which drops user and cache
export const useLogoutMutation = () =>
  useMutation({
    mutationFn: logout,
  })

export const useChangePasswordMutation = () =>
  useMutation({
    mutationFn: changePassword,
    onSuccess: refreshUser,
  })

export const useUpdateProfileMutation = () =>
  useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user)
    },
  })

export const useSetupTwoFactorMutation = () =>
  useMutation({
    mutationFn: setupTwoFactor,
  })

export const useEnableTwoFactorMutation = () =>
  useMutation({
    mutationFn: enableTwoFactor,
    onSuccess: refreshUser,
  })

export const useDisableTwoFactorMutation = () =>
  useMutation({
    mutationFn: disableTwoFactor,
    onSuccess: refreshUser,
  })
