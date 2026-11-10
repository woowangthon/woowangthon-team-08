"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import "./login-page.css"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"

// 로그인 화면
export function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // 이미 로그인한 사람은 이 화면 대신 메인으로 보내요.
  useEffect(() => {
    if (!authLoading && user) router.replace("/")
  }, [authLoading, user, router])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)


  async function submitForm(event) {
    event.preventDefault()
    setMessage("")
    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          })

      if (error) {
        console.error("로그인 실패:", error.message)
        setMessage("이메일 또는 비밀번호를 확인해 주세요.")
        return
      }

      if (!data.session) {
        setMessage("로그인 세션을 확인하지 못했어요.")
        return
      }

      // 로그인 성공 후 메인 페이지 이동
      router.push("/")
      router.refresh()

    } catch (error) {
      console.error("로그인 오류:", error)
      setMessage("로그인 중 문제가 발생했어요.")

    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="login-page">
      <div className="login-card">
        <PageHeading
          title="로그인"
          description="계정으로 로그인해요. 마음 정리 대화는 로그인 없이도 쓸 수 있어요."
        />

        <form onSubmit={submitForm} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email" className="login-label">
              이메일
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="login-input"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-label">
              비밀번호
            </label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="login-input"
            />
          </div>

          {message && (
            <p role="alert" className="login-message">
              {message}
            </p>
          )}

          <Button
              type="submit"
              size="lg"
              className="login-submit"
              disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </Button>

          <p className="login-switch">
            아직 계정이 없나요? <Link href="/signup">회원가입</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
