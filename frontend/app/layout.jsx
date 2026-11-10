import { Analytics } from "@vercel/analytics/next"
import { Sidebar } from "@/components/sidebar"
import { AuthProvider } from "@/components/auth-provider"
import { ChatSessionProvider } from "@/components/chat-session-provider"
import "./globals.css"
export const metadata = {
  applicationName: "마음결",
  title: {
    default: "마음결 | 청년 마음건강의 첫걸음",
    template: "%s · 마음결",
  },
  description:
    "마음을 정리하고 상담을 준비하며, 나에게 맞는 상담기관과 마음건강 지원 정보를 찾아보세요.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "마음결 | 청년 마음건강의 첫걸음",
    description:
      "마음을 정리하고 상담을 준비하며, 나에게 맞는 도움을 찾아보는 청년 마음건강 서비스입니다.",
    locale: "ko_KR",
    type: "website",
  },
}
export const viewport = {
  colorScheme: "light",
  themeColor: "#eef2f0",
}
export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="light" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          <ChatSessionProvider>
            <Sidebar>{children}</Sidebar>
          </ChatSessionProvider>
        </AuthProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
