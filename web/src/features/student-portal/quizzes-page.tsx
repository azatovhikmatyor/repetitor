import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Textarea } from '@/components/ui/field'
import { ConfirmModal } from '@/components/ui/modal'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import {
  myQuizAssignmentsQuery,
  myQuizHistoryQuery,
  qk,
  telegramLinkCodeQuery,
} from '@/lib/api/queries'
import type { AttemptResult, AttemptStart, QuestionType, StudentAssignment } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { formatDateTime } from '@/lib/format'
import { attemptStatusLabel, attemptStatusTone, quizModeLabel } from '@/lib/labels'

type Tab = 'assigned' | 'history'

export function MyQuizzesPage() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('assigned')
  const [activeAttempt, setActiveAttempt] = useState<AttemptStart | null>(null)
  const queryClient = useQueryClient()

  const assignments = useQuery({ ...myQuizAssignmentsQuery(), enabled: tab === 'assigned' })
  const history = useQuery({ ...myQuizHistoryQuery(), enabled: tab === 'history' })
  const linkCode = useQuery(telegramLinkCodeQuery())

  if (activeAttempt) {
    return (
      <QuizTakeView
        attempt={activeAttempt}
        onExit={() => setActiveAttempt(null)}
        onSubmitted={async () => {
          setActiveAttempt(null)
          await queryClient.invalidateQueries({ queryKey: qk.myQuizAssignments })
          await queryClient.invalidateQueries({ queryKey: ['me', 'quizzes', 'history'] })
        }}
      />
    )
  }

  return (
    <>
      <PageHeader title={t.quizzes.student.title} />

      {linkCode.data && (
        <Card className="mb-4 border-brand-100 bg-brand-50">
          <CardBody>
            <p className="text-sm font-medium text-slate-800">{t.quizzes.student.telegramTitle}</p>
            <p className="mt-0.5 text-sm text-slate-600">{t.quizzes.student.telegramDesc}</p>
            <p className="mt-2 rounded-lg bg-white px-3 py-2 font-mono text-sm text-brand-700">
              {t.quizzes.student.telegramInstructions(linkCode.data)}
            </p>
          </CardBody>
        </Card>
      )}

      <nav className="mb-4 flex gap-1 border-b border-slate-200" aria-label={t.quizzes.student.title}>
        <TabButton active={tab === 'assigned'} onClick={() => setTab('assigned')}>
          {t.quizzes.student.tabAssigned}
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          {t.quizzes.student.tabHistory}
        </TabButton>
      </nav>

      {tab === 'assigned' && (
        <>
          {assignments.isPending && <Loading rows={4} />}
          {assignments.error && (
            <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />
          )}
          {assignments.data && assignments.data.length === 0 && (
            <Card>
              <EmptyState
                title={t.quizzes.student.noneAssigned}
                description={t.quizzes.student.noneAssignedDesc}
              />
            </Card>
          )}
          {assignments.data && assignments.data.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {assignments.data.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStarted={setActiveAttempt}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {history.isPending && <Loading rows={4} />}
          {history.error && (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          )}
          {history.data && history.data.length === 0 && (
            <Card>
              <EmptyState title={t.quizzes.student.noneHistory} />
            </Card>
          )}
          {history.data && history.data.length > 0 && (
            <Card>
              <DataTable
                rows={history.data}
                rowKey={(entry) => entry.attempt_id}
                columns={[
                  {
                    key: 'quiz',
                    header: t.quizzes.student.colQuiz,
                    primary: true,
                    cell: (entry) => (
                      <span className="font-medium text-slate-900">{entry.quiz_title}</span>
                    ),
                  },
                  {
                    key: 'mode',
                    header: t.quizzes.student.colMode,
                    cell: (entry) => (
                      <Badge tone={entry.mode === 'exam' ? 'brand' : 'neutral'}>
                        {quizModeLabel(t)[entry.mode]}
                      </Badge>
                    ),
                  },
                  {
                    key: 'attempt',
                    header: t.quizzes.student.colAttempt,
                    cell: (entry) => <span className="text-slate-500">#{entry.attempt_no}</span>,
                  },
                  {
                    key: 'score',
                    header: t.quizzes.student.colScore,
                    align: 'right',
                    cell: (entry) =>
                      entry.total_score !== null ? (
                        <span className="tabular font-medium">
                          {entry.total_score} / {entry.max_score}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      ),
                  },
                  {
                    key: 'status',
                    header: t.quizzes.student.colStatus,
                    cell: (entry) => (
                      <Badge tone={attemptStatusTone[entry.status]}>
                        {attemptStatusLabel(t)[entry.status]}
                      </Badge>
                    ),
                  },
                  {
                    key: 'date',
                    header: t.quizzes.student.colDate,
                    cell: (entry) => (
                      <span className="text-slate-500">
                        {entry.submitted_at ? formatDateTime(entry.submitted_at) : '—'}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          )}
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

function AssignmentCard({
  assignment,
  onStarted,
}: {
  assignment: StudentAssignment
  onStarted: (attempt: AttemptStart) => void
}) {
  const t = useT()
  const toast = useToast()

  const deadlinePassed =
    assignment.mode === 'exam' &&
    assignment.deadline !== null &&
    new Date(assignment.deadline) < new Date()
  const attemptsExhausted =
    assignment.max_attempts !== null && assignment.attempts_used >= assignment.max_attempts
  const blocked = deadlinePassed || attemptsExhausted

  const startMutation = useMutation({
    mutationFn: () =>
      api.post<AttemptStart>(
        `/students/me/quizzes/assignments/${assignment.id}/start`,
      ),
    onSuccess: onStarted,
    onError: (error) => toast.error(error),
  })

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{assignment.quiz_title}</h3>
        <Badge tone={assignment.mode === 'exam' ? 'brand' : 'neutral'}>
          {assignment.mode === 'exam' ? t.quizzes.student.examBadge : t.quizzes.student.practiceBadge}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        {assignment.deadline
          ? t.quizzes.student.deadlineLabel(formatDateTime(assignment.deadline))
          : t.quizzes.student.noDeadline}
      </p>
      <p className="mt-0.5 text-sm text-slate-500">
        {assignment.max_attempts !== null
          ? t.quizzes.student.attemptsLabel(assignment.attempts_used, assignment.max_attempts)
          : t.quizzes.student.attemptsUnlimited(assignment.attempts_used)}
      </p>

      <Button
        className="mt-4 w-full"
        disabled={blocked}
        loading={startMutation.isPending}
        onClick={() => startMutation.mutate()}
      >
        {deadlinePassed
          ? t.quizzes.student.deadlinePassed
          : attemptsExhausted
            ? t.quizzes.student.attemptsExhausted
            : t.quizzes.student.startBtn}
      </Button>
    </Card>
  )
}

function QuizTakeView({
  attempt,
  onExit,
  onSubmitted,
}: {
  attempt: AttemptStart
  onExit: () => void
  onSubmitted: () => void
}) {
  const t = useT()
  const toast = useToast()
  const [answers, setAnswers] = useState<Record<number, unknown>>({})
  const [confirmExit, setConfirmExit] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [result, setResult] = useState<AttemptResult | null>(null)

  const allQuestions = attempt.quiz.sections.flatMap((section) => section.questions)
  const answeredCount = allQuestions.filter((q) => isAnswered(answers[q.id])).length

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<AttemptResult>(
        `/students/me/quizzes/attempts/${attempt.attempt_id}/submit`,
        { answers },
      ),
    onSuccess: (data) => {
      setResult(data)
      toast.success(t.quizzes.student.take.submittedToast)
    },
    onError: (error) => toast.error(error),
  })

  if (result) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          {t.quizzes.student.take.resultTitle}
        </h2>
        {result.total_score !== null ? (
          <p className="mt-3 text-3xl font-semibold text-brand-600">
            {t.quizzes.student.take.totalScoreLabel(
              String(result.total_score),
              String(result.max_score),
            )}
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t.quizzes.student.take.pendingManualNotice}</p>
        )}
        {result.pending_manual_grading && result.total_score !== null && (
          <p className="mt-2 text-sm text-slate-500">{t.quizzes.student.take.pendingManualNotice}</p>
        )}
        <Button className="mt-5" onClick={onSubmitted}>
          {t.quizzes.student.take.backToList}
        </Button>
      </Card>
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="font-semibold text-slate-900">{attempt.quiz.title}</h1>
          <p className="text-sm text-slate-500">
            {t.quizzes.student.take.answeredCount(answeredCount, allQuestions.length)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirmExit(true)}>
            {t.quizzes.student.take.exitBtn}
          </Button>
          <Button size="sm" onClick={() => setConfirmSubmit(true)}>
            {t.quizzes.student.take.submitBtn}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {attempt.quiz.sections.map((section) => (
          <Card key={section.id}>
            <CardHeader title={section.title} description={section.instructions ?? undefined} />
            <CardBody className="space-y-4">
              {section.questions.map((question, index) => (
                <div key={question.id} className="rounded-lg bg-slate-50 p-4">
                  <p className="font-medium text-slate-800">
                    {index + 1}. {question.prompt}
                  </p>
                  <div className="mt-2">
                    <AnswerInput
                      type={question.type}
                      options={question.options}
                      value={answers[question.id]}
                      onChange={(value) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: value }))
                      }
                    />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => setConfirmSubmit(true)}>{t.quizzes.student.take.submitBtn}</Button>
      </div>

      <ConfirmModal
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        onConfirm={onExit}
        destructive
        title={t.quizzes.student.take.exitConfirmTitle}
        message={t.quizzes.student.take.exitConfirmMessage}
        confirmLabel={t.quizzes.student.take.exitBtn}
      />
      <ConfirmModal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => {
          setConfirmSubmit(false)
          submitMutation.mutate()
        }}
        loading={submitMutation.isPending}
        title={t.quizzes.student.take.submitConfirmTitle}
        message={t.quizzes.student.take.submitConfirmMessage}
        confirmLabel={t.quizzes.student.take.submitBtn}
      />
    </>
  )
}

function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function AnswerInput({
  type,
  options,
  value,
  onChange,
}: {
  type: QuestionType
  options: { id: string; text: string }[] | null
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (type === 'single_choice' && options) {
    return (
      <div className="space-y-1.5">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="text-brand-600"
            />
            {option.text}
          </label>
        ))}
      </div>
    )
  }

  if (type === 'multi_choice' && options) {
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="space-y-1.5">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
              className="text-brand-600"
            />
            {option.text}
          </label>
        ))}
      </div>
    )
  }

  if (type === 'text') {
    return (
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    )
  }

  return (
    <Textarea
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      rows={4}
    />
  )
}
