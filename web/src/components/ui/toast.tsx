import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/cn'

type Tone = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  tone: Tone
  message: string
  action?: ToastAction
}

interface ToastApi {
  success: (message: string) => void
  error: (error: unknown) => void
  info: (message: string) => void
  /**
   * Amalni qaytarish taklifi bilan bildirishnoma.
   *
   * Tasdiq oynasi o'rniga: amal darrov bajariladi, foydalanuvchi esa bir
   * necha soniya ichida qaytarib olishi mumkin. Xatoni tuzatish oson
   * bo'lgani uchun har safar "rostdanmi?" deb so'rash shart emas.
   */
  undo: (message: string, action: ToastAction) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast <ToastProvider> ichida ishlatiladi')
  return context
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (tone: Tone, message: string, action?: ToastAction) => {
      const id = nextId++
      setToasts((current) => [...current, { id, tone, message, action }])
      setTimeout(() => dismiss(id), action ? 8000 : 5000)
      return id
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      info: (message) => push('info', message),
      undo: (message, action) => {
        const id = push('info', message, {
          label: action.label,
          onClick: () => {
            dismiss(id)
            action.onClick()
          },
        })
      },
      // Xatolikni bir joyda matnga aylantiramiz — har ekranda takrorlanmaydi.
      error: (error) =>
        push('error', error instanceof ApiError ? error.message : 'Xatolik yuz berdi'),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <output
            key={toast.id}
            className={cn(
              'pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg',
              toast.tone === 'success' && 'bg-paid text-white',
              toast.tone === 'error' && 'bg-unpaid text-white',
              toast.tone === 'info' && 'bg-slate-800 text-white',
            )}
          >
            <span className="flex items-center gap-3">
              {toast.message}
              {toast.action && (
                <button
                  type="button"
                  onClick={toast.action.onClick}
                  className="shrink-0 font-semibold underline underline-offset-2"
                >
                  {toast.action.label}
                </button>
              )}
            </span>
          </output>
        ))}
      </div>
    </ToastContext>
  )
}
