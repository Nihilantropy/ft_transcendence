// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type User = {
  id: string
  email: string
  role?: string
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
}

export type ChangePasswordPayload = {
  old_password: string
  new_password: string
  password_confirm: string
}
