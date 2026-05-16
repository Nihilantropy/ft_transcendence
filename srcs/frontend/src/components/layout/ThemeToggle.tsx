import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'


// theme toggle component
// default theme is system, any click will switch to the opposite of the current resolved theme
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-hidden disabled />
  }

  const isDark = resolvedTheme === 'dark'
  // if the theme is explicitly set to light or dark
  const isExplicit = theme !== 'system'

  const handleClick = () => {
    if (isExplicit) {
      setTheme('system')
    } else {
      setTheme(isDark ? 'light' : 'dark')
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label={isDark ? t('accessibility.switchToLight') : t('accessibility.switchToDark')}
    >
      {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </Button>
  )
}
