import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MoneyInput, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { qk } from '@/lib/api/queries'
import type { Charge, PaymentMethod } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { money, monthName } from '@/lib/format'
import { methodOptions } from '@/lib/labels'
import type { Period } from '@/lib/period'

/**
 * To'lovni qayd etish.
 *
 * Summa qarz bilan oldindan to'ldiriladi — odatiy holatda o'qituvchi faqat
 * "Saqlash" ni bosadi. Qisman to'lov ham shu oyna orqali: bir oyga bir
 * nechta to'lov qo'shilib boraveradi.
 */
export function RecordPaymentModal({
  groupId,
  period,
  charge,
  onClose,
}: {
  groupId: number
  period: Period
  charge: Charge
  onClose: () => void
}) {
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()

  const remaining = charge.balance > 0 ? charge.balance : charge.amount_due
  const [amount, setAmount] = useState(String(remaining))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/payments`, {
        student_id: charge.student_id,
        year: period.year,
        month: period.month,
        amount: Number(amount || 0),
        method,
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'payments'] })
      await queryClient.invalidateQueries({ queryKey: qk.dashboard })
      await queryClient.invalidateQueries({ queryKey: ['student', charge.student_id] })
      toast.success(t.payments.record.savedToast)
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  const parsed = Number(amount || 0)

  return (
    <Modal
      open
      onClose={onClose}
      title={charge.full_name}
      description={t.payments.record.descriptionLine(
        monthName(period.month),
        period.year,
        money(charge.amount_due),
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.payments.record.cancel}
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={parsed <= 0}
            onClick={() => mutation.mutate()}
          >
            {t.payments.record.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MoneyInput
          label={t.payments.record.amountLabel}
          value={amount}
          autoFocus
          hint={
            charge.amount_paid > 0
              ? t.payments.record.alreadyPaidHint(
                  money(charge.amount_paid),
                  money(charge.balance),
                )
              : undefined
          }
          onChange={setAmount}
        />

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAmount(String(remaining))}>
            {t.payments.record.fullAmount(money(remaining))}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAmount(String(Math.floor(remaining / 2)))}
          >
            {t.payments.record.half}
          </Button>
        </div>

        <Select
          label={t.payments.record.methodLabel}
          value={method}
          options={methodOptions(t)}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
        />

        <Textarea label={t.payments.record.noteLabel} rows={2} value={note} onChange={setNote} />
      </div>
    </Modal>
  )
}
