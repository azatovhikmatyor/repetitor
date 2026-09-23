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
                label="Yig&rsquo;ilish"
                value={percent(data.collection_rate)}
                caption={`${data.active_student_count} o'quvchi · ${data.active_group_count} guruh`}
                to="/reports"
              />
              <div className="sm:col-span-2 lg:col-span-4">
                <Progress
                  value={data.expected === 0 ? 0 : data.collected / data.expected}
                />
              </div>
            </CardBody>
          </Card>

          {data.groups_without_attendance_today.length > 0 && (
            <Card className="border-partial/40 bg-partial/5">
              <CardBody>
                <p className="mb-3 text-sm font-medium text-slate-800">
                  Bugun davomat qilinmagan
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.groups_without_attendance_today.map((group) => (
                    <Link key={group.group_id} to={`/groups/${group.group_id}/attendance`}>
                      <Button variant="secondary" size="sm">
                        {group.group_name}
                      </Button>
                    </Link>
                  ))}
                </div>
              </CardBody>
            </Card>
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
