import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import type { ForgotPasswordResponse } from '@/lib/api/types'

import { AuthLayout } from './login-page'

/**
 * Parolni tiklash — faqat o'qituvchilar uchun.
 *
 * O'quvchi parolni o'zi tiklay olmaydi: u o'qituvchisiga murojaat qiladi
 * (talab 3).
 */
export function ForgotPasswordPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await api.post<ForgotPasswordResponse>(
        '/auth/password/forgot',
        { login },
        { skipAuth: true },
      )
      setInfo(response.detail)
      // Kanal null bo'lsa — hisobda email ham, telefon ham yo'q va parolni
      // faqat administrator tiklay oladi.
      if (response.channel) setSent(true)
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  async function reset(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post(
        '/auth/password/reset',
        {
          token,
          new_password: password,
          new_password_confirm: password,
        },
        { skipAuth: true },
      )
      toast.success('Parol yangilandi. Endi yangi parol bilan kiring.')
      void navigate('/login')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Parolni tiklash"
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Kirishga qaytish
        </Link>
      }
    >
      {sent ? (
        <form onSubmit={reset} className="space-y-4">
          <Input
            label="Email&rsquo;ga kelgan kod"
            value={token}
            autoFocus
            onChange={(event) => setToken(event.target.value)}
          />
          <Input
            label="Yangi parol"
            type="password"
            value={password}
            hint="Kamida 8 belgi"
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" className="w-full" loading={busy}>
            Saqlash
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setSent(false)}
          >
            Boshqa manzil kiritish
          </Button>
        </form>
      ) : (
        <form onSubmit={requestCode} className="space-y-4">
          <Input
            label="Email yoki telefon raqami"
            value={login}
            autoFocus
            hint="Kod shu manzilga yuboriladi"
            onChange={(event) => setLogin(event.target.value)}
          />
          {info && <p className="text-sm text-slate-600">{info}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            Kod yuborish
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
