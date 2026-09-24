import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Printable, print } from '@/components/ui/printable'
import type { Payment } from '@/lib/api/types'
import { formatDateTime, money, monthName } from '@/lib/format'
import { methodLabel } from '@/lib/labels'

/**
 * To'lov kvitansiyasi.
 *
 * Ota-ona "qog'oz bering" deydi — bu oyna ekranda ko'rinadi va shu
 * holicha chop etiladi (brauzer orqali PDF ham bo'ladi).
 */
export function ReceiptModal({
  payment,
  teacherName,
  onClose,
}: {
  payment: Payment
  teacherName: string
  onClose: () => void
}) {
  const number = `${payment.year}${String(payment.month).padStart(2, '0')}-${payment.id}`

  const body = (
    <div className="mx-auto max-w-md">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <p className="text-lg font-semibold">To&rsquo;lov kvitansiyasi</p>
          <p className="text-sm text-slate-500">№ {number}</p>
        </div>
        <p className="text-sm text-slate-500">{formatDateTime(payment.paid_at)}</p>
      </div>

      <dl className="space-y-2 py-4 text-sm">
        <Row label="O&rsquo;quvchi" value={payment.full_name} />
        <Row label="Guruh" value={payment.group_name} />
        <Row
          label="Davr"
          value={`${monthName(payment.month)} ${payment.year}`}
        />
        <Row label="To&rsquo;lov turi" value={methodLabel[payment.method]} />
        {payment.note && <Row label="Izoh" value={payment.note} />}
      </dl>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-sm text-slate-500">Summa</span>
        <span className="text-xl font-semibold">
          {money(payment.amount)} so&rsquo;m
        </span>
      </div>

      <div className="mt-8 flex justify-between text-xs text-slate-500">
        <span>Qabul qildi: {teacherName}</span>
        <span>Imzo: ____________</span>
      </div>
    </div>
  )

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Kvitansiya"
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Yopish
            </Button>
            <Button onClick={print}>Chop etish</Button>
          </>
        }
      >
        {body}
      </Modal>

      {/* Chop etish uchun nusxa — ekranda ko'rinmaydi. */}
      <Printable>{body}</Printable>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
