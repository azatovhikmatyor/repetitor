import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import { qk, studentsQuery } from '@/lib/api/queries'
import type { AddStudentResponse, StudentSummary } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

import { FeeFields, feeCreatePayload, initialFee, type FeeDraft } from './fee-fields'

/**
 * Guruhga o'quvchi qo'shish.
 *
 * Ikki yo'l bitta oynada: yangi account yaratish yoki mavjud o'quvchini
 * qidiruvdan topib qo'shish (talab 6). "Enrollment" so'zi ko'rinmaydi.
 */
export function AddStudentModal({
  groupId,
  groupFee,
  open,
  onClose,
}: {
  groupId: number
  groupFee: number
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Chegirma bilan qo'shish keyin tahrirlashdan qulayroq: kelishuv
  // odatda qo'shilayotgan paytda bo'ladi.
  const [fee, setFee] = useState<FeeDraft>(() => initialFee(null, null))
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const searchResults = useQuery({
    ...studentsQuery(search),
    enabled: mode === 'existing' && search.trim().length >= 2,
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<AddStudentResponse>(`/groups/${groupId}/students`, body),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      await queryClient.invalidateQueries({ queryKey: qk.dashboard })

      // Yangi account yaratilgan bo'lsa, vaqtinchalik parol faqat shu yerda
      // ko'rsatiladi — o'qituvchi uni o'quvchiga aytishi kerak.
      if (result.temporary_password) {
        setTemporaryPassword(result.temporary_password)
      } else {
        toast.success(t.groups.addStudent.addedToast)
        onClose()
      }
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error)
    },
  })

  if (temporaryPassword) {
    return (
      <TemporaryPasswordModal
        password={temporaryPassword}
        onClose={() => {
          setTemporaryPassword(null)
          onClose()
        }}
      />
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.groups.addStudent.title}
      footer={
        mode === 'new' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button
              loading={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  first_name: form.first_name.trim(),
                  last_name: form.last_name.trim(),
                  phone: form.phone.trim(),
                  ...feeCreatePayload(fee),
                })
              }
            >
              {t.groups.addStudent.addBtn}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
        {(['new', 'existing'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              mode === value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500',
            )}
          >
            {value === 'new' ? t.groups.addStudent.newTab : t.groups.addStudent.existingTab}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t.groups.addStudent.firstName}
              value={form.first_name}
              error={errors.first_name}
              autoFocus
              onChange={(event) => setForm({ ...form, first_name: event.target.value })}
            />
            <Input
              label={t.groups.addStudent.lastName}
              value={form.last_name}
              error={errors.last_name}
              onChange={(event) => setForm({ ...form, last_name: event.target.value })}
            />
          </div>
          <Input
            label={t.groups.addStudent.phone}
            value={form.phone}
            error={errors.phone}
            placeholder={t.groups.addStudent.phonePlaceholder}
            hint={t.groups.addStudent.phoneHint}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />

          <FeeFields groupFee={groupFee} value={fee} onChange={setFee} />
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            label={t.groups.addStudent.searchLabel}
            value={search}
            autoFocus
            placeholder={t.groups.addStudent.searchPlaceholder}
            hint={t.groups.addStudent.searchHint}
            onChange={(event) => setSearch(event.target.value)}
          />

          <FeeFields groupFee={groupFee} value={fee} onChange={setFee} />

          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {search.trim().length < 2 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                {t.groups.addStudent.minChars}
              </p>
            ) : searchResults.isFetching ? (
              <div className="grid place-items-center py-6">
                <Spinner />
              </div>
            ) : (searchResults.data?.items.length ?? 0) === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                {t.groups.addStudent.notFound}
              </p>
            ) : (
              searchResults.data?.items.map((student: StudentSummary) => (
                <button
                  key={student.id}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      student_id: student.id,
                      ...feeCreatePayload(fee),
                    })
                  }
                  className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50 disabled:opacity-50"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      {student.full_name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {student.phone ?? student.username}
                    </span>
                  </span>
                  <span className="text-brand-600">+</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

/**
 * Vaqtinchalik parol — faqat bir marta ko'rsatiladi.
 *
 * O'quvchining parolini tiklaganda ham shu oyna ishlatiladi.
 */
export function TemporaryPasswordModal({
  password,
  onClose,
}: {
  password: string
  onClose: () => void
}) {
  const toast = useToast()
  const t = useT()

  return (
    <Modal
      open
      onClose={onClose}
      title={t.groups.addStudent.tempPasswordTitle}
      description={t.groups.addStudent.tempPasswordDesc}
      width="max-w-sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(password)
              toast.success(t.groups.addStudent.copied)
            }}
          >
            {t.groups.addStudent.copy}
          </Button>
          <Button onClick={onClose}>{t.common.close}</Button>
        </>
      }
    >
      <p className="rounded-lg bg-slate-50 py-4 text-center text-2xl font-bold tracking-[0.3em] text-slate-900">
        {password}
      </p>
      <p className="mt-3 text-xs text-slate-500">{t.groups.addStudent.mustChangeNotice}</p>
    </Modal>
  )
}
