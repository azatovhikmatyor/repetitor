import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-xs',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}
