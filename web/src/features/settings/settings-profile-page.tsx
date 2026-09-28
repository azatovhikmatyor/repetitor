import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/app-shell'
import { AvatarUploader } from '@/components/ui/avatar-uploader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import type { User } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/auth-context'
import { useT } from '@/lib/i18n'
import { formatDateTime } from '@/lib/format'

function formFrom(user: User | null) {
  return {
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    middle_name: user?.middle_name ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
  }
}

/**
 * Profil ma'lumotlari — ism/aloqa maydonlari standart holatda faqat o'qish
 * uchun, "Tahrirlash" bosilgandagina tahrirlanadigan bo'ladi. Rasm yuklash
 * bundan mustaqil — u har doim faol (tanlangan zahoti yuboriladi).
 */
export function SettingsProfilePage() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => formFrom(user))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: () => api.patch<User>('/auth/me', form),
    onSuccess: (updated) => {
      setUser(updated)
      setErrors({})
      setEditing(false)
      toast.success(t.profile.savedToast)
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error)
    },
  })

  if (!user) return null

  function startEditing() {
    setForm(formFrom(user))
    setErrors({})
    setEditing(true)
  }

  function cancelEditing() {
    setForm(formFrom(user))
    setErrors({})
    setEditing(false)
  }

  const canResetAlone = Boolean(form.email || form.phone)

  return (
    <>
      <PageHeader
        title={t.settings.hubProfileRow}
        back={{ to: '/settings', label: t.settings.back }}
      />

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader
            title={t.profile.infoTitle}
            action={
              editing ? (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={cancelEditing}>
                    {t.profile.cancelBtn}
                  </Button>
                  <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
                    {t.profile.save}
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={startEditing}>
                  {t.profile.editBtn}
                </Button>
              )
            }
          />
          <CardBody className="space-y-4">
            <AvatarUploader<User>
              src={user.avatar_url}
              name={user.full_name}
              path="/auth/me/avatar"
              onChange={setUser}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t.profile.firstName}
                value={form.first_name}
                error={errors.first_name}
                disabled={!editing}
                onChange={(event) =>
                  setForm({ ...form, first_name: event.target.value })
                }
              />
              <Input
                label={t.profile.lastName}
                value={form.last_name}
                error={errors.last_name}
                disabled={!editing}
                onChange={(event) =>
                  setForm({ ...form, last_name: event.target.value })
                }
              />
            </div>

            <Input
              label={t.profile.middleName}
              value={form.middle_name}
              error={errors.middle_name}
              placeholder={t.profile.middlePlaceholder}
              disabled={!editing}
              onChange={(event) =>
                setForm({ ...form, middle_name: event.target.value })
              }
            />

            <Input
              label={t.profile.email}
              type="email"
              value={form.email}
              error={errors.email}
              disabled={!editing}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <Input
              label={t.profile.phone}
              value={form.phone}
              error={errors.phone}
              disabled={!editing}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />

            {editing && !canResetAlone && (
              <p className="rounded-lg bg-partial/10 px-3 py-2 text-xs text-slate-700">
                {t.profile.resetAloneHint}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.profile.accountTitle} />
          <CardBody className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">{t.profile.username}</dt>
                <dd className="font-medium text-slate-800">{user.username}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">{t.profile.status}</dt>
                <dd>
                  {user.status === 'active' ? (
                    <Badge tone="paid">{t.profile.statusActive}</Badge>
                  ) : user.status === 'pending' ? (
                    <Badge tone="partial">{t.profile.statusPending}</Badge>
                  ) : (
                    <Badge tone="unpaid">{t.profile.statusBlocked}</Badge>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t.profile.lastLogin}</dt>
                <dd className="text-slate-800">
                  {user.last_login_at ? formatDateTime(user.last_login_at) : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t.profile.registeredAt}</dt>
                <dd className="text-slate-800">{formatDateTime(user.created_at)}</dd>
              </div>
            </dl>

            <p className="text-xs text-slate-500">{t.profile.usernameFixedNotice}</p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
