import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Icon } from '@/components/ui/icon'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { Stat } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { groupQuery, groupStudentsQuery, qk } from '@/lib/api/queries'
import type { Group, GroupStudent } from '@/lib/api/types'
import { formatDate, money } from '@/lib/format'

import { AddStudentModal } from './add-student-modal'
import { FeeFields, feePayload, initialFee, type FeeDraft } from './fee-fields'
import { GroupFormModal } from './group-form-modal'
import { ScheduleModal } from './schedule-modal'

export function GroupDetailPage() {
  const { groupId } = useParams()
  const id = Number(groupId)
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const group = useQuery(groupQuery(id))
  const students = useQuery(groupStudentsQuery(id))

  const [editing, setEditing] = useState(false)
  const [schedule, setSchedule] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'unarchive' | 'delete' | null>(null)

  // Qaysi o'quvchi ustida amal bajarilmoqda — modal bitta, qator ko'p.
  const [feeFor, setFeeFor] = useState<GroupStudent | null>(null)

  const refreshGroup = async () => {
    await queryClient.invalidateQueries({ queryKey: ['group', id] })
    await queryClient.invalidateQueries({ queryKey: ['groups'] })
    await queryClient.invalidateQueries({ queryKey: qk.dashboard })
  }

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) =>
      api.post<Group>(`/groups/${id}/${archived ? 'archive' : 'unarchive'}`),
    onSuccess: async () => {
      await refreshGroup()
      setConfirm(null)
    },
    onError: (error) => toast.error(error),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/groups/${id}`),
    onSuccess: async () => {
      await refreshGroup()
      toast.success("Guruh o'chirildi")
      void navigate('/groups')
    },
    // Ma'lumoti bor guruh o'chirilmaydi — server 409 va tushuntirish qaytaradi.
    onError: (error) => {
      toast.error(error)
      setConfirm(null)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (entry: GroupStudent) =>
      api.post(`/groups/${id}/students`, {
        student_id: entry.student.id,
        custom_fee: entry.custom_fee ?? undefined,
      }),
    onSuccess: refreshGroup,
    onError: (error) => toast.error(error),
  })

  /**
   * Guruhdan chiqarish darrov bajariladi, tasdiqsiz.
   *
   * O'rniga bildirishnomada "Qaytarish" turadi: xato bosilsa bir bosishda
   * tiklanadi. Ma'lumot yo'qolmaydi — davomat va to'lov tarixi joyida
   * qoladi, shuning uchun bu xavfli amal emas.
   */
  const removeMutation = useMutation({
    mutationFn: (entry: GroupStudent) =>
      api.delete(`/groups/${id}/students/${entry.student.id}`),
    onSuccess: async (_result, entry) => {
      await refreshGroup()
      toast.undo(`${entry.student.full_name} guruhdan chiqarildi`, {
        label: 'Qaytarish',
        onClick: () => restoreMutation.mutate(entry),
      })
    },
    onError: (error) => toast.error(error),
  })

  if (group.isPending) return <Loading rows={5} />
  if (group.error) {
    return <ErrorState error={group.error} onRetry={() => void group.refetch()} />
  }

  const data = group.data
  const isArchived = data.status === 'archived'

  return (
    <>
      <PageHeader
        title={data.name}
        description={data.description ?? undefined}
        back={{ to: '/groups', label: 'Guruhlar' }}
        actions={
          <>
            {/* Hammasi bir xil ko'rinishda: bu tugmalar boshqa sahifaga
                o'tkazadi, shu sahifadagi holatni bildirmaydi. */}
            <Link to={`/groups/${id}/attendance`}>
              <Button variant="secondary">Davomat</Button>
            </Link>
            <Link to={`/groups/${id}/payments`}>
              <Button variant="secondary">To&rsquo;lovlar</Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => setConfirm(isArchived ? 'unarchive' : 'archive')}
            >
              {isArchived ? 'Arxivdan qaytarish' : 'Arxivlash'}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Guruh sozlamalari"
              aria-label="Guruh sozlamalari"
              className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <Icon name="settings" />
            </button>
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardBody className="grid gap-6 sm:grid-cols-3">
            <Stat label="Oylik to&rsquo;lov" value={money(data.monthly_fee)} caption="so&rsquo;m" />
            <Stat
              label="Oylik kutilma"
              value={money(data.expected_monthly)}
              caption={
                data.student_count * data.monthly_fee > data.expected_monthly
                  ? `${data.student_count} o'quvchi · chegirma ${money(
                      data.student_count * data.monthly_fee - data.expected_monthly,
                    )}`
                  : `${data.student_count} o'quvchi`
              }
            />
            <div>
              <Stat label="Jadval" value={data.schedule ?? 'kiritilmagan'} />
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 -ml-3"
                onClick={() => setSchedule(true)}
              >
                {data.schedule ? 'Jadvalni o’zgartirish' : 'Jadval kiritish'}
              </Button>
            </div>
          </CardBody>
        </Card>

        {isArchived && (
          <Card className="border-slate-300 bg-slate-100">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Guruh arxivlangan: tarix saqlanadi, yangi davomat va to&rsquo;lov
                qo&rsquo;shilmaydi.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirm('delete')}
              >
                O&rsquo;chirish
              </Button>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="O&rsquo;quvchilar"
            description={`${data.student_count} ta faol`}
            action={
              !isArchived && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  O&rsquo;quvchi qo&rsquo;shish
                </Button>
              )
            }
          />

          {students.isPending && <Loading />}
          {students.error && (
            <ErrorState error={students.error} onRetry={() => void students.refetch()} />
          )}

          {students.data && students.data.length === 0 && (
            <EmptyState
              title="Guruhda o&rsquo;quvchi yo&rsquo;q"
              description="Yangi o&rsquo;quvchi yarating yoki mavjudini qo&rsquo;shing"
              action={
                !isArchived && <Button size="sm" onClick={() => setAdding(true)}>Qo&rsquo;shish</Button>
              }
            />
          )}

          {students.data && students.data.length > 0 && (
            <DataTable
              rows={students.data}
              rowKey={(entry) => entry.enrollment_id}
              columns={[
                {
                  key: 'name',
                  header: 'Ism',
                  primary: true,
                  cell: (entry) => (
                    <Link
                      to={`/students/${entry.student.id}`}
                      className="flex items-center gap-2.5 font-medium text-slate-900 hover:text-brand-700"
                    >
                      <Avatar
                        src={entry.student.avatar_url}
                        name={entry.student.full_name}
                        className="size-8 text-xs"
                      />
                      <span className="hover:underline">{entry.student.full_name}</span>
                    </Link>
                  ),
                },
                {
                  key: 'phone',
                  header: 'Telefon',
                  cell: (entry) => (
                    <span className="text-slate-500">{entry.student.phone ?? '—'}</span>
                  ),
                },
                {
                  key: 'fee',
                  header: 'Oylik narx',
                  align: 'right',
                  cell: (entry) => <FeeCell entry={entry} />,
                },
                {
                  key: 'joined',
                  header: "Qo'shilgan",
                  cell: (entry) => (
                    <span className="text-slate-500">{formatDate(entry.joined_on)}</span>
                  ),
                },
                {
                  key: 'actions',
                  align: 'right',
                  footer: true,
                  cell: (entry) =>
                    isArchived ? null : (
                      <span className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setFeeFor(entry)}>
                          Narx
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMutation.mutate(entry)}
                        >
                          Chiqarish
                        </Button>
                      </span>
                    ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      {editing && (
        <GroupFormModal open onClose={() => setEditing(false)} group={data} />
      )}
      {adding && (
        <AddStudentModal
          groupId={id}
          groupFee={data.monthly_fee}
          open
          onClose={() => setAdding(false)}
        />
      )}
      {schedule && <ScheduleModal groupId={id} onClose={() => setSchedule(false)} />}

      {feeFor && (
        <CustomFeeModal
          key={feeFor.enrollment_id}
          groupId={id}
          groupFee={data.monthly_fee}
          entry={feeFor}
          onClose={() => setFeeFor(null)}
          onSaved={refreshGroup}
        />
      )}

      <ConfirmModal
        open={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        onConfirm={() => archiveMutation.mutate(true)}
        loading={archiveMutation.isPending}
        title="Arxivlash"
        message="Guruh o'chirilmaydi — arxivga o'tadi. Barcha to'lov va davomat tarixi saqlanadi, lekin yangi yozuv qo'shilmaydi."
        confirmLabel="Arxivlash"
      />
      <ConfirmModal
        open={confirm === 'unarchive'}
        onClose={() => setConfirm(null)}
        onConfirm={() => archiveMutation.mutate(false)}
        loading={archiveMutation.isPending}
        title="Arxivdan qaytarish"
        message="Guruh yana faol bo'ladi va unga davomat hamda to'lov qo'shish mumkin."
        confirmLabel="Qaytarish"
      />
      <ConfirmModal
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        destructive
        title="Guruhni o'chirish"
        message="Faqat o'quvchisiz va davomatsiz guruhni o'chirish mumkin. Bu amalni qaytarib bo'lmaydi."
        confirmLabel="O'chirish"
      />
    </>
  )
}

function FeeCell({ entry }: { entry: GroupStudent }) {
  if (entry.custom_fee === 0) {
    return (
      <span className="inline-flex flex-col items-end">
        <Badge tone="brand">Bepul</Badge>
        {entry.fee_note && (
          <span className="mt-0.5 text-xs text-slate-400">{entry.fee_note}</span>
        )}
      </span>
    )
  }

  return (
    <span className="inline-flex flex-col items-end">
      <span>{money(entry.monthly_fee)}</span>
      {entry.discount > 0 && (
        // Chegirma miqdori ko'rinib tursin — "alohida" degan yorliq
        // qancha kamayganini aytmaydi.
        <span className="text-xs text-partial">&minus;{money(entry.discount)}</span>
      )}
      {entry.fee_note && (
        <span className="text-xs text-slate-400">{entry.fee_note}</span>
      )}
    </span>
  )
}

function CustomFeeModal({
  groupId,
  groupFee,
  entry,
  onClose,
  onSaved,
}: {
  groupId: number
  groupFee: number
  entry: GroupStudent
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [fee, setFee] = useState<FeeDraft>(() =>
    initialFee(entry.custom_fee, entry.fee_note),
  )
  // Kelishuv odatda oy boshida bo'ladi, shuning uchun standart holat — ha.
  const [applyNow, setApplyNow] = useState(true)

  const feeMutation = useMutation({
    mutationFn: () =>
      api.patch(`/groups/${groupId}/students/${entry.student.id}`, {
        ...feePayload(fee),
        apply_current_month: applyNow,
      }),
    onSuccess: async () => {
      await onSaved()
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Oylik narx"
      description={entry.student.full_name}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            loading={feeMutation.isPending}
            disabled={fee.mode === 'custom' && !fee.amount}
            onClick={() => feeMutation.mutate()}
          >
            Saqlash
          </Button>
        </>
      }
    >
      <FeeFields groupFee={groupFee} value={fee} onChange={setFee} />

      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={applyNow}
          onChange={(event) => setApplyNow(event.target.checked)}
          className="mt-0.5 size-4 rounded border-slate-300 text-brand-600"
        />
        <span>
          Shu oyning hisobiga ham qo&rsquo;llansin
          <span className="block text-xs text-slate-500">
            Shu oyda to&rsquo;lov qilingan bo&rsquo;lsa hisob o&rsquo;zgarmaydi.
            O&rsquo;tgan oylar har doim o&rsquo;z holicha qoladi.
          </span>
        </span>
      </label>
    </Modal>
  )
}
