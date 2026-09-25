import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Printable, print } from '@/components/ui/printable'
import type { Payment } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
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
  const t = useT()
  const number = `${payment.year}${String(payment.month).padStart(2, '0')}-${payment.id}`

  const body = (
    <div className="mx-auto max-w-md">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <p className="text-lg font-semibold">{t.payments.receipt.documentTitle}</p>
          <p className="text-sm text-slate-500">
            {t.payments.receipt.numberPrefix} {number}
          </p>
        </div>
        <p className="text-sm text-slate-500">{formatDateTime(payment.paid_at)}</p>
      </div>

      <dl className="space-y-2 py-4 text-sm">
        <Row label={t.payments.receipt.student} value={payment.full_name} />
        <Row label={t.payments.receipt.group} value={payment.group_name} />
        <Row
          label={t.payments.receipt.period}
          value={`${monthName(payment.month)} ${payment.year}`}
        />
        <Row label={t.payments.receipt.method} value={methodLabel(t)[payment.method]} />
        {payment.note && <Row label={t.payments.receipt.note} value={payment.note} />}
      </dl>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-sm text-slate-500">{t.payments.receipt.amount}</span>
        <span className="text-xl font-semibold">
          {money(payment.amount)} {t.common.somUnit}
        </span>
      </div>

      <div className="mt-8 flex justify-between text-xs text-slate-500">
        <span>{t.payments.receipt.receivedBy(teacherName)}</span>
        <span>{t.payments.receipt.signature}</span>
      </div>
    </div>
  )

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={t.payments.receipt.title}
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t.payments.receipt.close}
            </Button>
            <Button onClick={print}>{t.payments.receipt.print}</Button>
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
