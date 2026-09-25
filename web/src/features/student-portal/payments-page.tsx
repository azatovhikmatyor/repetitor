import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { myPaymentsQuery } from '@/lib/api/queries'
import { useT } from '@/lib/i18n'
import { money, monthName } from '@/lib/format'
import { chargeStateLabel, chargeStateTone } from '@/lib/labels'

/**
 * O'quvchining o'z to'lov tarixi.
 *
 * Faqat o'qish uchun — bu yerda "to'lov qabul qilish" tugmasi yo'q,
 * chunki yangi to'lovni faqat o'qituvchi kiritadi.
 */
export function MyPaymentsPage() {
  const t = useT()
  const { data, isPending, error, refetch } = useQuery(myPaymentsQuery())
  const charges = data ?? []
  const debt = charges.reduce(
    (sum, charge) => sum + Math.max(charge.amount_due - charge.amount_paid, 0),
    0,
  )

  return (
    <>
      <PageHeader
        title={t.students.detail.paymentHistoryTitle}
        description={debt > 0 ? t.students.detail.totalDebt(money(debt)) : undefined}
      />

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && charges.length === 0 && (
        <Card>
          <EmptyState title={t.students.detail.noPayments} />
        </Card>
      )}

      {charges.length > 0 && (
        <Card>
          <DataTable
            rows={charges}
            rowKey={(charge) => charge.charge_id}
            columns={[
              {
                key: 'month',
                header: t.students.detail.colMonth,
                primary: true,
                cell: (charge) => (
                  <span className="whitespace-nowrap">
                    {monthName(charge.month)} {charge.year}
                  </span>
                ),
              },
              {
                key: 'group',
                header: t.students.detail.colGroup,
                cell: (charge) => (
                  <span className="text-slate-500">{charge.group_name}</span>
                ),
              },
              {
                key: 'due',
                header: t.students.detail.colDue,
                align: 'right',
                cell: (charge) => money(charge.amount_due),
              },
              {
                key: 'paid',
                header: t.students.detail.colPaid,
                align: 'right',
                cell: (charge) => money(charge.amount_paid),
              },
              {
                key: 'status',
                header: t.students.detail.colStatus,
                cell: (charge) => (
                  <Badge tone={chargeStateTone(charge.status, charge.amount_due)}>
                    {chargeStateLabel(t, charge.status, charge.amount_due)}
                  </Badge>
                ),
              },
            ]}
          />
        </Card>
      )}
    </>
  )
}
