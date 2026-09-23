import { useEffect, useState } from 'react'

/**
 * Qiymatni kechiktirib qaytaradi.
 *
 * Qidiruv uchun: har bosilgan harfda so'rov ketmasin. Sekin internetda
 * javoblar tartibsiz qaytib, ro'yxat sakrab turishining oldini oladi.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
