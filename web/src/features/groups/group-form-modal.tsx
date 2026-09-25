import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, MoneyInput, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import { qk } from '@/lib/api/queries'
import type { Group } from '@/lib/api/types'
import { useT } from '@/lib/i18n'

/**
 * Guruh yaratish/tahrirlash oynasi.
 *
 * `group` berilsa tahrirlash, aks holda yaratish.
 */
export function GroupFormModal({
  open,
  onClose,
  group,
}: {
  open: boolean
  onClose: () => void
  group?: Group
}) {
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()
  const isEdit = group !== undefined

  const [form, setForm] = useState({
    name: group?.name ?? '',
    monthly_fee: group ? String(group.monthly_fee) : '',
    description: group?.description ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        monthly_fee: Number(form.monthly_fee || 0),
        description: form.description.trim(),
      }
      return isEdit
        ? api.patch<Group>(`/groups/${group.id}`, body)
        : api.post<Group>('/groups', body)
    },
    onSuccess: async (saved) => {
      // Guruh o'zgardi — ro'yxat, guruh kartasi va dashboard yangilanadi.
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      await queryClient.invalidateQueries({ queryKey: qk.group(saved.id) })
      await queryClient.invalidateQueries({ queryKey: qk.dashboard })
      toast.success(isEdit ? t.groups.form.savedToast : t.groups.form.createdToast)
      onClose()
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error)
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t.groups.form.editTitle : t.groups.form.newTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t.groups.form.nameLabel}
          value={form.name}
          error={errors.name}
          placeholder={t.groups.form.namePlaceholder}
          autoFocus
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <MoneyInput
          label={t.groups.form.feeLabel}
          value={form.monthly_fee}
          error={errors.monthly_fee}
          // Narx o'zgarsa o'tgan oylar o'zgarmasligini eslatib turamiz.
          hint={t.groups.form.feeHint}
          onChange={(value) => setForm({ ...form, monthly_fee: value })}
        />
        <Textarea
          label={t.groups.form.descLabel}
          value={form.description}
          error={errors.description}
          onChange={(value) => setForm({ ...form, description: value })}
        />
      </div>
    </Modal>
  )
}
