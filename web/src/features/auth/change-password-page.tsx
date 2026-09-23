import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
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
  const [form, setForm] = useState({ current: '', next: '', repeat: '' })
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (form.next !== form.repeat) {
      toast.error(new Error('Parollar mos kelmadi'))
      return
    }
    setBusy(true)
    try {
      await api.post('/auth/password/change', {
        current_password: form.current,
        new_password: form.next,
        new_password_confirm: form.repeat,
      })
      toast.success("Parol o'zgartirildi. Qaytadan kiring.")
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
      title="Parolni o&rsquo;zgartirish"
      subtitle={
        mustChangePassword ? 'Davom etish uchun avval yangi parol qo‘ying' : undefined
      }
      footer={
        mustChangePassword ? null : (
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="text-sm text-slate-500 hover:underline"
          >
            Orqaga
          </button>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Joriy parol"
          type="password"
          value={form.current}
          autoComplete="current-password"
          autoFocus
          onChange={(event) => setForm({ ...form, current: event.target.value })}
        />
        <Input
          label="Yangi parol"
          type="password"
          value={form.next}
          hint="Kamida 8 belgi"
          autoComplete="new-password"
          onChange={(event) => setForm({ ...form, next: event.target.value })}
        />
        <Input
          label="Yangi parolni takrorlang"
          type="password"
          value={form.repeat}
          autoComplete="new-password"
          onChange={(event) => setForm({ ...form, repeat: event.target.value })}
        />
        <Button type="submit" className="w-full" loading={busy}>
          Saqlash
        </Button>
      </form>
    </AuthLayout>
  )
}
