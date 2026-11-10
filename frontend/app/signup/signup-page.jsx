"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth-provider"
// 로그인 화면과 같은 카드 모양이라 스타일(login-*)을 같이 써요.
import "../login/login-page.css"

// ── 비밀번호 조건 (바꾸려면 여기만 고치면 돼요) ──
const PASSWORD_MIN = 8
const PASSWORD_HINT = `영문과 숫자를 함께 써서 ${PASSWORD_MIN}자 이상으로 만들어 주세요.`

function isPasswordValid(password) {
  return password.length >= PASSWORD_MIN && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
}

// 회원가입 화면. 가입이 끝나면 /login 으로 보내요.(회원가입하면 자동 로그링되서 바로 메인페이지로 이동하게 했어용)
export function SignupPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // 이미 로그인한 사람은 이 화면 대신 메인으로 보내요.
  useEffect(() => {
    if (!authLoading && user) router.replace("/")
  }, [authLoading, user, router])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordCheck, setPasswordCheck] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)


  async function submitForm(event) {
    event.preventDefault()
    setMessage("")

    // 1. 비밀번호 조건 확인
    if (!isPasswordValid(password)) {
      setMessage(`비밀번호 조건을 확인해 주세요. ${PASSWORD_HINT}`)
      return
    }

    // 2. 비밀번호 일치 확인
    if (password !== passwordCheck) {
      setMessage("비밀번호가 서로 달라요. 다시 확인해 주세요.")
      return
    }

    // 3. Supabase 회원가입 요청
    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      // 4. 회원가입 오류 처리
      if (error) {
        console.error("회원가입 실패:", error.message)

        if (error.code === "user_already_exists") {
          setMessage("이미 가입된 이메일입니다. 로그인해 주세요.")
        } else {
          setMessage("회원가입에 실패했어요. 다시 시도해 주세요.")
        }
        return
      }

      // 5. 로그인 세션 확인
      if (!data.session) {
        setMessage("로그인 세션을 생성하지 못했어요.")
        return
      }

      // 6. 회원가입 성공 후 메인 홈페이지 이동
      router.push("/")
      router.refresh()

    } catch (error) {
      console.error("회원가입 오류:", error)
      setMessage("회원가입 중 문제가 발생했어요.")

    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="login-page">
      <div className="login-card">
        <PageHeading
          title="회원가입"
          description="이메일과 비밀번호로 계정을 만들어요. 가입한 뒤에는 바로 서비스를 이용할 수 있어요."
        />

        <form onSubmit={submitForm} className="login-form">
          <div className="login-field">
            <label htmlFor="signup-email" className="login-label">
              이메일
            </label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="login-input"
            />
          </div>

          <div className="login-field">
            <label htmlFor="signup-password" className="login-label">
              비밀번호
            </label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              aria-describedby="signup-password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="login-input"
            />
            <p id="signup-password-hint" className="login-hint">
              {PASSWORD_HINT}
            </p>
          </div>

          <div className="login-field">
            <label htmlFor="signup-password-check" className="login-label">
              비밀번호 확인
            </label>
            <Input
              id="signup-password-check"
              type="password"
              autoComplete="new-password"
              required
              value={passwordCheck}
              onChange={(event) => setPasswordCheck(event.target.value)}
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
            {loading ? "가입 중..." : "회원가입"}
          </Button>

          <p className="login-switch">
            이미 계정이 있나요? <Link href="/login">로그인</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
