import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { ErrorState, Loading } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/cn'
import { qk } from '@/lib/api/queries'
import type { Quiz, QuestionType } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { useDebounced } from '@/lib/use-debounced'
import { questionTypeOptions } from '@/lib/labels'

import {
  blankFields,
  newOption,
  newQuestion,
  newSection,
  quizToFields,
  type FormFields,
  type QuestionDraft,
  type SectionDraft,
} from './quiz-draft'
import { parseQuizJson } from './quiz-json'

/** Ro'yxatda bitta elementni boshqa o'ringa ko'chiradi (drag-and-drop uchun). */
function moveItem<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

// --------------------------------------------------------- qoralama (draft)

/**
 * Uzoq testlar (masalan 100 ta savol) yozish daqiqalar oladi — tasodifan
 * boshqa sahifaga o'tib yoki oynani yopib qo'ysa hammasi qaytadan
 * yozilmasligi kerak. Shu sababli har o'zgarishda `localStorage`ga
 * saqlanadi va sahifa qayta ochilganda avtomatik tiklanadi.
 */
function draftKey(endpoint: string, quizId?: number): string {
  return `quiz-draft:${endpoint}:${quizId ?? 'new'}`
}

function loadDraft(key: string): FormFields | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as FormFields) : null
  } catch {
    return null
  }
}

function saveDraft(key: string, fields: FormFields) {
  try {
    localStorage.setItem(key, JSON.stringify(fields))
  } catch {
    // Xotira to'lgan yoki xususiy rejim — qoralamasiz davom etamiz.
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ...
  }
}

/**
 * Test yaratish/tahrirlash sahifasi — bo'lim va savollar bilan.
 *
 * Alohida sahifa (modal emas): 100 ta savolli test yozilganda uzoq
 * scroll bo'ladi, modalning o'zi ekranni tor qilib qo'yardi. URL'da
 * `quizId` bo'lsa — tahrirlash (mavjud test yuklanadi, PUT yuboriladi),
 * bo'lmasa — yangi test (POST). `endpoint` orqali ham o'qituvchining o'z
 * testi (`/quizzes`), ham admin katalog testi (`/admin/quizzes`) ishlaydi.
 */
