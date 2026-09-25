/**
 * "Yorug'" — standart tema, asosiy (reference) rang to'plami.
 *
 * Boshqa barcha temalar shu faylning tipini (`ThemeTokens`) to'liq
 * qanoatlantirishi shart — bitta kalit tushib qolsa TypeScript xato
 * beradi. Har bir kalit `src/index.css` dagi `--color-*` o'zgaruvchisiga
 * mos keladi va runtime'da shu qiymat bilan almashtiriladi.
 */
const light = {
  'slate-50': 'oklch(98.4% .003 247.858)',
  'slate-100': 'oklch(96.8% .007 247.896)',
  'slate-200': 'oklch(92.9% .013 255.508)',
  'slate-300': 'oklch(86.9% .022 252.894)',
  'slate-400': 'oklch(70.4% .04 256.788)',
  'slate-500': 'oklch(55.4% .046 257.417)',
  'slate-600': 'oklch(44.6% .043 257.281)',
  'slate-700': 'oklch(37.2% .044 257.287)',
  'slate-800': 'oklch(27.9% .041 260.031)',
  'slate-900': 'oklch(20.8% .042 265.755)',
  white: 'oklch(100% 0 0)',

  'brand-50': 'oklch(97% .02 160)',
  'brand-100': 'oklch(93% .05 160)',
  'brand-200': 'oklch(86% .08 160)',
  'brand-300': 'oklch(76% .11 160)',
  'brand-400': 'oklch(65% .13 160)',
  'brand-500': 'oklch(55% .13 160)',
  'brand-600': 'oklch(47% .12 160)',
  'brand-700': 'oklch(39% .1 160)',
  'brand-800': 'oklch(32% .08 160)',
  'brand-900': 'oklch(26% .06 160)',

  paid: 'oklch(55% .14 150)',
  partial: 'oklch(65% .13 80)',
  unpaid: 'oklch(55% .19 25)',
}

export default light
export type ThemeTokens = typeof light
