import type { ThemeTokens } from './light'

/**
 * "Nord" — sovuq arktik ko'k fon, "frost" ko'k urg'u (Nord palitrasining
 * o'zidagi imzo rangi — yashil emas).
 *
 * "white" (karta foni) va "slate-200" (chegara) orasida yetarli farq
 * qoldirilgan — aks holda kartalar va inputlar chegarasiz ko'rinib,
 * deyarli hech narsa ajralib turmay qoladi.
 */
const nord: ThemeTokens = {
  'slate-50': 'oklch(13% .016 222)',
  white: 'oklch(19% .018 222)',
  'slate-100': 'oklch(24% .02 222)',
  'slate-200': 'oklch(31% .022 220)',
  'slate-300': 'oklch(39% .024 219)',
  'slate-400': 'oklch(53% .026 218)',
  'slate-500': 'oklch(66% .022 216)',
  'slate-600': 'oklch(75% .018 214)',
  'slate-700': 'oklch(84% .014 212)',
  'slate-800': 'oklch(91% .009 210)',
  'slate-900': 'oklch(96% .005 205)',

  // "Frost" ko'k — Nord palitrasining haqiqiy imzo rangi.
  'brand-50': 'oklch(20% .05 200)',
  'brand-100': 'oklch(26% .07 200)',
  'brand-200': 'oklch(33% .09 200)',
  'brand-300': 'oklch(41% .12 200)',
  'brand-400': 'oklch(49% .14 200)',
  'brand-500': 'oklch(57% .16 200)',
  'brand-600': 'oklch(58% .17 200)',
  'brand-700': 'oklch(69% .14 200)',
  'brand-800': 'oklch(79% .1 200)',
  'brand-900': 'oklch(87% .07 200)',

  paid: 'oklch(67% .16 150)',
  partial: 'oklch(73% .14 80)',
  unpaid: 'oklch(69% .2 25)',
}

export default nord