export function QuizFormPage({ endpoint }: { endpoint: '/quizzes' | '/admin/quizzes' }) {
  const { quizId } = useParams()
  const id = quizId ? Number(quizId) : undefined
  const isEdit = id !== undefined
  const key = draftKey(endpoint, id)

  const navigate = useNavigate()
  const toast = useToast()
  const t = useT()
  const queryClient = useQueryClient()

  const existing = useQuery<Quiz>({
    queryKey: endpoint === '/admin/quizzes' ? qk.adminQuiz(id ?? 0) : qk.quiz(id ?? 0),
    queryFn: ({ signal }) => api.get<Quiz>(`${endpoint}/${id}`, undefined, signal),
    enabled: isEdit,
  })

  const [fields, setFields] = useState<FormFields>(blankFields)
  const [hydrated, setHydrated] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Drag-and-drop bilan qayta tartiblash uchun — faqat qaysi element
  // "ko'tarilganini" bilib turadi, qolgan mantiq drop bo'lganda ishlaydi.
  const [draggedSection, setDraggedSection] = useState<number | null>(null)
  const [draggedQuestion, setDraggedQuestion] = useState<
    { section: number; index: number } | null
  >(null)

  // Boshlang'ich to'ldirish: avval qoralama, bo'lmasa serverdagi (edit) yoki bo'sh forma.
  useEffect(() => {
    if (isEdit && !existing.data) return
    const draft = loadDraft(key)
    if (draft) {
      setFields(draft)
      setDraftRestored(true)
    } else if (existing.data) {
      setFields(quizToFields(existing.data))
    } else {
      setFields(blankFields())
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, existing.data, key])

  // Har o'zgarishdan keyin (kechiktirib) qoralamani saqlaymiz.
  const debouncedFields = useDebounced(fields, 400)
  useEffect(() => {
    if (!hydrated) return
    saveDraft(key, debouncedFields)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFields, hydrated, key])

  function discardDraft() {
    clearDraft(key)
    setFields(existing.data ? quizToFields(existing.data) : blankFields())
    setDraftRestored(false)
  }

  function updateSection(index: number, patch: Partial<SectionDraft>) {
    setFields((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    }))
  }

  function updateQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<QuestionDraft>,
  ) {
    setFields((prev) => ({
      ...prev,
      sections: prev.sections.map((section, si) =>
        si !== sectionIndex
          ? section
          : {
              ...section,
              questions: section.questions.map((question, qi) =>
                qi === questionIndex ? { ...question, ...patch } : question,
              ),
            },
      ),
    }))
  }

  /** `afterIndex` bo'lmasa oxiriga, bo'lsa shu o'rindan keyin qo'shadi. */
  function addSection(afterIndex?: number) {
    setFields((prev) => {
      const at = afterIndex === undefined ? prev.sections.length : afterIndex + 1
      return {
        ...prev,
        sections: [...prev.sections.slice(0, at), newSection(), ...prev.sections.slice(at)],
      }
    })
  }

  function removeSection(index: number) {
    setFields((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== index) }))
  }

  function moveSection(from: number, to: number) {
    setFields((prev) => ({ ...prev, sections: moveItem(prev.sections, from, to) }))
  }

  function addQuestion(sectionIndex: number, afterIndex?: number) {
    const current = fields.sections[sectionIndex].questions
    const at = afterIndex === undefined ? current.length : afterIndex + 1
    updateSection(sectionIndex, {
      questions: [...current.slice(0, at), newQuestion(), ...current.slice(at)],
    })
  }

  function moveQuestion(sectionIndex: number, from: number, to: number) {
    updateSection(sectionIndex, {
      questions: moveItem(fields.sections[sectionIndex].questions, from, to),
    })
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    updateSection(sectionIndex, {
      questions: fields.sections[sectionIndex].questions.filter((_, i) => i !== questionIndex),
    })
  }

  function addOption(sectionIndex: number, questionIndex: number) {
    const question = fields.sections[sectionIndex].questions[questionIndex]
    updateQuestion(sectionIndex, questionIndex, {
      options: [...question.options, newOption()],
    })
  }

  function removeOption(sectionIndex: number, questionIndex: number, optionId: string) {
    const question = fields.sections[sectionIndex].questions[questionIndex]
    updateQuestion(sectionIndex, questionIndex, {
      options: question.options.filter((o) => o.id !== optionId),
      correctSingle: question.correctSingle === optionId ? '' : question.correctSingle,
      correctMulti: question.correctMulti.filter((id) => id !== optionId),
    })
  }

  const importInputRef = useRef<HTMLInputElement>(null)

  async function handleImportFile(file: File | undefined) {
    if (!file) return
    try {
      const text = await file.text()
      const imported = parseQuizJson(text)
      setFields(imported)
      setDraftRestored(false)
      toast.success(t.quizzes.form.importedToast)
    } catch (importError) {
      toast.error(importError)
    }
  }

  const backTo = isEdit ? `/quizzes/${id}` : endpoint === '/admin/quizzes' ? '/admin/quizzes' : '/quizzes'
  const backLabel = isEdit
    ? t.quizzes.detail.backLabel
    : endpoint === '/admin/quizzes'
      ? t.nav.quizCatalog
      : t.quizzes.title

  const mutation = useMutation({
    mutationFn: async () => {
      const { subject, title, description, timeLimit, sections } = fields
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
        return api.put<Quiz>(`${endpoint}/${id}`, body)
      }
      return api.post<Quiz>(endpoint, body)
    },
    onSuccess: async (saved) => {
      clearDraft(key)
      const invalidateKey = endpoint === '/admin/quizzes' ? ['admin', 'quizzes'] : ['quizzes']
      await queryClient.invalidateQueries({ queryKey: invalidateKey })
      if (isEdit) {
        await queryClient.invalidateQueries({
          queryKey: endpoint === '/admin/quizzes' ? ['admin', 'quiz', id] : ['quiz', id],
        })
      }
      toast.success(isEdit ? t.quizzes.form.updatedToast : t.quizzes.form.createdToast)
      navigate(endpoint === '/admin/quizzes' ? '/admin/quizzes' : `/quizzes/${saved.id}`)
    },
    onError: (mutationError) => {
      if (mutationError instanceof Error) setError(mutationError.message)
      toast.error(mutationError)
    },
  })

  if (isEdit && existing.isPending) return <Loading rows={6} />
  if (isEdit && existing.error) {
    return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
  }

  return (
    <>
      <PageHeader
        title={isEdit ? t.quizzes.form.editTitle : t.quizzes.form.newTitle}
        back={{ to: backTo, label: backLabel }}
        actions={
          // JSON eksport/import faqat owner (Super Admin) uchun — o'qituvchi
          // o'z testini yaratganda bu tugmalar ko'rinmaydi.
          endpoint === '/admin/quizzes' ? (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  void handleImportFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <Button variant="secondary" onClick={() => importInputRef.current?.click()}>
                {t.quizzes.form.importJsonBtn}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="space-y-5 pb-24">
        {draftRestored && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-partial/10 px-4 py-3 text-sm text-slate-700">
            <span>{t.quizzes.form.draftRestoredNotice}</span>
            <Button variant="ghost" size="sm" onClick={discardDraft}>
              {t.quizzes.form.discardDraftBtn}
            </Button>
          </div>
        )}

        <Card>
          <CardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t.quizzes.form.subjectLabel}
                placeholder={t.quizzes.form.subjectPlaceholder}
                value={fields.subject}
                onChange={(event) => setFields({ ...fields, subject: event.target.value })}
                autoFocus
              />
              <Input
                label={t.quizzes.form.titleLabel}
                placeholder={t.quizzes.form.titlePlaceholder}
                value={fields.title}
                onChange={(event) => setFields({ ...fields, title: event.target.value })}
              />
            </div>

            <Textarea
              label={t.quizzes.form.descLabel}
              value={fields.description}
              onChange={(value) => setFields({ ...fields, description: value })}
            />

            <Input
              label={t.quizzes.form.timeLimitLabel}
              hint={t.quizzes.form.timeLimitHint}
              type="number"
              min={1}
              value={fields.timeLimit}
              onChange={(event) =>
                setFields({ ...fields, timeLimit: event.target.value.replace(/\D/g, '') })
              }
              className="max-w-40"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.quizzes.form.sectionsTitle} />
          <CardBody className="space-y-3">
            {fields.sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <div
                  onDragOver={(event: DragEvent) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedSection !== null && draggedSection !== sectionIndex) {
                      moveSection(draggedSection, sectionIndex)
                    }
                    setDraggedSection(null)
                  }}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border border-slate-200 p-3',
                    draggedSection === sectionIndex && 'opacity-40',
                  )}
                >
                  <span
                    draggable
                    onDragStart={() => setDraggedSection(sectionIndex)}
                    onDragEnd={() => setDraggedSection(null)}
                    title={t.quizzes.form.reorderHint}
                    className="mt-6 shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                  >
                    <Icon name="grip" />
                  </span>

                  <div className="flex-1 space-y-3">
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
                      {fields.sections.length > 1 && (
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
                      <p className="text-xs font-medium text-slate-500">
                        {t.quizzes.form.questionsLabel}
                      </p>

                      {section.questions.map((question, questionIndex) => (
                        <div key={questionIndex}>
                          <QuestionEditor
                            question={question}
                            isDragging={
                              draggedQuestion?.section === sectionIndex &&
                              draggedQuestion.index === questionIndex
                            }
                            onDragStart={() =>
                              setDraggedQuestion({ section: sectionIndex, index: questionIndex })
                            }
                            onDragEnd={() => setDraggedQuestion(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                              if (
                                draggedQuestion !== null &&
                                draggedQuestion.section === sectionIndex &&
                                draggedQuestion.index !== questionIndex
                              ) {
                                moveQuestion(sectionIndex, draggedQuestion.index, questionIndex)
                              }
                              setDraggedQuestion(null)
                            }}
                            canRemove={section.questions.length > 1}
                            onChange={(patch) =>
                              updateQuestion(sectionIndex, questionIndex, patch)
                            }
                            onRemove={() => removeQuestion(sectionIndex, questionIndex)}
                            onAddOption={() => addOption(sectionIndex, questionIndex)}
                            onRemoveOption={(optionId) =>
                              removeOption(sectionIndex, questionIndex, optionId)
                            }
                          />
                          {/* Har savoldan keyin — ro'yxat uzun bo'lganda yuqoriga
                              chiqmasdan, xuddi shu yerdan keyingisini qo'shish uchun. */}
                          <div className="flex justify-center pt-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addQuestion(sectionIndex, questionIndex)}
                            >
                              {t.quizzes.form.addQuestion}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Har bo'limdan keyin — xuddi shunday, keyingi bo'limni
                    shu yerdan qo'shish mumkin. */}
                <div className="flex justify-center pt-2">
                  <Button variant="secondary" size="sm" onClick={() => addSection(sectionIndex)}>
                    {t.quizzes.form.addSection}
                  </Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {error && <p className="text-sm text-unpaid">{error}</p>}
      </div>

      {/* Ekran pastida doim ko'rinadi — 100 ta savolli testda ham pastga
          scroll qilish shart emas. */}
      <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-md">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          {t.common.cancel}
        </Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
          {t.common.save}
        </Button>
      </div>
    </>
  )
}

function QuestionEditor({
  question,
  canRemove,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onChange,
  onRemove,
  onAddOption,
  onRemoveOption,
}: {
  question: QuestionDraft
  canRemove: boolean
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent) => void
  onDrop: () => void
  onChange: (patch: Partial<QuestionDraft>) => void
  onRemove: () => void
  onAddOption: () => void
  onRemoveOption: (optionId: string) => void
}) {
  const t = useT()
  const isChoice = question.type === 'single_choice' || question.type === 'multi_choice'

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'flex items-start gap-2 rounded-lg bg-slate-50 p-3',
        isDragging && 'opacity-40',
      )}
    >
      <span
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={t.quizzes.form.reorderHint}
        className="mt-2 shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        <Icon name="grip" />
      </span>

      <div className="flex-1 space-y-3">
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
    </div>
  )
}
