import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { assignmentResultsQuery, quizAssignmentsQuery } from '@/lib/api/queries'
import { useT } from '@/lib/i18n'
import { formatDateTime } from '@/lib/format'

export function ResultsPage() {
  const { assignmentId } = useParams()
  const id = Number(assignmentId)
  const t = useT()
  const toast = useToast()
  const queryClient = useQueryClient()

  const results = useQuery(assignmentResultsQuery(id))
  const assignments = useQuery(quizAssignmentsQuery())
  const assignment = assignments.data?.find((a) => a.id === id)

  const finalizeMutation = useMutation({
    mutationFn: () => api.post(`/quizzes/assignments/${id}/finalize`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quiz-assignment', id] })
      await queryClient.invalidateQueries({ queryKey: ['quiz-assignments'] })
      toast.success(t.quizzes.detail.finalizeToast)
    },
    onError: (error) => toast.error(error),
  })

  if (results.isPending) return <Loading rows={5} />
  if (results.error) {
    return <ErrorState error={results.error} onRetry={() => void results.refetch()} />
  }

  const data = results.data

  return (
    <>
      <PageHeader
        title={assignment ? `${t.quizzes.results.title} — ${assignment.quiz_title}` : t.quizzes.results.title}
        description={assignment?.group_name}
        back={{ to: `/quizzes/${assignment?.quiz_id ?? ''}`, label: t.quizzes.results.backLabel }}
      />

      {!data.fully_graded && (
        <Card className="mb-4 border-partial/40 bg-partial/10">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{t.quizzes.results.notGradedYet}</p>
            <Button
              size="sm"
              variant="secondary"
              loading={finalizeMutation.isPending}
              onClick={() => finalizeMutation.mutate()}
            >
              {t.quizzes.results.finalizeBtn}
            </Button>
          </CardBody>
        </Card>
      )}

      {assignment?.notified_at && (
        <p className="mb-4 text-xs text-slate-500">
          {t.quizzes.detail.alreadyNotified} · {formatDateTime(assignment.notified_at)}
        </p>
      )}

      <Card>
        {data.entries.length === 0 ? (
          <EmptyState title={t.quizzes.results.noEntries} />
        ) : (
          <DataTable
            rows={data.entries}
            rowKey={(entry) => entry.student_id}
            columns={[
              {
                key: 'rank',
                header: t.quizzes.results.colRank,
                cell: (entry) => (
                  <span className="font-semibold tabular">
                    {entry.rank} / {entry.out_of}
                  </span>
                ),
              },
              {
                key: 'student',
                header: t.quizzes.results.colStudent,
                primary: true,
                cell: (entry) => (
                  <span className="font-medium text-slate-900">{entry.student_name}</span>
                ),
              },
              {
                key: 'score',
                header: t.quizzes.results.colScore,
                align: 'right',
                cell: (entry) => (
                  <Badge tone={entry.rank === 1 ? 'paid' : 'neutral'}>{entry.score}</Badge>
                ),
              },
            ]}
          />
        )}
      </Card>
    </>
  )
}
