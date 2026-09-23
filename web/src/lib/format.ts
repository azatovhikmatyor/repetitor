/**
 * Son, pul va sana formati.
 *
 * Backend hech qachon formatlangan matn qaytarmaydi — barcha summa butun
 * son (so'm, tiyinsiz) bo'lib keladi va shu yerda ko'rinishga aylanadi.
 */

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
] as const

//: Qisqartmalar qo'lda: "Iyun" va "Iyul" ning birinchi uch harfi bir xil.
const MONTHS_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
  'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
] as const

/** `500000` -> `500 000` (uzilmaydigan probel bilan) */
export function money(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const digits = Math.abs(Math.trunc(amount)).toString()
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '\u00a0'
    out += digits[i]
  }
  return sign + out
}

/** `500000` -> `500 000 so'm` */
export function soum(amount: number): string {
  return `${money(amount)} so\u2018m`
}

/** `2725000` -> `2,7 mln` — grafik va tor ustunlar uchun */
export function compact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000
    const text = millions.toFixed(Math.abs(millions) >= 10 ? 0 : 1).replace('.', ',')
    return `${text} mln`
  }
  if (Math.abs(amount) >= 1000) return `${Math.round(amount / 1000)} ming`
  return money(amount)
}

export function percent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? String(month)
}

/** `6` -> `Iyn` — grafik o'qlari uchun. */
export function monthShort(month: number): string {
  return MONTHS_SHORT[month - 1] ?? String(month)
}

/** `2026-09-21` — API kutgan sana formati (mahalliy vaqt bo'yicha) */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `21 Sentabr` */
export function dayMonth(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getDate()} ${monthName(date.getMonth() + 1)}`
}

export function initials(fullName: string): string {
  const trimmed = fullName.trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}

const WEEKDAYS = [
  'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba',
  'Payshanba', 'Juma', 'Shanba',
] as const

/** `23-sentabr, chorshanba` — native sana maydoni yonidagi tushunarli yozuv. */
export function longDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const month = monthName(date.getMonth() + 1).toLowerCase()
  const weekday = WEEKDAYS[date.getDay()].toLowerCase()
  return `${date.getDate()}-${month}, ${weekday}`
}
