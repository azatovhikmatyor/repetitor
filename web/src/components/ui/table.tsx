import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Desktop uchun jadval.
 *
 * Mobil ilovada ro'yxat kartalari ishlatilgan, bu yerda esa keng ekranning
 * afzalligi: bir qarashda ko'p qator va tik turgan raqamlar.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  )
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  className,
  colSpan,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'border-b border-slate-100 px-4 py-2.5 text-slate-700',
        align === 'right' && 'text-right tabular',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(onClick && 'cursor-pointer hover:bg-slate-50', className)}
    >
      {children}
    </tr>
  )
}
