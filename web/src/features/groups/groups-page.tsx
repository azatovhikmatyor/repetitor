import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { Progress } from '@/components/ui/stat'
import { dashboardQuery, groupsQuery } from '@/lib/api/queries'
import type { DashboardGroupCard, Group } from '@/lib/api/types'
import { money } from '@/lib/format'
import { useDebounced } from '@/lib/use-debounced'

import { GroupFormModal } from './group-form-modal'

type Tab = 'active' | 'archived'

export function GroupsPage() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('active')
  const [creating, setCreating] = useState(false)

  const { data, isPending, error, refetch } = useQuery(
    groupsQuery(useDebounced(search)),
  )
  // Shu oyning to'lov holati — bosh sahifadagi bilan bir manbadan.
  const dashboard = useQuery(dashboardQuery())

  const groups = data?.items ?? []
  const active = groups.filter((group) => group.status === 'active')
  const archived = groups.filter((group) => group.status === 'archived')
  const shown = tab === 'active' ? active : archived

  return (
    <>
      <PageHeader
        title="Guruhlar"
        description={data ? `${data.total} ta guruh` : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 border-b border-slate-200" aria-label="Guruh holati">
          <TabButton active={tab === 'active'} count={active.length} onClick={() => setTab('active')}>
            Faol
          </TabButton>
          <TabButton
            active={tab === 'archived'}
            count={archived.length}
            onClick={() => setTab('archived')}
          >
            Arxiv
          </TabButton>
        </nav>

        <div className="w-full max-w-xs">
          <Input
            placeholder="Guruh nomi bo&rsquo;yicha qidirish"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {isPending && <Loading />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && groups.length === 0 && (
        <EmptyState
          title={search ? 'Topilmadi' : "Hali guruh yo'q"}
          description={search ? undefined : 'Birinchi guruhni yarating'}
          action={
            search ? undefined : (
              <Button onClick={() => setCreating(true)}>Guruh yaratish</Button>
            )
          }
        />
      )}

      {data && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              money={dashboard.data?.groups.find(
                (card) => card.group_id === group.id,
              )}
            />
          ))}

          {/* Yaratish kartasi faol ro'yxat oxirida — arxivda yangi guruh ochilmaydi. */}
          {tab === 'active' && <NewGroupCard onClick={() => setCreating(true)} />}

          {tab === 'archived' && archived.length === 0 && (
            <p className="text-sm text-slate-500">Arxivlangan guruh yo&rsquo;q</p>
          )}
        </div>
      )}

      {creating && <GroupFormModal open onClose={() => setCreating(false)} />}
    </>
  )
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-brand-600 text-brand-600'
          : 'border-transparent text-slate-500 hover:text-slate-800',
      )}
    >
      {children}
      <span className={cn('ml-1.5 text-xs', active ? 'text-brand-600/70' : 'text-slate-400')}>
        {count}
      </span>
    </button>
  )
}

function GroupCard({
  group,
  money: payments,
}: {
  group: Group
  money?: DashboardGroupCard
}) {
  const navigate = useNavigate()

  return (
    // Link — klaviatura bilan ham ochiladi va yangi oynada ochish ishlaydi.
    <Link
      to={`/groups/${group.id}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{group.name}</h3>
        {group.status === 'archived' && <Badge>Arxiv</Badge>}
      </div>

      <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
        {group.description || group.schedule || '—'}
      </p>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold text-slate-900">{group.student_count}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">o&rsquo;quvchi</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-800">{money(group.monthly_fee)}</p>
          <p className="text-xs uppercase tracking-wide text-slate-400">oylik</p>
        </div>
      </div>

      {payments && payments.total_due > 0 && (
        <div className="mt-3">
          <Progress
            value={payments.total_paid / payments.total_due}
            tone={payments.total_debt === 0 ? 'paid' : 'partial'}
          />
          <p className="mt-1 flex justify-between text-xs">
            <span className="tabular text-slate-500">
              {money(payments.total_paid)} / {money(payments.total_due)}
            </span>
            {payments.total_debt > 0 && (
              <span className="tabular text-unpaid">
                qarz {money(payments.total_debt)}
              </span>
            )}
          </p>
        </div>
      )}

      {group.status === 'active' && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              // Karta havolasi ichida — o'zining manziliga olib boradi.
              event.preventDefault()
              event.stopPropagation()
              void navigate(`/groups/${group.id}/attendance`)
            }}
          >
            Davomat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void navigate(`/groups/${group.id}/payments`)
            }}
          >
            To&rsquo;lovlar
          </Button>
        </div>
      )}
    </Link>
  )
}

function NewGroupCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 p-5 text-slate-500 transition-colors hover:border-brand-600 hover:text-brand-600"
    >
      <span className="text-2xl leading-none">+</span>
      <span className="text-sm font-medium">Yangi guruh</span>
    </button>
  )
}
