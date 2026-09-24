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
        &lsaquo; O&rsquo;quvchilar
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
                  title="Rasmni o&rsquo;zgartirish"
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
                      <Badge tone="paid">Faol</Badge>
                    ) : (
                      <Badge tone="unpaid">Bloklangan</Badge>
                    )}
                    {data.must_change_password && (
                      <Badge tone="partial">Parol almashtirilmagan</Badge>
                    )}
                    {data.birth_date && <Badge>{age(data.birth_date)} yosh</Badge>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pb-1">
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Tahrirlash
                </Button>
                <Button variant="ghost" onClick={() => setConfirmReset(true)}>
                  Parolni tiklash
                </Button>
              </div>
            </div>

            {/* Tez ko'z yuguritish uchun raqamlar */}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <Metric label="Guruhlar" value={String(activeGroups.length)} />
              <Metric
                label="Oyiga"
                value={money(monthlyTotal)}
                caption="so&rsquo;m"
              />
              <Metric
                label="Davomat"
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
                label="Qarz"
                value={money(debt)}
                caption="so&rsquo;m"
                tone={debt > 0 ? 'unpaid' : 'paid'}
              />
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Ma'lumotlar */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="Ma&rsquo;lumotlar" />
              <CardBody className="space-y-3">
                <Field label="Telefon">
                  {data.phone ? (
                    <a href={`tel:${data.phone}`} className="hover:underline">
                      {data.phone}
                    </a>
                  ) : null}
                </Field>
                <Field label="Username">{data.username}</Field>
                <Field label="Tug&rsquo;ilgan sana">
                  {data.birth_date ? formatDate(data.birth_date) : null}
                </Field>
                <Field label="Maktab">{data.school}</Field>

                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
                    Ota-ona
                  </p>
                  <Field label="Ismi">{data.parent_name}</Field>
                  <Field label="Telefon">
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
                      Izoh
                    </p>
                    <p className="text-sm whitespace-pre-line text-slate-700">
                      {data.note}
                    </p>
                  </div>
                )}

                <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
                  Qo&rsquo;shilgan: {formatDate(data.created_at)}
                  {data.last_login_at
                    ? ` · oxirgi kirish ${formatDate(data.last_login_at)}`
                    : ' · hali tizimga kirmagan'}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Davomat"
                description={
                  attendance.data && attendance.data.recent.length > 0
                    ? 'Oxirgi darslar pastda'
                    : undefined
                }
              />
              {attendance.isPending && <Loading rows={2} />}
              {attendance.data?.groups.length === 0 && (
                <EmptyState title="Hali davomat yozilmagan" />
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
                        {summary.total_sessions} darsdan {summary.absent_count} tasida
                        yo&rsquo;q
                        {summary.late_count > 0 && `, ${summary.late_count} marta kech`}
                      </p>
                    </div>
                  ))}

                  {attendance.data.recent.length > 0 && (
                    <AttendanceHistory entries={attendance.data.recent} />
                  )}
                </CardBody>
              )}
            </Card>
          </div>

          {/* O'qishi */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="Guruhlar" />
              {data.groups.length === 0 ? (
                <EmptyState
                  title="Guruhga qo&rsquo;shilmagan"
                  description="O&rsquo;quvchi guruh sahifasidan qo&rsquo;shiladi"
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
                        {group.status !== 'active' && <Badge>Chiqarilgan</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.monthly_fee === 0 ? (
                          <span className="text-brand-700">Bepul</span>
                        ) : (
                          `${money(group.monthly_fee)} so'm / oy`
                        )}
                      </p>
                    </Link>
                  ))}
                </CardBody>
              )}
            </Card>

            <Card>
              <CardHeader
                title="To&rsquo;lov tarixi"
                description={debt > 0 ? `Jami qarz ${money(debt)} so'm` : undefined}
              />
              {payments.isPending && <Loading rows={2} />}
              {charges.length === 0 && !payments.isPending && (
                <EmptyState title="Hali to&rsquo;lov yo&rsquo;q" />
              )}
              {charges.length > 0 && (
                <DataTable
                  rows={charges}
                  rowKey={(charge) => charge.charge_id}
                  columns={[
                    {
                      key: 'month',
                      header: 'Oy',
                      primary: true,
                      cell: (charge) => (
                        <span className="whitespace-nowrap">
                          {monthName(charge.month)} {charge.year}
                        </span>
                      ),
                    },
                    {
                      key: 'group',
                      header: 'Guruh',
                      cell: (charge) => (
                        <span className="text-slate-500">{charge.group_name}</span>
                      ),
                    },
                    {
                      key: 'due',
                      header: 'Kutilgan',
                      align: 'right',
                      cell: (charge) => money(charge.amount_due),
                    },
                    {
                      key: 'paid',
                      header: "To'langan",
                      align: 'right',
                      cell: (charge) => money(charge.amount_paid),
                    },
                    {
                      key: 'status',
                      header: 'Holat',
                      cell: (charge) => (
                        <Badge tone={chargeStateTone(charge.status, charge.amount_due)}>
                          {chargeStateLabel(charge.status, charge.amount_due)}
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
          title="O&rsquo;quvchi rasmi"
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
        title="Parolni tiklash"
        message={`${data.full_name} uchun yangi vaqtinchalik parol beriladi va uning barcha sessiyalari yopiladi.`}
        confirmLabel="Tiklash"
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
function AttendanceHistory({ entries }: { entries: StudentAttendanceEntry[] }) {
  const [all, setAll] = useState(false)
  const missed = entries.filter((entry) => entry.status !== 'present')
  const shown = (all ? entries : missed).slice(0, 12)

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          {all ? 'Oxirgi darslar' : "Kelmagan kunlari"}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setAll((value) => !value)}>
          {all ? 'Faqat kelmaganlari' : 'Hammasi'}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">
          Bitta ham dars qoldirmagan
        </p>
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
                {attendanceLabel[entry.status]}
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
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-slate-800">
        {children || <span className="font-normal text-slate-300">kiritilmagan</span>}
      </span>
    </div>
  )
}
