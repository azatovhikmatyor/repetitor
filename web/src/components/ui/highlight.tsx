import type { ReactNode } from 'react'

/**
 * Qidiruv so'ziga mos qismni ajratib ko'rsatadi.
 *
 * Nega kerak: "9" deb qidirilganda natijada nima uchun bu o'quvchi
 * chiqqani ko'rinmaydi — ismidami, telefonidami, maktabidami. Belgilangan
 * qism darrov javob beradi.
 */
export function Highlight({
  text,
  query,
}: {
  text: string | null | undefined
  query: string
}): ReactNode {
  const value = text ?? ''
  const needle = query.trim()
  // Har doim bitta element qaytaramiz: massiv qaytarilsa, flex
  // konteyner ichida har bo'lak alohida element bo'lib, orasiga `gap`
  // tushadi va ism ikkiga bo'lingandek ko'rinadi.
  if (!needle || !value) return <span>{value}</span>

  const parts: ReactNode[] = []
  const haystack = value.toLowerCase()
  const lowered = needle.toLowerCase()

  let index = 0
  let found = haystack.indexOf(lowered)
  while (found !== -1) {
    if (found > index) parts.push(value.slice(index, found))
    parts.push(
      <mark
        key={`${found}-${parts.length}`}
        // Gorizontal padding yo'q: u so'zni ikkiga bo'lib ko'rsatadi
        // ("Rahim ova"). Rang bilan ajratish yetarli.
        className="bg-partial/35 text-inherit"
      >
        {value.slice(found, found + needle.length)}
      </mark>,
    )
    index = found + needle.length
    found = haystack.indexOf(lowered, index)
  }

  if (index < value.length) parts.push(value.slice(index))
  return <span>{parts}</span>
}

/** Matnda qidiruv so'zi bormi — "nega topildi" sababini ko'rsatish uchun. */
export function matches(text: string | null | undefined, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  return (text ?? '').toLowerCase().includes(needle)
}
