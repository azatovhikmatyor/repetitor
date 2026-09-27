import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api/client'
import type { Quiz, QuestionType } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { questionTypeOptions } from '@/lib/labels'

interface OptionDraft {
  id: string
  text: string
}

interface QuestionDraft {
  type: QuestionType
  prompt: string
  points: string
  options: OptionDraft[]
  correctSingle: string
  correctMulti: string[]
  correctText: string
}

interface SectionDraft {
  title: string
  instructions: string
  questions: QuestionDraft[]
}

let nextOptionId = 1

function newOption(): OptionDraft {
  return { id: `opt-${nextOptionId++}`, text: '' }
}

function newQuestion(): QuestionDraft {
  return {
    type: 'single_choice',
    prompt: '',
    points: '1',
    options: [newOption(), newOption()],
    correctSingle: '',
    correctMulti: [],
    correctText: '',
  }
}

function newSection(): SectionDraft {
  return { title: '', instructions: '', questions: [newQuestion()] }
}

/** Backenddan kelgan Quiz ma'lumotini forma draft formatiga o'tkazish. */
function quizToDraft(quiz: Quiz): SectionDraft[] {
  return quiz.sections.map((section) => ({
    title: section.title,
    instructions: section.instructions ?? '',
    questions: section.questions.map((question) => {
      const options = (question.options ?? []).map((o) => ({ id: o.id, text: o.text }))
      const correctAnswer = question.correct_answer
      return {
        type: question.type,
        prompt: question.prompt,
        points: String(question.points),
        options: options.length >= 2 ? options : [newOption(), newOption()],
        correctSingle:
          question.type === 'single_choice' && typeof correctAnswer === 'string'
            ? correctAnswer
            : '',
        correctMulti:
          question.type === 'multi_choice' && Array.isArray(correctAnswer) ? correctAnswer : [],
        correctText:
          question.type === 'text' && typeof correctAnswer === 'string' ? correctAnswer : '',
      }
    }),
  }))
}

/**
 * Test yaratish/tahrirlash oynasi — bo'lim va savollar bilan bitta shaklda.
 *
 * `quiz` berilsa — edit mode: mavjud ma'lumotlar to'ldiriladi va PUT
 * so'rov yuboriladi. `endpoint` orqali ham o'qituvchining o'z testi
 * (`/quizzes`), ham admin katalog testi (`/admin/quizzes`) yaratiladi/tahrirlanadi.
 */
