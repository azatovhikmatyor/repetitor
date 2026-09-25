import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { ThemeTokens } from './themes/light'

/**
 * Temalar ro'yxati — yangi tema qo'shishning yagona joyi.
 *
 * Yangi tema qo'shish uchun: `themes/<nom>.ts` fayl yozing (u
 * `ThemeTokens` tipini to'liq qanoatlantirishi shart — bitta rang tushib
 * qolsa TypeScript xato beradi), so'ng shu ro'yxatga bitta qator qo'shing.
 * Ranglar hech qanday komponentda hardcoded emas: barcha ekranlar
 * Tailwind'ning `slate-*`/`brand-*`/`paid`/`partial`/`unpaid` klasslari
 * orqali ishlaydi, ular esa CSS o'zgaruvchilariga (`--color-*`) bog'liq —
 * shu o'zgaruvchilarni tema almashtirganda qayta yozamiz, xolos.
 *
 * Har bir tema alohida fayl bo'lgani uchun faqat tanlangan tema
 * `import()` orqali yuklanadi — ishlatilmagan temalar brauzerga umuman
 * yuborilmaydi.
 */
const THEME_LOADERS = {
  light: () => import('./themes/light').then((m) => m.default),
  dark: () => import('./themes/dark').then((m) => m.default),
  mirage: () => import('./themes/mirage').then((m) => m.default),
  sepia: () => import('./themes/sepia').then((m) => m.default),
  nord: () => import('./themes/nord').then((m) => m.default),
} satisfies Record<string, () => Promise<ThemeTokens>>

/** UI'da ko'rsatiladigan nom va tanlash oynasidagi kichik namuna ranglar. */
const THEME_META = {
  light: { label: "Yorug'", scheme: 'light', preview: ['#ffffff', '#1e8a5f'] },
  dark: { label: "Qorong'i", scheme: 'dark', preview: ['#1c2333', '#4fcf93'] },
  mirage: { label: 'Mirage', scheme: 'dark', preview: ['#181c2c', '#4ad6a0'] },
  sepia: { label: 'Sepiya', scheme: 'light', preview: ['#f6ecd9', '#5c7a3a'] },
  nord: { label: 'Nord', scheme: 'dark', preview: ['#242c3d', '#4fcf93'] },
} satisfies Record<
  keyof typeof THEME_LOADERS,
  { label: string; scheme: 'light' | 'dark'; preview: [string, string] }
>

export type Theme = keyof typeof THEME_LOADERS

export const THEME_OPTIONS = (Object.keys(THEME_LOADERS) as Theme[]).map((value) => ({
  value,
  ...THEME_META[value],
}))

const STORAGE_KEY = 'theme'

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in THEME_LOADERS) return stored as Theme
  } catch {
    // localStorage yopiq bo'lishi mumkin (xususiy rejim) — standart temaga qaytamiz.
  }
  return 'light'
}

/** `--color-*` o'zgaruvchilarini `<html>` ustiga yozadi — shu bilan butun ilova qayta ranglanadi. */
function applyTheme(tokens: ThemeTokens, theme: Theme) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--color-${key}`, value)
  }
  root.dataset.theme = theme
  root.style.colorScheme = THEME_META[theme].scheme
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    let cancelled = false
    void THEME_LOADERS[theme]().then((tokens) => {
      if (!cancelled) applyTheme(tokens, theme)
    })
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Xususiy rejimda yozib bo'lmasa ham ilova ishlashda davom etadi.
    }
    return () => {
      cancelled = true
    }
  }, [theme])

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}

/** Joriy tema va uni o'zgartirish funksiyasi: `const { theme, setTheme } = useTheme()`. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme <ThemeProvider> ichida ishlatiladi')
  return context
}
