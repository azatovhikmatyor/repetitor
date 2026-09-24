import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { MonthPicker } from '@/components/ui/month-picker'
import { ConfirmModal } from '@/components/ui/modal'
import { Progress, Stat } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { DataTable } from '@/components/ui/data-table'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { groupMonthQuery, paymentHistoryQuery, qk } from '@/lib/api/queries'
import type { Charge, Payment } from '@/lib/api/types'
import { formatDate, money } from '@/lib/format'
import { useAuth } from '@/lib/auth/auth-context'
import { downloadCsv, slug } from '@/lib/export'
import { chargeStateLabel, chargeStateTone, methodLabel } from '@/lib/labels'
import { currentPeriod, shiftPeriod } from '@/lib/period'

import { ReceiptModal } from './receipt-modal'
import { RecordPaymentModal } from './record-payment-modal'

/**
 * Guruhning oylik to'lov holati.
 *
 * Yuqorida o'quvchilar kesimi (kim to'ladi, kim to'lamadi), pastda shu
 * oyning to'lovlar tarixi — bekor qilish tugmasi bilan.
 */
export function GroupPaymentsPage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const [period, setPeriod] = useState(currentPeriod())
  const [charge, setCharge] = useState<Charge | null>(null)
  const [reversing, setReversing] = useState<Payment | null>(null)
  const [receipt, setReceipt] = useState<Payment | null>(null)

  const toast = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const reverse = useMutation({
    mutationFn: (payment: Payment) => api.post(`/payments/${payment.id}/reverse`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', id, 'payments'] })
      await queryClient.invalidateQueries({ queryKey: qk.dashboard })
      toast.success("To'lov bekor qilindi")
      setReversing(null)
    },
    onError: (error) => {
      toast.error(error)
      setReversing(null)
    },
  })

  const month = useQuery(groupMonthQuery(id, period))
  const history = useQuery(paymentHistoryQuery(id, period))

  // To'lov o'tgan, joriy va kelasi oy uchun kiritiladi (talab 12).
  const maxPeriod = shiftPeriod(currentPeriod(), 1)

  return (
    <>
      <PageHeader
        title="To&rsquo;lovlar"
        description={month.data?.group_name}
        back={{ to: `/groups/${id}`, label: 'Guruh' }}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!month.data}
              onClick={() => {
                if (!month.data) return
                downloadCsv(
                  `${slug(month.data.group_name)}-${period.year}-${String(
                    period.month,
                  ).padStart(2, '0')}`,
                  ["O'quvchi", 'Kutilgan', "To'langan", 'Qarz', 'Holat'],
                  month.data.students.map((item) => [
                    item.full_name,
                    item.amount_due,
                    item.amount_paid,
                    Math.max(item.balance, 0),
                    chargeStateLabel(item.status, item.amount_due),
                  ]),
                )
              }}
            >
              Excel
            </Button>
            <MonthPicker value={period} onChange={setPeriod} max={maxPeriod} />
          </>
        }
      />

      {month.isPending && <Loading rows={5} />}
      {month.error && <ErrorState error={month.error} onRetry={() => void month.refetch()} />}

      {month.data && (
        <div className="space-y-6">
          <Card>
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Stat
                label="Yig&rsquo;ilgan"
                value={money(month.data.total_paid)}
                tone="paid"
              />
              <Stat label="Kutilgan" value={money(month.data.total_due)} />
              <Stat
                label="Qarz"
                value={money(month.data.total_debt)}
                tone={month.data.total_debt > 0 ? 'unpaid' : undefined}
              />
              <div className="sm:col-span-3">
                <Progress
                  value={
                    month.data.total_due === 0
                      ? 0
                      : month.data.total_paid / month.data.total_due
                  }
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="O&rsquo;quvchilar" />
            {month.data.students.length === 0 ? (
              <EmptyState
                title="Bu oyda hisob yo&rsquo;q"
                description="Guruhda faol o&rsquo;quvchi bo&rsquo;lmasa hisob ochilmaydi"
              />
            ) : (
              <DataTable
                rows={month.data.students}
                rowKey={(item) => item.charge_id}
                columns={[
                  {
                    key: 'name',
                    header: 'Ism',
                    primary: true,
                    cell: (item) => item.full_name,
                  },
                  {
                    key: 'due',
                    header: 'Kutilgan',
                    align: 'right',
                    cell: (item) => money(item.amount_due),
                  },
                  {
                    key: 'paid',
                    header: "To'langan",
                    align: 'right',
                    cell: (item) => money(item.amount_paid),
                  },
                  {
                    key: 'balance',
                    header: 'Qarz',
                    align: 'right',
                    cell: (item) =>
                      item.balance > 0 ? (
                        <span className="font-medium text-unpaid">
                          {money(item.balance)}
                        </span>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    key: 'status',
                    header: 'Holat',
                    cell: (item) => (
                      <Badge tone={chargeStateTone(item.status, item.amount_due)}>
                        {chargeStateLabel(item.status, item.amount_due)}
                      </Badge>
                    ),
                  },
                  {
                    key: 'action',
                    align: 'right',
                    footer: true,
                    cell: (item) => (
                      <Button size="sm" variant="secondary" onClick={() => setCharge(item)}>
                        To&rsquo;lov
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="To&rsquo;lovlar tarixi"
              description="To&rsquo;lov o&rsquo;chirilmaydi &mdash; bekor qilinganda tuzatuvchi yozuv qo&rsquo;shiladi"
            />
            {history.isPending && <Loading rows={2} />}
            {history.data?.length === 0 && <EmptyState title="Bu oyda to&rsquo;lov yo&rsquo;q" />}
            {history.data && history.data.length > 0 && (
              <DataTable
                rows={history.data}
                rowKey={(payment) => payment.id}
                columns={[
                  {
                    key: 'name',
                    header: "O'quvchi",
                    primary: true,
                    cell: (payment) => payment.full_name,
                  },
                  {
                    key: 'date',
                    header: 'Sana',
                    cell: (payment) => (
                      <span className="whitespace-nowrap text-slate-500">
                        {formatDate(payment.paid_at)}
                      </span>
                    ),
                  },
                  {
                    key: 'method',
                    header: 'Turi',
                    cell: (payment) => (
                      <span className="text-slate-500">{methodLabel[payment.method]}</span>
                    ),
                  },
                  {
                    key: 'note',
                    header: 'Izoh',
                    cell: (payment) =>
                      payment.is_reversal ? (
                        <Badge tone="unpaid">Bekor qilingan</Badge>
                      ) : (
                        <span className="text-slate-500">{payment.note}</span>
                      ),
                  },
                  {
                    key: 'amount',
                    header: 'Summa',
                    align: 'right',
                    cell: (payment) => (
                      <span
                        className={
                          payment.amount < 0
                            ? 'font-medium text-unpaid'
                            : 'font-medium text-paid'
                        }
                      >
                        {money(payment.amount)}
                      </span>
                    ),
                  },
                  {
                    key: 'action',
                    align: 'right',
                    footer: true,
                    cell: (payment) =>
                      payment.is_reversal ? null : (
                        <span className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReceipt(payment)}
                          >
                            Kvitansiya
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReversing(payment)}
                          >
                            Bekor qilish
                          </Button>
                        </span>
                      ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      <ConfirmModal
        open={reversing !== null}
        onClose={() => setReversing(null)}
        onConfirm={() => reversing && reverse.mutate(reversing)}
        loading={reverse.isPending}
        destructive
        title="To'lovni bekor qilish"
        message={`${reversing?.full_name ?? ''} — ${money(reversing?.amount ?? 0)}. Yozuv o'chmaydi: unga bog'langan manfiy summali tuzatuvchi yozuv qo'shiladi va ikkalasi ham tarixda qoladi.`}
        confirmLabel="Bekor qilish"
      />

      {receipt && (
        <ReceiptModal
          payment={receipt}
          teacherName={user?.full_name ?? ''}
          onClose={() => setReceipt(null)}
        />
      )}

      {charge && (
        <RecordPaymentModal
          groupId={id}
          period={period}
          charge={charge}
          onClose={() => setCharge(null)}
        />
      )}
    </>
  )
}