export function QuizFormModal({
  open,
  onClose,
  endpoint,
  invalidateKey,
  quiz,
}: {
  open: boolean
  onClose: () => void
  endpoint: '/quizzes' | '/admin/quizzes'
  invalidateKey: readonly unknown[]
  quiz?: Quiz
}) {
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()

  const [subject, setSubject] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimit, setTimeLimit] = useState('')
  const [sections, setSections] = useState<SectionDraft[]>([newSection()])
  const [error, setError] = useState<string | null>(null)

  const isEdit = quiz !== undefined

  // Edit mode da mavjud ma'lumotlarni to'ldiramiz.
  useEffect(() => {
    if (quiz) {
      setSubject(quiz.subject)
      setTitle(quiz.title)
      setDescription(quiz.description ?? '')
      setTimeLimit(quiz.time_limit_minutes ? String(quiz.time_limit_minutes) : '')
      setSections(quizToDraft(quiz))
    } else {
      setSubject('')
      setTitle('')
      setDescription('')
      setTimeLimit('')
      setSections([newSection()])
    }
    setError(null)
  }, [quiz, open])

  function updateSection(index: number, patch: Partial<SectionDraft>) {
    setSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    )
  }

  function updateQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<QuestionDraft>,
  ) {
    setSections((prev) =>
      prev.map((section, si) =>
        si !== sectionIndex
          ? section
          : {
              ...section,
              questions: section.questions.map((question, qi) =>
                qi === questionIndex ? { ...question, ...patch } : question,
              ),
            },
      ),
    )
  }

  function addSection() {
    setSections((prev) => [...prev, newSection()])
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index))
  }

  function addQuestion(sectionIndex: number) {
    updateSection(sectionIndex, {
      questions: [...sections[sectionIndex].questions, newQuestion()],
    })
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    updateSection(sectionIndex, {
      questions: sections[sectionIndex].questions.filter((_, i) => i !== questionIndex),
    })
  }

  function addOption(sectionIndex: number, questionIndex: number) {
    const question = sections[sectionIndex].questions[questionIndex]
    updateQuestion(sectionIndex, questionIndex, {
      options: [...question.options, newOption()],
    })
  }

  function removeOption(sectionIndex: number, questionIndex: number, optionId: string) {
    const question = sections[sectionIndex].questions[questionIndex]
    updateQuestion(sectionIndex, questionIndex, {
      options: question.options.filter((o) => o.id !== optionId),
      correctSingle: question.correctSingle === optionId ? '' : question.correctSingle,
      correctMulti: question.correctMulti.filter((id) => id !== optionId),
    })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      for (const section of sections) {
        if (!section.title.trim()) throw new Error(t.quizzes.form.needSection)
        for (const question of section.questions) {
          if (!question.prompt.trim()) throw new Error(t.quizzes.form.needQuestion)
          if (question.type === 'single_choice' || question.type === 'multi_choice') {
            const filled = question.options.filter((o) => o.text.trim())
            if (filled.length < 2) throw new Error(t.quizzes.form.needOptions)
            const hasCorrect =
              question.type === 'single_choice'
                ? Boolean(question.correctSingle)
                : question.correctMulti.length > 0
            if (!hasCorrect) throw new Error(t.quizzes.form.needCorrectAnswer)
          }
          if (question.type === 'text' && !question.correctText.trim()) {
            throw new Error(t.quizzes.form.needCorrectAnswer)
          }
        }
      }

      const body = {
        subject: subject.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        time_limit_minutes: timeLimit ? Number(timeLimit) : undefined,
        sections: sections.map((section) => ({
          title: section.title.trim(),
          instructions: section.instructions.trim() || undefined,
          questions: section.questions.map((question) => ({
            type: question.type,
            prompt: question.prompt.trim(),
            points: Number(question.points || 1),
            options:
              question.type === 'single_choice' || question.type === 'multi_choice'
                ? question.options
                    .filter((o) => o.text.trim())
                    .map((o) => ({ id: o.id, text: o.text.trim() }))
                : undefined,
            correct_answer:
              question.type === 'single_choice'
                ? question.correctSingle
                : question.type === 'multi_choice'
                  ? question.correctMulti
                  : question.type === 'text'
                    ? question.correctText.trim()
                    : undefined,
          })),
        })),
      }

      if (isEdit) {
        return api.put<Quiz>(`${endpoint}/${quiz!.id}`, body)
      }
      return api.post<Quiz>(endpoint, body)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invalidateKey })
      toast.success(
        isEdit ? t.quizzes.form.updatedToast : t.quizzes.form.createdToast,
      )
      onClose()
    },
    onError: (mutationError) => {
      if (mutationError instanceof ApiError) {
        setError(mutationError.message)
      } else if (mutationError instanceof Error) {
        setError(mutationError.message)
      }
      toast.error(mutationError)
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t.quizzes.form.editTitle : t.quizzes.form.newTitle}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t.quizzes.form.subjectLabel}
            placeholder={t.quizzes.form.subjectPlaceholder}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            autoFocus
          />
          <Input
            label={t.quizzes.form.titleLabel}
            placeholder={t.quizzes.form.titlePlaceholder}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <Textarea
          label={t.quizzes.form.descLabel}
          value={description}
          onChange={setDescription}
        />

        <Input
          label={t.quizzes.form.timeLimitLabel}
          hint={t.quizzes.form.timeLimitHint}
          type="number"
          min={1}
          value={timeLimit}
          onChange={(event) => setTimeLimit(event.target.value.replace(/\D/g, ''))}
          className="max-w-40"
        />

        <div className="space-y-4 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              {t.quizzes.form.sectionsTitle}
            </h3>
            <Button variant="secondary" size="sm" onClick={addSection}>
              {t.quizzes.form.addSection}
            </Button>
          </div>

          {sections.map((section, sectionIndex) => (
            <div
              key={sectionIndex}
              className="space-y-3 rounded-lg border border-slate-200 p-3"
            >
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    label={t.quizzes.form.sectionTitleLabel}
                    placeholder={t.quizzes.form.sectionTitlePlaceholder}
                    value={section.title}
                    onChange={(event) =>
                      updateSection(sectionIndex, { title: event.target.value })
                    }
                  />
                  <Input
                    label={t.quizzes.form.sectionInstructionsLabel}
                    value={section.instructions}
                    onChange={(event) =>
                      updateSection(sectionIndex, { instructions: event.target.value })
                    }
                  />
                </div>
                {sections.length > 1 && (
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    className="mt-6"
                    onClick={() => removeSection(sectionIndex)}
                  >
                    {t.common.delete}
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">
                    {t.quizzes.form.questionsLabel}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addQuestion(sectionIndex)}
                  >
                    {t.quizzes.form.addQuestion}
                  </Button>
                </div>

                {section.questions.map((question, questionIndex) => (
                  <QuestionEditor
                    key={questionIndex}
                    question={question}
                    canRemove={section.questions.length > 1}
                    onChange={(patch) => updateQuestion(sectionIndex, questionIndex, patch)}
                    onRemove={() => removeQuestion(sectionIndex, questionIndex)}
                    onAddOption={() => addOption(sectionIndex, questionIndex)}
                    onRemoveOption={(optionId) =>
                      removeOption(sectionIndex, questionIndex, optionId)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-unpaid">{error}</p>}
      </div>
    </Modal>
  )
}

function QuestionEditor({
  question,
  canRemove,
  onChange,
  onRemove,
  onAddOption,
  onRemoveOption,
}: {
  question: QuestionDraft
  canRemove: boolean
  onChange: (patch: Partial<QuestionDraft>) => void
  onRemove: () => void
  onAddOption: () => void
  onRemoveOption: (optionId: string) => void
}) {
  const t = useT()
  const isChoice = question.type === 'single_choice' || question.type === 'multi_choice'

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            placeholder={t.quizzes.form.promptPlaceholder}
            value={question.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
          />
          <Input
            type="number"
            min={0.5}
            step={0.5}
            value={question.points}
            onChange={(event) => onChange({ points: event.target.value })}
            suffix={t.quizzes.detail.pointsUnit}
            className="w-28"
          />
        </div>
        {canRemove && (
          <Button variant="danger-ghost" size="sm" onClick={onRemove}>
            {t.common.delete}
          </Button>
        )}
      </div>

      <Select
        label={t.quizzes.form.questionTypeLabel}
        value={question.type}
        onChange={(event) =>
          onChange({
            type: event.target.value as QuestionType,
            correctSingle: '',
            correctMulti: [],
            correctText: '',
          })
        }
        options={questionTypeOptions(t)}
        className="max-w-xs"
      />

      {isChoice && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">{t.quizzes.form.optionsLabel}</p>
          {question.options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
                name={`correct-${option.id}`}
                checked={
                  question.type === 'single_choice'
                    ? question.correctSingle === option.id
                    : question.correctMulti.includes(option.id)
                }
                onChange={(event) => {
                  if (question.type === 'single_choice') {
                    onChange({ correctSingle: option.id })
                  } else {
                    onChange({
                      correctMulti: event.target.checked
                        ? [...question.correctMulti, option.id]
                        : question.correctMulti.filter((id) => id !== option.id),
                    })
                  }
                }}
                className="size-4 text-brand-600"
              />
              <Input
                value={option.text}
                placeholder={t.quizzes.form.optionTextPlaceholder}
                onChange={(event) =>
                  onChange({
                    options: question.options.map((o) =>
                      o.id === option.id ? { ...o, text: event.target.value } : o,
                    ),
                  })
                }
                className="flex-1"
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(option.id)}
                  className="text-xs text-slate-400 hover:text-unpaid"
                >
                  {t.common.delete}
                </button>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={onAddOption}>
            {t.quizzes.form.addOption}
          </Button>
          <p className="text-xs text-slate-500">
            {question.type === 'single_choice'
              ? t.quizzes.form.correctSingleHint
              : t.quizzes.form.correctMultiHint}
          </p>
        </div>
      )}

      {question.type === 'text' && (
        <Input
          label={t.quizzes.form.correctAnswerLabel}
          placeholder={t.quizzes.form.correctTextPlaceholder}
          value={question.correctText}
          onChange={(event) => onChange({ correctText: event.target.value })}
        />
      )}

      {question.type === 'essay' && (
        <p className="text-xs text-slate-500">{t.quizzes.form.essayHint}</p>
      )}
    </div>
  )
}