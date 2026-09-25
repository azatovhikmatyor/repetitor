import { MoneyInput, Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { money } from '@/lib/format'

export type FeeMode = 'group' | 'custom' | 'free'

export interface FeeDraft {
  mode: FeeMode
  amount: string
  note: string
}

export function initialFee(
  customFee: number | null | undefined,
  note: string | null | undefined,
): FeeDraft {
  if (customFee === null || customFee === undefined) {
    return { mode: 'group', amount: '', note: '' }
  }
  return {
    mode: customFee === 0 ? 'free' : 'custom',
    amount: customFee === 0 ? '' : String(customFee),
    note: note ?? '',
  }
}

/**
 * Tanlovni API so'roviga aylantiradi.
 *
 * `reset_custom_fee` alohida bayroq: `custom_fee: null` yuborish "o'zgarmasin"
 * degani, "guruh narxiga qayt" degani emas.
 */
export function feePayload(draft: FeeDraft): Record<string, unknown> {
  if (draft.mode === 'group') return { reset_custom_fee: true }
  return {
    custom_fee: draft.mode === 'free' ? 0 : Number(draft.amount || 0),
    fee_note: draft.note.trim() || null,
  }
}

/** Yangi o'quvchi qo'shishda: guruh narxi bo'lsa hech nima yuborilmaydi. */
export function feeCreatePayload(draft: FeeDraft): Record<string, unknown> {
  if (draft.mode === 'group') return {}
  return {
    custom_fee: draft.mode === 'free' ? 0 : Number(draft.amount || 0),
    fee_note: draft.note.trim() || undefined,
  }
}

/**
 * O'quvchining shu guruhdagi oylik narxi.
 *
 * Uch holat ataylab alohida tugma: bo'sh maydonni "0 so'm" deb tushunish
 * xato bo'lardi — bepul o'qish ongli qaror, tasodifan qo'yiladigan narsa
 * emas.
 */
export function FeeFields({
  groupFee,
  value,
  onChange,
}: {
  groupFee: number
  value: FeeDraft
  onChange: (draft: FeeDraft) => void
}) {
  const t = useT()
  const modes: { value: FeeMode; label: string }[] = [
    { value: 'group', label: t.groups.fee.modeGroup },
    { value: 'custom', label: t.groups.fee.modeCustom },
    { value: 'free', label: t.groups.fee.modeFree },
  ]

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {t.groups.fee.label}
        </span>
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange({ ...value, mode: mode.value })}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                value.mode === mode.value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {value.mode === 'group' && (
          <p className="mt-1.5 text-xs text-slate-500">
            {t.groups.fee.groupHint(money(groupFee))}
          </p>
        )}
        {value.mode === 'free' && (
          <p className="mt-1.5 text-xs text-slate-500">{t.groups.fee.freeHint}</p>
        )}
      </div>

      {value.mode === 'custom' && (
        <MoneyInput
          label={t.groups.fee.amountLabel}
          value={value.amount}
          hint={t.groups.fee.amountHint(money(groupFee))}
          onChange={(amount) => onChange({ ...value, amount })}
        />
      )}

      {value.mode !== 'group' && (
        <Input
          label={t.groups.fee.reasonLabel}
          value={value.note}
          placeholder={t.groups.fee.reasonPlaceholder}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
        />
      )}
    </div>
  )
}
