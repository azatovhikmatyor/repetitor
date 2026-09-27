import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/field'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { pendingGradingQuery, quizAssignmentsQuery } from '@/lib/api/queries'
import type { PendingGradingItem } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { formatDateTime } from '@/lib/format'

export function GradingPage() {
  const { assignmentId } = useParams()
  const id = Number(assignmentId)
  const t = useT()

  const pending = useQuery(pendingGradingQuery(id))
  const assignments = useQuery(quizAssignmentsQuery())
  const assignment = assignments.data?.find((a) => a.id === id)

  return (
    <>
      <PageHeader
        title={assignment ? `${t.quizzes.grading.title} — ${assignment.quiz_title}` : t.quizzes.grading.title}
        description={assignment?.group_name}
        back={{ to: `/quizzes/${assignment?.quiz_id ?? ''}`, label: t.quizzes.grading.backLabel }}
      />

      {pending.isPending && <Loading rows={4} />}
      {pending.error && (
        <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
      )}

      {pending.data && pending.data.length === 0 && (
        <Card>
          <EmptyState
            title={t.quizzes.grading.noneToGrade}
            description={t.quizzes.grading.noneToGradeDesc}
          />
        </Card>
      )}

      <div className="space-y-4">
        {pending.data?.map((item) => (
          <AttemptGradingCard key={item.attempt_id} item={item} assignmentId={id} />
        ))}
      </div>
    </>
  )
}

function AttemptGradingCard({
  item,
  assignmentId,
}: {
  item: PendingGradingItem
  assignmentId: number
}) {
  const t = useT()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [scores, setScores] = useState<Record<number, string>>(
    Object.fromEntries(item.questions.map((q) => [q.question_id, ''])),
  )
  const [feedback, setFeedback] = useState<Record<number, string>>(
    Object.fromEntries(item.questions.map((q) => [q.question_id, ''])),
  )

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/quizzes/attempts/${item.attempt_id}/grade`, {
        grades: item.questions.map((q) => ({
          question_id: q.question_id,
          score: Number(scores[q.question_id] || 0),
          feedback: feedback[q.question_id] || undefined,
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quiz-assignment', assignmentId] })
      toast.success(t.quizzes.grading.savedToast)
    },
    onError: (error) => toast.error(error),
  })

  return (
    <Card>
      <CardHeader
        title={item.student_name}
        description={
          item.submitted_at
            ? t.quizzes.grading.submittedLabel(formatDateTime(item.submitted_at))
            : undefined
        }
      />
      <CardBody className="space-y-4">
        {item.questions.map((question) => (
          <div key={question.question_id} className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">{question.prompt}</p>
            <p className="mt-1 text-sm text-slate-600">
              <span className="text-slate-400">{t.quizzes.grading.studentAnswerLabel}: </span>
              {String(question.student_answer ?? '—')}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr]">
              <Input
                label={t.quizzes.grading.scoreLabel}
                type="number"
                min={0}
                max={question.max_points}
                step={0.5}
                value={scores[question.question_id]}
                suffix={t.quizzes.grading.maxPointsSuffix(question.max_points)}
                onChange={(event) =>
                  setScores((prev) => ({ ...prev, [question.question_id]: event.target.value }))
                }
                className="max-w-40"
              />
              <Textarea
                label={t.quizzes.grading.feedbackLabel}
                value={feedback[question.question_id]}
                onChange={(value) =>
                  setFeedback((prev) => ({ ...prev, [question.question_id]: value }))
                }
                rows={2}
              />
            </div>
          </div>
        ))}

        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
          {t.quizzes.grading.saveBtn}
        </Button>
      </CardBody>
    </Card>
  )
}
