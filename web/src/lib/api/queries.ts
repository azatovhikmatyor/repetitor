import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { periodKey, type Period } from '@/lib/period'

import { api } from './client'
import type {
  AttendanceReport,
  AttendanceSession,
  Dashboard,
  Debtors,
  ExpenseMonth,
  Group,
  GroupSchedule,
  GroupMonth,
  GroupStudent,
  MonthlyAttendance,
  MonthlyReport,
  Page,
  Payment,
  RevenuePoint,
  StudentAttendance,
  StudentCharge,
  StudentDetail,
  StudentListItem,
  Teacher,
  AdminStats,
  UserStatus,
} from './types'

/**
 * Barcha so'rov kalitlari bitta joyda.
 *
 * Mutatsiyadan keyin nimani yangilash kerakligini shu yerdan ko'rish oson
 * bo'lsin — kalitlar ekranlar bo'ylab tarqalib ketmasin.
 */
export const qk = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  groups: (search?: string) => ['groups', search ?? ''] as const,
  group: (id: number) => ['group', id] as const,
  groupSchedule: (id: number) => ['group', id, 'schedule'] as const,
  groupStudents: (id: number, includeLeft: boolean) =>
    ['group', id, 'students', includeLeft] as const,
  attendance: (groupId: number, date: string, startTime?: string | null) =>
    ['group', groupId, 'attendance', date, startTime ?? ''] as const,
  attendanceMonthly: (groupId: number, period: Period) =>
    ['group', groupId, 'attendance', 'monthly', periodKey(period)] as const,
  groupMonth: (groupId: number, period: Period) =>
    ['group', groupId, 'payments', periodKey(period)] as const,
  paymentHistory: (groupId: number, period: Period) =>
    ['group', groupId, 'payments', 'history', periodKey(period)] as const,
  students: (
    search: string,
    page: number,
    groupId?: number,
    onlyDebtors?: boolean,
  ) => ['students', search, page, groupId ?? 0, onlyDebtors ?? false] as const,
  student: (id: number) => ['student', id] as const,
  studentAttendance: (id: number) => ['student', id, 'attendance'] as const,
  studentPayments: (id: number) => ['student', id, 'payments'] as const,
  myAttendance: ['me', 'attendance'] as const,
  myPayments: ['me', 'payments'] as const,
  monthlyReport: (period: Period) => ['report', 'monthly', periodKey(period)] as const,
  revenueTrend: (months: number) => ['report', 'revenue', months] as const,
  debtors: (period: Period) => ['report', 'debtors', periodKey(period)] as const,
  attendanceReport: (period: Period) => ['report', 'attendance', periodKey(period)] as const,
  teachers: (search: string, status?: UserStatus) =>
    ['admin', 'teachers', search, status ?? 'all'] as const,
  pendingTeachers: ['admin', 'teachers', 'pending-count'] as const,
  adminStats: ['admin', 'stats'] as const,
  expenses: (period: Period) => ['expenses', periodKey(period)] as const,
}

export const dashboardQuery = () =>
  queryOptions({
    queryKey: qk.dashboard,
    queryFn: ({ signal }) => api.get<Dashboard>('/reports/dashboard', undefined, signal),
  })

export const groupsQuery = (search?: string) =>
  queryOptions({
    queryKey: qk.groups(search),
    queryFn: ({ signal }) =>
      api.get<Page<Group>>('/groups', { size: 100, search }, signal),
    placeholderData: keepPreviousData,
  })

export const groupQuery = (id: number) =>
  queryOptions({
    queryKey: qk.group(id),
    queryFn: ({ signal }) => api.get<Group>(`/groups/${id}`, undefined, signal),
  })

export const groupStudentsQuery = (id: number, includeLeft = false) =>
  queryOptions({
    queryKey: qk.groupStudents(id, includeLeft),
    queryFn: ({ signal }) =>
      api.get<GroupStudent[]>(`/groups/${id}/students`, { include_left: includeLeft }, signal),
  })

export const groupScheduleQuery = (id: number) =>
  queryOptions({
    queryKey: qk.groupSchedule(id),
    queryFn: ({ signal }) =>
      api.get<GroupSchedule>(`/groups/${id}/schedule`, undefined, signal),
  })

export const attendanceQuery = (
  groupId: number,
  date: string,
  startTime?: string | null,
) =>
  queryOptions({
    queryKey: qk.attendance(groupId, date, startTime),
    queryFn: ({ signal }) =>
      api.get<AttendanceSession>(
        `/groups/${groupId}/attendance`,
        { date, start_time: startTime ?? undefined },
        signal,
      ),
  })

