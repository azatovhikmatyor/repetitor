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
import { money, monthName, percent } from '@/lib/format'

/**
 * O'qituvchining bosh sahifasi.
 *
 * Talab 9: shu oy daromadi va qarz bir ekranda, davomat qilinmagan guruhlar
 * eslatma sifatida.
 */
export function DashboardPage() {
  const { user } = useAuth()
  const { data, isPending, error, refetch } = useQuery(dashboardQuery())
  const [paying, setPaying] = useState(false)

  const firstName = user?.full_name.trim().split(' ')[0] ?? ''

  return (
    <>
      <PageHeader
        title={firstName ? `Salom, ${firstName}` : 'Bosh sahifa'}
        description={data ? `${monthName(data.month)} ${data.year}` : undefined}
        actions={
          <Button onClick={() => setPaying(true)}>To&rsquo;lov qabul qilish</Button>
        }
      />

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <div className="space-y-6">
          <Card>
            <CardBody className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Yig&rsquo;ilgan"
                value={money(data.collected)}
                caption="so&rsquo;m"
                tone="paid"
              />
              <Stat label="Kutilgan" value={money(data.expected)} caption="so&rsquo;m" />
              <Stat
                label="Qarz"
                value={money(data.debt)}
                caption={`${data.debtor_count} ta qarzdor · ro'yxat ›`}
                tone={data.debt > 0 ? 'unpaid' : undefined}
                to={data.debt > 0 ? '/debtors' : undefined}
              />
              <Stat
                label={data.expenses > 0 ? 'Foyda' : "Yig'ilish"}
                value={
                  data.expenses > 0
                    ? money(data.profit)
                    : percent(data.collection_rate)
                }
                caption={
                  data.expenses > 0
                    ? `xarajat ${money(data.expenses)}`
                    : `${data.active_student_count} o'quvchi · ${data.active_group_count} guruh`
                }
                tone={
                  data.expenses > 0
                    ? data.profit >= 0
                      ? 'paid'
                      : 'unpaid'
                    : undefined
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
            <StartHere />
          ) : data.today_lessons.length > 0 ? (
            <Card>
              <CardHeader
                title="Bugungi darslar"
                description={`${data.today_lessons.length} ta dars`}
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
                        {lesson.student_count} ta o&rsquo;quvchi
                        {lesson.end_time && ` · ${lesson.end_time.slice(0, 5)} gacha`}
                      </span>
                    </span>

                    {lesson.is_cancelled ? (
                      <Badge>Dars bo&rsquo;lmadi</Badge>
                    ) : lesson.is_saved ? (
                      <Badge tone="paid">Davomat olingan</Badge>
                    ) : (
                      <Link
                        to={`/groups/${lesson.group_id}/attendance${
                          lesson.start_time
                            ? `?start_time=${lesson.start_time.slice(0, 5)}`
                            : ''
                        }`}
                      >
                        <Button size="sm">Davomat olish</Button>
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
                    Bugun davomat qilinmagan
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
                  <p className="mt-2 text-xs text-slate-500">
                    Guruh jadvali kiritilsa, bu yerda bugungi darslar vaqti bilan
                    ko&rsquo;rinadi.
                  </p>
                </CardBody>
              </Card>
            )
          )}

          <Card>
            <CardHeader
              title="Guruhlar"
              action={
                <Link to="/groups">
                  <Button variant="secondary" size="sm">
                    Hammasi
                  </Button>
                </Link>
              }
            />
            {data.groups.length === 0 ? (
              <EmptyState
                title="Hali guruh yo&rsquo;q"
                description="Birinchi guruhni yarating va o&rsquo;quvchilarni qo&rsquo;shing"
                action={
                  <Link to="/groups">
                    <Button size="sm">Guruh yaratish</Button>
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
                          {group.student_count} ta o&rsquo;quvchi
                        </p>
                      </div>
                      {group.attendance_taken_today && (
                        <Badge tone="paid">Davomat bor</Badge>
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
                          qarz {money(group.total_debt)}
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
function StartHere() {
  const steps = [
    {
      title: 'Guruh yarating',
      description: 'Nomi va oylik to‘lovi bilan',
      to: '/groups',
      action: 'Guruhlarga o‘tish',
    },
    {
      title: 'Dars jadvalini kiriting',
      description: 'Hafta kunlari va soatlari — bugungi darslar shu yerdan chiqadi',
    },
    {
      title: 'O‘quvchilarni qo‘shing',
      description: 'Bittalab yoki ro‘yxatni bir yo‘la import qilib',
    },
    {
      title: 'Davomat oling',
      description: 'Kelmaganlarni belgilaysiz, qolgani avtomatik',
    },
  ]

  return (
    <Card className="border-brand-200 bg-brand-50/40">
      <CardHeader
        title="Boshlash uchun to‘rt qadam"
        description="Har bir qadam keyingisini ochadi"
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
