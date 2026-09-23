import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
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
      setErrors({ password_confirm: 'Parollar mos kelmadi' })
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
      <AuthLayout title="Ro&rsquo;yxatdan o&rsquo;tdingiz">
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-600">{done.detail}</p>
          <p className="rounded-lg bg-slate-50 py-3 text-sm">
            Username: <span className="font-semibold">{done.username}</span>
          </p>
          <p className="text-xs text-slate-500">
            Tasdiqlangandan keyin shu username va parol bilan kira olasiz.
          </p>
          <Link to="/login">
            <Button className="w-full">Kirish sahifasiga</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Ro&rsquo;yxatdan o&rsquo;tish"
      subtitle="O&rsquo;qituvchi hisobini oching"
      footer={
        <>
          Hisobingiz bormi?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Kirish
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Ism"
            value={form.first_name}
            error={errors.first_name}
            autoFocus
            onChange={(event) => setForm({ ...form, first_name: event.target.value })}
          />
          <Input
            label="Familiya"
            value={form.last_name}
            error={errors.last_name}
            onChange={(event) => setForm({ ...form, last_name: event.target.value })}
          />
        </div>

        <Input
          label="Username"
          value={form.username}
          error={errors.username}
          autoComplete="username"
          hint="Tizimga shu nom bilan kirasiz. Kichik harf, raqam, . _ -"
          onChange={(event) =>
            setForm({ ...form, username: event.target.value.toLowerCase() })
          }
        />

        <Input
          label="Email (ixtiyoriy)"
          type="email"
          value={form.email}
          error={errors.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />

        <Input
          label="Telefon (ixtiyoriy)"
          value={form.phone}
          error={errors.phone}
          placeholder="+998 90 123 45 67"
          hint="Email yoki telefon bo&rsquo;lsa, parolni o&rsquo;zingiz tiklay olasiz"
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />

        <Input
          label="Parol"
          type="password"
          value={form.password}
          error={errors.password}
          hint="Kamida 8 belgi"
          autoComplete="new-password"
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />

        <Input
          label="Parolni takrorlang"
          type="password"
          value={form.password_confirm}
          error={errors.password_confirm}
          autoComplete="new-password"
          onChange={(event) =>
            setForm({ ...form, password_confirm: event.target.value })
          }
        />

        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Hisobingiz administrator tasdiqlagandan keyin faollashadi.
        </p>

        <Button type="submit" className="w-full" loading={busy}>
          Ro&rsquo;yxatdan o&rsquo;tish
        </Button>
      </form>
    </AuthLayout>
  )
}
