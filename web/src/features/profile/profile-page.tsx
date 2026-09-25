import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { AvatarUploader } from '@/components/ui/avatar-uploader'
import { ConfirmModal } from '@/components/ui/modal'
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

export function ProfilePage() {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const t = useT()
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    middle_name: user?.middle_name ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmLogout, setConfirmLogout] = useState(false)

  const save = useMutation({
    mutationFn: () => api.patch<User>('/auth/me', form),
    onSuccess: (updated) => {
      setUser(updated)
      setErrors({})
      toast.success(t.profile.savedToast)
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error)
    },
  })

  if (!user) return null

  const canResetAlone = Boolean(form.email || form.phone)

  return (
    <>
      <PageHeader
        title={t.profile.title}
        description={
          user.role === 'super_admin'
            ? t.nav.superAdminRole
            : user.role === 'student'
              ? t.nav.studentRole
              : t.nav.teacherRole
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.profile.infoTitle} />
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
                onChange={(event) =>
                  setForm({ ...form, first_name: event.target.value })
                }
              />
              <Input
                label={t.profile.lastName}
                value={form.last_name}
                error={errors.last_name}
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
              onChange={(event) =>
                setForm({ ...form, middle_name: event.target.value })
              }
            />

            <Input
              label={t.profile.email}
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <Input
              label={t.profile.phone}
              value={form.phone}
              error={errors.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />

            {!canResetAlone && (
              <p className="rounded-lg bg-partial/10 px-3 py-2 text-xs text-slate-700">
                {t.profile.resetAloneHint}
              </p>
            )}

            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {t.profile.save}
            </Button>
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

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Link to="/change-password">
                <Button variant="secondary">{t.profile.changePassword}</Button>
              </Link>
              <Button variant="danger-ghost" onClick={() => setConfirmLogout(true)}>
                {t.logoutModal.confirmLabel}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <ConfirmModal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => void logout()}
        destructive
        title={t.logoutModal.title}
        message={t.logoutModal.message}
        confirmLabel={t.logoutModal.confirmLabel}
      />
    </>
  )
}
