import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Chop etiladigan blok.
 *
 * Mazmun `body` ostiga portal bilan qo'yiladi: shunda `@media print`
 * qoidasi ilovaning qolgan qismini yashirib, faqat shu blokni chiqaradi.
 * Modal ichida qoldirilsa, `<dialog>` va uning fon qatlami chop etishda
 * ishonchsiz ishlaydi.
 */
export function Printable({ children }: { children: ReactNode }) {
  const [host] = useState(() => {
    const element = document.createElement('div')
    element.className = 'print-root'
    return element
  })

  useEffect(() => {
    document.body.append(host)
    return () => host.remove()
  }, [host])

  return createPortal(children, host)
}

/** Chop etish oynasini ochadi. */
export function print(): void {
  window.print()
}
