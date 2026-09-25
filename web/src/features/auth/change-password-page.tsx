import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { useT } from '@/lib/i18n'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/auth-context'

import { AuthLayout } from './login-page'

/**
 * Parolni o'zgartirish.
 *
 * Ikki holatda ochiladi: foydalanuvchi vaqtinchalik parol bilan birinchi
 * marta kirganda (majburiy, orqaga yo'l yo'q) va profildan ixtiyoriy
 * ravishda.
 */
export function ChangePasswordPage() {
  const { status, mustChangePassword, signOutLocally } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const t = useT()
  const [form, setForm] = useState({ current: '', next: '', repeat: '' })
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (form.next !== form.repeat) {
      toast.error(new Error(t.auth.passwordsMismatch))
      return
    }
    setBusy(true)
    try {
      await api.post('/auth/password/change', {
        current_password: form.current,
        new_password: form.next,
        new_password_confirm: form.repeat,
      })
      toast.success(t.auth.passwordChanged)
      // Backend barcha sessiyalarni yopdi — qayta kirish kerak.
      signOutLocally()
      void navigate('/login')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'signed-out') return <Navigate to="/login" replace />

  return (
    <AuthLayout
      title={t.auth.changePasswordTitle}
      subtitle={mustChangePassword ? t.auth.mustChangeSubtitle : undefined}
      footer={
        mustChangePassword ? null : (
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="text-sm text-slate-500 hover:underline"
          >
            {t.auth.back}
          </button>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label={t.auth.currentPassword}
          type="password"
          value={form.current}
          autoComplete="current-password"
          autoFocus
          onChange={(event) => setForm({ ...form, current: event.target.value })}
        />
        <Input
          label={t.auth.newPassword}
          type="password"
          value={form.next}
          hint={t.auth.passwordHint}
          autoComplete="new-password"
          onChange={(event) => setForm({ ...form, next: event.target.value })}
        />
        <Input
          label={t.auth.newPasswordRepeat}
          type="password"
          value={form.repeat}
          autoComplete="new-password"
          onChange={(event) => setForm({ ...form, repeat: event.target.value })}
        />
        <Button type="submit" className="w-full" loading={busy}>
          {t.common.save}
        </Button>
      </form>
    </AuthLayout>
  )
}
