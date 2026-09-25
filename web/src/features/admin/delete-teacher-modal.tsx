import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import type { Teacher, TeacherDeletePreview } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { money } from '@/lib/format'

/**
 * O'qituvchini butunlay o'chirish.
 *
 * Amal qaytarib bo'lmaydi va kaskad: guruhlar, o'quvchi hisoblari, davomat
 * va to'lov tarixi ham yo'qoladi. Shuning uchun uch bosqich:
 * 1) nima yo'qolishini ko'rsatamiz, 2) zaxira nusxani yuklab olishni
 * taklif qilamiz, 3) username'ni qo'lda yozdirib tasdiqlatamiz.
 */
export function DeleteTeacherModal({
  teacher,
  onClose,
}: {
  teacher: Teacher
  onClose: () => void
}) {
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState('')
  const [backedUp, setBackedUp] = useState(false)

  const preview = useQuery({
    queryKey: ['admin', 'teacher', teacher.id, 'delete-preview'],
    queryFn: () =>
      api.get<TeacherDeletePreview>(`/admin/teachers/${teacher.id}/delete-preview`),
  })

  const exportMutation = useMutation({
    mutationFn: () => api.get<unknown>(`/admin/teachers/${teacher.id}/export`),
    onSuccess: (data) => {
      // Zaxira nusxani brauzer orqali faylga tushiramiz.
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `repetitor-${teacher.username}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setBackedUp(true)
      toast.success(t.admin.deleteModal.backupDownloadedToast)
    },
    onError: (error) => toast.error(error),
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(
        `/admin/teachers/${teacher.id}?confirm=${encodeURIComponent(confirm)}`,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success(t.admin.deleteModal.deletedToast)
      onClose()
    },
    onError: (error) => toast.error(error),
  })

  const matches = confirm.trim().toLowerCase() === (teacher.username ?? '').toLowerCase()

  return (
    <Modal
      open
      onClose={onClose}
      title={t.admin.deleteModal.title}
      description={`${teacher.full_name} (${teacher.username})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.admin.deleteModal.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={!matches}
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {t.admin.deleteModal.confirmDelete}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-unpaid/30 bg-unpaid/5 p-3">
          <p className="text-sm font-medium text-unpaid">
            {t.admin.deleteModal.irreversible}
          </p>
          {preview.isPending ? (
            <div className="py-3">
              <Spinner className="size-5" />
            </div>
          ) : preview.data ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>{t.admin.deleteModal.groupsCount(preview.data.group_count)}</li>
              <li>{t.admin.deleteModal.studentsCount(preview.data.student_count)}</li>
              <li>{t.admin.deleteModal.sessionsCount(preview.data.attendance_session_count)}</li>
              <li>
                {t.admin.deleteModal.paymentsCount(
                  preview.data.payment_count,
                  money(preview.data.total_collected),
                )}
              </li>
            </ul>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-800">
            {t.admin.deleteModal.backupFirst}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{t.admin.deleteModal.backupDesc}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {backedUp ? t.admin.deleteModal.downloadAgain : t.admin.deleteModal.downloadBackup}
          </Button>
          {backedUp && (
            <span className="ml-2 text-xs text-paid">{t.admin.deleteModal.downloaded}</span>
          )}
        </div>

        <Input
          label={t.admin.deleteModal.confirmInputLabel(teacher.username ?? '')}
          value={confirm}
          placeholder={teacher.username ?? ''}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
    </Modal>
  )
}
