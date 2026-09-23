import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'brand' | 'paid' | 'partial' | 'unpaid'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
  paid: 'bg-paid/10 text-paid',
  partial: 'bg-partial/15 text-partial',
  unpaid: 'bg-unpaid/10 text-unpaid',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
