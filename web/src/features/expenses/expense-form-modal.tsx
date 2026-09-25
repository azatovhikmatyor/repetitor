import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, MoneyInput, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import type { Expense, ExpenseCategory } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { isoDate } from '@/lib/format'
import { expenseCategoryOptions } from '@/lib/labels'
import type { Period } from '@/lib/period'

/** Tanlangan oy ichidagi sana — o'tgan oyni ko'rib turib qo'shganda. */
function defaultDate(period: Period): string {
  const today = new Date()
  if (today.getFullYear() === period.year && today.getMonth() + 1 === period.month) {
    return isoDate(today)
  }
  return isoDate(new Date(period.year, period.month - 1, 1))
}

export function ExpenseFormModal({
  expense,
  period,
  onClose,
  onSaved,
}: {
  expense: Expense | null
  period: Period
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const t = useT()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    title: expense?.title ?? '',
    amount: expense ? String(expense.amount) : '',
    category: (expense?.category ?? 'rent') as ExpenseCategory,
    spent_on: expense?.spent_on ?? defaultDate(period),
    note: expense?.note ?? '',
    is_recurring: expense?.is_recurring ?? false,
  })

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount || 0),
        category: form.category,
        spent_on: form.spent_on,
        note: form.note.trim() || null,
        is_recurring: form.is_recurring,
      }
      return expense
        ? api.patch<Expense>(`/expenses/${expense.id}`, payload)
        : api.post<Expense>('/expenses', payload)
    },
    onSuccess: async () => {
      await onSaved()
      toast.success(t.expenses.form.savedToast)
      onClose()
    },
    onError: (issue) => {
      if (issue instanceof ApiError) setErrors(issue.fieldErrors)
      toast.error(issue)
    },
  })

  const set = (change: Partial<typeof form>) => setForm({ ...form, ...change })

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? t.expenses.form.editTitle : t.expenses.form.newTitle}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!form.title.trim() || Number(form.amount || 0) <= 0}
            onClick={() => save.mutate()}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t.expenses.form.titleLabel}
          value={form.title}
          error={errors.title}
          placeholder={t.expenses.form.titlePlaceholder}
          autoFocus
          onChange={(event) => set({ title: event.target.value })}
        />

        <MoneyInput
          label={t.expenses.form.amountLabel}
          value={form.amount}
          error={errors.amount}
          onChange={(amount) => set({ amount })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t.expenses.form.categoryLabel}
            value={form.category}
            options={expenseCategoryOptions(t)}
            onChange={(event) =>
              set({ category: event.target.value as ExpenseCategory })
            }
          />
          <Input
            label={t.expenses.form.dateLabel}
            type="date"
            value={form.spent_on}
            error={errors.spent_on}
            onChange={(event) => set({ spent_on: event.target.value })}
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_recurring}
            onChange={(event) => set({ is_recurring: event.target.checked })}
            className="mt-0.5 size-4 rounded border-slate-300 text-brand-600"
          />
          <span>
            {t.expenses.form.recurringLabel}
            <span className="block text-xs text-slate-500">
              {t.expenses.form.recurringHint}
            </span>
          </span>
        </label>

        <Textarea
          label={t.expenses.form.noteLabel}
          rows={2}
          value={form.note}
          error={errors.note}
          onChange={(note) => set({ note })}
        />
      </div>
    </Modal>
  )
}
