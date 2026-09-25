import { THEME_OPTIONS, useTheme } from '@/lib/theme'

import { cn } from '@/lib/cn'

/** Tema tanlash — har biri kichik rang namunasi bilan. */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          aria-pressed={theme === option.value}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 text-left transition',
            theme === option.value
              ? 'border-brand-500 ring-2 ring-brand-100'
              : 'border-slate-200 hover:border-slate-300',
          )}
        >
          <span
            className="size-8 shrink-0 overflow-hidden rounded-full border border-black/10"
            style={{
              background: `linear-gradient(135deg, ${option.preview[0]} 50%, ${option.preview[1]} 50%)`,
            }}
          />
          <span className="text-sm font-medium text-slate-800">{option.label}</span>
        </button>
      ))}
    </div>
  )
}
