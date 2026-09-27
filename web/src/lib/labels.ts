import type { Dictionary } from './i18n'
import type {
  AttendanceStatus,
  AttemptStatus,
  ChargeStatus,
  ExpenseCategory,
  PaymentMethod,
  QuestionType,
  QuizMode,
  ScoreRule,
} from './api/types'

/**
 * Enum qiymatlarining ko'p tildagi nomlari va ranglari.
 *
 * Matnlarning o'zi `t.enums` da (`lib/i18n/dictionaries`) — bu yerda
 * faqat backend enum'iga bog'liq bo'lgan, tilga bog'liq bo'lmagan
 * narsalar: ranglar va tanlov ro'yxatlari.
 */

export function attendanceLabel(t: Dictionary): Record<AttendanceStatus, string> {
  return t.enums.attendanceStatus
}

export function chargeLabel(t: Dictionary): Record<ChargeStatus, string> {
  return t.enums.chargeStatus
}

export function methodLabel(t: Dictionary): Record<PaymentMethod, string> {
  return t.enums.paymentMethod
}

export function expenseCategoryLabel(t: Dictionary): Record<ExpenseCategory, string> {
  return t.enums.expenseCategory
}

export function expenseCategoryOptions(
  t: Dictionary,
): { value: ExpenseCategory; label: string }[] {
  return Object.entries(t.enums.expenseCategory).map(([value, label]) => ({
    value: value as ExpenseCategory,
    label,
  }))
}

export function methodOptions(t: Dictionary): { value: PaymentMethod; label: string }[] {
  return Object.entries(t.enums.paymentMethod).map(([value, label]) => ({
    value: value as PaymentMethod,
    label,
  }))
}

/** Holat -> Badge rangi (`components/ui/badge.tsx` dagi variantlar). */
export const chargeTone: Record<ChargeStatus, 'paid' | 'partial' | 'unpaid'> = {
  paid: 'paid',
  overpaid: 'paid',
  partial: 'partial',
  unpaid: 'unpaid',
}

/**
 * Hisob holati — bepul o'quvchini hisobga olib.
 *
 * Server uchun 0 so'mlik hisob "to'langan", lekin o'qituvchi uchun bu
 * "bepul o'qiydi" degani: "To'langan" deb yozilsa chalg'itadi.
 */
export function chargeStateLabel(
  t: Dictionary,
  status: ChargeStatus,
  amountDue: number,
): string {
  return amountDue === 0 ? t.enums.freeLabel : t.enums.chargeStatus[status]
}

export function chargeStateTone(
  status: ChargeStatus,
  amountDue: number,
): 'paid' | 'partial' | 'unpaid' | 'brand' {
  return amountDue === 0 ? 'brand' : chargeTone[status]
}

export function questionTypeLabel(t: Dictionary): Record<QuestionType, string> {
  return t.enums.questionType
}

export function questionTypeOptions(
  t: Dictionary,
): { value: QuestionType; label: string }[] {
  return Object.entries(t.enums.questionType).map(([value, label]) => ({
    value: value as QuestionType,
    label,
  }))
}

export function quizModeLabel(t: Dictionary): Record<QuizMode, string> {
  return t.enums.quizMode
}

export function scoreRuleLabel(t: Dictionary): Record<ScoreRule, string> {
  return t.enums.scoreRule
}

export function scoreRuleOptions(t: Dictionary): { value: ScoreRule; label: string }[] {
  return Object.entries(t.enums.scoreRule).map(([value, label]) => ({
    value: value as ScoreRule,
    label,
  }))
}

export function attemptStatusLabel(t: Dictionary): Record<AttemptStatus, string> {
  return t.enums.attemptStatus
}

export const attemptStatusTone: Record<AttemptStatus, 'neutral' | 'partial' | 'paid'> = {
  in_progress: 'neutral',
  submitted: 'partial',
  graded: 'paid',
}
