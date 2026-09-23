import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { MonthPicker } from '@/components/ui/month-picker'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { attendanceMonthlyQuery, groupQuery } from '@/lib/api/queries'
import type { AttendanceStatus, MonthlyColumn } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { percent } from '@/lib/format'
import { currentPeriod } from '@/lib/period'

/**
 * Oylik davomat jadvali: o'quvchilar × darslar.
 *
 * Ustun — sana emas, dars: bir kunda ikki dars bo'lsa ikki ustun chiqadi
 * va sarlavhada vaqt ko'rinadi. Jadval bo'yicha bo'lishi kerak bo'lgan,
 * lekin davomat kiritilmagan dars ham ustun bo'lib turadi — o'tkazilmagan
 * dars ko'rinib tursin.
 */
export function MonthlyAttendancePage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const [period, setPeriod] = useState(currentPeriod())

  const { data, isPending, error, refetch } = useQuery(attendanceMonthlyQuery(id, period))
  const group = useQuery(groupQuery(id))

  return (
    <>
      <PageHeader
        title={group.data ? `${group.data.name} — oylik davomat` : 'Oylik davomat'}
        back={{ to: `/groups/${id}/attendance`, label: 'Davomat' }}
        actions={<MonthPicker value={period} onChange={setPeriod} max={currentPeriod()} />}
      />

      <Card>
        {isPending && <Loading rows={6} />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}

        {data && data.columns.length === 0 && (
          <EmptyState
            title="Bu oyda dars yo&rsquo;q"
            description="Guruh jadvali kiritilmagan yoki bu oyda dars bo&rsquo;lmagan"
          />
        )}

        {data && data.columns.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {/* Ism ustuni chapda qotib turadi — jadval kengaysa ham. */}
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    O&rsquo;quvchi
                  </th>
                  {data.columns.map((column) => (
                    <th
                      key={column.key}
                      title={columnTitle(column)}
                      className={cn(
                        'w-10 border-b border-slate-200 bg-slate-50 px-1 py-2.5 text-center text-xs font-medium',
                        column.is_saved ? 'text-slate-500' : 'text-slate-300',
                      )}
                    >
                      <span className="block">
                        {new Date(column.lesson_date).getDate()}
                      </span>
                      {column.start_time && (
                        <span className="block text-[10px] font-normal text-slate-400">
                          {column.start_time.slice(0, 5)}
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Foiz
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((row) => (
                  <tr key={row.student_id}>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 font-medium whitespace-nowrap text-slate-800">
                      {row.full_name}
                    </td>
                    {data.columns.map((column) => (
                      <td
                        key={column.key}
                        className="border-b border-slate-100 px-1 py-2 text-center"
                      >
                        <Mark status={row.marks[column.key]} />
                      </td>
                    ))}
                    <td
                      className={cn(
                        'tabular border-b border-slate-100 px-4 py-2 text-right font-semibold',
                        row.attendance_rate >= 80
                          ? 'text-paid'
                          : row.attendance_rate >= 60
                            ? 'text-partial'
                            : 'text-unpaid',
                      )}
                    >
                      {percent(row.attendance_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function columnTitle(column: MonthlyColumn): string {
  const time = column.start_time ? ` ${column.start_time.slice(0, 5)}` : ''
  const state = column.is_saved ? '' : ' — davomat kiritilmagan'
  return `${column.lesson_date}${time}${state}`
}

function Mark({ status }: { status?: AttendanceStatus }) {
  if (!status) return <span className="text-slate-300">&ndash;</span>

  const styles: Record<AttendanceStatus, string> = {
    present: 'bg-paid/15 text-paid',
    absent: 'bg-unpaid/15 text-unpaid',
    late: 'bg-partial/20 text-partial',
    excused: 'bg-slate-100 text-slate-500',
  }
  const symbols: Record<AttendanceStatus, string> = {
    present: '✓',
    absent: '✕',
    late: '◔',
    excused: 'i',
  }

  return (
    <span
      title={status}
      className={cn(
        'inline-grid size-6 place-items-center rounded-md text-xs font-bold',
        styles[status],
      )}
    >
      {symbols[status]}
    </span>
  )
}
