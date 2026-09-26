import type { ThemeTokens } from './light'

/**
 * "Ayu Mirage" — mashhur muharrir temasi asosida: yumshoq ko'k-kulrang
 * fon (qop-qora emas!) va issiq oltin/apelsin urg'u rang.
 *
 * Avvalgi versiya juda qorong'i edi (fon deyarli qora) — bu yerda fon
 * ayu-mirage'ning haqiqiy `#1f2430` atrofida, kartalar undan sezilarli
 * yorug'roq.
 */
const mirage: ThemeTokens = {
  'slate-50': 'oklch(16% .02 230)',
  white: 'oklch(21% .022 230)',
  'slate-100': 'oklch(26% .024 230)',
  'slate-200': 'oklch(34% .026 229)',
  'slate-300': 'oklch(42% .03 228)',
  'slate-400': 'oklch(55% .028 226)',
  'slate-500': 'oklch(66% .024 224)',
  'slate-600': 'oklch(75% .02 222)',
  'slate-700': 'oklch(83% .015 220)',
  'slate-800': 'oklch(89% .01 218)',
  'slate-900': 'oklch(92% .008 210)',

  // Ayu'ning imzo rangi — oltin/apelsin. 600 (tugma foni) oq matn bilan
  // yetarli kontrast uchun ataylab quyuqroq, 700+ esa matn/havola uchun
  // yorqinroq (haqiqiy ayu oltin rangiga yaqin).
  'brand-50': 'oklch(20% .05 58)',
  'brand-100': 'oklch(26% .07 58)',
  'brand-200': 'oklch(33% .1 57)',
  'brand-300': 'oklch(40% .13 56)',
  'brand-400': 'oklch(44% .15 55)',
  'brand-500': 'oklch(46% .16 54)',
  'brand-600': 'oklch(48% .17 52)',
  'brand-700': 'oklch(62% .17 58)',
  'brand-800': 'oklch(75% .13 62)',
  'brand-900': 'oklch(85% .09 66)',

  paid: 'oklch(66% .17 150)',
  partial: 'oklch(73% .15 80)',
  unpaid: 'oklch(70% .21 25)',
}

export default mirage
