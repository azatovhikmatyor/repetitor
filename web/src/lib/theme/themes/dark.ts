import type { ThemeTokens } from './light'

/**
 * "Qorong'i" — neytral ko'k-kulrang fon, binafsha urg'u.
 *
 * Har bir qadam orasida kamida 6-8% yorug'lik farqi qoldirilgan
 * ("white" — karta foni — bilan "slate-200" — chegara — orasida ham),
 * aks holda chegaralar/inputlar foni bilan qo'shilib, ko'rinmay qoladi.
 */
const dark: ThemeTokens = {
  'slate-50': 'oklch(11% .02 258)',
  white: 'oklch(17% .022 258)',
  'slate-100': 'oklch(22% .024 258)',
  'slate-200': 'oklch(30% .026 258)',
  'slate-300': 'oklch(38% .03 257)',
  'slate-400': 'oklch(52% .032 257)',
  'slate-500': 'oklch(64% .028 255)',
  'slate-600': 'oklch(74% .024 253)',
  'slate-700': 'oklch(83% .018 250)',
  'slate-800': 'oklch(90% .012 248)',
  'slate-900': 'oklch(96% .006 240)',

  // Urg'u rang — binafsha/indigo, "yorug'"dagi yashildan ataylab farq
  // qilsin: har tema o'z joziba rangiga ega bo'lishi kerak.
  'brand-50': 'oklch(20% .06 280)',
  'brand-100': 'oklch(26% .08 280)',
  'brand-200': 'oklch(33% .1 280)',
  'brand-300': 'oklch(41% .13 280)',
  'brand-400': 'oklch(49% .16 280)',
  'brand-500': 'oklch(57% .19 280)',
  'brand-600': 'oklch(60% .2 280)',
  'brand-700': 'oklch(72% .17 280)',
  'brand-800': 'oklch(82% .13 280)',
  'brand-900': 'oklch(89% .09 280)',

  paid: 'oklch(68% .16 150)',
  partial: 'oklch(74% .14 80)',
  unpaid: 'oklch(70% .2 25)',
}

export default dark
