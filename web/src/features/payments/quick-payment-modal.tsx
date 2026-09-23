import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { debtorsQuery } from '@/lib/api/queries'
import type { Charge, Debtor } from '@/lib/api/types'
import { money } from '@/lib/format'
import { currentPeriod, type Period } from '@/lib/period'

import { RecordPaymentModal } from './record-payment-modal'

/** Qarzdor yozuvini to'lov oynasi kutadigan shaklga keltiradi. */
function toCharge(debtor: Debtor): Charge {
  return {
    charge_id: debtor.charge_id,
    student_id: debtor.student_id,
    full_name: debtor.full_name,
    amount_due: debtor.amount_due,
    amount_paid: debtor.amount_paid,
    balance: debtor.balance,
    status: debtor.amount_paid > 0 ? 'partial' : 'unpaid',
    note: null,
  }
}

/**
 * Bosh sahifadan to'lov kiritish.
 *
 * Ilgari yo'l uzun edi: Guruhlar → guruh → To'lovlar → o'quvchi. To'lov
 * kuniga bir necha marta kiritilgani uchun qarzdorni shu yerdan izlab,
 * darrov kiritish mumkin.
 */
export function QuickPaymentModal({
  debtor,
  period = currentPeriod(),
  onClose,
}: {
  /** Berilgan bo'lsa ro'yxat o'tkazib yuboriladi. */
  debtor?: Debtor
  period?: Period
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Debtor | null>(debtor ?? null)
  const [search, setSearch] = useState('')

  const { data, isPending, error, refetch } = useQuery({
    ...debtorsQuery(period),
    enabled: selected === null,
  })

  if (selected) {
    return (
      <RecordPaymentModal
        groupId={selected.group_id}
        period={period}
        charge={toCharge(selected)}
        onClose={onClose}
      />
    )
  }

  const query = search.trim().toLowerCase()
  const items = (data?.items ?? []).filter((item) =>
    query ? item.full_name.toLowerCase().includes(query) : true,
  )

  return (
    <Modal open onClose={onClose} title="To&rsquo;lov qabul qilish" description="Qarzdorlar">
      <div className="space-y-3">
        <Input
          placeholder="O&rsquo;quvchi ismi"
          value={search}
          autoFocus
          onChange={(event) => setSearch(event.target.value)}
        />

        {isPending && <Loading rows={3} />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}

        {data && items.length === 0 && (
          <EmptyState
            title={query ? 'Topilmadi' : 'Qarzdor yo&rsquo;q'}
            description={
              query ? undefined : 'Bu oy uchun hamma to&rsquo;lagan'
            }
          />
        )}

        {items.length > 0 && (
          <Card className="max-h-80 overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.charge_id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {item.full_name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {item.group_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-unpaid">
                      {money(item.balance)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Modal>
  )
}
