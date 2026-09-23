import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input, Select } from '@/components/ui/field'
import { Highlight, matches } from '@/components/ui/highlight'
import { Icon } from '@/components/ui/icon'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { groupsQuery, studentsQuery } from '@/lib/api/queries'
import type { StudentListItem } from '@/lib/api/types'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { useDebounced } from '@/lib/use-debounced'

type View = 'cards' | 'table'

const PAGE_SIZE = 24

/**
 * O'qituvchining barcha o'quvchilari.
 *
 * Ro'yxat ikki ko'rinishda: kartalar (rasm, guruh, qarz bir qarashda) va
 * jadval (ko'p qatorni tez ko'rish uchun). Qidiruv nafaqat ism bo'yicha,
 * balki ota-ona va maktab bo'yicha ham ishlaydi — shuning uchun topilgan
 * joy ajratib ko'rsatiladi, aks holda "nega bu chiqdi?" degan savol
 * tug'iladi.
 */
export function StudentsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [groupId, setGroupId] = useState(0)
  const [onlyDebtors, setOnlyDebtors] = useState(false)
  const [view, setView] = useState<View>('cards')

  const query = useDebounced(search)
  const groups = useQuery(groupsQuery())
  const { data, isPending, error, refetch, isPlaceholderData } = useQuery(
    studentsQuery(query, {
      page,
      size: PAGE_SIZE,
      groupId: groupId || undefined,
      onlyDebtors,
    }),
  )

  // Filtr o'zgarsa birinchi sahifadan boshlanadi.
  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  const items = data?.items ?? []
  const debtors = items.filter((student) => student.debt > 0).length
  const hasFilters = Boolean(query) || groupId > 0 || onlyDebtors

  return (
    <>
      <PageHeader
        title="O&rsquo;quvchilar"
        description={data ? `${data.total} ta o'quvchi` : undefined}
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {(
              [
                { value: 'cards', label: 'Kartalar' },
                { value: 'table', label: 'Jadval' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  view === option.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <Input
            placeholder="Ism, telefon, ota-ona yoki maktab"
            value={search}
            autoFocus
            onChange={(event) => reset(setSearch)(event.target.value)}
          />
        </div>

        <div className="w-52">
          <Select
            value={String(groupId)}
            options={[
              { value: '0', label: 'Barcha guruhlar' },
              ...(groups.data?.items ?? []).map((group) => ({
                value: String(group.id),
                label: group.name,
              })),
            ]}
            onChange={(event) => reset(setGroupId)(Number(event.target.value))}
          />
        </div>

        <Button
          variant={onlyDebtors ? 'primary' : 'secondary'}
          onClick={() => reset(setOnlyDebtors)(!onlyDebtors)}
        >
          Qarzi borlar
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setGroupId(0)
              setOnlyDebtors(false)
              setPage(1)
            }}
          >
            Tozalash
          </Button>
        )}
      </div>

      {isPending && <Loading rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && items.length === 0 && (
        <Card>
          <EmptyState
            title={hasFilters ? 'Topilmadi' : "Hali o'quvchi yo'q"}
            description={
              hasFilters
                ? 'Boshqa so‘z bilan qidiring yoki filtrlarni tozalang'
                : "O'quvchilar guruh sahifasidan qo'shiladi — avval guruh oching"
            }
            action={
              hasFilters ? undefined : (
                <Link to="/groups">
                  <Button size="sm">Guruhlarga o&rsquo;tish</Button>
                </Link>
              )
            }
          />
        </Card>
      )}

      {data && items.length > 0 && (
        <div className={cn('space-y-4', isPlaceholderData && 'opacity-60')}>
          {onlyDebtors && (
            <p className="text-sm text-slate-500">
              Shu sahifada {debtors} ta qarzdor &middot; jami{' '}
              <span className="font-medium text-unpaid">
                {money(items.reduce((sum, student) => sum + student.debt, 0))} so&rsquo;m
              </span>
            </p>
          )}

          {view === 'cards' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((student) => (
                <StudentCard key={student.id} student={student} query={query} />
              ))}
            </div>
          ) : (
            <Card>
              <DataTable
                rows={items}
                rowKey={(student) => student.id}
                onRowClick={(student) => void navigate(`/students/${student.id}`)}
                columns={[
                  {
                    key: 'name',
                    header: 'Ism',
                    primary: true,
                    cell: (student) => (
                      <span className="flex items-center gap-2.5">
                        <Avatar
                          src={student.avatar_url}
                          name={student.full_name}
                          className="size-8 text-xs"
                        />
                        <Highlight text={student.full_name} query={query} />
                      </span>
                    ),
                  },
                  {
                    key: 'phone',
                    header: 'Telefon',
                    cell: (student) => (
                      <span className="text-slate-500">
                        {student.phone ? (
                          <Highlight text={student.phone} query={query} />
                        ) : (
                          '—'
                        )}
                      </span>
                    ),
                  },
                  {
                    key: 'groups',
                    header: 'Guruhlar',
                    cell: (student) => (
                      <span className="text-slate-500">
                        {student.group_names.join(', ') || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'debt',
                    header: 'Qarz',
                    align: 'right',
                    cell: (student) =>
                      student.debt > 0 ? (
                        <span className="font-medium text-unpaid">
                          {money(student.debt)}
                        </span>
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      ),
                  },
                  {
                    key: 'chevron',
                    align: 'right',
                    hideOnCard: true,
                    cell: () => (
                      <Icon
                        name="chevron-right"
                        className="ml-auto size-4 text-slate-400"
                      />
                    ),
                  },
                ]}
              />
            </Card>
          )}

          <Card>
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              label="o&rsquo;quvchi"
              onChange={setPage}
            />
          </Card>
        </div>
      )}
    </>
  )
}

function StudentCard({
  student,
  query,
}: {
  student: StudentListItem
  query: string
}) {
  // Qidiruv ism yoki telefondan topmagan bo'lsa, qayeridan topilganini
  // ko'rsatamiz — "nega bu chiqdi?" degan savol qolmasin.
  const visible = matches(student.full_name, query) || matches(student.phone, query)
  const hidden = visible
    ? null
    : ([
        ['Ota-ona', student.parent_name],
        ['Ota-ona telefoni', student.parent_phone],
        ['Maktab', student.school],
        ['Username', student.username],
      ] as const).find(([, value]) => matches(value, query))

  return (
    <Link
      to={`/students/${student.id}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={student.avatar_url}
          name={student.full_name}
          className="size-12 text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">
            <Highlight text={student.full_name} query={query} />
          </p>
          <p className="truncate text-sm text-slate-500">
            {student.phone ? (
              <Highlight text={student.phone} query={query} />
            ) : (
              (student.username ?? '—')
            )}
          </p>
        </div>
        {student.debt > 0 && (
          <Badge tone="unpaid">{money(student.debt)}</Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {student.group_names.length === 0 ? (
          <span className="text-xs text-slate-400">Guruhga qo&rsquo;shilmagan</span>
        ) : (
          student.group_names.map((name) => (
            <span
              key={name}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              {name}
            </span>
          ))
        )}
      </div>

      {hidden && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <span className="text-slate-400">{hidden[0]}: </span>
          <Highlight text={hidden[1]} query={query} />
        </p>
      )}
    </Link>
  )
}
