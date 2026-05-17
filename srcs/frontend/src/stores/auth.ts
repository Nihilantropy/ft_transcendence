import type { User } from '@/api/types'
import { create } from 'zustand'

interface AuthState {
  // current authenticated user, or null
  user: User | null
  // true once the initial verify() call has completed
  isReady: boolean
  setUser: (user: User | null) => void
  clearUser: () => void
  setReady: (ready: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isReady: false,
  setUser: (user) => {
    set({ user })
  },
  clearUser: () => {
    set({ user: null })
  },
  setReady: (isReady) => {
    set({ isReady })
  },
}))

export const useUser = (): User | null => useAuthStore((s) => s.user)
export const useIsAuthenticated = (): boolean => useAuthStore((s) => s.user !== null)
export const useIsAuthReady = (): boolean => useAuthStore((s) => s.isReady)
