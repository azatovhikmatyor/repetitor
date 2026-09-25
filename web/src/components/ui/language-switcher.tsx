import { LOCALE_OPTIONS, useLocale } from '@/lib/i18n'

import { cn } from '@/lib/cn'

/** Til tanlash — profil va kirish sahifalarida bir xil ko'rinishda. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()

  return (
    <div className={cn('inline-flex rounded-lg bg-slate-100 p-1', className)}>
      {LOCALE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLocale(option.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition',
            locale === option.value
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
