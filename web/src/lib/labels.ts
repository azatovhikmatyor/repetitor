import type {
  AttendanceStatus,
  ChargeStatus,
  ExpenseCategory,
  PaymentMethod,
} from './api/types'

/**
 * Enum qiymatlarining o'zbekcha nomlari va ranglari.
 *
 * Interfeys matnlari komponentlarda yozilgan (JSX'da o'qish oson), bu yerda
 * esa faqat backend enum'lariga bog'liq bo'lgan tarjimalar — ular bir necha
 * ekranda takrorlanadi.
 */

export const attendanceLabel: Record<AttendanceStatus, string> = {
  present: 'Bor',
  absent: "Yo'q",
  late: 'Kech',
  excused: 'Sababli',
}

export const chargeLabel: Record<ChargeStatus, string> = {
  unpaid: "To'lanmagan",
  partial: 'Qisman',
  paid: "To'langan",
  overpaid: 'Ortiqcha',
}

export const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Naqd',
  card: 'Karta',
  transfer: "O'tkazma",
  other: 'Boshqa',
}

export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  rent: 'Ijara',
  salary: 'Maosh',
  utilities: 'Kommunal',
  marketing: 'Reklama',
  supplies: 'Jihoz va materiallar',
  other: 'Boshqa',
}

export const expenseCategoryOptions = Object.entries(expenseCategoryLabel).map(
  ([value, label]) => ({ value: value as ExpenseCategory, label }),
)

export const methodOptions = Object.entries(methodLabel).map(([value, label]) => ({
  value: value as PaymentMethod,
  label,
}))

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
export function chargeStateLabel(status: ChargeStatus, amountDue: number): string {
  return amountDue === 0 ? 'Bepul' : chargeLabel[status]
}

export function chargeStateTone(
  status: ChargeStatus,
  amountDue: number,
): 'paid' | 'partial' | 'unpaid' | 'brand' {
  return amountDue === 0 ? 'brand' : chargeTone[status]
}
