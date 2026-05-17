import { changePassword, login, logout, register } from '@/api/routes'
import { useAuthStore } from '@/stores/auth'
import { useMutation } from '@tanstack/react-query'

export const useLoginMutation = () =>
  useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user)
    },
  })

export const useRegisterMutation = () =>
  useMutation({
    mutationFn: register,
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user)
    },
  })

export const useLogoutMutation = () =>
  useMutation({
    mutationFn: logout,
    onSettled: () => {
      useAuthStore.getState().clearUser()
    },
  })

export const useChangePasswordMutation = () =>
  useMutation({
    mutationFn: changePassword,
  })
