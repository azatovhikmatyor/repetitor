import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'

import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ' +
  'disabled:bg-slate-50 disabled:text-slate-400'

function Wrapper({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-unpaid">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  suffix?: ReactNode
}

export function Input({ label, hint, error, suffix, className, ...props }: InputProps) {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          className={cn(CONTROL, error && 'border-unpaid', suffix ? 'pr-14' : null, className)}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </Wrapper>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  options: Array<{ value: string; label: string }>
}

export function Select({ label, hint, error, options, className, ...props }: SelectProps) {
  const generated = useId()
  const id = props.id ?? generated

  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <select id={id} className={cn(CONTROL, error && 'border-unpaid', className)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  )
}

interface TextareaProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  rows?: number
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function Textarea({ label, hint, error, rows = 3, value, onChange, placeholder }: TextareaProps) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, error && 'border-unpaid')}
      />
    </Wrapper>
  )
}

/** Faqat raqam qabul qiladigan pul maydoni. */
export function MoneyInput({
  value,
  onChange,
  ...props
}: Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      inputMode="numeric"
      suffix="so&rsquo;m"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      {...props}
    />
  )
}
