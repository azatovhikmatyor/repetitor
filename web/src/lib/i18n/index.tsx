import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { Dictionary } from './dictionaries/uz'
export type { Dictionary }

/**
 * Tillar ro'yxati — yangi til qo'shishning yagona joyi.
 *
 * Yangi tilni qo'shish uchun: `dictionaries/en.ts` fayl yozing (u
 * `Dictionary` tipini to'liq qanoatlantirishi shart — bitta kalit
 * tushib qolsa TypeScript xato beradi), so'ng shu ro'yxatga bitta qator
 * qo'shing. Boshqa hech qanday fayl o'zgarmaydi: barcha ekranlar `t.xxx`
 * orqali ishlaydi, string kalitlar bilan emas.
 *
 * Lug'atlar `import()` orqali kerak bo'lganda yuklanadi — ishlatilmagan
 * til uchun matnlar brauzerga umuman yuborilmaydi (alohida chunk).
 */
const LOCALE_LOADERS = {
  uz: () => import('./dictionaries/uz').then((m) => m.default),
  ru: () => import('./dictionaries/ru').then((m) => m.default),
} satisfies Record<string, () => Promise<Dictionary>>

const LOCALE_LABELS = {
  uz: "O'zbekcha",
  ru: 'Русский',
} satisfies Record<keyof typeof LOCALE_LOADERS, string>

export type Locale = keyof typeof LOCALE_LOADERS

export const LOCALE_OPTIONS = (Object.keys(LOCALE_LOADERS) as Locale[]).map((value) => ({
  value,
  label: LOCALE_LABELS[value],
}))

const STORAGE_KEY = 'locale'

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in LOCALE_LOADERS) return stored as Locale
  } catch {
    // localStorage yopiq bo'lishi mumkin (xususiy rejim) — standart tilga qaytamiz.
  }
  return 'uz'
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Dictionary
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readStoredLocale)
  const [dict, setDict] = useState<Dictionary | null>(null)

  useEffect(() => {
    let cancelled = false
    void LOCALE_LOADERS[locale]().then((loaded) => {
      if (!cancelled) setDict(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [locale])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Xususiy rejimda yozib bo'lmasa ham ilova ishlashda davom etadi.
    }
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue | null>(
    () => (dict ? { locale, setLocale, t: dict } : null),
    [locale, dict],
  )

  // Lug'at hali yuklanmoqda — bir lahzalik bo'sh ekran, matnga bog'liq
  // hech narsa (Spinner ham) shu paytda ishlatilmaydi.
  if (!value) return null

  return <I18nContext value={value}>{children}</I18nContext>
}

/** Joriy tildagi matnlar: `const t = useT(); t.common.save`. */
export function useT(): Dictionary {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useT <I18nProvider> ichida ishlatiladi')
  return context.t
}

/** Til tanlash uchun: joriy til va uni o'zgartirish funksiyasi. */
export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useLocale <I18nProvider> ichida ishlatiladi')
  return { locale: context.locale, setLocale: context.setLocale }
}
