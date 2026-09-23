import { useEffect, useRef, type ReactNode } from 'react'

import { Button } from './button'

/**
 * Oddiy modal — native `<dialog>` ustida.
 *
 * Radix yoki headlessui qo'shilmadi: `<dialog>` fokus tutqichi, Esc bilan
 * yopish va backdrop'ni brauzerning o'zi beradi.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={`m-auto w-[calc(100vw-2rem)] rounded-xl p-0 backdrop:bg-slate-900/40 ${width}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Yopish">
          &times;
        </Button>
      </div>

      <div className="px-5 py-4">{children}</div>

      {footer && (
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  )
}

/** Xavfli amaldan oldin tasdiqlash. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ha',
  destructive = false,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  )
}
