import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { Icon } from './icon'
import { Table, Td, Th, Tr } from './table'

export interface Column<T> {
  /** React kaliti va ustun identifikatori. */
  key: string
  header?: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Kartada sarlavha bo'ladigan ustun — odatda ism. Bittasi bo'lishi kerak. */
  primary?: boolean
  /** Kartada pastki qatorga tushadi — tugmalar uchun. */
  footer?: boolean
  /** Kartada umuman ko'rsatilmaydi — masalan "›" strelkasi. */
  hideOnCard?: boolean
}

/**
 * Jadval — keng ekranda, karta — telefonda.
 *
 * Ustunlar bir marta tavsiflanadi, ikkala ko'rinish o'shandan chiqadi.
 * Sabab: telefonda 5-6 ustunli jadval ekrandan chiqib ketadi va o'qituvchi
 * gorizontal aylantirishga majbur bo'ladi — davomat va to'lov aynan
 * telefondan kiritiladi.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowClassName,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
}) {
  const primary = columns.find((column) => column.primary) ?? columns[0]
  const details = columns.filter(
    (column) => column !== primary && !column.footer && !column.hideOnCard,
  )
  const footers = columns.filter((column) => column.footer)

  return (
    <>
      {/* Keng ekran */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              {columns.map((column) => (
                <Th key={column.key} align={column.align}>
                  {column.header}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={rowClassName?.(row)}
              >
                {columns.map((column) => (
                  <Td key={column.key} align={column.align}>
                    {column.cell(row)}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Telefon */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn('px-4 py-3', rowClassName?.(row))}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 font-medium text-slate-900">
                {primary.cell(row)}
              </div>
              {onRowClick && (
                <Icon name="chevron-right" className="size-4 text-slate-400" />
              )}
            </div>

            {details.length > 0 && (
              <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {details.map((column) => (
                  <div key={column.key} className="flex justify-between gap-2">
                    <dt className="text-slate-400">{column.header}</dt>
                    <dd className="min-w-0 truncate text-right text-slate-700">
                      {column.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {footers.length > 0 && (
              <div
                className="mt-2 flex flex-wrap gap-2"
                // Tugmalar qatorni ochib yubormasin.
                onClick={(event) => event.stopPropagation()}
              >
                {footers.map((column) => (
                  <span key={column.key}>{column.cell(row)}</span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
