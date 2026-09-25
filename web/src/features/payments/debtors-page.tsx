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
import { useT } from '@/lib/i18n'
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
  const t = useT()
  const [period, setPeriod] = useState(currentPeriod())
  const [paying, setPaying] = useState<Debtor | null>(null)

  const { data, isPending, error, refetch } = useQuery(debtorsQuery(period))

  return (
    <>
      <PageHeader
        title={t.payments.debtors.title}
        description={data ? t.payments.debtors.countCaption(data.items.length) : undefined}
        back={{ to: '/', label: t.payments.debtors.backHome }}
        actions={<MonthPicker value={period} onChange={setPeriod} max={currentPeriod()} />}
      />

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <Stat
                label={t.payments.debtors.totalDebt}
                value={money(data.total_debt)}
                caption={t.common.somUnit}
                tone={data.total_debt > 0 ? 'unpaid' : undefined}
              />
            </CardBody>
          </Card>

          <Card>
            {data.items.length === 0 ? (
              <EmptyState
                title={t.payments.debtors.noDebtors}
                description={t.payments.debtors.allPaid}
              />
            ) : (
              <DataTable
                rows={data.items}
                rowKey={(debtor) => debtor.charge_id}
                columns={[
                  {
                    key: 'name',
                    header: t.payments.debtors.colStudent,
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
                    header: t.payments.debtors.colGroup,
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
                    header: t.payments.debtors.colPhone,
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
                    header: t.payments.debtors.colDebt,
                    align: 'right',
                    cell: (debtor) => (
                      <Badge tone={debtor.amount_paid > 0 ? 'partial' : 'unpaid'}>
                        {debtor.amount_paid > 0 ? t.payments.debtors.partial : t.payments.debtors.unpaid} ·{' '}
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
                        {t.payments.debtors.payBtn}
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
