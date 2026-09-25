import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import { useT } from '@/lib/i18n'
import type { RegisterResponse } from '@/lib/api/types'

import { AuthLayout } from './login-page'

/**
 * O'qituvchining ro'yxatdan o'tishi.
 *
 * Ism va familiya alohida — bir xil ismli odamlar bo'lishi mumkin, shuning
 * uchun hisobning yagona identifikatori username. Email va telefon
 * ixtiyoriy, lekin ularsiz parolni mustaqil tiklab bo'lmaydi.
 *
 * Hisob darhol faollashmaydi: administrator tasdiqlagandan keyin ochiladi.
 */
export function RegisterPage() {
  const toast = useToast()
  const t = useT()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<RegisterResponse | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    if (form.password !== form.password_confirm) {
      setErrors({ password_confirm: t.auth.passwordsMismatch })
      return
    }

    setBusy(true)
    setErrors({})
    try {
      const response = await api.post<RegisterResponse>(
        '/auth/register',
        {
          first_name: form.first_name,
          last_name: form.last_name,
          username: form.username,
          password: form.password,
          password_confirm: form.password_confirm,
          ...(form.email ? { email: form.email } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
        },
        { skipAuth: true },
      )
      setDone(response)
    } catch (error) {
      // Backend "bu username allaqachon band" ni aynan maydon bilan
      // qaytaradi — uni shu maydon ostida ko'rsatamiz.
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthLayout title={t.auth.registeredTitle}>
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-600">{done.detail}</p>
          <p className="rounded-lg bg-slate-50 py-3 text-sm">
            <span className="font-semibold">{t.auth.usernameLabelShort(done.username)}</span>
          </p>
          <p className="text-xs text-slate-500">{t.auth.afterApprovalHint}</p>
          <Link to="/login">
            <Button className="w-full">{t.auth.toLoginPage}</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
      footer={
        <>
          {t.auth.hasAccount}{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            {t.auth.login}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t.auth.firstName}
            value={form.first_name}
            error={errors.first_name}
            autoFocus
            onChange={(event) => setForm({ ...form, first_name: event.target.value })}
          />
          <Input
            label={t.auth.lastName}
            value={form.last_name}
            error={errors.last_name}
            onChange={(event) => setForm({ ...form, last_name: event.target.value })}
          />
        </div>

        <Input
          label={t.auth.username}
          value={form.username}
          error={errors.username}
          autoComplete="username"
          hint={t.auth.usernameHint}
          onChange={(event) =>
            setForm({ ...form, username: event.target.value.toLowerCase() })
          }
        />

        <Input
          label={t.auth.emailOptional}
          type="email"
          value={form.email}
          error={errors.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />

        <Input
          label={t.auth.phoneOptional}
          value={form.phone}
          error={errors.phone}
          placeholder="+998 90 123 45 67"
          hint={t.auth.phoneHint}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />

        <Input
          label={t.auth.password}
          type="password"
          value={form.password}
          error={errors.password}
          hint={t.auth.passwordHint}
          autoComplete="new-password"
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />

        <Input
          label={t.auth.repeatPassword}
          type="password"
          value={form.password_confirm}
          error={errors.password_confirm}
          autoComplete="new-password"
          onChange={(event) =>
            setForm({ ...form, password_confirm: event.target.value })
          }
        />

        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          {t.auth.pendingApprovalNotice}
        </p>

        <Button type="submit" className="w-full" loading={busy}>
          {t.auth.registerTitle}
        </Button>
      </form>
    </AuthLayout>
  )
}
