import type { ApiErrorBody, FieldError, TokenPair } from './types'

/**
 * Backend manzili.
 *
 * Ishlab chiqishda bo'sh qoldiriladi va `/api/v1` nisbiy manzil bo'ladi —
 * Vite proxy uni backend'ga uzatadi, shuning uchun brauzer uchun origin bir
 * xil bo'lib qoladi va CORS umuman kerak bo'lmaydi.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

const ACCESS_KEY = 'repetitor.access'
const REFRESH_KEY = 'repetitor.refresh'

/**
 * Tokenlar `localStorage` da.
 *
 * Eng xavfsiz variant emas (XSS tokenni o'qiy oladi), lekin backend
 * `httpOnly` cookie bermaydi va SPA sahifa yangilanganda sessiyani
 * saqlashi kerak. Cookie'ga o'tilsa, faqat shu modul o'zgaradi.
 */
export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  get hasSession() {
    return localStorage.getItem(REFRESH_KEY) !== null
  },
  save(tokens: Pick<TokenPair, 'access_token' | 'refresh_token'>) {
    localStorage.setItem(ACCESS_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(
    message: string,
    options: { code: string; status: number; fieldErrors?: Record<string, string> },
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code
    this.status = options.status
    this.fieldErrors = options.fieldErrors ?? {}
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isNotFound() {
    return this.status === 404
  }

  get isConflict() {
    return this.status === 409
  }

  get requiresPasswordChange() {
    return this.code === 'password_change_required'
  }

  get isNetwork() {
    return this.status === 0
  }
}

/** Sessiya tugaganda chaqiriladi — auth qatlami login sahifasiga qaytaradi. */
let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

/** Bir vaqtda kelgan bir nechta 401 uchun refresh faqat bir marta ketadi. */
let refreshInFlight: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  const refresh = tokenStore.refresh
  if (!refresh) return false

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
  if (!response.ok) return false

  tokenStore.save((await response.json()) as TokenPair)
  return true
}

function ensureRefresh(): Promise<boolean> {
  refreshInFlight ??= refreshTokens()
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // Javob JSON emas — pastdagi standart xabar ishlatiladi.
  }

  const fieldErrors: Record<string, string> = {}
  if (Array.isArray(body?.details)) {
    for (const item of body.details as FieldError[]) {
      if (item?.field) fieldErrors[item.field] = item.message
    }
  }

  return new ApiError(body?.detail ?? `Xatolik (${response.status})`, {
    code: body?.code ?? 'error',
    status: response.status,
    fieldErrors,
  })
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** `FormData` yuborilganda `Content-Type` ni brauzer o'zi qo'yadi. */
  formData?: FormData
  query?: Record<string, string | number | boolean | undefined | null>
  /** Login/refresh kabi so'rovlar uchun — token qo'shilmaydi. */
  skipAuth?: boolean
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${BASE_URL}${path}`
  if (!query) return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  }
  const search = params.toString()
  return search ? `${url}?${search}` : url
}

async function send<T>(path: string, options: RequestOptions, retried = false): Promise<T> {
  const headers: Record<string, string> = {}
  // FormData bilan `Content-Type` qo'lda qo'yilmaydi: brauzer boundary
  // bilan birga o'zi qo'shadi.
  if (options.body !== undefined && !options.formData) {
    headers['Content-Type'] = 'application/json'
  }

  const token = tokenStore.access
  if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Internet aloqasi yo‘q', { code: 'network_error', status: 0 })
  }

  // Token eskirgan — yangilab, so'rovni bir marta qaytaramiz.
  const isAuthEndpoint = path.startsWith('/auth/') && path !== '/auth/me'
  if (response.status === 401 && !retried && !isAuthEndpoint && tokenStore.refresh) {
    if (await ensureRefresh()) {
      return send<T>(path, options, true)
    }
    tokenStore.clear()
    onSessionExpired?.()
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    send<T>(path, { query, signal }),

  post: <T>(path: string, body?: unknown, options?: Pick<RequestOptions, 'skipAuth'>) =>
    send<T>(path, { method: 'POST', body, skipAuth: options?.skipAuth }),

  patch: <T>(path: string, body?: unknown) => send<T>(path, { method: 'PATCH', body }),

  /** Fayl yuklash — multipart/form-data. */
  upload: <T>(path: string, formData: FormData) =>
    send<T>(path, { method: 'POST', formData }),

  put: <T>(path: string, body?: unknown) => send<T>(path, { method: 'PUT', body }),

  delete: <T = void>(path: string) => send<T>(path, { method: 'DELETE' }),

  /** Fayl yuklab olish (PDF va h.k.) — JSON emas, `Blob` qaytaradi. */
  async download(path: string, query?: RequestOptions['query']): Promise<Blob> {
    const headers: Record<string, string> = {}
    const token = tokenStore.access
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await fetch(buildUrl(path, query), { headers })
    if (!response.ok) throw await toApiError(response)
    return response.blob()
  },
}

/** `Blob`ni brauzerga fayl sifatida yuklatadi (link yaratib, bosib, tozalab). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
