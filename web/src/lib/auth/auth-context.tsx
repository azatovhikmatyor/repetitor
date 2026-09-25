import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { api, ApiError, setSessionExpiredHandler, tokenStore } from '@/lib/api/client'
import type { LoginResponse, User } from '@/lib/api/types'

type Status = 'loading' | 'signed-out' | 'signed-in'

interface AuthState {
  status: Status
  user: User | null
  /** Vaqtinchalik parol bilan kirgan — boshqa sahifalar yopiq. */
  mustChangePassword: boolean
}

interface AuthApi extends AuthState {
  login: (login: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  /** Parol o'zgargach backend barcha sessiyalarni yopadi. */
  signOutLocally: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

export function useAuth(): AuthApi {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth <AuthProvider> ichida ishlatiladi')
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({
    status: tokenStore.hasSession ? 'loading' : 'signed-out',
    user: null,
    mustChangePassword: false,
  })

  const applyUser = useCallback((user: User) => {
    setState({
      status: 'signed-in',
      user,
      mustChangePassword: user.must_change_password,
    })
  }, [])

  const signOutLocally = useCallback(() => {
    tokenStore.clear()
    setState({ status: 'signed-out', user: null, mustChangePassword: false })
    // Keyingi hisob (bir xil vkladkada) avvalgisining keshlangan
    // ma'lumotini (guruh, o'quvchi, dashboard...) ko'rmasligi kerak —
    // query kalitlari foydalanuvchi bo'yicha ajratilmagan.
    void queryClient.clear()
  }, [queryClient])

  // Refresh ham ishlamay qolsa — login sahifasiga.
  useEffect(() => {
    setSessionExpiredHandler(signOutLocally)
  }, [signOutLocally])

  // Saqlangan sessiyani tekshiramiz.
  useEffect(() => {
    if (!tokenStore.hasSession) return

    let cancelled = false
    api
      .get<User>('/auth/me')
      .then((user) => {
        if (!cancelled) applyUser(user)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // Token eskirgan yoki hisob bloklangan.
        if (error instanceof ApiError) signOutLocally()
      })

    return () => {
      cancelled = true
    }
  }, [applyUser, signOutLocally])

  const value = useMemo<AuthApi>(
    () => ({
      ...state,
      setUser: applyUser,
      signOutLocally,

      async login(login, password) {
        const response = await api.post<LoginResponse>(
          '/auth/login',
          { login: login.trim(), password },
          { skipAuth: true },
        )
        tokenStore.save(response)
        // Oldingi hisobdan qolgan kesh bo'lishi mumkin (masalan avvalgi
        // sessiya to'liq tozalanmagan bo'lsa) — yangi foydalanuvchi doim
        // toza holatdan boshlaydi.
        queryClient.clear()
        applyUser(response.user)
      },

      async logout() {
        try {
          const refresh = tokenStore.refresh
          if (refresh) await api.post('/auth/logout', { refresh_token: refresh })
        } catch {
          // Server javob bermasa ham lokal sessiya tozalanadi.
        } finally {
          signOutLocally()
        }
      },
    }),
    [state, applyUser, signOutLocally, queryClient],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
