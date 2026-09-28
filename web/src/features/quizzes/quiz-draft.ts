import type { Quiz, QuestionType } from '@/lib/api/types'

/**
 * Test yaratish/tahrirlash formasining ichki holati — bo'lim/savol
 * darajasida hali serverga yuborilmagan qoralama.
 *
 * `quiz-form-page.tsx` (forma) va `quiz-json.ts` (JSON eksport/import)
 * ikkalasi ham shu turlar va yordamchilardan foydalanadi.
 */

export interface OptionDraft {
  id: string
  text: string
}

export interface QuestionDraft {
  type: QuestionType
  prompt: string
  points: string
  options: OptionDraft[]
  correctSingle: string
  correctMulti: string[]
  correctText: string
}

export interface SectionDraft {
  title: string
  instructions: string
  questions: QuestionDraft[]
}

export interface FormFields {
  subject: string
  title: string
  description: string
  timeLimit: string
  sections: SectionDraft[]
}

let nextOptionId = 1

export function newOption(): OptionDraft {
  return { id: `opt-${nextOptionId++}`, text: '' }
}

export function newQuestion(): QuestionDraft {
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

export function newSection(): SectionDraft {
  return { title: '', instructions: '', questions: [newQuestion()] }
}

export function blankFields(): FormFields {
  return { subject: '', title: '', description: '', timeLimit: '', sections: [newSection()] }
}

const QUESTION_TYPES: QuestionType[] = ['single_choice', 'multi_choice', 'text', 'essay']

/**
 * Bitta savolni draft shakliga o'tkazadi — backenddan kelgan (ishonchli)
 * `Quiz` ham, foydalanuvchi yuklagan JSON fayl (ishonchsiz) ham shu orqali
 * o'tadi, shuning uchun maydonlar ehtiyotkorlik bilan tekshiriladi.
 */
export function rawQuestionToDraft(raw: unknown): QuestionDraft {
  if (!raw || typeof raw !== 'object') throw new Error('Savol obyekti emas')
  const q = raw as Record<string, unknown>

  if (typeof q.type !== 'string' || !QUESTION_TYPES.includes(q.type as QuestionType)) {
    throw new Error(`Noto'g'ri savol turi: ${String(q.type)}`)
  }
  const type = q.type as QuestionType
  if (typeof q.prompt !== 'string' || !q.prompt.trim()) {
    throw new Error("Savol matni (prompt) yo'q")
  }

  const rawOptions = Array.isArray(q.options) ? q.options : []
  const options: OptionDraft[] = rawOptions.map((o) => {
    const option = (o ?? {}) as Record<string, unknown>
    return {
      id: typeof option.id === 'string' && option.id ? option.id : newOption().id,
      text: typeof option.text === 'string' ? option.text : '',
    }
  })

  const correctAnswer = q.correct_answer
  return {
    type,
    prompt: q.prompt,
    points: q.points !== undefined && q.points !== null ? String(q.points) : '1',
    options: options.length >= 2 ? options : [newOption(), newOption()],
    correctSingle: type === 'single_choice' && typeof correctAnswer === 'string' ? correctAnswer : '',
    correctMulti: type === 'multi_choice' && Array.isArray(correctAnswer) ? correctAnswer : [],
    correctText: type === 'text' && typeof correctAnswer === 'string' ? correctAnswer : '',
  }
}

/** Backenddan kelgan `Quiz` ma'lumotini forma draft formatiga o'tkazish. */
export function quizToFields(quiz: Quiz): FormFields {
  return {
    subject: quiz.subject,
    title: quiz.title,
    description: quiz.description ?? '',
    timeLimit: quiz.time_limit_minutes ? String(quiz.time_limit_minutes) : '',
    sections: quiz.sections.map((section) => ({
      title: section.title,
      instructions: section.instructions ?? '',
      questions: section.questions.map(rawQuestionToDraft),
    })),
  }
}
