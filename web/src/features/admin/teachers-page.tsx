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
import { formatDate } from '@/lib/format'
import { useDebounced } from '@/lib/use-debounced'

import { DeleteTeacherModal } from './delete-teacher-modal'

const FILTERS = [
  { value: 'all', label: 'Hammasi' },
  { value: 'pending', label: 'Tasdiq kutmoqda' },
  { value: 'active', label: 'Faol' },
  { value: 'blocked', label: 'Bloklangan' },
]

const STATUS_BADGE: Record<UserStatus, { tone: 'paid' | 'partial' | 'unpaid'; label: string }> = {
  active: { tone: 'paid', label: 'Faol' },
  pending: { tone: 'partial', label: 'Tasdiq kutmoqda' },
  blocked: { tone: 'unpaid', label: 'Bloklangan' },
}

export function TeachersPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const status = filter === 'all' ? undefined : (filter as UserStatus)
  const { data, isPending, error, refetch } = useQuery(teachersQuery(useDebounced(search), status))

  return (
    <>
      <PageHeader
        title="O&rsquo;qituvchilar"
        description={data ? `${data.total} ta hisob` : undefined}
        back={{ to: '/admin', label: 'Platforma' }}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Ism, username, email yoki telefon"
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
            title={filter === 'pending' ? 'Tasdiq kutayotgan yo&rsquo;q' : 'Topilmadi'}
          />
        )}

        {data && data.items.length > 0 && (
          <Table>
            <thead>
              <tr>
                <Th>Ism</Th>
                <Th>Username</Th>
                <Th>Aloqa</Th>
                <Th align="right">Guruh</Th>
                <Th align="right">O&rsquo;quvchi</Th>
                <Th>Holat</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((teacher) => (
                <TeacherRow key={teacher.id} teacher={teacher} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

function TeacherRow({ teacher }: { teacher: Teacher }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [action, setAction] = useState<'approve' | 'block' | 'unblock' | 'reset' | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const statusMutation = useMutation({
    mutationFn: (path: 'approve' | 'block' | 'unblock') =>
      api.post(`/admin/teachers/${teacher.id}/${path}`),
    onSuccess: async (_, path) => {
      await refresh()
      toast.success(
        path === 'approve' ? 'Tasdiqlandi' : path === 'block' ? 'Bloklandi' : 'Tiklandi',
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
            <span className="text-unpaid">yo&rsquo;q</span>
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
                Tasdiqlash
              </Button>
            )}
            {teacher.status === 'active' && (
              <Button variant="ghost" size="sm" onClick={() => setAction('block')}>
                Bloklash
              </Button>
            )}
            {teacher.status === 'blocked' && (
              <Button variant="secondary" size="sm" onClick={() => setAction('unblock')}>
                Tiklash
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setAction('reset')}>
              Parol
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
              O&rsquo;chirish
            </Button>
          </span>
        </Td>
      </Tr>

      <ConfirmModal
        open={action === 'approve'}
        onClose={() => setAction(null)}
        onConfirm={() => statusMutation.mutate('approve')}
        loading={statusMutation.isPending}
        title="Hisobni tasdiqlash"
        message={`${teacher.full_name} (${teacher.username}) tizimga kira oladigan bo'ladi.`}
        confirmLabel="Tasdiqlash"
      />

      <ConfirmModal
        open={action === 'block'}
        onClose={() => setAction(null)}
        onConfirm={() => statusMutation.mutate('block')}
        loading={statusMutation.isPending}
        destructive
        title="Hisobni bloklash"
        message={`${teacher.full_name} tizimga kira olmaydi. Uning ${teacher.student_count} ta o'quvchisi ham o'z hisobidan foydalana olmaydi. Ma'lumotlar o'chmaydi.`}
        confirmLabel="Bloklash"
      />

      <ConfirmModal
        open={action === 'unblock'}
        onClose={() => setAction(null)}
        onConfirm={() => statusMutation.mutate('unblock')}
        loading={statusMutation.isPending}
        title="Hisobni tiklash"
        message={`${teacher.full_name} va uning o'quvchilari yana tizimga kira oladi.`}
        confirmLabel="Tiklash"
      />

      <ConfirmModal
        open={action === 'reset'}
        onClose={() => setAction(null)}
        onConfirm={() => resetMutation.mutate()}
        loading={resetMutation.isPending}
        title="Parolni tiklash"
        message={`${teacher.full_name} uchun yangi vaqtinchalik parol beriladi va barcha sessiyalari yopiladi. U keyingi kirishda parolni almashtirishi shart.`}
        confirmLabel="Tiklash"
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
