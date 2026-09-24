/**
 * CSV eksport va chop etish.
 *
 * PDF server tomonda yasalmaydi: brauzerning o'z "Chop etish → PDF"
 * imkoniyati yetarli va u har doim mavjud. CSV esa Excel'da to'g'ridan
 * to'g'ri ochiladi.
 */

/**
 * Excel uchun CSV.
 *
 * Ajratgich — nuqtali vergul: kirill/lotin lokalida Excel vergulni
 * ustun ajratgichi deb qabul qilmaydi. BOM qo'shiladi, aks holda
 * o'zbekcha harflar buzilib ochiladi.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const content = [headers, ...rows]
    .map((row) => row.map(escape).join(';'))
    .join('\r\n')

  const blob = new Blob([`﻿${content}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** Fayl nomi uchun xavfsiz matn: `IELTS ertalabki` → `ielts-ertalabki`. */
export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
