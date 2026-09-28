import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { adminCatalogQuizzesQuery } from '@/lib/api/queries'
import type { Quiz, QuizSummary } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { useDebounced } from '@/lib/use-debounced'

import { downloadQuizJson } from '../quizzes/quiz-json'

/** Super Admin: fanlar bo'yicha tayyor testlar to'plami — o'qituvchilar obuna bo'ladi. */
export function AdminQuizzesCatalogPage() {
  const t = useT()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)

  const { data, isPending, error, refetch } = useQuery(
    adminCatalogQuizzesQuery(debouncedSearch, page),
  )

  return (
    <>
      <PageHeader
        title={t.quizzes.adminCatalog.title}
        description={t.quizzes.adminCatalog.description}
        actions={
          <Button onClick={() => navigate('/admin/quizzes/new')}>
            {t.quizzes.adminCatalog.newQuiz}
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Input
          placeholder={t.quizzes.searchPlaceholder}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </div>

      {isPending && <Loading />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={t.quizzes.adminCatalog.noneYet}
          action={
            <Button onClick={() => navigate('/admin/quizzes/new')}>
              {t.quizzes.adminCatalog.newQuiz}
            </Button>
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((quiz) => (
              <CatalogQuizCard key={quiz.id} quiz={quiz} onDeleted={() => void refetch()} />
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

function CatalogQuizCard({ quiz, onDeleted }: { quiz: QuizSummary; onDeleted: () => void }) {
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/quizzes/${quiz.id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'quizzes'] })
      toast.success(t.quizzes.form.deletedToast)
      onDeleted()
    },
    onError: (error) => toast.error(error),
  })

  async function handleDownload() {
    setDownloading(true)
    try {
      const full = await api.get<Quiz>(`/admin/quizzes/${quiz.id}`)
      downloadQuizJson(full)
    } catch (error) {
      toast.error(error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <Card className="p-5">
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          {quiz.subject}
        </p>
        <h3 className="mt-0.5 font-semibold text-slate-900">{quiz.title}</h3>
        {quiz.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{quiz.description}</p>
        )}
        <div className="mt-4">
          <Badge tone="brand">{t.quizzes.questionCountUnit(quiz.question_count)}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/admin/quizzes/${quiz.id}/edit`)}
          >
            {t.quizzes.detail.editBtn}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            loading={downloading}
            onClick={() => void handleDownload()}
          >
            {t.quizzes.detail.downloadJsonBtn}
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            className="flex-1"
            onClick={() => setDeleteTarget(true)}
          >
            {t.quizzes.detail.deleteQuizBtn}
          </Button>
        </div>
      </Card>

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
