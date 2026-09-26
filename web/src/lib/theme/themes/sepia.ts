import type { ThemeTokens } from './light'

/**
 * "Sepiya" — issiq, qog'ozsimon yorug' tema (ko'zga yengil), amber/tuproq
 * rangli urg'u — boshqa temalardagi yashildan ataylab farq qilsin.
 */
const sepia: ThemeTokens = {
  'slate-50': 'oklch(96% .015 80)',
  'slate-100': 'oklch(93% .02 75)',
  'slate-200': 'oklch(87% .03 70)',
  'slate-300': 'oklch(80% .035 65)',
  'slate-400': 'oklch(65% .04 60)',
  'slate-500': 'oklch(52% .045 55)',
  'slate-600': 'oklch(42% .04 50)',
  'slate-700': 'oklch(34% .035 45)',
  'slate-800': 'oklch(26% .03 40)',
  'slate-900': 'oklch(18% .025 35)',
  white: 'oklch(99% .008 85)',

  'brand-50': 'oklch(96% .03 55)',
  'brand-100': 'oklch(90% .07 50)',
  'brand-200': 'oklch(81% .11 48)',
  'brand-300': 'oklch(70% .15 45)',
  'brand-400': 'oklch(60% .17 42)',
  'brand-500': 'oklch(52% .17 40)',
  'brand-600': 'oklch(45% .16 38)',
  'brand-700': 'oklch(38% .14 36)',
  'brand-800': 'oklch(31% .11 35)',
  'brand-900': 'oklch(25% .08 34)',

  paid: 'oklch(50% .13 140)',
  partial: 'oklch(60% .12 70)',
  unpaid: 'oklch(52% .18 30)',
}

export default sepia
