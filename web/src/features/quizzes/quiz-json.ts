import { saveBlob } from '@/lib/api/client'
import type { Quiz } from '@/lib/api/types'

import { rawQuestionToDraft, type FormFields } from './quiz-draft'

/**
 * Test JSON eksport/import — o'qituvchilar testlarni fayl sifatida
 * almashishi (masalan boshqa kompyuterga ko'chirish yoki zaxira sifatida
 * saqlash) uchun. Shakl aynan `POST /quizzes` kutgan tanaga mos —
 * shuning uchun eksport qilingan fayl backendga to'g'ridan-to'g'ri ham
 * mos keladi, faqat bu yerda avval forma orqali ko'rib chiqish mumkin.
 */
export interface QuizJson {
  subject: string
  title: string
  description: string | null
  time_limit_minutes: number | null
  sections: {
    title: string
    instructions: string | null
    questions: {
      type: string
      prompt: string
      points: number
      options: { id: string; text: string }[] | null
      correct_answer: unknown
    }[]
  }[]
}

export function quizToJson(quiz: Quiz): QuizJson {
  return {
    subject: quiz.subject,
    title: quiz.title,
    description: quiz.description,
    time_limit_minutes: quiz.time_limit_minutes,
    sections: quiz.sections.map((section) => ({
      title: section.title,
      instructions: section.instructions,
      questions: section.questions.map((question) => ({
        type: question.type,
        prompt: question.prompt,
        points: question.points,
        options: question.options,
        correct_answer: question.correct_answer,
      })),
    })),
  }
}

/** Fayl nomi uchun xavfsiz emas belgilarni olib tashlaydi. */
function safeFileName(title: string): string {
  const cleaned = title.trim().replace(/[^\p{L}\p{N} _-]/gu, '').trim()
  return (cleaned || 'test').slice(0, 80)
}

export function downloadQuizJson(quiz: Quiz): void {
  const json = JSON.stringify(quizToJson(quiz), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  saveBlob(blob, `${safeFileName(quiz.title)}.json`)
}

/** Foydalanuvchi yuklagan JSON faylni forma qoralamasiga o'tkazadi. */
export function parseQuizJson(raw: string): FormFields {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
  }
  if (!data || typeof data !== 'object') {
    throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
  }
  const value = data as Record<string, unknown>

  if (typeof value.subject !== 'string' || !value.subject.trim()) {
    throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
  }
  if (typeof value.title !== 'string' || !value.title.trim()) {
    throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
  }
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
  }

  return {
    subject: value.subject,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    timeLimit:
      value.time_limit_minutes !== undefined && value.time_limit_minutes !== null
        ? String(value.time_limit_minutes)
        : '',
    sections: value.sections.map((rawSection) => {
      if (!rawSection || typeof rawSection !== 'object') {
        throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
      }
      const section = rawSection as Record<string, unknown>
      if (typeof section.title !== 'string' || !section.title.trim()) {
        throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
      }
      if (!Array.isArray(section.questions) || section.questions.length === 0) {
        throw new Error("JSON fayl noto'g'ri yoki tuzilishi mos emas")
      }
      return {
        title: section.title,
        instructions: typeof section.instructions === 'string' ? section.instructions : '',
        questions: section.questions.map(rawQuestionToDraft),
      }
    }),
  }
}
