import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { myAttendanceQuery } from '@/lib/api/queries'
import type { StudentAttendanceEntry } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { formatDate, percent } from '@/lib/format'
import { attendanceLabel } from '@/lib/labels'

/**
 * O'quvchining o'z davomat xulosasi.
 *
 * O'qituvchining "O'quvchi kartasi" sahifasidagi davomat blokiga o'xshash
 * ko'rinish — faqat shu yerda faqat o'zi haqidagi ma'lumot, boshqa hech
 * kim ko'rinmaydi.
 */
export function MyAttendancePage() {
  const t = useT()
  const { data, isPending, error, refetch } = useQuery(myAttendanceQuery())

  return (
    <>
      <PageHeader title={t.students.detail.attendanceTitle} />

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.groups.length === 0 && (
        <Card>
          <EmptyState title={t.students.detail.noAttendance} />
        </Card>
      )}

      {data && data.groups.length > 0 && (
        <Card>
          <CardHeader
            title={t.students.detail.attendanceTitle}
            description={
              data.recent.length > 0 ? t.students.detail.recentBelow : undefined
            }
          />
          <CardBody className="space-y-4">
            {data.groups.map((summary) => (
              <div key={summary.group_id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">
                    {summary.group_name}
                  </span>
                  <span className="tabular font-semibold">
                    {percent(summary.attendance_rate)}
                  </span>
                </div>
                <Progress
                  value={summary.attendance_rate / 100}
                  tone={summary.attendance_rate >= 80 ? 'paid' : 'partial'}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {t.students.detail.sessionsAbsences(
                    summary.total_sessions,
                    summary.absent_count,
                  )}
                  {summary.late_count > 0 &&
                    t.students.detail.lateSuffix(summary.late_count)}
                </p>
              </div>
            ))}

            {data.recent.length > 0 && <AttendanceHistory entries={data.recent} />}
          </CardBody>
        </Card>
      )}
    </>
  )
}

const ATTENDANCE_TONE: Record<
  StudentAttendanceEntry['status'],
  'paid' | 'unpaid' | 'partial' | 'neutral'
> = {
  present: 'paid',
  absent: 'unpaid',
  late: 'partial',
  excused: 'neutral',
}

/** Oxirgi darslar — standart holatda faqat kelmagan kunlar ko'rinadi. */
function AttendanceHistory({ entries }: { entries: StudentAttendanceEntry[] }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const missed = entries.filter((entry) => entry.status !== 'present')
  const shown = (all ? entries : missed).slice(0, 20)

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {all ? t.students.detail.recentLessons : t.students.detail.missedDays}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setAll((value) => !value)}>
          {all ? t.students.detail.onlyMissed : t.students.detail.all}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">{t.students.detail.noMissed}</p>
      ) : (
        <ul className="space-y-1">
          {shown.map((entry) => (
            <li
              key={`${entry.lesson_date}-${entry.start_time ?? ''}-${entry.group_id}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-slate-600">
                {formatDate(entry.lesson_date)}
                {entry.start_time && (
                  <span className="ml-1 text-xs text-slate-400">
                    {entry.start_time.slice(0, 5)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                {entry.group_name}
              </span>
              <Badge tone={ATTENDANCE_TONE[entry.status]}>
                {attendanceLabel(t)[entry.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
