import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { myQuizzesQuery, quizCatalogQuery } from '@/lib/api/queries'
import type { Quiz, QuizSummary } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { useDebounced } from '@/lib/use-debounced'

type Tab = 'mine' | 'catalog'

export function QuizzesPage() {
  const t = useT()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const mine = useQuery({ ...myQuizzesQuery(page), enabled: tab === 'mine' })
  const catalog = useQuery({
    ...quizCatalogQuery(debouncedSearch, page),
    enabled: tab === 'catalog',
  })

  const active = tab === 'mine' ? mine : catalog
  const data = active.data

  function switchTab(next: Tab) {
    setTab(next)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title={t.quizzes.title}
        description={data ? t.quizzes.countCaption(data.total) : undefined}
        actions={<Button onClick={() => navigate('/quizzes/new')}>{t.quizzes.newQuiz}</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 border-b border-slate-200" aria-label={t.quizzes.title}>
          <TabButton active={tab === 'mine'} onClick={() => switchTab('mine')}>
            {t.quizzes.tabMine}
          </TabButton>
          <TabButton active={tab === 'catalog'} onClick={() => switchTab('catalog')}>
            {t.quizzes.tabCatalog}
          </TabButton>
        </nav>

        {tab === 'catalog' && (
          <div className="w-full max-w-xs">
            <Input
              placeholder={t.quizzes.searchPlaceholder}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
        )}
      </div>

      {active.isPending && <Loading />}
      {active.error && (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title={t.quizzes.noneYet}
          description={t.quizzes.noneYetDesc}
          action={
            tab === 'mine' ? (
              <Button onClick={() => navigate('/quizzes/new')}>{t.quizzes.newQuiz}</Button>
            ) : undefined
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                showCatalogActions={tab === 'catalog'}
                isMineTab={tab === 'mine' && !quiz.is_catalog}
                onDeleted={() => void mine.refetch()}
              />
            ))}
          </div>
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            onChange={setPage}
            label="test"
          />
        </>
      )}

    </>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px ' +
        (active
          ? 'border-brand-600 text-brand-600'
          : 'border-transparent text-slate-500 hover:text-slate-800')
      }
    >
      {children}
    </button>
  )
}

function QuizCard({
  quiz,
  showCatalogActions,
  isMineTab,
  onDeleted,
}: {
  quiz: QuizSummary
  showCatalogActions: boolean
  isMineTab: boolean
  onDeleted: () => void
}) {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [deleteTarget, setDeleteTarget] = useState(false)

  const subscribeMutation = useMutation({
    mutationFn: () => api.post(`/quizzes/${quiz.id}/subscribe`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(t.quizzes.subscribedToast)
    },
    onError: (error) => toast.error(error),
  })

  const unsubscribeMutation = useMutation({
    mutationFn: () => api.delete(`/quizzes/${quiz.id}/subscribe`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(t.quizzes.unsubscribedToast)
    },
    onError: (error) => toast.error(error),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/quizzes/${quiz.id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(t.quizzes.form.deletedToast)
      onDeleted()
    },
    onError: (error) => toast.error(error),
  })

  const cloneMutation = useMutation({
    mutationFn: () => api.post<Quiz>(`/quizzes/${quiz.id}/clone`),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(t.quizzes.form.cloneToast)
      navigate(`/quizzes/${data.id}`)
    },
    onError: (error) => toast.error(error),
  })

  const body = (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            {quiz.subject}
          </p>
          <h3 className="mt-0.5 font-semibold text-slate-900">{quiz.title}</h3>
        </div>
        {quiz.is_catalog ? (
          <Badge tone="brand">{t.quizzes.catalogBadge}</Badge>
        ) : (
          <Badge>{t.quizzes.ownBadge}</Badge>
        )}
      </div>

      {quiz.description && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{quiz.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">{t.quizzes.questionCountUnit(quiz.question_count)}</span>
        {quiz.time_limit_minutes && (
          <span className="text-slate-400">{t.quizzes.timeLimitSuffix(quiz.time_limit_minutes)}</span>
        )}
      </div>

      {showCatalogActions && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {quiz.is_subscribed ? (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              loading={unsubscribeMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                unsubscribeMutation.mutate()
              }}
            >
              {t.quizzes.unsubscribeBtn}
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              loading={subscribeMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                subscribeMutation.mutate()
              }}
            >
              {t.quizzes.subscribeBtn}
            </Button>
          )}
        </div>
      )}

      {isMineTab && (
        <div className="mt-3 flex gap-1.5 border-t border-slate-100 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              navigate(`/quizzes/${quiz.id}/edit`)
            }}
          >
            {t.quizzes.detail.editBtn}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            loading={cloneMutation.isPending}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              cloneMutation.mutate()
            }}
          >
            {t.quizzes.detail.cloneBtn}
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setDeleteTarget(true)
            }}
          >
            {t.quizzes.detail.deleteQuizBtn}
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {showCatalogActions && !quiz.is_subscribed ? (
        <div>{body}</div>
      ) : (
        <Link to={`/quizzes/${quiz.id}`}>{body}</Link>
      )}

      <ConfirmModal
        open={deleteTarget}
        onClose={() => setDeleteTarget(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        destructive
        title={t.quizzes.detail.deleteQuizConfirmTitle}
        message={t.quizzes.detail.deleteQuizConfirmMessage}
        confirmLabel={t.common.delete}
      />
    </>
  )
}
