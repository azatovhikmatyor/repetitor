import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { Avatar } from '@/components/ui/avatar'
import { AvatarUploader } from '@/components/ui/avatar-uploader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Icon } from '@/components/ui/icon'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { Progress } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { TemporaryPasswordModal } from '@/features/groups/add-student-modal'
import { api } from '@/lib/api/client'
import {
  studentAttendanceQuery,
  studentPaymentsQuery,
  studentQuery,
} from '@/lib/api/queries'
import type { StudentAttendanceEntry, StudentDetail } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { useT, type Dictionary } from '@/lib/i18n'
import { formatDate, money, monthName, percent } from '@/lib/format'
import { attendanceLabel, chargeStateLabel, chargeStateTone } from '@/lib/labels'

import { StudentEditModal } from './student-edit-modal'

/** `2010-04-15` → 16 (to'liq yosh). */
function age(birthDate: string): number {
  const born = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - born.getFullYear()
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  if (beforeBirthday) years -= 1
  return years
}

/**
 * O'quvchi kartasi.
 *
 * Yuqorida "kim" (rasm, ism, aloqa), ostida "qanday o'qiyapti" (davomat,
 * qarz, guruhlar). O'qituvchi ko'pincha shu sahifani ota-onaga qo'ng'iroq
 * qilishdan oldin ochadi — shuning uchun aloqa raqamlari va qarz eng
 * yuqorida.
 */
