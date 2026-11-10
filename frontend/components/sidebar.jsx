"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Compass, FileText, Home, LogIn, LogOut, MapPin, MessageCircle } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { useAuth } from "@/components/auth-provider"
import { ChatHistory } from "@/components/chat-history"
import { createClient } from "@/lib/supabase/client"
import "./sidebar.css"
const navigation = [
  { href: "/", label: "마음 홈", icon: Home },
  { href: "/chat", label: "마음 정리", icon: MessageCircle },
  { href: "/summary", label: "대화 메모", icon: FileText },
  { href: "/find", label: "상담기관 찾기", icon: MapPin },
  { href: "/support", label: "지원제도 탐색", icon: Compass },
]
const mobileNavigation = navigation.filter((item) => item.href !== "/summary")
function NavigationLinks({ mobile = false }) {
  const pathname = usePathname()
  const items = mobile ? mobileNavigation : navigation
  return (
    <nav aria-label="주요 메뉴" className="nav" data-mobile={mobile || undefined}>
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className="nav-link focus-ring-offset"
        >
          <Icon aria-hidden="true" className="nav-icon" />
          <span className="nav-label">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
// 로그인 링크: 로그인 전에는 "로그인", 로그인 후에는 "로그아웃"으로 바뀌어요.
// 넓은 화면은 사이드바 아래, 모바일은 위쪽 바 오른쪽에 둬요.
function LoginLink({ className }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  // 로그인 여부를 확인하는 동안은 깜빡이지 않게 비워둬요.
  if (loading) return null

  if (user) {
    async function logout() {
      await createClient().auth.signOut()
      router.push("/")
      router.refresh()
    }
    return (
      <button
        type="button"
        onClick={logout}
        title={user.email}
        className={className}
      >
        <LogOut aria-hidden="true" className="nav-icon" />
        <span>로그아웃</span>
      </button>
    )
  }

  return (
    <Link
      href="/login"
      aria-current={pathname === "/login" ? "page" : undefined}
      className={className}
    >
      <LogIn aria-hidden="true" className="nav-icon" />
      <span>로그인</span>
    </Link>
  )
}
export function Sidebar({ children }) {
  return (
    <div className="sidebar">
      <aside className="sidebar-panel">
        <div className="sidebar-panel-inner">
          <Link href="/" aria-label="마음결 홈" className="sidebar-brand focus-ring">
            <BrandLogo compact />
          </Link>
          <div className="sidebar-nav-wrap">
            <NavigationLinks />
          </div>
          <ChatHistory />
          <div className="sidebar-foot">
            <LoginLink className="nav-link focus-ring-offset" />
            <p className="sidebar-disclaimer">
              마음결은 진단·치료를 하지 않아요. 전문 도움이 필요하면 기관 찾기로 이어져요.
            </p>
          </div>
        </div>
      </aside>

      <header className="sidebar-topbar">
        <Link href="/" aria-label="마음결 홈" className="sidebar-topbar-brand focus-ring">
          <BrandLogo compact />
        </Link>
        <LoginLink className="sidebar-topbar-login focus-ring-offset" />
      </header>

      <main id="main-content" className="sidebar-main">
        <div className="sidebar-content">{children}</div>
      </main>

      <div className="sidebar-bottomnav">
        <NavigationLinks mobile />
      </div>
    </div>
  )
}
