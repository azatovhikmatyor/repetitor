import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { TemporaryPasswordModal } from '@/features/groups/add-student-modal'
import { api } from '@/lib/api/client'
import { teachersQuery } from '@/lib/api/queries'
import type { Teacher, UserStatus } from '@/lib/api/types'
import { useT, type Dictionary } from '@/lib/i18n'
import { formatDate } from '@/lib/format'
import { useDebounced } from '@/lib/use-debounced'

import { DeleteTeacherModal } from './delete-teacher-modal'

export function TeachersPage() {
  const t = useT()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const FILTERS = [
    { value: 'all', label: t.admin.filterAll },
    { value: 'pending', label: t.admin.filterPending },
    { value: 'active', label: t.admin.filterActive },
    { value: 'blocked', label: t.admin.filterBlocked },
  ]

  const status = filter === 'all' ? undefined : (filter as UserStatus)
  const { data, isPending, error, refetch } = useQuery(teachersQuery(useDebounced(search), status))

  return (
    <>
      <PageHeader
        title={t.admin.teachersTitle}
        description={data ? t.admin.accountsCaption(data.total) : undefined}
        back={{ to: '/admin', label: t.admin.platformBack }}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder={t.admin.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            value={filter}
            options={FILTERS}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </div>

      <Card>
        {isPending && <Loading />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data && data.items.length === 0 && (
          <EmptyState
            title={filter === 'pending' ? t.admin.noPending : t.admin.notFound}
          />
        )}

        {data && data.items.length > 0 && (
          <Table>
            <thead>
              <tr>
                <Th>{t.admin.colName}</Th>
                <Th>{t.admin.colUsername}</Th>
                <Th>{t.admin.colContact}</Th>
                <Th align="right">{t.admin.colGroups}</Th>
                <Th align="right">{t.admin.colStudents}</Th>
                <Th>{t.admin.colStatus}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((teacher) => (
                <TeacherRow key={teacher.id} teacher={teacher} t={t} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

function TeacherRow({ teacher, t }: { teacher: Teacher; t: Dictionary }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [action, setAction] = useState<'approve' | 'block' | 'unblock' | 'reset' | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const STATUS_BADGE: Record<UserStatus, { tone: 'paid' | 'partial' | 'unpaid'; label: string }> = {
    active: { tone: 'paid', label: t.admin.statusActive },
    pending: { tone: 'partial', label: t.admin.statusPending },
    blocked: { tone: 'unpaid', label: t.admin.statusBlocked },
  }

  const statusMutation = useMutation({
    mutationFn: (path: 'approve' | 'block' | 'unblock') =>
      api.post(`/admin/teachers/${teacher.id}/${path}`),
    onSuccess: async (_, path) => {
      await refresh()
      toast.success(
        path === 'approve'
          ? t.admin.approvedToast
          : path === 'block'
            ? t.admin.blockedToast
            : t.admin.unblockedToast,
      )
      setAction(null)
    },
    onError: (error) => {
      toast.error(error)
      setAction(null)
    },
  })

  const resetMutation = useMutation({
    mutationFn: () =>
      api.post<{ temporary_password: string }>(
        `/admin/teachers/${teacher.id}/reset-password`,
      ),
    onSuccess: async (result) => {
      await refresh()
      setAction(null)
      setTemporaryPassword(result.temporary_password)
    },
    onError: (error) => {
      toast.error(error)
      setAction(null)
    },
  })

  const badge = STATUS_BADGE[teacher.status]

  return (
    <>
      <Tr className={teacher.status === 'pending' ? 'bg-partial/5' : undefined}>
        <Td>
          <span className="font-medium text-slate-900">{teacher.full_name}</span>
          {teacher.middle_name && (
            <span className="block text-xs text-slate-500">{teacher.middle_name}</span>
          )}
        </Td>
        <Td className="text-slate-600">{teacher.username}</Td>
        <Td className="text-slate-500">
          {teacher.email ?? teacher.phone ?? (
            // Bu ikkisisiz o'qituvchi parolni o'zi tiklay olmaydi.
            <span className="text-unpaid">{t.admin.noContact}</span>
          )}
        </Td>
        <Td align="right">{teacher.active_group_count}</Td>
        <Td align="right">{teacher.student_count}</Td>
        <Td>
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {teacher.status === 'pending' && (
            <span className="mt-0.5 block text-xs text-slate-500">
              {formatDate(teacher.created_at)}
            </span>
          )}
        </Td>
        <Td align="right">
          <span className="flex flex-wrap justify-end gap-1">
            {teacher.status === 'pending' && (
              <Button size="sm" onClick={() => setAction('approve')}>
                {t.admin.approveBtn}
              </Button>
            )}
            {teacher.status === 'active' && (
              <Button variant="ghost" size="sm" onClick={() => setAction('block')}>
                {t.admin.blockBtn}
              </Button>
            )}
            {teacher.status === 'blocked' && (
              <Button variant="secondary" size="sm" onClick={() => setAction('unblock')}>
                {t.admin.unblockBtn}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setAction('reset')}>
              {t.admin.passwordBtn}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
              {t.admin.deleteBtn}
            </Button>
          </span>
        </Td>
      </Tr>

      <ConfirmModal
        open={action === 'approve'}
        onClose={() => setAction(null)}
        onConfirm={() => statusMutation.mutate('approve')}
        loading={statusMutation.isPending}
        title={t.admin.approveConfirmTitle}
        message={t.admin.approveConfirmMessage(teacher.full_name, teacher.username ?? '')}
        confirmLabel={t.admin.approveBtn}
      />

      <ConfirmModal
        open={action === 'block'}
        onClose={() => setAction(null)}
        onConfirm={() => statusMutation.mutate('block')}
        loading={statusMutation.isPending}
        destructive
        title={t.admin.blockConfirmTitle}
        message={t.admin.blockConfirmMessage(teacher.full_name, teacher.student_count)}
        confirmLabel={t.admin.blockBtn}
      />

      <ConfirmModal
        open={action === 'unblock'}
        onClose={() => setAction(null)}
        onConfirm={() => statusMutation.mutate('unblock')}
        loading={statusMutation.isPending}
        title={t.admin.unblockConfirmTitle}
        message={t.admin.unblockConfirmMessage(teacher.full_name)}
        confirmLabel={t.admin.unblockBtn}
      />

      <ConfirmModal
        open={action === 'reset'}
        onClose={() => setAction(null)}
        onConfirm={() => resetMutation.mutate()}
        loading={resetMutation.isPending}
        title={t.admin.resetConfirmTitle}
        message={t.admin.resetConfirmMessage(teacher.full_name)}
        confirmLabel={t.admin.passwordBtn}
      />

      {deleting && (
        <DeleteTeacherModal teacher={teacher} onClose={() => setDeleting(false)} />
      )}

      {temporaryPassword && (
        <TemporaryPasswordModal
          password={temporaryPassword}
          onClose={() => setTemporaryPassword(null)}
        />
      )}
    </>
  )
}
