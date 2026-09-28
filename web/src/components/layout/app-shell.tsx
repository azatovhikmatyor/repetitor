import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'

import { Avatar } from '@/components/ui/avatar'
import { Icon, type IconName } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/modal'
import { pendingTeachersQuery } from '@/lib/api/queries'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth/auth-context'
import { useT } from '@/lib/i18n'

interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Tasdiq kutayotganlar soni shu bo'limda ko'rsatiladi. */
  badge?: 'pending-teachers'
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const t = useT()
  const isAdmin = user?.role === 'super_admin'
  const isStudent = user?.role === 'student'
  const teacherNav: NavItem[] = [
    { to: '/', label: t.nav.dashboard, icon: 'home' },
    { to: '/groups', label: t.nav.groups, icon: 'groups' },
    { to: '/students', label: t.nav.students, icon: 'students' },
    { to: '/quizzes', label: t.nav.quizzes, icon: 'quiz' },
    { to: '/expenses', label: t.nav.expenses, icon: 'money' },
    { to: '/reports', label: t.nav.reports, icon: 'reports' },
  ]
  const adminNav: NavItem[] = [
    { to: '/admin', label: t.nav.platform, icon: 'home' },
    { to: '/admin/teachers', label: t.nav.teachers, icon: 'students', badge: 'pending-teachers' },
    { to: '/admin/quizzes', label: t.nav.quizCatalog, icon: 'quiz' },
  ]
  // O'quvchi faqat o'zini ko'radi — guruh, o'quvchilar ro'yxati va
  // xarajatlar unga umuman ko'rinmaydi.
  const studentNav: NavItem[] = [
    { to: '/my/attendance', label: t.nav.myAttendance, icon: 'reports' },
    { to: '/my/payments', label: t.nav.myPayments, icon: 'money' },
    { to: '/my/quizzes', label: t.nav.myQuizzes, icon: 'quiz' },
  ]
  const nav = isAdmin ? adminNav : isStudent ? studentNav : teacherNav

  // Yangi o'qituvchi haqidagi bildirishnoma — yon menyudagi raqam.
  const pending = useQuery({ ...pendingTeachersQuery(), enabled: isAdmin })

  const [logoutOpen, setLogoutOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Yon panel — desktopda doim ochiq, telefonda tugma bilan. */}
      <aside
        className={cn(
          'border-b border-slate-200 bg-white lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0',
          'lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              R
            </span>
            <span className="font-semibold text-slate-900">Repetitor</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            Menyu
          </Button>
        </div>

        <div className={cn('px-3', !menuOpen && 'hidden lg:block')}>
          {/* Profil — navigatsiyadan yuqorida: kim bo'lib kirganingiz doim ko'rinadi. */}
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
            {/* Faqat ma'lumot — bosilmaydi. Profil/sozlamalar gear
                tugmasi orqali ochiladi. */}
            <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">
              <Avatar src={user?.avatar_url} name={user?.full_name} className="size-9" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {user?.full_name}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {user?.role === 'super_admin'
                    ? t.nav.superAdminRole
                    : user?.role === 'student'
                      ? t.nav.studentRole
                      : t.nav.teacherRole}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                void navigate('/settings')
              }}
              title={t.nav.settings}
              aria-label={t.nav.settings}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            >
              <Icon name="settings" className="size-4.5" />
            </button>

            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              title={t.nav.logout}
              aria-label={t.nav.logout}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-unpaid transition-colors hover:border-unpaid/40 hover:bg-unpaid/10"
            >
              <Icon name="logout" className="size-4.5" />
            </button>
          </div>
        </div>

        <nav className={cn('px-3 pb-4', !menuOpen && 'hidden lg:block')}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/admin'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.badge === 'pending-teachers' && (pending.data ?? 0) > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-unpaid px-1.5 text-xs font-semibold text-white">
                  {pending.data}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void logout()}
        destructive
        title={t.logoutModal.title}
        message={t.logoutModal.message}
        confirmLabel={t.logoutModal.confirmLabel}
      />
    </div>
  )
}

/** Sahifa sarlavhasi — barcha ekranlarda bir xil. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <header className="mb-6">
      {back && (
        <NavLink
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          &lsaquo; {back.label}
        </NavLink>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 lg:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
