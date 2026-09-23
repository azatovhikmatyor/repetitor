/** (yil, oy) juftligi bilan ishlash — to'lov va hisobot ekranlarida. */
export interface Period {
  year: number
  month: number
}

export function currentPeriod(): Period {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function shiftPeriod({ year, month }: Period, delta: number): Period {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function isAfter(a: Period, b: Period): boolean {
  return a.year > b.year || (a.year === b.year && a.month > b.month)
}

export function periodKey({ year, month }: Period): string {
  return `${year}-${String(month).padStart(2, '0')}`
}
