import { Button } from './button'
import { Icon } from './icon'

/**
 * Sahifalash.
 *
 * Raqamlar deraza bo'lib ko'rsatiladi: 200 sahifa bo'lsa ham qator
 * uzunligi o'zgarmaydi. Bitta sahifa bo'lsa umuman chizilmaydi.
 */
export function Pagination({
  page,
  pages,
  total,
  onChange,
  label = 'yozuv',
}: {
  page: number
  pages: number
  total: number
  onChange: (page: number) => void
  label?: string
}) {
  if (pages <= 1) return null

  const numbers = windowOf(page, pages)

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"
      aria-label="Sahifalar"
    >
      <p className="text-xs text-slate-500">
        {total} ta {label} &middot; {page}/{pages}-sahifa
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Oldingi sahifa"
        >
          <Icon name="chevron-right" className="size-4 rotate-180" />
        </Button>

        {numbers.map((value, index) =>
          value === null ? (
            <span key={`gap-${index}`} className="px-1 text-slate-400">
              &hellip;
            </span>
          ) : (
            <Button
              key={value}
              variant={value === page ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onChange(value)}
              aria-current={value === page ? 'page' : undefined}
            >
              {value}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Keyingi sahifa"
        >
          <Icon name="chevron-right" className="size-4" />
        </Button>
      </div>
    </nav>
  )
}

/** `1 … 4 5 6 … 20` — joriy sahifa atrofidagi raqamlar. */
function windowOf(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1)

  const result: (number | null)[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(pages - 1, page + 1)

  if (from > 2) result.push(null)
  for (let value = from; value <= to; value++) result.push(value)
  if (to < pages - 1) result.push(null)

  result.push(pages)
  return result
}
