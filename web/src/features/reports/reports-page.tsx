import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Printable, print } from '@/components/ui/printable'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { MonthPicker } from '@/components/ui/month-picker'
import { Progress, Stat } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import {
  attendanceReportQuery,
  monthlyReportQuery,
  revenueTrendQuery,
} from '@/lib/api/queries'
import type { AttendanceReport, MonthlyReport, RevenuePoint } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/auth-context'
import { downloadCsv } from '@/lib/export'
import { cn } from '@/lib/cn'
import { compact, money, monthName, monthShort, percent } from '@/lib/format'
import { currentPeriod } from '@/lib/period'

export function ReportsPage() {
  const [period, setPeriod] = useState(currentPeriod())
  const { user } = useAuth()

  const monthly = useQuery(monthlyReportQuery(period))
  const trend = useQuery(revenueTrendQuery(12))
  const attendance = useQuery(attendanceReportQuery(period))

  return (
    <>
      <PageHeader
        title="Hisobot"
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!monthly.data}
              onClick={() => {
                if (!monthly.data) return
                downloadCsv(
                  `hisobot-${period.year}-${String(period.month).padStart(2, '0')}`,
                  [
                    'Guruh',
                    "O'quvchi",
                    'Kutilgan',
                    "Yig'ilgan",
                    'Qarz',
                    "To'lagan",
                    'Qisman',
                    "To'lamagan",
                  ],
                  [
                    ...monthly.data.groups.map((group) => [
                      group.group_name,
                      group.student_count,
                      group.total_due,
                      group.total_paid,
                      group.total_debt,
                      group.paid_count,
                      group.partial_count,
                      group.unpaid_count,
                    ]),
                    [
                      'JAMI',
                      '',
                      monthly.data.total_due,
                      monthly.data.total_paid,
                      monthly.data.total_debt,
                      '',
                      '',
                      '',
                    ],
                    ['XARAJAT', '', '', monthly.data.total_expenses, '', '', '', ''],
                    ['FOYDA', '', '', monthly.data.profit, '', '', '', ''],
                  ],
                )
              }}
            >
              Excel
            </Button>
            <Button variant="secondary" onClick={print}>
              Chop etish
            </Button>
            <MonthPicker value={period} onChange={setPeriod} max={currentPeriod()} />
          </>
        }
      />

      {monthly.data && (
        <Printable>
          <PrintableReport
            data={monthly.data}
            attendance={attendance.data}
            teacherName={user?.full_name ?? ''}
          />
        </Printable>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Oylik moliyaviy hisobot"
            description={`${monthName(period.month)} ${period.year}`}
          />
          {monthly.isPending && <Loading rows={4} />}
          {monthly.error && (
            <ErrorState error={monthly.error} onRetry={() => void monthly.refetch()} />
          )}

          {monthly.data && (
            <>
              <CardBody className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Yig&rsquo;ilgan"
                  value={money(monthly.data.total_paid)}
                  tone="paid"
                />
                <Stat label="Kutilgan" value={money(monthly.data.total_due)} />
                <Stat
                  label="Qarz"
                  value={money(monthly.data.total_debt)}
                  tone={monthly.data.total_debt > 0 ? 'unpaid' : undefined}
                />
                <Stat
                  label="Foyda"
                  value={money(monthly.data.profit)}
                  caption={`xarajat ${money(monthly.data.total_expenses)}`}
                  tone={monthly.data.profit >= 0 ? 'paid' : 'unpaid'}
                  to="/expenses"
                />
              </CardBody>

              {monthly.data.groups.length === 0 ? (
                <EmptyState title="Bu oyda ma&rsquo;lumot yo&rsquo;q" />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Guruh</Th>
                      <Th align="right">O&rsquo;quvchi</Th>
                      <Th align="right">Kutilgan</Th>
                      <Th align="right">Yig&rsquo;ilgan</Th>
                      <Th align="right">Qarz</Th>
                      <Th>Holatlar</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.data.groups.map((group) => (
                      <Tr key={group.group_id}>
                        <Td>
                          <Link
                            to={`/groups/${group.group_id}/payments`}
                            className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                          >
                            {group.group_name}
                          </Link>
                        </Td>
                        <Td align="right">{group.student_count}</Td>
                        <Td align="right">{money(group.total_due)}</Td>
                        <Td align="right">{money(group.total_paid)}</Td>
                        <Td align="right">
                          {group.total_debt > 0 ? (
                            <span className="font-medium text-unpaid">
                              {money(group.total_debt)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td>
                          <span className="flex flex-wrap gap-1">
                            <Badge tone="paid">{group.paid_count}</Badge>
                            {group.partial_count > 0 && (
                              <Badge tone="partial">{group.partial_count}</Badge>
                            )}
                            {group.unpaid_count > 0 && (
                              <Badge tone="unpaid">{group.unpaid_count}</Badge>
                            )}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Daromad tendentsiyasi"
            description="Oxirgi 12 oy: yig&rsquo;ilgan va kutilgan"
          />
          {trend.isPending && <Loading rows={2} />}
          {trend.error && (
            <ErrorState error={trend.error} onRetry={() => void trend.refetch()} />
          )}
          {trend.data && <TrendChart points={trend.data} />}
        </Card>

        <Card>
          <CardHeader title="Davomat" />
          {attendance.isPending && <Loading rows={2} />}
          {attendance.error && (
            <ErrorState
              error={attendance.error}
              onRetry={() => void attendance.refetch()}
            />
          )}
          {attendance.data && attendance.data.groups.length === 0 && (
            <EmptyState title="Bu oyda davomat yo&rsquo;q" />
          )}
          {attendance.data && attendance.data.groups.length > 0 && (
            <CardBody className="space-y-5">
              {attendance.data.groups.map((group) => (
                <div key={group.group_id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{group.group_name}</span>
                    <span className="tabular font-semibold">
                      {percent(group.attendance_rate)}
                    </span>
                  </div>
                  <Progress
                    value={group.attendance_rate / 100}
                    tone={group.attendance_rate >= 80 ? 'paid' : 'partial'}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {group.session_count} ta dars
                  </p>
                </div>
              ))}

              {attendance.data.frequent_absentees.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Eng ko&rsquo;p qoldiradiganlar
                  </p>
                  <ul className="space-y-1.5">
                    {attendance.data.frequent_absentees.slice(0, 5).map((student) => (
                      <li
                        key={student.student_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <Link
                          to={`/students/${student.student_id}`}
                          className="text-slate-700 hover:text-brand-700 hover:underline"
                        >
                          {student.full_name}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {student.total_sessions} darsdan {student.absent_count} tasida
                          yo&rsquo;q &middot;{' '}
                          <span className="font-semibold text-unpaid">
                            {percent(student.attendance_rate)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          )}
        </Card>
      </div>
    </>
  )
}

/**
 * Ustunli diagramma.
 *
 * Tashqi grafik kutubxonasi qo'shilmadi: 12 ta ustun uchun oddiy div yetarli
 * va bundle o'smaydi.
 */
/**
 * Daromad tendentsiyasi — har oy uchun ikki qiymat.
 *
 * Kutilgan — och kulrang ustun (to'liq balandlik), yig'ilgan — uning
 * ichidagi yashil ustun. Shunday qilib "qancha yig'ilishi kerak edi" va
 * "qancha yig'ildi" bir ustunda taqqoslanadi, ikkitasini ko'z bilan
 * o'lchash shart emas.
 */
function TrendChart({ points }: { points: RevenuePoint[] }) {
  if (points.length === 0) return <EmptyState title="Ma&rsquo;lumot yo&rsquo;q" />

  const max = Math.max(
    1,
    ...points.map((point) => Math.max(point.expected, point.collected)),
  )
  const withData = points.filter((point) => point.expected > 0)

  if (withData.length === 0) {
    return (
      <EmptyState
        title="Hali daromad yo&rsquo;q"
        description="Oylik hisoblar ochilgach grafik to&rsquo;la boshlaydi"
      />
    )
  }

  const totalCollected = points.reduce((sum, point) => sum + point.collected, 0)
  const totalExpected = points.reduce((sum, point) => sum + point.expected, 0)
  const totalExpenses = points.reduce((sum, point) => sum + point.expenses, 0)
  const hasExpenses = totalExpenses > 0

  return (
    <CardBody className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-paid" />
          <span className="text-slate-600">Yig&rsquo;ilgan</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-slate-200" />
          <span className="text-slate-600">Kutilgan</span>
        </span>
        {hasExpenses && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-sm bg-unpaid/70" />
            <span className="text-slate-600">Xarajat</span>
          </span>
        )}
        <span className="ml-auto text-slate-500">
          {withData.length} oyda{' '}
          <span className="tabular font-medium text-slate-800">
            {money(totalCollected)}
          </span>{' '}
          / {money(totalExpected)} so&rsquo;m
          {hasExpenses && (
            <>
              {' \u00b7 foyda '}
              <span
                className={cn(
                  'tabular font-medium',
                  totalCollected - totalExpenses >= 0 ? 'text-paid' : 'text-unpaid',
                )}
              >
                {money(totalCollected - totalExpenses)}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="relative">
        {/* Eng baland ustun qiymati — o'q o'rnida. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-200">
          <span className="tabular absolute -top-2 right-0 bg-white pl-1 text-[10px] text-slate-400">
            {compact(max)}
          </span>
        </div>

        <div className="flex items-end gap-1 pt-3">
          {points.map((point, index) => {
            const isNewYear = index > 0 && point.year !== points[index - 1].year
            const rate =
              point.expected > 0
                ? Math.round((point.collected / point.expected) * 100)
                : 0

            return (
              <div
                key={`${point.year}-${point.month}`}
                title={
                  point.expected > 0
                    ? `${monthName(point.month)} ${point.year}: ${money(
                        point.collected,
                      )} / ${money(point.expected)} so'm (${rate}%)`
                    : `${monthName(point.month)} ${point.year}: ma'lumot yo'q`
                }
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1',
                  // Yil almashgan joyda ingichka ajratuvchi.
                  isNewYear && 'border-l border-slate-200 pl-1',
                )}
              >
                <span className="tabular text-[10px] text-slate-500">
                  {point.collected > 0 ? compact(point.collected) : ''}
                </span>

                {/*
                  Ustun maydonining balandligi ANIQ (`h-40`): foizli
                  balandlik faqat shunda hisoblanadi. `flex-1` bilan
                  ota-elementning balandligi "aniqlanmagan" bo'lib qoladi
                  va ustunlar umuman chizilmaydi.
                */}
                <div className="relative h-40 w-full">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t bg-slate-100"
                    style={{ height: `${(point.expected / max) * 100}%` }}
                  />
                  <div
                    className={cn(
                      'absolute inset-x-0 bottom-0 rounded-t',
                      // To'liq yig'ilgan oy yashil, kam yig'ilgani sariq.
                      rate >= 90 ? 'bg-paid' : 'bg-partial',
                    )}
                    style={{ height: `${(point.collected / max) * 100}%` }}
                  />
                  {/* Xarajat chizig'i — shu oyda qancha ketgani. */}
                  {point.expenses > 0 && (
                    <div
                      className="absolute inset-x-0 border-t-2 border-dashed border-unpaid/70"
                      style={{ bottom: `${(point.expenses / max) * 100}%` }}
                    />
                  )}
                </div>

                <span className="truncate text-[10px] text-slate-500">
                  {monthShort(point.month)}
                </span>
                {isNewYear && (
                  <span className="text-[9px] text-slate-400">{point.year}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </CardBody>
  )
}

/**
 * Chop etiladigan oylik hisobot.
 *
 * Ekrandagi kartalar emas, buxgalteriyaga beriladigan bitta varaq:
 * jadval, jami qatori va imzo joyi.
 */
function PrintableReport({
  data,
  attendance,
  teacherName,
}: {
  data: MonthlyReport
  attendance: AttendanceReport | undefined
  teacherName: string
}) {
  return (
    <div>
      <div className="flex items-start justify-between border-b border-slate-300 pb-3">
        <div>
          <p className="text-lg font-semibold">Oylik hisobot</p>
          <p className="text-sm text-slate-600">
            {monthName(data.month)} {data.year}
          </p>
        </div>
        <p className="text-sm text-slate-600">{teacherName}</p>
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left">
            <th className="py-1.5">Guruh</th>
            <th className="py-1.5 text-right">O&rsquo;quvchi</th>
            <th className="py-1.5 text-right">Kutilgan</th>
            <th className="py-1.5 text-right">Yig&rsquo;ilgan</th>
            <th className="py-1.5 text-right">Qarz</th>
          </tr>
        </thead>
        <tbody>
          {data.groups.map((group) => (
            <tr key={group.group_id} className="border-b border-slate-200">
              <td className="py-1.5">{group.group_name}</td>
              <td className="py-1.5 text-right">{group.student_count}</td>
              <td className="py-1.5 text-right">{money(group.total_due)}</td>
              <td className="py-1.5 text-right">{money(group.total_paid)}</td>
              <td className="py-1.5 text-right">{money(group.total_debt)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-2">JAMI</td>
            <td />
            <td className="py-2 text-right">{money(data.total_due)}</td>
            <td className="py-2 text-right">{money(data.total_paid)}</td>
            <td className="py-2 text-right">{money(data.total_debt)}</td>
          </tr>
          <tr>
            <td className="py-1.5" colSpan={3}>
              Xarajat
            </td>
            <td className="py-1.5 text-right">{money(data.total_expenses)}</td>
            <td />
          </tr>
          <tr className="border-t border-slate-300 font-semibold">
            <td className="py-2" colSpan={3}>
              Foyda
            </td>
            <td className="py-2 text-right">{money(data.profit)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      {attendance && attendance.groups.length > 0 && (
        <>
          <p className="mt-6 mb-2 font-semibold">Davomat</p>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {attendance.groups.map((group) => (
                <tr key={group.group_id} className="border-b border-slate-200">
                  <td className="py-1.5">{group.group_name}</td>
                  <td className="py-1.5 text-right">{group.session_count} dars</td>
                  <td className="py-1.5 text-right">
                    {percent(group.attendance_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-10 flex justify-between text-sm text-slate-600">
        <span>Sana: ____________</span>
        <span>Imzo: ____________</span>
      </div>
    </div>
  )
}
