import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/lib/auth/auth-context'

/** Kirish, ro'yxatdan o'tish va parol tiklash sahifalarining umumiy ramkasi. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            R
          </span>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          {children}
        </div>

        {footer && <div className="mt-4 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ login: '', password: '' })
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await login(form.login, form.password)
      // Yo'naltirishni router o'zi qiladi (auth holati o'zgardi).
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Repetitor"
      subtitle="Guruh, davomat va to&rsquo;lov &mdash; bir joyda"
      footer={
        <>
          Hisobingiz yo&rsquo;qmi?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Ro&rsquo;yxatdan o&rsquo;tish
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Username, email yoki telefon"
          value={form.login}
          autoComplete="username"
          autoFocus
          onChange={(event) => setForm({ ...form, login: event.target.value })}
        />
        <Input
          label="Parol"
          type="password"
          value={form.password}
          autoComplete="current-password"
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <Button type="submit" className="w-full" loading={busy}>
          Kirish
        </Button>
        <p className="text-center">
          <Link to="/forgot-password" className="text-sm text-slate-500 hover:underline">
            Parolni unutdingizmi?
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