export const attendanceMonthlyQuery = (groupId: number, period: Period) =>
  queryOptions({
    queryKey: qk.attendanceMonthly(groupId, period),
    queryFn: ({ signal }) =>
      api.get<MonthlyAttendance>(
        `/groups/${groupId}/attendance/monthly`,
        { year: period.year, month: period.month },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const groupMonthQuery = (groupId: number, period: Period) =>
  queryOptions({
    queryKey: qk.groupMonth(groupId, period),
    queryFn: ({ signal }) =>
      api.get<GroupMonth>(
        `/groups/${groupId}/payments`,
        { year: period.year, month: period.month },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const paymentHistoryQuery = (groupId: number, period: Period) =>
  queryOptions({
    queryKey: qk.paymentHistory(groupId, period),
    queryFn: ({ signal }) =>
      api.get<Payment[]>(
        `/groups/${groupId}/payments/history`,
        { year: period.year, month: period.month },
        signal,
      ),
  })

export const studentsQuery = (
  search: string,
  options: { page?: number; size?: number; groupId?: number; onlyDebtors?: boolean } = {},
) => {
  const { page = 1, size = 24, groupId, onlyDebtors } = options
  return queryOptions({
    queryKey: qk.students(search, page, groupId, onlyDebtors),
    queryFn: ({ signal }) =>
      api.get<Page<StudentListItem>>(
        '/students',
        {
          size,
          page,
          search,
          group_id: groupId,
          only_debtors: onlyDebtors || undefined,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  })
}

export const studentQuery = (id: number) =>
  queryOptions({
    queryKey: qk.student(id),
    queryFn: ({ signal }) => api.get<StudentDetail>(`/students/${id}`, undefined, signal),
  })

export const studentAttendanceQuery = (id: number) =>
  queryOptions({
    queryKey: qk.studentAttendance(id),
    queryFn: ({ signal }) =>
      api.get<StudentAttendance>(`/students/${id}/attendance`, undefined, signal),
  })

export const studentPaymentsQuery = (id: number) =>
  queryOptions({
    queryKey: qk.studentPayments(id),
    queryFn: ({ signal }) =>
      api.get<StudentCharge[]>(`/students/${id}/payments`, undefined, signal),
  })

/** O'quvchining o'ziga: o'z davomat xulosasi. */
export const myAttendanceQuery = () =>
  queryOptions({
    queryKey: qk.myAttendance,
    queryFn: ({ signal }) =>
      api.get<StudentAttendance>('/students/me/attendance', undefined, signal),
  })

/** O'quvchining o'ziga: o'z to'lov tarixi. */
export const myPaymentsQuery = () =>
  queryOptions({
    queryKey: qk.myPayments,
    queryFn: ({ signal }) =>
      api.get<StudentCharge[]>('/students/me/payments', undefined, signal),
  })

export const monthlyReportQuery = (period: Period) =>
  queryOptions({
    queryKey: qk.monthlyReport(period),
    queryFn: ({ signal }) =>
      api.get<MonthlyReport>(
        '/reports/monthly',
        { year: period.year, month: period.month },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const revenueTrendQuery = (months = 12) =>
  queryOptions({
    queryKey: qk.revenueTrend(months),
    queryFn: ({ signal }) =>
      api
        .get<{ points: RevenuePoint[] }>('/reports/revenue-trend', { months }, signal)
        .then((response) => response.points),
  })

export const debtorsQuery = (period: Period) =>
  queryOptions({
    queryKey: qk.debtors(period),
    queryFn: ({ signal }) =>
      api.get<Debtors>(
        '/reports/debtors',
        { year: period.year, month: period.month },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const attendanceReportQuery = (period: Period) =>
  queryOptions({
    queryKey: qk.attendanceReport(period),
    queryFn: ({ signal }) =>
      api.get<AttendanceReport>(
        '/reports/attendance',
        { year: period.year, month: period.month },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const teachersQuery = (search: string, status?: UserStatus) =>
  queryOptions({
    queryKey: qk.teachers(search, status),
    queryFn: ({ signal }) =>
      api.get<Page<Teacher>>('/admin/teachers', { size: 50, search, status }, signal),
    placeholderData: keepPreviousData,
  })

/** Yon menyudagi "tasdiq kutmoqda" hisoblagichi. */
export const pendingTeachersQuery = () =>
  queryOptions({
    queryKey: qk.pendingTeachers,
    queryFn: ({ signal }) =>
      api
        .get<{ count: number }>('/admin/teachers/pending-count', undefined, signal)
        .then((response) => response.count),
    refetchInterval: 60_000,
  })

export const expensesQuery = (period: Period) =>
  queryOptions({
    queryKey: qk.expenses(period),
    queryFn: ({ signal }) =>
      api.get<ExpenseMonth>(
        '/expenses',
        { year: period.year, month: period.month },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

export const adminStatsQuery = () =>
  queryOptions({
    queryKey: qk.adminStats,
    queryFn: ({ signal }) => api.get<AdminStats>('/admin/stats', undefined, signal),
  })
