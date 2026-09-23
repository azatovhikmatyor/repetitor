/** Shartli class nomlarini birlashtiradi (clsx'ning minimal varianti). */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
