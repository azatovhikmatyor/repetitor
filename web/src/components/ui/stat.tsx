import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/cn'

export function Stat({
  label,
  value,
  caption,
  tone,
  to,
}: {
  label: string
  value: ReactNode
  caption?: ReactNode
  tone?: 'paid' | 'unpaid' | 'partial'
  /** Berilsa raqam havolaga aylanadi — qiziqarli son harakatga olib borsin. */
  to?: string
}) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p
        className={cn(
          'tabular mt-1 text-2xl font-semibold',
          tone === 'paid' && 'text-paid',
          tone === 'unpaid' && 'text-unpaid',
          tone === 'partial' && 'text-partial',
          !tone && 'text-slate-900',
        )}
      >
        {value}
      </p>
      {caption && <p className="mt-0.5 text-xs text-slate-500">{caption}</p>}
    </>
  )

  if (to) {
    return (
      <Link to={to} className="-m-2 block rounded-lg p-2 transition-colors hover:bg-slate-50">
        {body}
      </Link>
    )
  }

  return <div>{body}</div>
}

export function Progress({
  value,
  tone = 'paid',
}: {
  /** 0..1 */
  value: number
  tone?: 'paid' | 'partial'
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn('h-full rounded-full', tone === 'paid' ? 'bg-paid' : 'bg-partial')}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
