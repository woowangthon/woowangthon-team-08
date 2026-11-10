"use client"
import { useEffect, useState } from "react"
import { ArrowUpRight, Check, Search } from "lucide-react"
import { PageHeading } from "@/components/page-heading"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { supportApplicationStatus } from "@/lib/support-application"
import { matchesSupportRegion, supportRegions } from "@/lib/support-regions"
import { classifySupportTypes, supportTypes } from "@/lib/support-types"
import "./support-page.css"

const programs = [
  {
    id: "mind-investment",
    title: "전국민 마음투자 지원사업",
    types: ["심리상담", "상담비·바우처"],
    regions: [],
    description: "전문 심리상담 이용 지원에 관한 신청 요건과 제공기관 안내를 확인해 보세요.",
    audience: "신청 대상과 증빙 기준은 최신 사업 지침·공고에서 확인해 주세요.",
    support: "지원 내용, 본인부담 여부, 이용 회기는 현행 안내에 따라 달라질 수 있어요.",
    route: "복지로 또는 관할 행정복지센터의 신청 안내를 먼저 확인해요.",
    href: "https://www.bokjiro.go.kr/ssis-tbu/index.do",
    linkLabel: "복지로 최신 공고",
  },
  {
    id: "local-youth",
    title: "청년 마음건강 지원",
    types: ["기타 지원"],
    description: "지자체별 청년 상담·마음건강 사업의 운영 여부와 모집 정보를 살펴봐요.",
    audience: "거주 지역, 연령, 모집 기간 등은 지자체별 공고를 확인해 주세요.",
    support: "상담비 지원, 프로그램, 상담 회기 등 지원 형태는 지역마다 다를 수 있어요.",
    route: "거주지 청년정책 포털이나 지자체 홈페이지에서 현재 모집을 확인해요.",
    href: "https://youth.seoul.go.kr/",
    linkLabel: "서울청년포털(예시)",
  },
  {
    id: "local-center",
    title: "정신건강복지센터 상담·연계",
    types: ["심리상담"],
    description: "가까운 지역 센터에서 상담 정보와 전문기관 연계 방법을 문의할 수 있어요.",
    audience: "관할 지역과 서비스 대상은 해당 센터에 직접 문의해 주세요.",
    support: "상담·안내 범위와 비용은 센터 및 서비스에 따라 달라질 수 있어요.",
    route: "국가정신건강정보포털에서 지역 센터를 찾고 운영 시간을 확인해요.",
    href: "https://www.mentalhealth.go.kr/",
    linkLabel: "국가정신건강정보포털",
  },
]
const checklist = [
  "내 거주 지역과 신청 대상 기준 확인하기",
  "상담 필요성을 확인할 자료가 필요한지 확인하기",
  "신분·거주 확인 자료 제출 여부 확인하기",
  "신청서와 개인정보 동의 항목 확인하기",
  "본인 부담, 제공기관, 예약 절차 확인하기",
]
const categories = ["전체", ...supportTypes]
const gov24Messages = {
  loading: "정부24 지원 제도를 불러오는 중이에요.",
  unconfigured: "정부24 연동 설정 전이라 기존 지원 안내를 보여드려요.",
  unavailable: "정부24 정보를 불러오지 못해 기존 지원 안내를 보여드려요.",
  empty: "정부24에서 관련 사업을 찾지 못해 기존 지원 안내를 보여드려요.",
  ok: "정부24에서 수집한 정신건강 지원 제도예요.",
}

function normalizeSearchText(text) {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, "")
}

