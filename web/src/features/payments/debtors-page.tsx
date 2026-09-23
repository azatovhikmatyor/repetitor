import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { MonthPicker } from '@/components/ui/month-picker'
import { Stat } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { debtorsQuery } from '@/lib/api/queries'
import type { Debtor } from '@/lib/api/types'
import { money } from '@/lib/format'
import { currentPeriod } from '@/lib/period'

import { QuickPaymentModal } from './quick-payment-modal'

/**
 * Qarzdorlar — bosh sahifadagi "Qarz" raqamining tafsiloti.
 *
 * Eng katta qarz yuqorida: o'qituvchi kim bilan gaplashishni shu yerdan
 * ko'radi va to'lovni o'sha zahoti kiritadi.
 */
export function DebtorsPage() {
  const [period, setPeriod] = useState(currentPeriod())
  const [paying, setPaying] = useState<Debtor | null>(null)

  const { data, isPending, error, refetch } = useQuery(debtorsQuery(period))

  return (
    <>
      <PageHeader
        title="Qarzdorlar"
        description={data ? `${data.items.length} ta o'quvchi` : undefined}
        back={{ to: '/', label: 'Bosh sahifa' }}
        actions={<MonthPicker value={period} onChange={setPeriod} max={currentPeriod()} />}
      />

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <Stat
                label="Umumiy qarz"
                value={money(data.total_debt)}
                caption="so&rsquo;m"
                tone={data.total_debt > 0 ? 'unpaid' : undefined}
              />
            </CardBody>
          </Card>

          <Card>
            {data.items.length === 0 ? (
              <EmptyState
                title="Qarzdor yo&rsquo;q"
                description="Bu oy uchun hamma to&rsquo;lagan"
              />
            ) : (
              <DataTable
                rows={data.items}
                rowKey={(debtor) => debtor.charge_id}
                columns={[
                  {
                    key: 'name',
                    header: "O'quvchi",
                    primary: true,
                    cell: (debtor) => (
                      <Link
                        to={`/students/${debtor.student_id}`}
                        className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {debtor.full_name}
                      </Link>
                    ),
                  },
                  {
                    key: 'group',
                    header: 'Guruh',
                    cell: (debtor) => (
                      <Link
                        to={`/groups/${debtor.group_id}/payments`}
                        className="text-slate-500 hover:underline"
                      >
                        {debtor.group_name}
                      </Link>
                    ),
                  },
                  {
                    key: 'phone',
                    header: 'Telefon',
                    cell: (debtor) =>
                      debtor.phone ? (
                        <a href={`tel:${debtor.phone}`} className="text-slate-500 hover:underline">
                          {debtor.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      ),
                  },
                  {
                    key: 'balance',
                    header: 'Qarz',
                    align: 'right',
                    cell: (debtor) => (
                      <Badge tone={debtor.amount_paid > 0 ? 'partial' : 'unpaid'}>
                        {debtor.amount_paid > 0 ? 'qisman' : "to'lanmagan"} ·{' '}
                        {money(debtor.balance)}
                      </Badge>
                    ),
                  },
                  {
                    key: 'action',
                    align: 'right',
                    footer: true,
                    cell: (debtor) => (
                      <Button size="sm" variant="secondary" onClick={() => setPaying(debtor)}>
                        To&rsquo;lov
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      {paying && (
        <QuickPaymentModal
          debtor={paying}
          period={period}
          onClose={() => setPaying(null)}
        />
      )}
    </>
  )
}
