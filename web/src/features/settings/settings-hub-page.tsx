import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { ConfirmModal } from '@/components/ui/modal'
import { useAuth } from '@/lib/auth/auth-context'
import { useT } from '@/lib/i18n'

/**
 * Sozlamalar bosh sahifasi — Telegram uslubida: yuqorida profil qatori,
 * pastda bo'lim ro'yxati, har biri o'z sahifasiga olib boradi.
 *
 * Yon paneldagi profil qatori (avatar+ism) endi bosilmaydi — profilni
 * o'zgartirish faqat shu yerdan, gear tugmasi orqali.
 */
export function SettingsHubPage() {
  const t = useT()
  const { user, logout } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  if (!user) return null

  const roleLabel =
    user.role === 'super_admin'
      ? t.nav.superAdminRole
      : user.role === 'student'
        ? t.nav.studentRole
        : t.nav.teacherRole

  return (
    <>
      <PageHeader title={t.settings.title} />

      <div className="max-w-lg space-y-6">
        <Card className="overflow-hidden">
          <Link
            to="/settings/profile"
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50"
          >
            <Avatar src={user.avatar_url} name={user.full_name} className="size-12 text-base" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-slate-900">
                {user.full_name}
              </span>
              <span className="block truncate text-sm text-slate-500">{roleLabel}</span>
            </span>
            <Icon name="chevron-right" className="size-4 shrink-0 text-slate-400" />
          </Link>
        </Card>

        <Card className="divide-y divide-slate-100 overflow-hidden">
          <HubRow to="/settings/profile" icon="user" label={t.settings.hubProfileRow} description={t.settings.hubProfileDesc} />
          <HubRow to="/settings/language" icon="globe" label={t.settings.hubLanguageRow} />
          <HubRow to="/settings/appearance" icon="palette" label={t.settings.hubAppearanceRow} description={t.settings.hubAppearanceDesc} />
          <HubRow to="/settings/security" icon="lock" label={t.settings.hubSecurityRow} description={t.settings.hubSecurityDesc} />
        </Card>

        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-unpaid transition-colors hover:bg-unpaid/5"
          >
            <Icon name="logout" className="size-5 shrink-0" />
            <span className="flex-1 font-medium">{t.logoutModal.confirmLabel}</span>
          </button>
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

function HubRow({
  to,
  icon,
  label,
  description,
}: {
  to: string
  icon: IconName
  label: string
  description?: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon name={icon} className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-800">{label}</span>
        {description && (
          <span className="block truncate text-xs text-slate-500">{description}</span>
        )}
      </span>
      <Icon name="chevron-right" className="size-4 shrink-0 text-slate-400" />
    </Link>
  )
}
