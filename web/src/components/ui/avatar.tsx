import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

/**
 * Profil rasmi — yuklangan bo'lsa rasm, bo'lmasa ismning bosh harfi.
 *
 * Bir joyda turishi kerak: yon panel, profil sahifasi va ro'yxatlar bir xil
 * ko'rinsin.
 */
export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null
  name?: string | null
  className?: string
}) {
  const base = 'shrink-0 rounded-full object-cover'

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(base, 'ring-1 ring-slate-200', className ?? 'size-8')}
      />
    )
  }

  return (
    <span
      className={cn(
        base,
        'grid place-items-center bg-slate-200 font-semibold text-slate-600',
        className ?? 'size-8 text-sm',
      )}
    >
      {initials(name ?? '')}
    </span>
  )
}
