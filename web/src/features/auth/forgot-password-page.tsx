import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { useT } from '@/lib/i18n'
import type { ForgotPasswordResponse } from '@/lib/api/types'

import { AuthLayout } from './login-page'

/**
 * Parolni tiklash.
 *
 * O'qituvchi email/SMS kod bilan o'zi tiklaydi. O'quvchi esa parolni
 * o'zi tiklay olmaydi (talab: faqat o'qituvchisi so'rov asosida beradi)
 * — shuning uchun shu sahifada alohida, sodda rejim bor: username/telefon
 * kiritadi, tizim o'qituvchisiga xabar qo'yadi.
 */
export function ForgotPasswordPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const t = useT()
  const [studentMode, setStudentMode] = useState(false)
  const [login, setLogin] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [studentRequestSent, setStudentRequestSent] = useState(false)

  async function requestStudentReset(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await api.post<{ detail: string }>(
        '/auth/password/request-reset-from-teacher',
        { login },
        { skipAuth: true },
      )
      setInfo(response.detail)
      setStudentRequestSent(true)
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

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
      toast.success(t.auth.passwordUpdated)
      void navigate('/login')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  if (studentMode) {
    return (
      <AuthLayout
        title={t.auth.studentResetTitle}
        subtitle={studentRequestSent ? undefined : t.auth.studentResetDesc}
        footer={
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            {t.auth.backToLogin}
          </Link>
        }
      >
        {studentRequestSent ? (
          <p className="text-center text-sm text-slate-600">{info}</p>
        ) : (
          <form onSubmit={requestStudentReset} className="space-y-4">
            <Input
              label={t.auth.studentLoginLabel}
              value={login}
              autoFocus
              onChange={(event) => setLogin(event.target.value)}
            />
            <Button type="submit" className="w-full" loading={busy}>
              {t.auth.studentResetSubmit}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStudentMode(false)}
            >
              {t.auth.backToTeacherFlow}
            </Button>
          </form>
        )}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t.auth.resetTitle}
      footer={
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          {t.auth.backToLogin}
        </Link>
      }
    >
      {sent ? (
        <form onSubmit={reset} className="space-y-4">
          <Input
            label={t.auth.emailCodeLabel}
            value={token}
            autoFocus
            onChange={(event) => setToken(event.target.value)}
          />
          <Input
            label={t.auth.newPassword}
            type="password"
            value={password}
            hint={t.auth.passwordHint}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" className="w-full" loading={busy}>
            {t.common.save}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setSent(false)}
          >
            {t.auth.useAnotherAddress}
          </Button>
        </form>
      ) : (
        <form onSubmit={requestCode} className="space-y-4">
          <Input
            label={t.auth.emailOrPhoneLabel}
            value={login}
            autoFocus
            hint={t.auth.codeSentHint}
            onChange={(event) => setLogin(event.target.value)}
          />
          {info && <p className="text-sm text-slate-600">{info}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            {t.auth.sendCode}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStudentMode(true)}
          >
            {t.auth.studentToggleLink}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
