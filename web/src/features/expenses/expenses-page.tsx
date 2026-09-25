import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { MonthPicker } from '@/components/ui/month-picker'
import { ConfirmModal } from '@/components/ui/modal'
import { Progress, Stat } from '@/components/ui/stat'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { expensesQuery, qk } from '@/lib/api/queries'
import type { CopyPreviousResult, Expense } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { downloadCsv } from '@/lib/export'
import { useT } from '@/lib/i18n'
import { formatDate, money, monthName } from '@/lib/format'
import { expenseCategoryLabel } from '@/lib/labels'
import { currentPeriod } from '@/lib/period'

import { ExpenseFormModal } from './expense-form-modal'

/**
 * Xarajatlar va foyda.
 *
 * Daromad allaqachon tizimda edi, foyda esa yo'q — ijara, maosh va
 * kommunal hech qayerda yozilmasdi. Shu sahifa o'sha bo'shliqni
 * to'ldiradi: yuqorida uchta raqam (yig'ilgan − xarajat = foyda),
 * pastda toifalar kesimi va yozuvlar.
 */
export function ExpensesPage() {
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod())
  const [editing, setEditing] = useState<Expense | null>(null)
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<Expense | null>(null)

  const { data, isPending, error, refetch } = useQuery(expensesQuery(period))

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['expenses'] })
    await queryClient.invalidateQueries({ queryKey: qk.dashboard })
    await queryClient.invalidateQueries({ queryKey: ['report'] })
  }

  const remove = useMutation({
    mutationFn: (expense: Expense) => api.delete(`/expenses/${expense.id}`),
    onSuccess: async () => {
      await refresh()
      setRemoving(null)
      toast.success(t.expenses.deletedToast)
    },
    onError: (issue) => {
      toast.error(issue)
      setRemoving(null)
    },
  })

  const copyPrevious = useMutation({
    mutationFn: () =>
      api.post<CopyPreviousResult>(
        `/expenses/copy-previous?year=${period.year}&month=${period.month}`,
      ),
    onSuccess: async (result) => {
      await refresh()
      toast.success(
        result.copied > 0
          ? t.expenses.copiedToast(result.copied)
          : t.expenses.nothingToCopy,
      )
    },
    onError: (issue) => toast.error(issue),
  })

  const profitable = (data?.profit ?? 0) >= 0
  const rate =
    data && data.collected > 0 ? Math.max(data.profit, 0) / data.collected : 0

  return (
    <>
      <PageHeader
        title={t.expenses.title}
        description={data ? `${monthName(data.month)} ${data.year}` : undefined}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!data || data.items.length === 0}
              onClick={() => {
                if (!data) return
                downloadCsv(
                  `xarajat-${data.year}-${String(data.month).padStart(2, '0')}`,
                  [
                    t.expenses.colDate,
                    t.expenses.colTitle,
                    t.expenses.colCategory,
                    t.expenses.colAmount,
                    t.expenses.form.noteLabel,
                  ],
                  data.items.map((item) => [
                    item.spent_on,
                    item.title,
                    expenseCategoryLabel(t)[item.category],
                    item.amount,
                    item.note,
                  ]),
                )
              }}
            >
              {t.reports.excel}
            </Button>
            <MonthPicker value={period} onChange={setPeriod} />
            <Button onClick={() => setCreating(true)}>{t.expenses.addBtn}</Button>
          </>
        }
      />

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <div className="space-y-6">
          <Card>
            <CardBody className="grid gap-6 sm:grid-cols-3">
              <Stat label={t.expenses.collected} value={money(data.collected)} tone="paid" />
              <Stat
                label={t.expenses.total}
                value={money(data.total)}
                tone={data.total > 0 ? 'unpaid' : undefined}
              />
              <Stat
                label={t.expenses.profit}
                value={money(data.profit)}
                caption={
                  data.collected > 0
                    ? t.expenses.profitPctCaption(Math.round(rate * 100))
                    : t.expenses.noIncome
                }
                tone={profitable ? 'paid' : 'unpaid'}
              />
              <div className="sm:col-span-3">
                {/* Chiziq — daromadning qancha qismi qo'lda qolgani. */}
                <Progress value={rate} tone={profitable ? 'paid' : 'partial'} />
              </div>
            </CardBody>
          </Card>

          {data.by_category.length > 0 && (
            <Card>
              <CardHeader title={t.expenses.byCategory} />
              <CardBody className="space-y-3">
                {data.by_category.map((item) => (
                  <div key={item.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        {expenseCategoryLabel(t)[item.category]}
                        <span className="ml-1.5 text-xs text-slate-400">
                          {t.expenses.countUnit(item.count)}
                        </span>
                      </span>
                      <span className="tabular font-medium text-slate-800">
                        {money(item.total)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-400"
                        style={{
                          width: `${
                            data.total > 0 ? (item.total / data.total) * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title={t.expenses.entriesTitle}
              description={t.expenses.countUnit(data.items.length)}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  loading={copyPrevious.isPending}
                  onClick={() => copyPrevious.mutate()}
                >
                  {t.expenses.copyPrevious}
                </Button>
              }
            />

            {data.items.length === 0 ? (
              <EmptyState
                title={t.expenses.noExpenses}
                description={t.expenses.noExpensesDesc}
                action={
                  <Button size="sm" onClick={() => setCreating(true)}>
                    {t.expenses.addBtn}
                  </Button>
                }
              />
            ) : (
              <DataTable
                rows={data.items}
                rowKey={(item) => item.id}
                columns={[
                  {
                    key: 'title',
                    header: t.expenses.colTitle,
                    primary: true,
                    cell: (item) => (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {item.title}
                        {item.is_recurring && <Badge>{t.expenses.recurringBadge}</Badge>}
                      </span>
                    ),
                  },
                  {
                    key: 'category',
                    header: t.expenses.colCategory,
                    cell: (item) => (
                      <span className="text-slate-500">
                        {expenseCategoryLabel(t)[item.category]}
                      </span>
                    ),
                  },
                  {
                    key: 'date',
                    header: t.expenses.colDate,
                    cell: (item) => (
                      <span className="text-slate-500">{formatDate(item.spent_on)}</span>
                    ),
                  },
                  {
                    key: 'amount',
                    header: t.expenses.colAmount,
                    align: 'right',
                    cell: (item) => (
                      <span className="font-medium">{money(item.amount)}</span>
                    ),
                  },
                  {
                    key: 'actions',
                    align: 'right',
                    footer: true,
                    cell: (item) => (
                      <span className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(item)}
                        >
                          {t.expenses.edit}
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() => setRemoving(item)}
                        >
                          {t.expenses.delete}
                        </Button>
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </Card>

          {data.items.some((item) => item.note) && (
            <p className={cn('text-xs text-slate-400')}>{t.expenses.noteHint}</p>
          )}
        </div>
      )}

      {(creating || editing) && (
        <ExpenseFormModal
          expense={editing}
          period={period}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={refresh}
        />
      )}

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
        loading={remove.isPending}
        destructive
        title={t.expenses.deleteConfirmTitle}
        message={t.expenses.deleteConfirmMessage(
          removing?.title ?? '',
          money(removing?.amount ?? 0),
        )}
        confirmLabel={t.expenses.delete}
      />
    </>
  )
}
