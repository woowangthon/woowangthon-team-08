"use client"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const AuthContext = createContext({ session: null, user: null, loading: true })

// 로그인 상태를 앱 전체에서 같이 쓰게 해주는 Provider예요.
// user가 null이면 로그아웃 상태, loading은 처음 확인하는 동안만 true예요.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // 새로고침했을 때 저장돼 있는 세션을 읽어와요.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // 로그인·로그아웃이 일어날 때마다 상태를 갱신해요.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// 사용법: const { user, session, loading } = useAuth()
// 백엔드(Spring Boot)에는 session.access_token 을 Authorization: Bearer 로 보내면 돼요.
export function useAuth() {
  return useContext(AuthContext)
}
