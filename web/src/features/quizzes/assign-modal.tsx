import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import { groupsQuery } from '@/lib/api/queries'
import type { QuizAssignment, QuizMode, ScoreRule } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { scoreRuleOptions } from '@/lib/labels'

export function AssignModal({ quizId, onClose }: { quizId: number; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const queryClient = useQueryClient()

  const groups = useQuery(groupsQuery())
  const groupOptions = (groups.data?.items ?? []).map((group) => ({
    value: String(group.id),
    label: group.name,
  }))

  const [groupId, setGroupId] = useState('')
  const [mode, setMode] = useState<QuizMode>('practice')
  // Mashq uchun standart holat — cheksiz (bo'sh). Imtihonga o'tilganda
  // majburiy bo'lgani uchun avtomatik "1" qo'yiladi, agar hali kiritilmagan bo'lsa.
  const [maxAttempts, setMaxAttempts] = useState('')
  const [scoreRule, setScoreRule] = useState<ScoreRule>('best')
  const [deadline, setDeadline] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function selectMode(next: QuizMode) {
    setMode(next)
    if (next === 'exam' && !maxAttempts) setMaxAttempts('1')
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post<QuizAssignment>('/quizzes/assignments', {
        quiz_id: quizId,
        group_id: Number(groupId),
        mode,
        max_attempts: maxAttempts ? Number(maxAttempts) : undefined,
        score_rule: scoreRule,
        deadline: mode === 'exam' && deadline ? new Date(deadline).toISOString() : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quiz-assignments'] })
      toast.success(t.quizzes.assign.createdToast)
      onClose()
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fieldErrors)
      toast.error(error)
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={t.quizzes.assign.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!groupId}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t.quizzes.assign.groupLabel}
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          options={[{ value: '', label: t.common.notEntered }, ...groupOptions]}
        />

        <div className="flex gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm has-checked:border-brand-500 has-checked:bg-brand-50">
            <input
              type="radio"
              checked={mode === 'practice'}
              onChange={() => selectMode('practice')}
              className="text-brand-600"
            />
            {t.quizzes.assign.modePractice}
          </label>
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm has-checked:border-brand-500 has-checked:bg-brand-50">
            <input
              type="radio"
              checked={mode === 'exam'}
              onChange={() => selectMode('exam')}
              className="text-brand-600"
            />
            {t.quizzes.assign.modeExam}
          </label>
        </div>

        <Input
          label={t.quizzes.assign.maxAttemptsLabel}
          hint={
            mode === 'exam'
              ? t.quizzes.assign.maxAttemptsHint
              : t.quizzes.assign.maxAttemptsUnlimitedHint
          }
          placeholder={mode === 'practice' ? t.quizzes.detail.unlimitedAttempts : undefined}
          type="number"
          min={1}
          value={maxAttempts}
          error={errors.max_attempts}
          onChange={(event) => setMaxAttempts(event.target.value.replace(/\D/g, ''))}
        />

        {mode === 'exam' && (
          <>
            <Select
              label={t.quizzes.assign.scoreRuleLabel}
              value={scoreRule}
              onChange={(event) => setScoreRule(event.target.value as ScoreRule)}
              options={scoreRuleOptions(t)}
            />
            <Input
              label={t.quizzes.assign.deadlineLabel}
              hint={t.quizzes.assign.deadlineHint}
              type="datetime-local"
              value={deadline}
              error={errors.deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </>
        )}
      </div>
    </Modal>
  )
}
