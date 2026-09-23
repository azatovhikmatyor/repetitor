import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MoneyInput, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { qk } from '@/lib/api/queries'
import type { Charge, PaymentMethod } from '@/lib/api/types'
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
      toast.success("To'lov qayd etildi")
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
      description={`${monthName(period.month)} ${period.year} · kutilgan ${money(charge.amount_due)} so'm`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={parsed <= 0}
            onClick={() => mutation.mutate()}
          >
            Saqlash
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MoneyInput
          label="Summa"
          value={amount}
          autoFocus
          hint={
            charge.amount_paid > 0
              ? `Allaqachon to'langan: ${money(charge.amount_paid)} · qarz: ${money(charge.balance)}`
              : undefined
          }
          onChange={setAmount}
        />

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAmount(String(remaining))}>
            To&rsquo;liq ({money(remaining)})
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAmount(String(Math.floor(remaining / 2)))}
          >
            Yarmi
          </Button>
        </div>

        <Select
          label="To&rsquo;lov turi"
          value={method}
          options={methodOptions}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
        />

        <Textarea label="Izoh" rows={2} value={note} onChange={setNote} />
      </div>
    </Modal>
  )
}
