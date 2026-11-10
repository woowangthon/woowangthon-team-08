"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  Heart,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { ActionLink } from "@/components/action-link"
import { PageHeading } from "@/components/page-heading"
import { useChatSession } from "@/components/chat-session-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import "./summary-page.css"
function getSections(text) {
  const segments = text
    .split(/(?=^###\s)/m)
    .map((segment) => segment.trim())
    .filter(Boolean)
  const sections = segments
    .map((segment) => {
      const title = segment.match(/^###\s*(.+)$/m)?.[1]?.trim()
      const content = segment.replace(/^###\s*.+\n?/m, "").trim()
      return title && content ? { title, content } : null
    })
    .filter((section) => section !== null)
  return sections.length > 0 ? sections : [{ title: "상담 전 메모", content: text.trim() }]
}
export function SummaryPage() {
  const router = useRouter()
  const { messages, focus, summary, setSummary, resetSession } = useChatSession()
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [copied, setCopied] = useState(false)
  const transcript = useMemo(
    () =>
      messages
        .map((message) => ({
          role: message.role,
          text: message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")
            .trim(),
        }))
        .filter(
          (message) =>
            (message.role === "user" || message.role === "assistant") && message.text.length > 0,
        )
        .slice(-24),
    [messages],
  )
  const sections = useMemo(() => (summary ? getSections(summary) : []), [summary])
  async function createSummary() {
    if (transcript.length === 0 || isGenerating) return
    setIsGenerating(true)
    setErrorMessage("")
    setCopied(false)
    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, focus }),
      })
      const result = await response.json()
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("summary" in result) ||
        typeof result.summary !== "string"
      ) {
        throw new Error("요약을 만들지 못했어요.")
      }
      setSummary(result.summary)
    } catch {
      setErrorMessage("요약을 만들지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setIsGenerating(false)
    }
  }
  async function copySummary() {
    if (!summary) return
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
    } catch {
      setErrorMessage("이 브라우저에서는 복사 기능을 사용할 수 없어요.")
    }
  }
  function startNewSession() {
    resetSession()
    router.push("/chat")
  }
  return (
    <div className="summary-page">
      <PageHeading
        eyebrow="상담 준비 메모"
        title="나눈 이야기를 한 장으로 정리해요"
        description="대화에서 직접 말한 고민과 감정의 흐름을 살펴보고, 전문가에게 전하고 싶은 내용을 정리해요. 이 메모는 진단이나 평가가 아니에요."
        action={
          transcript.length > 0 ? (
            <ActionLink href="/chat" variant="outline">
              <MessageCircle aria-hidden="true" /> 대화로 돌아가기
            </ActionLink>
          ) : undefined
        }
      />

      <div className="summary-layout">
        <section aria-label="대화 요약">
          {transcript.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="summary-empty">
                <div className="icon-box" data-size="lg">
                  <ClipboardList aria-hidden="true" />
                </div>
                <h2>먼저 마음결과 이야기를 나눠보세요</h2>
                <p>대화가 끝나면 고민 요약과 마음의 흐름을 상담 준비 메모로 만들 수 있어요.</p>
                <ActionLink href="/chat" className="summary-empty-cta">
                  마음 정리 시작하기 <ArrowRight aria-hidden="true" />
                </ActionLink>
              </CardContent>
            </Card>
          ) : summary ? (
            <Card className="surface-card">
              <CardHeader className="summary-head">
                <div className="summary-head-info">
                  <div className="icon-box">
                    <ClipboardList aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="summary-title card-title-lg">상담 전 마음 메모</CardTitle>
                    <CardDescription className="summary-head-desc">
                      대화 {transcript.length}개를 바탕으로 정리했어요. 필요하면 직접 고쳐서
                      사용하세요.
                    </CardDescription>
                  </div>
                </div>
                <div className="summary-head-actions">
                  <Button type="button" variant="outline" size="sm" onClick={copySummary}>
                    {copied ? (
                      <Check data-icon="inline-start" />
                    ) : (
                      <Copy data-icon="inline-start" />
                    )}
                    {copied ? "복사했어요" : "복사하기"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={createSummary}
                    disabled={isGenerating}
                  >
                    <RotateCcw data-icon="inline-start" /> 다시 정리
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="summary-sections">
                {sections.map((section, index) => {
                  const Icon = index === 1 ? Heart : index === 3 ? Sparkles : ClipboardList
                  return (
                    <section key={`${section.title}-${index}`} className="summary-section">
                      <div className="summary-section-head">
                        <div className="icon-box" data-size="xs">
                          <Icon aria-hidden="true" />
                        </div>
                        <h2>{section.title}</h2>
                      </div>
                      <p>{section.content}</p>
                    </section>
                  )
                })}
              </CardContent>
              <CardFooter className="summary-foot">
                <p className="summary-note">
                  이 내용은 AI가 대화를 바탕으로 정리한 참고 메모예요. 사실과 다르거나 불편한 표현은
                  상담 전에 직접 고쳐주세요.
                </p>
              </CardFooter>
            </Card>
          ) : (
            <Card className="surface-card">
              <CardHeader className="summary-ready-head">
                <div className="icon-box" data-tone="secondary" data-size="md">
                  <Sparkles aria-hidden="true" />
                </div>
                <CardTitle className="summary-title card-title-lg">
                  대화에서 중요한 내용을 정리할 준비가 됐어요
                </CardTitle>
                <CardDescription className="summary-ready-desc">
                  고민 요약, 대화에 나타난 감정의 흐름, 상담에서 전하고 싶은 점을 정리해요. 감정
                  변화가 분명히 드러나지 않으면 추측하지 않고 그렇게 표시합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="summary-ready-body">
                <Button type="button" size="lg" onClick={createSummary} disabled={isGenerating}>
                  {isGenerating ? "메모를 정리하고 있어요…" : "AI로 상담 메모 만들기"}
                  {!isGenerating && <ArrowRight data-icon="inline-end" />}
                </Button>
                {errorMessage && (
                  <p role="alert" className="summary-error">
                    {errorMessage}
                  </p>
                )}
              </CardContent>
              <CardFooter className="summary-foot">
                <p className="summary-note">
                  버튼을 누르면 대화 내용이 AI 모델 제공자에게 전송되어 요약을 생성합니다. 대화
                  기록은 서비스 데이터베이스에 저장하지 않아요.
                </p>
              </CardFooter>
            </Card>
          )}
          {isGenerating && summary && (
            <p role="status" className="summary-status">
              메모를 다시 정리하고 있어요…
            </p>
          )}
          {errorMessage && summary && (
            <p role="alert" className="summary-error">
              {errorMessage}
            </p>
          )}
        </section>

        <aside className="summary-aside">
          <Card className="surface-card">
            <CardHeader className="summary-side-head">
              <CardTitle className="card-title-base">상담에서 꺼내볼 수 있는 질문</CardTitle>
              <CardDescription className="summary-side-desc">
                꼭 모두 답할 필요는 없어요. 생각나는 것만 적어두어도 충분해요.
              </CardDescription>
            </CardHeader>
            <CardContent className="summary-questions">
              <p>“이런 마음이 언제부터 이어졌나요?”</p>
              <p>“일상에서 가장 힘든 순간은 언제인가요?”</p>
              <p>“상담을 통해 어떤 도움을 받고 싶나요?”</p>
            </CardContent>
          </Card>

        </aside>
      </div>
    </div>
  )
}
