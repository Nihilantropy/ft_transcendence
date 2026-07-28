import { changePassword, login, logout, register } from '@/api/routes'
import { queryClient } from '@/providers/queryClient'
import { useAuthStore } from '@/stores/auth'
import { useMutation } from '@tanstack/react-query'

export const useLoginMutation = () =>
  useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.clear()
      useAuthStore.getState().setUser(user)
    },
  })

export const useRegisterMutation = () =>
  useMutation({
    mutationFn: register,
    onSuccess: (user) => {
      queryClient.clear()
      useAuthStore.getState().setUser(user)
    },
  })

export const useLogoutMutation = () =>
  useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear()
      useAuthStore.getState().clearUser()
    },
  })

export const useChangePasswordMutation = () =>
  useMutation({
    mutationFn: changePassword,
  })
