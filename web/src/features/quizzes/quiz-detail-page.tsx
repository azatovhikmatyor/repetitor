import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { ConfirmModal } from '@/components/ui/modal'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { quizAssignmentsQuery, quizQuery } from '@/lib/api/queries'
import type { Quiz, QuizAssignment } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { formatDateTime } from '@/lib/format'
import { quizModeLabel, scoreRuleLabel } from '@/lib/labels'

import { AssignModal } from './assign-modal'
import { QuizFormModal } from './quiz-form-modal'

export function QuizDetailPage() {
  const { quizId } = useParams()
  const id = Number(quizId)
  const t = useT()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const quiz = useQuery(quizQuery(id))
  const assignments = useQuery(quizAssignmentsQuery())

  const [assigning, setAssigning] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QuizAssignment | null>(null)
  const [deleteQuizConfirm, setDeleteQuizConfirm] = useState(false)

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: number) =>
      api.delete(`/quizzes/assignments/${assignmentId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quiz-assignments'] })
      toast.success(t.quizzes.detail.deletedToast)
      setDeleteTarget(null)
    },
    onError: (error) => {
      toast.error(error)
      setDeleteTarget(null)
    },
  })

  const deleteQuizMutation = useMutation({
    mutationFn: () => api.delete(`/quizzes/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(t.quizzes.detail.quizDeletedToast)
      navigate('/quizzes')
    },
    onError: (error) => toast.error(error),
  })

  const cloneMutation = useMutation({
    mutationFn: () => api.post<Quiz>(`/quizzes/${id}/clone`),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success(t.quizzes.form.cloneToast)
      navigate(`/quizzes/${data.id}`)
    },
    onError: (error) => toast.error(error),
  })

  if (quiz.isPending) return <Loading rows={5} />
  if (quiz.error) return <ErrorState error={quiz.error} onRetry={() => void quiz.refetch()} />

  const data = quiz.data
  const relevantAssignments = (assignments.data ?? []).filter((a) => a.quiz_id === id)

  return (
    <>
      <PageHeader
        title={data.title}
        description={data.subject}
        back={{ to: '/quizzes', label: t.quizzes.detail.backLabel }}
        actions={
          <span className="flex flex-wrap gap-2">
            {!data.is_catalog && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  {t.quizzes.detail.editBtn}
                </Button>
                <Button
                  variant="secondary"
                  loading={cloneMutation.isPending}
                  onClick={() => cloneMutation.mutate()}
                >
                  {t.quizzes.detail.cloneBtn}
                </Button>
                <Button variant="danger-ghost" onClick={() => setDeleteQuizConfirm(true)}>
                  {t.quizzes.detail.deleteQuizBtn}
                </Button>
              </>
            )}
            <Button onClick={() => setAssigning(true)}>{t.quizzes.detail.assignBtn}</Button>
          </span>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title={t.quizzes.detail.sectionsTitle}
            description={
              data.description ?? t.quizzes.questionCountUnit(data.question_count)
            }
          />
          <CardBody className="space-y-5">
            {data.sections.map((section) => (
              <div key={section.id}>
                <h3 className="font-medium text-slate-800">{section.title}</h3>
                {section.instructions && (
                  <p className="mt-0.5 text-sm text-slate-500">{section.instructions}</p>
                )}
                <ol className="mt-2 space-y-2">
                  {section.questions.map((question, index) => (
                    <li
                      key={question.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-800">
                          {index + 1}. {question.prompt}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {question.points} {t.quizzes.detail.pointsUnit}
                        </span>
                      </div>
                      {question.options && (
                        <ul className="mt-1.5 space-y-0.5 text-slate-600">
                          {question.options.map((option) => {
                            const isCorrect = Array.isArray(question.correct_answer)
                              ? question.correct_answer.includes(option.id)
                              : question.correct_answer === option.id
                            return (
                              <li
                                key={option.id}
                                className={isCorrect ? 'font-medium text-paid' : undefined}
                              >
                                {option.text}
                                {isCorrect ? ' ✓' : ''}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {question.type === 'text' && (
                        <p className="mt-1.5 text-paid">
                          {t.quizzes.form.correctAnswerLabel}: {String(question.correct_answer)}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.quizzes.detail.assignmentsTitle} />

          {assignments.isPending && <Loading />}
          {assignments.error && (
            <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />
          )}

          {assignments.data && relevantAssignments.length === 0 && (
            <EmptyState
              title={t.quizzes.detail.noAssignments}
              description={t.quizzes.detail.noAssignmentsDesc}
            />
          )}

          {relevantAssignments.length > 0 && (
            <DataTable
              rows={relevantAssignments}
              rowKey={(assignment) => assignment.id}
              columns={[
                {
                  key: 'group',
                  header: t.quizzes.detail.colGroup,
                  primary: true,
                  cell: (assignment) => (
                    <span className="font-medium text-slate-900">
                      {assignment.group_name}
                    </span>
                  ),
                },
                {
                  key: 'mode',
                  header: t.quizzes.detail.colMode,
                  cell: (assignment) => (
                    <Badge tone={assignment.mode === 'exam' ? 'brand' : 'neutral'}>
                      {quizModeLabel(t)[assignment.mode]}
                    </Badge>
                  ),
                },
                {
                  key: 'deadline',
                  header: t.quizzes.detail.colDeadline,
                  cell: (assignment) => (
                    <span className="text-slate-500">
                      {assignment.deadline
                        ? formatDateTime(assignment.deadline)
                        : t.quizzes.detail.noDeadline}
                    </span>
                  ),
                },
                {
                  key: 'attempts',
                  header: t.quizzes.detail.colAttempts,
                  cell: (assignment) => (
                    <span className="text-slate-500">
                      {assignment.max_attempts ?? t.quizzes.detail.unlimitedAttempts}
                    </span>
                  ),
                },
                {
                  key: 'scoreRule',
                  header: t.quizzes.detail.colScoreRule,
                  cell: (assignment) =>
                    assignment.mode === 'exam' ? (
                      <span className="text-slate-500">
                        {scoreRuleLabel(t)[assignment.score_rule]}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    ),
                },
                {
                  key: 'actions',
                  align: 'right',
                  footer: true,
                  cell: (assignment) => (
                    <span className="flex flex-wrap justify-end gap-1">
                      {assignment.mode === 'exam' && (
                        <>
                          <Link to={`/quizzes/assignments/${assignment.id}/grading`}>
                            <Button variant="ghost" size="sm">
                              {t.quizzes.detail.gradingBtn}
                            </Button>
                          </Link>
                          <Link to={`/quizzes/assignments/${assignment.id}/results`}>
                            <Button variant="ghost" size="sm">
                              {t.quizzes.detail.resultsBtn}
                            </Button>
                          </Link>
                        </>
                      )}
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(assignment)}
                      >
                        {t.quizzes.detail.deleteAssignmentBtn}
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      {assigning && <AssignModal quizId={id} onClose={() => setAssigning(false)} />}

      {editing && data && (
        <QuizFormModal
          open
          quiz={data}
          onClose={() => setEditing(false)}
          endpoint="/quizzes"
          invalidateKey={['quiz', id]}
        />
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteAssignmentMutation.mutate(deleteTarget.id)}
        loading={deleteAssignmentMutation.isPending}
        destructive
        title={t.quizzes.detail.deleteConfirmTitle}
        message={t.quizzes.detail.deleteConfirmMessage}
        confirmLabel={t.common.delete}
      />

      <ConfirmModal
        open={deleteQuizConfirm}
        onClose={() => setDeleteQuizConfirm(false)}
        onConfirm={() => deleteQuizMutation.mutate()}
        loading={deleteQuizMutation.isPending}
        destructive
        title={t.quizzes.detail.deleteQuizConfirmTitle}
        message={t.quizzes.detail.deleteQuizConfirmMessage}
        confirmLabel={t.common.delete}
      />
    </>
  )
}