export function SupportPage() {
  const [category, setCategory] = useState("전체")
  const [gov24, setGov24] = useState({ status: "loading", programs: [] })
  const [query, setQuery] = useState("")
  const [province, setProvince] = useState("")
  const [district, setDistrict] = useState("")
  const [availableOnly, setAvailableOnly] = useState(true)
  const [now, setNow] = useState(null)
  const showGov24 = gov24.status === "ok"
  const districts = supportRegions[province] ?? []
  const listedPrograms = showGov24
    ? gov24.programs.map((program) => ({ ...program, applicationStatus: supportApplicationStatus(program.application, now) }))
    : programs
  const searchTerm = normalizeSearchText(query)
  const visiblePrograms = listedPrograms.filter((program) => (
    (category === "전체" || program.types.includes(category)) &&
    matchesSupportRegion(program.regions, province, district) &&
    (!showGov24 || !availableOnly || ["접수 중", "상시"].includes(program.applicationStatus)) &&
    (!searchTerm || normalizeSearchText(program.title).includes(searchTerm))
  ))

  useEffect(() => {
    const controller = new AbortController()

    async function loadPrograms() {
      try {
        const response = await fetch("/api/support-programs", { signal: controller.signal })
        if (!response.ok) throw new Error("정부24 지원 제도 요청 실패")
        const result = await response.json()
        if (controller.signal.aborted) return
        const programs = (result.programs ?? []).map((program) => ({
          ...program,
          types: classifySupportTypes(program.title, program.support),
        }))
        const status = result.status === "ok" && programs.length === 0 ? "empty" : result.status
        setNow(Date.now())
        setGov24({ status, programs })
      } catch {
        if (!controller.signal.aborted) setGov24({ status: "unavailable", programs: [] })
      }
    }

    loadPrograms()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!showGov24) return
    const refreshClock = () => setNow(Date.now())
    refreshClock()
    const timer = window.setInterval(refreshClock, 15_000)
    return () => window.clearInterval(timer)
  }, [showGov24])

  const [checkedItems, setCheckedItems] = useState({})
  const checkedCount = Object.values(checkedItems).filter(Boolean).length
  function toggleChecklistItem(item) {
    setCheckedItems((current) => ({ ...current, [item]: !current[item] }))
  }
  return (
    <div className="support-page">
      <PageHeading
        eyebrow="지원제도 탐색"
        title="상담비, 지원받을 수 있을까요"
        description="상담 지원 제도를 모아봤어요. 조건과 모집 기간이 다를 수 있으니 신청 전에 공고를 꼭 확인해 주세요."
      />

      <div className="support-layout">
        <section aria-labelledby="program-list-heading">
          <div className="support-chips" role="group" aria-label="제도 유형 필터">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className="support-chip focus-ring"
              >
                {item}
              </button>
            ))}
          </div>
          <InputGroup className="support-search mt-4">
            <InputGroupAddon align="inline-start" className="support-search-icon">
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="지원 사업명 검색"
              placeholder="사업명을 검색해 보세요 (예: 마음투자)"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
          <div className="support-filters" role="group" aria-label="거주 지역 및 접수 상태 필터">
            <label>
              시·도
              <select value={province} onChange={(event) => {
                setProvince(event.target.value)
                setDistrict("")
              }}>
                <option value="">전체 지역</option>
                {Object.keys(supportRegions).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label>
              시·군·구
              <select value={district} disabled={!districts.length} onChange={(event) => setDistrict(event.target.value)}>
                <option value="">전체 시·군·구</option>
                {districts.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            {showGov24 && (
              <label className="support-available-filter">
                <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />
                지금 신청 가능
              </label>
            )}
          </div>
          <h2 id="program-list-heading" className="support-count" aria-live="polite">
            지원 제도 {visiblePrograms.length}개
          </h2>
          <p className="support-notice" role="status">{gov24Messages[gov24.status]}</p>
          {visiblePrograms.length === 0 && gov24.status !== "loading" && (
            <p className="support-notice">
              {searchTerm
                ? "현재 조건에서 해당 이름의 사업을 찾지 못했어요. 검색어나 선택한 필터를 바꿔 보세요."
                : "조건에 맞는 사업을 찾지 못했어요. 지원 유형이나 선택한 필터를 바꿔 보세요."}
            </p>
          )}
          <ul className="support-list">
            {visiblePrograms.map((program) => (
              <li key={program.id} className="support-card">
                <div className="support-tags">
                  {program.types.map((type) => <span key={type} className="support-tag">{type}</span>)}
                </div>
                <h3 className="support-card-title">{program.title}</h3>
                {program.description && <p className="support-card-desc">{program.description}</p>}
                <dl className="support-facts">
                  <div>
                    <dt>신청 대상</dt>
                    <dd>{program.audience}</dd>
                  </div>
                  <div>
                    <dt>지원 내용</dt>
                    <dd>{program.support}</dd>
                  </div>
                  {program.deadline && (
                    <div>
                      <dt>신청 기한</dt>
                      <dd>
                        {program.applicationStatus && <strong>{program.applicationStatus}<br /></strong>}
                        {program.deadline !== program.applicationStatus && program.deadline}
                      </dd>
                    </div>
                  )}
                  {showGov24 && (
                    <div>
                      <dt>지원 지역</dt>
                      <dd>{!program.regions ? "지역 확인 필요" : program.regions.length === 0
                        ? "전국 공통"
                        : program.regions.length > 3
                          ? "여러 지역 · 신청 대상 참고"
                          : program.regions.map(({ province, district }) => [province, district].filter(Boolean).join(" ")).join(", ")}</dd>
                    </div>
                  )}
                  <div className="support-fact-wide">
                    <dt>신청 경로</dt>
                    <dd>{program.route}</dd>
                  </div>
                </dl>
                {program.href && (
                  <a
                    href={program.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="support-link focus-ring"
                  >
                    {program.linkLabel}
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="support-notice">
            실제 자격·서류·본인부담금은 사업과 지역, 시기에 따라 달라요. 제출 전 공식 공고를 확인해
            주세요.
          </p>
        </section>

        <aside className="support-checklist">
          <div className="support-checklist-head">
            <h2>신청 전에 챙겨볼 것</h2>
            <span>
              {checkedCount}/{checklist.length}
            </span>
          </div>
          <ul className="support-checks">
            {checklist.map((item) => (
              <li key={item}>
                <label className="support-check">
                  <input
                    type="checkbox"
                    checked={Boolean(checkedItems[item])}
                    onChange={() => toggleChecklistItem(item)}
                    className="focus-ring"
                  />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="support-checklist-foot">
            <button type="button" onClick={() => setCheckedItems({})} className="focus-ring">
              <Check aria-hidden="true" /> 체크 지우기
            </button>
            <a href="/find" className="focus-ring">
              기관부터 찾기 <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
