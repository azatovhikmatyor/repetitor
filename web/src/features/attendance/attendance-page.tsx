import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ConfirmModal } from '@/components/ui/modal'
import { ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { attendanceQuery, dashboardQuery, groupQuery, qk } from '@/lib/api/queries'
import type { AttendanceSession, AttendanceStatus } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { useT, type Dictionary } from '@/lib/i18n'
import { isoDate, longDate } from '@/lib/format'
import { attendanceLabel } from '@/lib/labels'

/**
 * Kunlik davomat.
 *
 * Talab 7: hamma standart "Bor" holatida keladi, o'qituvchi faqat
 * kelmaganlarni belgilaydi va bir marta saqlaydi. Serverga ham faqat
 * kelmaganlar yuboriladi.
 */
export function AttendancePage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const t = useT()

  const today = isoDate(new Date())
  const [date, setDate] = useState(today)
  // Bosh sahifadan "davomat olish" bosilganda qaysi dars ekani manzilda
  // keladi: `?start_time=18:00`.
  const [params] = useSearchParams()
  const [lesson, setLesson] = useState<string | null>(
    params.get('start_time'),
  )

  const session = useQuery(attendanceQuery(id, date, lesson))
  // Qaysi guruh ekani sarlavhada ko'rinib tursin.
  const group = useQuery(groupQuery(id))

  return (
    <>
      <PageHeader
        title={group.data ? `${group.data.name} — ${t.attendance.dailyTitle.toLowerCase()}` : t.attendance.dailyTitle}
        description={group.data?.schedule ?? undefined}
        back={{ to: `/groups/${id}`, label: group.data?.name ?? t.groups.detail.backLabel }}
        actions={
          <Link to={`/groups/${id}/attendance/monthly`}>
            <Button variant="secondary">{t.attendance.monthlyLink}</Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={date}
              // Kelajakdagi sanaga davomat qo'yib bo'lmaydi (talab 7).
              max={today}
              onChange={(event) => {
                setDate(event.target.value || today)
                // Yangi kunning darslari boshqacha — tanlov qayta boshlanadi.
                setLesson(null)
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
            {/* Brauzerning oy/kun/yil formati chalg'itmasin — yonida to'liq yozuv. */}
            <span className="text-sm font-medium text-slate-700">
              {date === today ? `${t.attendance.today} · ${longDate(date)}` : longDate(date)}
            </span>
            {session.data?.is_saved && <Badge tone="brand">{t.attendance.savedBadge}</Badge>}
          </div>

          {(session.data?.day_lessons.length ?? 0) > 1 && (
            // Bir kunda bir nechta dars: qaysi biri ekanini tanlash kerak.
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">{t.attendance.lessonLabel}</span>
              {session.data?.day_lessons.map((item) => {
                const value = item.start_time
                const active = session.data?.start_time === value
                return (
                  <button
                    key={value ?? 'adhoc'}
                    type="button"
                    onClick={() => setLesson(value)}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                      active
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {value ? value.slice(0, 5) : t.attendance.noSchedule}
                    {item.is_cancelled ? (
                      <span className="ml-1">&times;</span>
                    ) : (
                      item.is_saved && <span className="ml-1">&#10003;</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {date !== today && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-partial">
              <Icon name="warning" className="size-4" />
              {t.attendance.pastNotice}
            </p>
          )}
        </CardBody>

        {session.isPending && <Loading rows={4} />}
        {session.error && (
          <ErrorState error={session.error} onRetry={() => void session.refetch()} />
        )}

        {session.data && (
          // `key` — sana o'zgarganda qoralama serverdagi holatdan qayta
          // boshlanadi. Shu sabab effekt ichida setState kerak emas.
          <AttendanceEditor
            key={`${id}-${date}-${session.data.start_time ?? ''}`}
            groupId={id}
            date={date}
            session={session.data}
            t={t}
          />
        )}
      </Card>
    </>
  )
}

function AttendanceEditor({
  groupId,
  date,
  session,
  t,
}: {
  groupId: number
  date: string
  session: AttendanceSession
  t: Dictionary
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const serverDraft = () =>
    Object.fromEntries(
      session.students.map((student) => [student.student_id, student.status]),
    )

  /** Lokal qoralama — "Saqlash" bosilmaguncha serverga bormaydi. */
  const [draft, setDraft] = useState<Record<number, AttendanceStatus>>(serverDraft)

  // Saqlagandan keyin: davomat qilinmagan keyingi guruhni taklif qilish uchun.
  const dashboard = useQuery(dashboardQuery())
  const [saved, setSaved] = useState(false)

  /**
   * O'tgan kun avval faqat ko'rish uchun ochiladi.
   *
   * Eski davomatga odatda "qanday edi?" deb qaraladi. Tugmalar darrov
   * ishlaydigan bo'lsa, tasodifan bosib qo'yilgan holat eski yozuvni
   * jimgina buzadi — shuning uchun o'zgartirish alohida tugma bilan
   * ochiladi.
   */
  const isPast = date !== isoDate(new Date())
  const [unlocked, setUnlocked] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const editable = session.is_editable && (!isPast || unlocked)

  const students = session.students.map((student) => ({
    ...student,
    status: draft[student.student_id] ?? student.status,
  }))
  const absentCount = students.filter((student) => student.status === 'absent').length

  const setAll = (status: AttendanceStatus) =>
    setDraft(
      Object.fromEntries(students.map((student) => [student.student_id, status])),
    )

  const save = useMutation({
    mutationFn: (options: { cancelled?: boolean } = {}) =>
      api.put<AttendanceSession>(`/groups/${groupId}/attendance`, {
        session_date: date,
        // Qaysi dars ekani — kunda bir nechtasi bo'lsa muhim.
        start_time: session.start_time,
        is_cancelled: options.cancelled ?? false,
        // Faqat "Bor" dan farq qiladiganlar yuboriladi: 30 kishilik guruhda
        // 5 ta kelmagan bo'lsa, so'rovda 5 ta element bo'ladi.
        records: students
          .filter((student) => student.status !== 'present')
          .map((student) => ({ student_id: student.student_id, status: student.status })),
      }),
    onSuccess: async (result: AttendanceSession) => {
      // Kesh kalitida tanlangan vaqt bor, javobda esa server aniqlagan
      // vaqt — mos kelmasligi mumkin, shuning uchun shu kunning barcha
      // so'rovlari yangilanadi.
      await queryClient.invalidateQueries({
        queryKey: ['group', groupId, 'attendance', date],
      })
      await queryClient.invalidateQueries({ queryKey: qk.dashboard })
      await queryClient.invalidateQueries({
        queryKey: ['group', groupId, 'attendance', 'monthly'],
      })
      setSaved(true)
      // O'tgan kun yana qulflanadi — keyingi tasodifiy bosishdan himoya.
      setUnlocked(false)
      setConfirmCancel(false)
      toast.success(
        result.is_cancelled ? t.attendance.cancelledToast : t.attendance.savedToast,
      )
    },
    onError: (error) => toast.error(error),
  })

  if (students.length === 0) {
    return (
      <CardBody>
        <p className="py-8 text-center text-sm text-slate-500">
          {t.attendance.noStudentsHere}
        </p>
      </CardBody>
    )
  }

  const nextGroup = dashboard.data?.groups_without_attendance_today.find(
    (group) => group.group_id !== groupId,
  )

  if (session.is_cancelled) {
    return (
      <>
        <CardBody className="flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
              <Icon name="close" className="size-4 text-slate-400" />
              {t.attendance.cancelledTitle}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {session.note ? session.note : t.attendance.cancelledDefaultNote}
            </p>
          </div>
          {session.is_editable && (
            <Button
              variant="secondary"
              loading={save.isPending}
              onClick={() => save.mutate({ cancelled: false })}
            >
              {t.attendance.restoreLesson}
            </Button>
          )}
        </CardBody>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-2.5">
        <p className="text-sm text-slate-500">
          {editable ? t.attendance.markAbsentHint : t.attendance.savedAttendance}
        </p>
        <div className="flex items-center gap-2">
          <Badge tone="paid">{t.attendance.presentCount(students.length - absentCount)}</Badge>
          <Badge tone={absentCount > 0 ? 'unpaid' : 'neutral'}>
            {t.attendance.absentCount(absentCount)}
          </Badge>
        </div>
      </div>

      {editable && (
        // Dars bekor bo'lgan kun uchun: 20 kishini bittalab bosish o'rniga.
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2">
          <span className="text-xs text-slate-400">{t.attendance.allLabel}</span>
          <Button variant="ghost" size="sm" onClick={() => setAll('present')}>
            {t.attendance.allPresentBtn}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAll('absent')}>
            {t.attendance.allAbsentBtn}
          </Button>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {students.map((student) => (
          <li
            key={student.student_id}
            className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
          >
            <span
              className={cn(
                'text-sm font-medium',
                student.status === 'absent'
                  ? 'text-slate-400 line-through'
                  : 'text-slate-800',
              )}
            >
              {student.full_name}
            </span>

            <div className="flex gap-1">
              {(['present', 'absent', 'late', 'excused'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={!editable}
                  aria-pressed={student.status === status}
                  onClick={() =>
                    setDraft((current) => ({ ...current, [student.student_id]: status }))
                  }
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                    student.status === status
                      ? STATUS_ACTIVE[status]
                      : 'bg-slate-100 text-slate-500',
                    // Qulflangan holatda tanlanmagan tugmalar xira bo'ladi:
                    // ko'rinishdan ham bosib bo'lmasligi bilinib tursin.
                    editable
                      ? student.status !== status && 'hover:bg-slate-200'
                      : 'cursor-default ' +
                        (student.status === status ? '' : 'opacity-40'),
                  )}
                >
                  {attendanceLabel(t)[status]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => save.mutate({ cancelled: true })}
        loading={save.isPending}
        title={t.attendance.cancelConfirmTitle}
        message={t.attendance.cancelConfirmMessage}
        confirmLabel={t.attendance.cancelConfirmLabel}
      />

      {/* Telefonda pastga scroll qilish shart emas — tugma ekranga yopishadi. */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
        {!session.is_editable ? (
          <p className="text-sm text-slate-500">{t.attendance.archivedNotice}</p>
        ) : !editable ? (
          <>
            <p className="mr-auto text-sm text-slate-500">{t.attendance.viewOnly}</p>
            <Button variant="secondary" onClick={() => setUnlocked(true)}>
              {session.is_saved ? t.attendance.changeBtn : t.attendance.enterAttendanceBtn}
            </Button>
          </>
        ) : (
          <>
            {saved && nextGroup && (
              <Button
                variant="secondary"
                onClick={() => void navigate(`/groups/${nextGroup.group_id}/attendance`)}
              >
                {t.attendance.nextGroup(nextGroup.group_name)}
              </Button>
            )}
            <Button
              variant="danger-ghost"
              onClick={() => setConfirmCancel(true)}
            >
              {t.attendance.cancelLessonBtn}
            </Button>
            {isPast && (
              <Button
                variant="ghost"
                onClick={() => {
                  // Qulflash bilan birga qoralama ham serverdagi holatga qaytadi.
                  setDraft(serverDraft())
                  setUnlocked(false)
                }}
              >
                {t.attendance.undoBtn}
              </Button>
            )}
            <Button loading={save.isPending} onClick={() => save.mutate({})}>
              {t.attendance.saveBtn}
            </Button>
          </>
        )}
      </div>
    </>
  )
}

const STATUS_ACTIVE: Record<AttendanceStatus, string> = {
  present: 'bg-paid text-white',
  absent: 'bg-unpaid text-white',
  late: 'bg-partial text-white',
  excused: 'bg-slate-500 text-white',
}
