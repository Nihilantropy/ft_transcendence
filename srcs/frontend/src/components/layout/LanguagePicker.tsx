import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown'
import { currentLanguage, type Language } from '@/i18n/i18n'
import { useTranslation } from 'react-i18next'

// the trigger shows the code, the list each language in its own name
const LANGUAGE_OPTIONS: DropdownOption<Language>[] = [
  { value: 'it', label: 'IT', render: 'Italiano' },
  { value: 'en', label: 'EN', render: 'English' },
  { value: 'ja', label: 'JA', render: '日本語' },
]

export function LanguagePicker() {
  const { i18n, t } = useTranslation()

  return (
    <div aria-label={t('accessibility.switchLanguage')} role="group">
      <Dropdown
        value={currentLanguage()}
        onChange={(lang) => {
          void i18n.changeLanguage(lang)
        }}
        options={LANGUAGE_OPTIONS}
        searchable={false}
        align="end"
        className="text-text-mid hover:text-text-hi hover:bg-accent/10 h-10 w-auto gap-1 border-transparent px-3 text-xs tracking-[0.18em] uppercase"
      />
    </div>
  )
}
