import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useToast } from '@/components/ui/toast'
import { useT } from '@/lib/i18n'
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

        <div className="mt-4 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const t = useT()
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
      title={t.auth.appName}
      subtitle={t.auth.tagline}
      footer={
        <>
          {t.auth.noAccount}{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            {t.auth.registerLink}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label={t.auth.usernameLabel}
          value={form.login}
          autoComplete="username"
          autoFocus
          onChange={(event) => setForm({ ...form, login: event.target.value })}
        />
        <Input
          label={t.auth.passwordLabel}
          type="password"
          value={form.password}
          autoComplete="current-password"
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <Button type="submit" className="w-full" loading={busy}>
          {t.auth.login}
        </Button>
        <p className="text-center">
          <Link to="/forgot-password" className="text-sm text-slate-500 hover:underline">
            {t.auth.forgotPassword}
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
