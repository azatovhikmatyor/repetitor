import { createBrowserRouter, Navigate, Outlet } from 'react-router'

import { AppShell } from '@/components/layout/app-shell'
import { Spinner } from '@/components/ui/states'
import { useAuth } from '@/lib/auth/auth-context'
import { AdminStatsPage } from '@/features/admin/admin-stats-page'
import { TeachersPage } from '@/features/admin/teachers-page'
import { AttendancePage } from '@/features/attendance/attendance-page'
import { MonthlyAttendancePage } from '@/features/attendance/monthly-attendance-page'
import { ChangePasswordPage } from '@/features/auth/change-password-page'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { GroupDetailPage } from '@/features/groups/group-detail-page'
import { GroupsPage } from '@/features/groups/groups-page'
import { GroupPaymentsPage } from '@/features/payments/group-payments-page'
import { ProfilePage } from '@/features/profile/profile-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { ExpensesPage } from '@/features/expenses/expenses-page'
import { DebtorsPage } from '@/features/payments/debtors-page'
import { AdminQuizzesCatalogPage } from '@/features/admin/quizzes-catalog-page'
import { GradingPage } from '@/features/quizzes/grading-page'
import { QuizDetailPage } from '@/features/quizzes/quiz-detail-page'
import { QuizzesPage } from '@/features/quizzes/quizzes-page'
import { ResultsPage } from '@/features/quizzes/results-page'
import { ReportsPage } from '@/features/reports/reports-page'
import { StudentDetailPage } from '@/features/students/student-detail-page'
import { StudentsPage } from '@/features/students/students-page'
import { MyAttendancePage } from '@/features/student-portal/attendance-page'
import { MyPaymentsPage } from '@/features/student-portal/payments-page'
import { MyQuizzesPage } from '@/features/student-portal/quizzes-page'

function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="size-8" />
    </div>
  )
}

/** Kirmagan foydalanuvchini login sahifasiga yuboradi. */
function RequireAuth() {
  const { status, mustChangePassword } = useAuth()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'signed-out') return <Navigate to="/login" replace />

  // Vaqtinchalik parol bilan kirgan — boshqa sahifalarga o'tolmaydi (talab 3).
  if (mustChangePassword) return <Navigate to="/change-password" replace />

  return <Outlet />
}

/** Kirgan foydalanuvchini login/register sahifalaridan qaytaradi. */
function RequireAnonymous() {
  const { status, mustChangePassword } = useAuth()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'signed-in') {
    return <Navigate to={mustChangePassword ? '/change-password' : '/'} replace />
  }
  return <Outlet />
}

/**
 * Rol bo'yicha ajratish.
 *
 * Super admin o'qituvchi sahifalarini ko'rmaydi va aksincha — backend ham
 * shunday cheklaydi (403), bu yerda faqat foydalanuvchi bekorga xatolikka
 * urilmasligi uchun oldindan yo'naltiramiz.
 */
function RoleHome() {
  const { user } = useAuth()
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (user?.role === 'student') return <Navigate to="/my/attendance" replace />
  return <DashboardPage />
}

function RequireAdmin() {
  const { user } = useAuth()
  return user?.role === 'super_admin' ? <Outlet /> : <Navigate to="/" replace />
}

export const router = createBrowserRouter([
  {
    element: <RequireAnonymous />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    // Parol almashtirish ekrani — kirgan, lekin hali to'liq ruxsat yo'q.
    path: '/change-password',
    element: <ChangePasswordPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <RoleHome /> },
          { path: 'groups', element: <GroupsPage /> },
          { path: 'groups/:groupId', element: <GroupDetailPage /> },
          { path: 'groups/:groupId/attendance', element: <AttendancePage /> },
          { path: 'groups/:groupId/attendance/monthly', element: <MonthlyAttendancePage /> },
          { path: 'groups/:groupId/payments', element: <GroupPaymentsPage /> },
          { path: 'students', element: <StudentsPage /> },
          { path: 'students/:studentId', element: <StudentDetailPage /> },
          { path: 'debtors', element: <DebtorsPage /> },
          { path: 'quizzes', element: <QuizzesPage /> },
          { path: 'quizzes/:quizId', element: <QuizDetailPage /> },
          { path: 'quizzes/assignments/:assignmentId/grading', element: <GradingPage /> },
          { path: 'quizzes/assignments/:assignmentId/results', element: <ResultsPage /> },
          { path: 'expenses', element: <ExpensesPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'my/attendance', element: <MyAttendancePage /> },
          { path: 'my/payments', element: <MyPaymentsPage /> },
          { path: 'my/quizzes', element: <MyQuizzesPage /> },
          {
            element: <RequireAdmin />,
            children: [
              { path: 'admin', element: <AdminStatsPage /> },
              { path: 'admin/teachers', element: <TeachersPage /> },
              { path: 'admin/quizzes', element: <AdminQuizzesCatalogPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
