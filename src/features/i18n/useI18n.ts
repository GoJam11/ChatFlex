import { useI18n as useVueI18n } from 'vue-i18n'
import { switchLocale, getCurrentLocale, SUPPORTED_LOCALES, getLocalizedLanguageName, type SupportedLocale } from '@/i18n'

export function useI18n() {
  const { t, locale } = useVueI18n()

  const changeLocale = async (newLocale: SupportedLocale) => {
    await switchLocale(newLocale)
  }

  const currentLocale = getCurrentLocale()

  const availableLocales = SUPPORTED_LOCALES.map(code => ({
    code,
    name: getLocalizedLanguageName(code)
  }))

  return {
    t,
    locale,
    currentLocale,
    changeLocale,
    availableLocales
  }
}
