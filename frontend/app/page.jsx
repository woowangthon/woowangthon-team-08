import { ArrowRight, ArrowUpRight, PhoneCall } from "lucide-react"
import Link from "next/link"
import { ActionLink } from "@/components/action-link"
import "./home.css"

const steps = [
  {
    href: "/chat",
    title: "말로 꺼내보기",
    description: "무슨 일인지 몰라도 돼요. 떠오르는 것부터 적으면 질문으로 같이 정리해요.",
    action: "대화 시작",
  },
  {
    href: "/summary",
    title: "상담 메모로 정리하기",
    description: "나눈 이야기를 자동으로 정리해서 상담 시 참고 자료로 활용할 수 있어요.",
    action: "메모 보기",
  },
  {
    href: "/find",
    title: "상담 센터 찾기",
    description: "내 지역의 상담기관 및 받을 수 있는 지원제도를 비교해봐요.",
    action: "기관 찾기",
  },
]

export default function HomePage() {
  return (
    <div className="home">
      <header className="home-intro">
        <h1 className="home-title">
          상담받고 싶은데,
          <br className="home-br" /> 뭐부터 해야 할지 모르겠다면
        </h1>
        <p className="home-lead">
          마음결은 치료를 하지 않아요!
          <br />
          대신 내 고민을 정리하고, 상담 기관을 추천해주는 첫 단계예요.
        </p>
        <div className="home-start-action">
          <ActionLink href="/chat" className="home-cta">
            마음 정리 시작
            <ArrowRight aria-hidden="true" />
          </ActionLink>
          <p className="home-start-text">하고 싶은 말만 하고, 대답하기 싫은 질문은 넘겨도 괜찮아요.</p>
        </div>
      </header>

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="home-steps-title">
          Step
        </h2>
        <ol className="home-steps">
          {steps.map(({ href, title, description, action }) => (
            <li key={href}>
              <Link href={href} className="home-step focus-ring">
                <span className="home-step-body">
                  <span className="home-step-name">{title}</span>
                  <span className="home-step-desc">{description}</span>
                </span>
                <span className="home-step-action">
                  {action}
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <ArrowUpRight aria-hidden="true" className="home-step-arrow" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <footer className="home-footer">
        <p>
          대화 내용은 서비스에 저장되지 않지만, 답변을 만들기 위해 AI 모델에 전달돼요. 이름이나
          연락처 같은 개인정보는 적지 마세요. 기관 정보와 지원 조건은 신청 전에 공식 사이트에서 한
          번 더 확인해 주세요.
        </p>
      </footer>
    </div>
  )
}
