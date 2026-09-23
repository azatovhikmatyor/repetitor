import type {
  AttendanceStatus,
  ChargeStatus,
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