export function StudentDetailPage() {
  const { studentId } = useParams()
  const id = Number(studentId)
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()

  const student = useQuery(studentQuery(id))
  const attendance = useQuery(studentAttendanceQuery(id))
  const payments = useQuery(studentPaymentsQuery(id))

  const [confirmReset, setConfirmReset] = useState(false)
  const [editing, setEditing] = useState(false)
  const [photo, setPhoto] = useState(false)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const resetPassword = useMutation({
    mutationFn: () =>
      api.post<{ temporary_password: string }>(`/students/${id}/reset-password`),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['student', id] })
      setConfirmReset(false)
      setTemporaryPassword(result.temporary_password)
    },
    onError: (error) => {
      toast.error(error)
      setConfirmReset(false)
    },
  })

  if (student.isPending) return <Loading rows={5} />
  if (student.error) {
    return <ErrorState error={student.error} onRetry={() => void student.refetch()} />
  }

  const data = student.data
  const activeGroups = data.groups.filter((group) => group.status === 'active')
  const monthlyTotal = activeGroups.reduce((sum, group) => sum + group.monthly_fee, 0)

  const charges = payments.data ?? []
  const debt = charges.reduce(
    (sum, charge) => sum + Math.max(charge.amount_due - charge.amount_paid, 0),
    0,
  )
  const overallRate = attendance.data?.groups.length
    ? attendance.data.groups.reduce(
        (sum, group) => sum + group.attendance_rate,
        0,
      ) / attendance.data.groups.length
    : null

  return (
    <>
      <Link
        to="/students"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        &lsaquo; {t.students.detail.backLabel}
      </Link>

      <div className="space-y-6">
        {/* Kim */}
        <Card className="overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-brand-600 to-brand-400" />
          <CardBody className="-mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-4">
                <button
                  type="button"
                  onClick={() => setPhoto(true)}
                  title={t.students.detail.changePhoto}
                  className="group relative rounded-full ring-4 ring-white"
                >
                  <Avatar
                    src={data.avatar_url}
                    name={data.full_name}
                    className="size-24 text-3xl"
                  />
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-slate-900/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Icon name="settings" className="size-5" />
                  </span>
                </button>

                <div className="sm:pb-1">
                  <h1 className="text-xl font-semibold text-slate-900 lg:text-2xl">
                    {data.full_name}
                  </h1>
                  {data.middle_name && (
                    <p className="text-sm text-slate-500">{data.middle_name}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {data.is_active ? (
                      <Badge tone="paid">{t.students.detail.active}</Badge>
                    ) : (
                      <Badge tone="unpaid">{t.students.detail.blocked}</Badge>
                    )}
                    {data.must_change_password && (
                      <Badge tone="partial">{t.students.detail.passwordNotChanged}</Badge>
                    )}
                    {data.password_reset_requested && (
                      <Badge tone="partial">{t.students.resetRequestedBadge}</Badge>
                    )}
                    {data.birth_date && (
                      <Badge>
                        {age(data.birth_date)} {t.students.detail.ageSuffix}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pb-1">
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  {t.students.detail.edit}
                </Button>
                {data.password_reset_requested ? (
                  <Button variant="ghost" onClick={() => setConfirmReset(true)}>
                    {t.students.detail.resetPassword}
                  </Button>
                ) : (
                  <p className="max-w-56 self-center text-xs text-slate-400">
                    {t.students.detail.resetPasswordUnavailable}
                  </p>
                )}
              </div>
            </div>

            {/* Tez ko'z yuguritish uchun raqamlar */}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <Metric label={t.students.detail.metricGroups} value={String(activeGroups.length)} />
              <Metric
                label={t.students.detail.metricMonthly}
                value={money(monthlyTotal)}
                caption={t.common.somUnit}
              />
              <Metric
                label={t.students.detail.metricAttendance}
                value={overallRate === null ? '—' : percent(Math.round(overallRate))}
                tone={
                  overallRate === null
                    ? undefined
                    : overallRate >= 80
                      ? 'paid'
                      : overallRate >= 60
                        ? 'partial'
                        : 'unpaid'
                }
              />
              <Metric
                label={t.students.detail.metricDebt}
                value={money(debt)}
                caption={t.common.somUnit}
                tone={debt > 0 ? 'unpaid' : 'paid'}
              />
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Ma'lumotlar */}
          <div className="space-y-6">
            <Card>
              <CardHeader title={t.students.detail.infoTitle} />
              <CardBody className="space-y-3">
                <Field label={t.students.detail.phone} t={t}>
                  {data.phone ? (
                    <a href={`tel:${data.phone}`} className="hover:underline">
                      {data.phone}
                    </a>
                  ) : null}
                </Field>
                <Field label={t.students.detail.username} t={t}>
                  {data.username}
                </Field>
                <Field label={t.students.detail.birthDate} t={t}>
                  {data.birth_date ? formatDate(data.birth_date) : null}
                </Field>
                <Field label={t.students.detail.school} t={t}>
                  {data.school}
                </Field>

                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
                    {t.students.detail.parentTitle}
                  </p>
                  <Field label={t.students.detail.parentName} t={t}>
                    {data.parent_name}
                  </Field>
                  <Field label={t.students.detail.parentPhone} t={t}>
                    {data.parent_phone ? (
                      <a href={`tel:${data.parent_phone}`} className="hover:underline">
                        {data.parent_phone}
                      </a>
                    ) : null}
                  </Field>
                </div>

                {data.note && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="mb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
                      {t.students.detail.noteTitle}
                    </p>
                    <p className="text-sm whitespace-pre-line text-slate-700">
                      {data.note}
                    </p>
                  </div>
                )}

                <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
                  {t.students.detail.joined(formatDate(data.created_at))}
                  {data.last_login_at
                    ? ` · ${t.students.detail.lastLogin(formatDate(data.last_login_at))}`
                    : ` · ${t.students.detail.neverLoggedIn}`}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={t.students.detail.attendanceTitle}
                description={
                  attendance.data && attendance.data.recent.length > 0
                    ? t.students.detail.recentBelow
                    : undefined
                }
              />
              {attendance.isPending && <Loading rows={2} />}
              {attendance.data?.groups.length === 0 && (
                <EmptyState title={t.students.detail.noAttendance} />
              )}
              {attendance.data && attendance.data.groups.length > 0 && (
                <CardBody className="space-y-4">
                  {attendance.data.groups.map((summary) => (
                    <div key={summary.group_id}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">
                          {summary.group_name}
                        </span>
                        <span className="tabular font-semibold">
                          {percent(summary.attendance_rate)}
                        </span>
                      </div>
                      <Progress
                        value={summary.attendance_rate / 100}
                        tone={summary.attendance_rate >= 80 ? 'paid' : 'partial'}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {t.students.detail.sessionsAbsences(
                          summary.total_sessions,
                          summary.absent_count,
                        )}
                        {summary.late_count > 0 &&
                          t.students.detail.lateSuffix(summary.late_count)}
                      </p>
                    </div>
                  ))}

                  {attendance.data.recent.length > 0 && (
                    <AttendanceHistory entries={attendance.data.recent} t={t} />
                  )}
                </CardBody>
              )}
            </Card>
          </div>

          {/* O'qishi */}
          <div className="space-y-6">
            <Card>
              <CardHeader title={t.students.detail.groupsTitle} />
              {data.groups.length === 0 ? (
                <EmptyState
                  title={t.students.detail.noGroups}
                  description={t.students.detail.noGroupsDesc}
                />
              ) : (
                <CardBody className="grid gap-3 sm:grid-cols-2">
                  {data.groups.map((group) => (
                    <Link
                      key={group.group_id}
                      to={`/groups/${group.group_id}`}
                      className={cn(
                        'rounded-lg border p-3 transition hover:border-brand-300 hover:bg-brand-50/30',
                        group.status === 'active'
                          ? 'border-slate-200'
                          : 'border-slate-200 bg-slate-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-900">
                          {group.group_name}
                        </span>
                        {group.status !== 'active' && (
                          <Badge>{t.students.detail.removedFromGroup}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.monthly_fee === 0 ? (
                          <span className="text-brand-700">{t.students.detail.free}</span>
                        ) : (
                          t.students.detail.perMonth(money(group.monthly_fee))
                        )}
                      </p>
                    </Link>
                  ))}
                </CardBody>
              )}
            </Card>

            <Card>
              <CardHeader
                title={t.students.detail.paymentHistoryTitle}
                description={debt > 0 ? t.students.detail.totalDebt(money(debt)) : undefined}
              />
              {payments.isPending && <Loading rows={2} />}
              {charges.length === 0 && !payments.isPending && (
                <EmptyState title={t.students.detail.noPayments} />
              )}
              {charges.length > 0 && (
                <DataTable
                  rows={charges}
                  rowKey={(charge) => charge.charge_id}
                  columns={[
                    {
                      key: 'month',
                      header: t.students.detail.colMonth,
                      primary: true,
                      cell: (charge) => (
                        <span className="whitespace-nowrap">
                          {monthName(charge.month)} {charge.year}
                        </span>
                      ),
                    },
                    {
                      key: 'group',
                      header: t.students.detail.colGroup,
                      cell: (charge) => (
                        <span className="text-slate-500">{charge.group_name}</span>
                      ),
                    },
                    {
                      key: 'due',
                      header: t.students.detail.colDue,
                      align: 'right',
                      cell: (charge) => money(charge.amount_due),
                    },
                    {
                      key: 'paid',
                      header: t.students.detail.colPaid,
                      align: 'right',
                      cell: (charge) => money(charge.amount_paid),
                    },
                    {
                      key: 'status',
                      header: t.students.detail.colStatus,
                      cell: (charge) => (
                        <Badge tone={chargeStateTone(charge.status, charge.amount_due)}>
                          {chargeStateLabel(t, charge.status, charge.amount_due)}
                        </Badge>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </div>
        </div>
      </div>

      {editing && (
        <StudentEditModal student={data} onClose={() => setEditing(false)} />
      )}

      {photo && (
        <Modal
          open
          onClose={() => setPhoto(false)}
          title={t.students.detail.photoModalTitle}
          width="max-w-md"
        >
          <AvatarUploader<StudentDetail>
            src={data.avatar_url}
            name={data.full_name}
            path={`/students/${id}/avatar`}
            onChange={(updated) => {
              queryClient.setQueryData(['student', id], updated)
              void queryClient.invalidateQueries({ queryKey: ['students'] })
            }}
          />
        </Modal>
      )}

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => resetPassword.mutate()}
        loading={resetPassword.isPending}
        title={t.students.detail.resetPasswordTitle}
        message={t.students.detail.resetPasswordMessage(data.full_name)}
        confirmLabel={t.students.detail.resetPasswordConfirm}
      />

      {temporaryPassword && (
        <TemporaryPasswordModal
          password={temporaryPassword}
          onClose={() => setTemporaryPassword(null)}
        />
      )}
    </>
  )
}

/**
 * Oxirgi darslar — sana bo'yicha.
 *
 * "Qaysi kunlari kelmagan?" degan savolga javob: umumiy foiz buni
 * aytmaydi. Standart holatda faqat kelmagan kunlar ko'rinadi, chunki
 * odatda shular qiziqtiradi.
 */
function AttendanceHistory({
  entries,
  t,
}: {
  entries: StudentAttendanceEntry[]
  t: Dictionary
}) {
  const [all, setAll] = useState(false)
  const missed = entries.filter((entry) => entry.status !== 'present')
  const shown = (all ? entries : missed).slice(0, 12)

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {all ? t.students.detail.recentLessons : t.students.detail.missedDays}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setAll((value) => !value)}>
          {all ? t.students.detail.onlyMissed : t.students.detail.all}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">{t.students.detail.noMissed}</p>
      ) : (
        <ul className="space-y-1">
          {shown.map((entry) => (
            <li
              key={`${entry.lesson_date}-${entry.start_time ?? ''}-${entry.group_id}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-slate-600">
                {formatDate(entry.lesson_date)}
                {entry.start_time && (
                  <span className="ml-1 text-xs text-slate-400">
                    {entry.start_time.slice(0, 5)}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                {entry.group_name}
              </span>
              <Badge tone={ATTENDANCE_TONE[entry.status]}>
                {attendanceLabel(t)[entry.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const ATTENDANCE_TONE: Record<
  StudentAttendanceEntry['status'],
  'paid' | 'unpaid' | 'partial' | 'neutral'
> = {
  present: 'paid',
  absent: 'unpaid',
  late: 'partial',
  excused: 'neutral',
}

function Metric({
  label,
  value,
  caption,
  tone,
}: {
  label: string
  value: string
  caption?: string
  tone?: 'paid' | 'unpaid' | 'partial'
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        {label}
      </p>
      <p
        className={cn(
          'tabular mt-0.5 text-lg font-semibold',
          tone === 'paid' && 'text-paid',
          tone === 'unpaid' && 'text-unpaid',
          tone === 'partial' && 'text-partial',
          !tone && 'text-slate-900',
        )}
      >
        {value}
        {caption && (
          <span className="ml-1 text-xs font-normal text-slate-400">{caption}</span>
        )}
      </p>
    </div>
  )
}

/** Bo'sh qiymat ham ko'rinadi — to'ldirilmagani bilinib tursin. */
function Field({
  label,
  children,
  t,
}: {
  label: string
  children: ReactNode
  t: Dictionary
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-slate-800">
        {children || <span className="font-normal text-slate-300">{t.common.notEntered}</span>}
      </span>
    </div>
  )
}
