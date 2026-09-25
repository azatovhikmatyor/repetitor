import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import type { StudentDetail } from '@/lib/api/types'
import { useT } from '@/lib/i18n'

/** O'quvchi ma'lumotlarini tahrirlash. */
export function StudentEditModal({
  student,
  onClose,
}: {
  student: StudentDetail
  onClose: () => void
}) {
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    first_name: student.first_name,
    last_name: student.last_name ?? '',
    middle_name: student.middle_name ?? '',
    phone: student.phone ?? '',
    username: student.username ?? '',
    birth_date: student.birth_date ?? '',
    parent_name: student.parent_name ?? '',
    parent_phone: student.parent_phone ?? '',
    school: student.school ?? '',
    note: student.note ?? '',
  })

  const save = useMutation({
    mutationFn: () =>
      api.patch<StudentDetail>(`/students/${student.id}`, {
        ...form,
        // Bo'sh sana `null` bo'lib ketishi kerak, "" emas.
        birth_date: form.birth_date || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student', student.id] })
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success(t.students.edit.savedToast)
      onClose()
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error)
    },
  })

  const set = (change: Partial<typeof form>) => setForm({ ...form, ...change })

  return (
    <Modal
      open
      onClose={onClose}
      title={t.students.edit.title}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t.students.edit.firstName}
            value={form.first_name}
            error={errors.first_name}
            onChange={(event) => set({ first_name: event.target.value })}
          />
          <Input
            label={t.students.edit.lastName}
            value={form.last_name}
            error={errors.last_name}
            onChange={(event) => set({ last_name: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t.students.edit.middleName}
            value={form.middle_name}
            error={errors.middle_name}
            onChange={(event) => set({ middle_name: event.target.value })}
          />
          <Input
            label={t.students.edit.birthDate}
            type="date"
            value={form.birth_date}
            error={errors.birth_date}
            onChange={(event) => set({ birth_date: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t.students.edit.phone}
            value={form.phone}
            error={errors.phone}
            hint={t.students.edit.phoneHint}
            onChange={(event) => set({ phone: event.target.value })}
          />
          <Input
            label={t.students.edit.username}
            value={form.username}
            error={errors.username}
            hint={t.students.edit.usernameHint}
            onChange={(event) => set({ username: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t.students.edit.school}
            value={form.school}
            error={errors.school}
            placeholder={t.students.edit.schoolPlaceholder}
            onChange={(event) => set({ school: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t.students.edit.parentName}
            value={form.parent_name}
            error={errors.parent_name}
            onChange={(event) => set({ parent_name: event.target.value })}
          />
          <Input
            label={t.students.edit.parentPhone}
            value={form.parent_phone}
            error={errors.parent_phone}
            hint={t.students.edit.parentPhoneHint}
            onChange={(event) => set({ parent_phone: event.target.value })}
          />
        </div>

        <Textarea
          label={t.students.edit.note}
          value={form.note}
          error={errors.note}
          placeholder={t.students.edit.notePlaceholder}
          onChange={(note) => set({ note })}
        />
      </div>
    </Modal>
  )
}
