import { monthName } from '@/lib/format'
import { isAfter, shiftPeriod, type Period } from '@/lib/period'

import { Button } from './button'

/** Oy tanlash paneli — to'lov va hisobot ekranlarida bir xil. */
export function MonthPicker({
  value,
  onChange,
  max,
}: {
  value: Period
  onChange: (period: Period) => void
  /** Bundan keyingi oyga o'tib bo'lmaydi. */
  max?: Period
}) {
  const next = shiftPeriod(value, 1)
  const canGoForward = !max || !isAfter(next, max)

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(shiftPeriod(value, -1))}
        aria-label="O&rsquo;tgan oy"
      >
        &lsaquo;
      </Button>
      <span className="min-w-32 text-center text-sm font-medium text-slate-800">
        {monthName(value.month)} {value.year}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={!canGoForward}
        onClick={() => onChange(next)}
        aria-label="Kelasi oy"
      >
        &rsaquo;
      </Button>
    </div>
  )
}
