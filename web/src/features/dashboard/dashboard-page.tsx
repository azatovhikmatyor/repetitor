import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { dashboardQuery } from '@/lib/api/queries'
import { useAuth } from '@/lib/auth/auth-context'
import { QuickPaymentModal } from '@/features/payments/quick-payment-modal'
import { cn } from '@/lib/cn'
import { useT, type Dictionary } from '@/lib/i18n'
import { money, monthName, percent } from '@/lib/format'

/**
 * O'qituvchining bosh sahifasi.
 *
 * Talab 9: shu oy daromadi va qarz bir ekranda, davomat qilinmagan guruhlar
 * eslatma sifatida.
 */
export function DashboardPage() {
  const { user } = useAuth()
  const t = useT()
  const { data, isPending, error, refetch } = useQuery(dashboardQuery())
  const [paying, setPaying] = useState(false)

  const firstName = user?.full_name.trim().split(' ')[0] ?? ''

  return (
    <>
      <PageHeader
        title={firstName ? t.dashboard.greeting(firstName) : t.dashboard.title}
        description={data ? `${monthName(data.month)} ${data.year}` : undefined}
        actions={<Button onClick={() => setPaying(true)}>{t.dashboard.recordPayment}</Button>}
      />

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <div className="space-y-6">
          <Card>
            <CardBody className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={t.dashboard.collected}
                value={money(data.collected)}
                caption={t.common.somUnit}
                tone="paid"
              />
              <Stat
                label={t.dashboard.expected}
                value={money(data.expected)}
                caption={t.common.somUnit}
              />
              <Stat
                label={t.dashboard.debt}
                value={money(data.debt)}
                caption={t.dashboard.debtorsCaption(data.debtor_count)}
                tone={data.debt > 0 ? 'unpaid' : undefined}
                to={data.debt > 0 ? '/debtors' : undefined}
              />
              <Stat
                label={data.expenses > 0 ? t.dashboard.profit : t.dashboard.collectionRate}
                value={
                  data.expenses > 0 ? money(data.profit) : percent(data.collection_rate)
                }
                caption={
                  data.expenses > 0
                    ? t.dashboard.expensesCaption(money(data.expenses))
                    : t.dashboard.studentsAndGroups(
                        data.active_student_count,
                        data.active_group_count,
                      )
                }
                tone={
                  data.expenses > 0 ? (data.profit >= 0 ? 'paid' : 'unpaid') : undefined
                }
                to={data.expenses > 0 ? '/expenses' : '/reports'}
              />
              <div className="sm:col-span-2 lg:col-span-4">
                <Progress
                  value={data.expected === 0 ? 0 : data.collected / data.expected}
                />
              </div>
            </CardBody>
          </Card>

          {data.groups.length === 0 ? (
            <StartHere t={t} />
          ) : data.today_lessons.length > 0 ? (
            <Card>
              <CardHeader
                title={t.dashboard.todayLessons}
                description={t.dashboard.lessonCount(data.today_lessons.length)}
              />
              <ul className="divide-y divide-slate-100">
                {data.today_lessons.map((lesson) => (
                  <li
                    key={`${lesson.group_id}-${lesson.start_time ?? ''}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3"
                  >
                    <span className="tabular w-14 shrink-0 text-sm font-semibold text-slate-800">
                      {lesson.start_time ? lesson.start_time.slice(0, 5) : '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        to={`/groups/${lesson.group_id}`}
                        className="block truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {lesson.group_name}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {t.dashboard.studentCount(lesson.student_count)}
                        {lesson.end_time &&
                          ` · ${t.dashboard.untilTime(lesson.end_time.slice(0, 5))}`}
                      </span>
                    </span>

                    {lesson.is_cancelled ? (
                      <Badge>{t.dashboard.lessonCancelled}</Badge>
                    ) : lesson.is_saved ? (
                      <Badge tone="paid">{t.dashboard.attendanceTaken}</Badge>
                    ) : (
                      <Link
                        to={`/groups/${lesson.group_id}/attendance${
                          lesson.start_time
                            ? `?start_time=${lesson.start_time.slice(0, 5)}`
                            : ''
                        }`}
                      >
                        <Button size="sm">{t.dashboard.takeAttendance}</Button>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            data.groups_without_attendance_today.length > 0 && (
              <Card className="border-partial/40 bg-partial/5">
                <CardBody>
                  <p className="mb-3 text-sm font-medium text-slate-800">
                    {t.dashboard.noAttendanceToday}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.groups_without_attendance_today.map((group) => (
                      <Link
                        key={group.group_id}
                        to={`/groups/${group.group_id}/attendance`}
                      >
                        <Button variant="secondary" size="sm">
                          {group.group_name}
                        </Button>
                      </Link>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{t.dashboard.scheduleHint}</p>
                </CardBody>
              </Card>
            )
          )}

          <Card>
            <CardHeader
              title={t.dashboard.groups}
              action={
                <Link to="/groups">
                  <Button variant="secondary" size="sm">
                    {t.dashboard.all}
                  </Button>
                </Link>
              }
            />
            {data.groups.length === 0 ? (
              <EmptyState
                title={t.dashboard.noGroupsYet}
                description={t.dashboard.noGroupsDescription}
                action={
                  <Link to="/groups">
                    <Button size="sm">{t.dashboard.createGroup}</Button>
                  </Link>
                }
              />
            ) : (
              <CardBody className="grid gap-4 md:grid-cols-2">
                {data.groups.map((group) => (
                  <Link
                    key={group.group_id}
                    to={`/groups/${group.group_id}`}
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {group.group_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.dashboard.studentCount(group.student_count)}
                        </p>
                      </div>
                      {group.attendance_taken_today && (
                        <Badge tone="paid">{t.dashboard.attendanceBadge}</Badge>
                      )}
                    </div>

                    <div className="mt-3">
                      <Progress
                        value={
                          group.total_due === 0 ? 0 : group.total_paid / group.total_due
                        }
                        tone={group.total_debt === 0 ? 'paid' : 'partial'}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="tabular font-medium text-slate-700">
                        {money(group.total_paid)} / {money(group.total_due)}
                      </span>
                      {group.total_debt > 0 && (
                        <span className="tabular text-xs text-unpaid">
                          {t.dashboard.debt.toLowerCase()} {money(group.total_debt)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </CardBody>
            )}
          </Card>
        </div>
      )}

      {paying && <QuickPaymentModal onClose={() => setPaying(false)} />}
    </>
  )
}

/**
 * Birinchi kirgan o'qituvchi uchun yo'riqnoma.
 *
 * Bo'sh ekran o'rniga nimadan boshlashni aytadi: guruh → jadval →
 * o'quvchilar → davomat. Guruh paydo bo'lishi bilan bu karta yo'qoladi.
 */
function StartHere({ t }: { t: Dictionary }) {
  const steps = [
    {
      title: t.dashboard.onboardingStep1Title,
      description: t.dashboard.onboardingStep1Desc,
      to: '/groups',
      action: t.dashboard.onboardingStep1Action,
    },
    {
      title: t.dashboard.onboardingStep2Title,
      description: t.dashboard.onboardingStep2Desc,
    },
    {
      title: t.dashboard.onboardingStep3Title,
      description: t.dashboard.onboardingStep3Desc,
    },
    {
      title: t.dashboard.onboardingStep4Title,
      description: t.dashboard.onboardingStep4Desc,
    },
  ]

  return (
    <Card className="border-brand-200 bg-brand-50/40">
      <CardHeader
        title={t.dashboard.onboardingTitle}
        description={t.dashboard.onboardingSubtitle}
      />
      <CardBody>
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                  index === 0
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-400 ring-1 ring-slate-200',
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-600">{step.description}</p>
              </div>
              {step.to && (
                <Link to={step.to}>
                  <Button size="sm">{step.action}</Button>
                </Link>
              )}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}
