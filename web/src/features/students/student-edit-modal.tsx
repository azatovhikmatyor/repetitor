import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import type { StudentDetail } from '@/lib/api/types'

/** O'quvchi ma'lumotlarini tahrirlash. */
export function StudentEditModal({
  student,
  onClose,
}: {
  student: StudentDetail
  onClose: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    first_name: student.first_name,
    last_name: student.last_name ?? '',
    middle_name: student.middle_name ?? '',
    phone: student.phone ?? '',
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
      toast.success('Saqlandi')
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
      title="O&rsquo;quvchi ma&rsquo;lumotlari"
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Ism"
            value={form.first_name}
            error={errors.first_name}
            onChange={(event) => set({ first_name: event.target.value })}
          />
          <Input
            label="Familiya"
            value={form.last_name}
            error={errors.last_name}
            onChange={(event) => set({ last_name: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Sharifi"
            value={form.middle_name}
            error={errors.middle_name}
            onChange={(event) => set({ middle_name: event.target.value })}
          />
          <Input
            label="Tug&rsquo;ilgan sana"
            type="date"
            value={form.birth_date}
            error={errors.birth_date}
            onChange={(event) => set({ birth_date: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Telefon"
            value={form.phone}
            error={errors.phone}
            hint="O&rsquo;quvchi shu raqam bilan kiradi"
            onChange={(event) => set({ phone: event.target.value })}
          />
          <Input
            label="Maktab, sinf"
            value={form.school}
            error={errors.school}
            placeholder="24-maktab, 9-sinf"
            onChange={(event) => set({ school: event.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Ota-ona"
            value={form.parent_name}
            error={errors.parent_name}
            onChange={(event) => set({ parent_name: event.target.value })}
          />
          <Input
            label="Ota-ona telefoni"
            value={form.parent_phone}
            error={errors.parent_phone}
            hint="To&rsquo;lov va davomat bo&rsquo;yicha aloqa uchun"
            onChange={(event) => set({ parent_phone: event.target.value })}
          />
        </div>

        <Textarea
          label="Izoh"
          value={form.note}
          error={errors.note}
          placeholder="Masalan: shanba kunlari kechroq keladi"
          onChange={(note) => set({ note })}
        />
      </div>
    </Modal>
  )
}
