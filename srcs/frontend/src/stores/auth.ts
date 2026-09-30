import type { User } from '@/api/types'
import { create } from 'zustand'

interface AuthState {
  // current authenticated user, or null
  user: User | null
  // true once the initial verify() call has completed
  isReady: boolean
  // set when the initial verify() failed for another reason than 401
  sessionError: Error | null
  setUser: (user: User | null) => void
  setReady: (ready: boolean) => void
  setSessionError: (error: Error | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isReady: false,
  sessionError: null,
  setUser: (user) => {
    set({ user, sessionError: null })
  },
  setReady: (isReady) => {
    set({ isReady })
  },
  setSessionError: (sessionError) => {
    set({ sessionError })
  },
}))

export const useUser = (): User | null => useAuthStore((s) => s.user)
export const useIsAuthenticated = (): boolean => useAuthStore((s) => s.user !== null)
export const useSessionError = (): Error | null => useAuthStore((s) => s.sessionError)
export const useIsAuthReady = (): boolean => useAuthStore((s) => s.isReady)
