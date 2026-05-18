export interface NavItem {
  to: string
  labelKey: string
}

/** Routes shown only to authenticated users (the main app surface). */
export const AUTHED_NAV: ReadonlyArray<NavItem> = [
  { to: '/analyze', labelKey: 'nav.analyze' },
  { to: '/pets', labelKey: 'nav.pets' },
]
