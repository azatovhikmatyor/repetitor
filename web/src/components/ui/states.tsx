import type { ReactNode } from 'react'

import { ApiError } from '@/lib/api/client'

import { Button } from './button'

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`}
      role="status"
      aria-label="Yuklanmoqda"
    />
  )
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-5" aria-busy>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Xatolik yuz berdi'
  const isNetwork = error instanceof ApiError && error.isNetwork

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-slate-600">{message}</p>
      {isNetwork && (
        <p className="text-xs text-slate-400">Backend ishlab turganini tekshiring</p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Qayta urinish
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
