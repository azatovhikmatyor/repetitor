import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { adminCatalogQuizzesQuery } from '@/lib/api/queries'
import { useT } from '@/lib/i18n'
import { useDebounced } from '@/lib/use-debounced'

import { QuizFormModal } from '../quizzes/quiz-form-modal'

/** Super Admin: fanlar bo'yicha tayyor testlar to'plami — o'qituvchilar obuna bo'ladi. */
export function AdminQuizzesCatalogPage() {
  const t = useT()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
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
          <Button onClick={() => setCreating(true)}>{t.quizzes.adminCatalog.newQuiz}</Button>
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
          action={<Button onClick={() => setCreating(true)}>{t.quizzes.adminCatalog.newQuiz}</Button>}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((quiz) => (
              <Card key={quiz.id} className="p-5">
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
              </Card>
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

      {creating && (
        <QuizFormModal
          open
          onClose={() => setCreating(false)}
          endpoint="/admin/quizzes"
          invalidateKey={['admin', 'quizzes']}
        />
      )}
    </>
  )
}
