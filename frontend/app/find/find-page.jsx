"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowUpRight, Search } from "lucide-react"
import { DirectoryMap } from "./directory-map"
import { PageHeading } from "@/components/page-heading"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { createClient } from "@/lib/supabase/client"
import {
  FACILITY_TABS,
  distanceKm,
  fetchFacilities,
  formatDistance,
  naverMapLink,
  normalizeSearchText,
} from "@/lib/facilities"
import "./find-page.css"

const PAGE_STEP = 10 // 목록은 10곳씩 보여주고, "더 보기"로 늘려요.
const TAB_IDS = FACILITY_TABS.map((tab) => tab.id)

function FilterSelect({ id, label, value, options, onChange, disabled = false }) {
  return (
    <label htmlFor={id} className="dir-field">
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="dir-select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ResultSkeleton() {
  return (
    <ul className="dir-list" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="dir-card dir-skeleton">
          <span className="dir-skel dir-skel--tag" />
          <span className="dir-skel dir-skel--title" />
          <span className="dir-skel dir-skel--line" />
          <span className="dir-skel dir-skel--short" />
        </li>
      ))}
    </ul>
  )
}

export function FindPage() {
  const params = useSearchParams()

  // 주소(URL)에서 처음 상태를 읽어와요 (새로고침·링크 공유 때 그대로 이어져요)
  const [tab, setTab] = useState(() => (TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "all"))
  const [query, setQuery] = useState(() => params.get("q") ?? "")
  const [province, setProvince] = useState(() => params.get("sido") ?? "")
  const [district, setDistrict] = useState(() => params.get("sigungu") ?? "")

  const [load, setLoad] = useState({ status: "loading", data: null })
  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [sortNear, setSortNear] = useState(false)
  const [viewportOnly, setViewportOnly] = useState(false)
  const [viewportIds, setViewportIds] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)

  // ── 데이터 불러오기 (Supabase facilities 테이블) ──
  const loadFacilities = useCallback(async () => {
    setLoad({ status: "loading", data: null })
    try {
      const data = await fetchFacilities(createClient())
      setLoad({ status: "ready", data })
    } catch (error) {
      console.error("facilities 조회 실패", error)
      setLoad({ status: "error", data: null })
    }
  }, [])
  useEffect(() => {
    loadFacilities()
  }, [loadFacilities])

  const data = load.data
  const facilities = data?.facilities
  const provinces = data?.provinces
  const districts = data && province ? (data.districtsByProvince[province] ?? []) : []
  const activeProvince = provinces?.includes(province) ? province : ""
  const activeDistrict = activeProvince && districts.includes(district) ? district : ""
  const queryKey = normalizeSearchText(query)

  // ── 주소(URL)에 현재 조건 저장 ──
  useEffect(() => {
    const next = new URLSearchParams()
    if (tab !== "all") next.set("tab", tab)
    if (query.trim()) next.set("q", query.trim())
    if (activeProvince || (load.status !== "ready" && province)) next.set("sido", activeProvince || province)
    if (activeDistrict || (load.status !== "ready" && district)) next.set("sigungu", activeDistrict || district)
    const text = next.toString()
    window.history.replaceState(null, "", text ? `?${text}` : window.location.pathname)
  }, [tab, query, province, district, activeProvince, activeDistrict, load.status])

  // ── 검색 + 지역 → 탭별 개수 → 탭 ──
  const searched = useMemo(() => {
    if (!facilities) return []
    return facilities.filter(
      (item) =>
        (!activeProvince || item.province === activeProvince) &&
        (!activeDistrict || item.district === activeDistrict) &&
        (!queryKey || item.searchText.includes(queryKey)),
    )
  }, [facilities, activeProvince, activeDistrict, queryKey])

  const tabCounts = useMemo(() => {
    const counts = { all: searched.length, public: 0, private: 0, hospital: 0 }
    for (const item of searched) if (item.tab in counts) counts[item.tab] += 1
    return counts
  }, [searched])

  const filtered = useMemo(
    () => (tab === "all" ? searched : searched.filter((item) => item.tab === tab)),
    [searched, tab],
  )

  // ── 정렬: 기본은 이름순, "가까운 순"이면 내 위치 기준 ──
  const distances = useMemo(() => {
    if (!userLocation) return null
    const map = new Map()
    for (const item of filtered) {
      if (item.lat !== null) map.set(item.id, distanceKm(userLocation, item))
    }
    return map
  }, [filtered, userLocation])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sortNear && distances) {
      return list.sort(
        (a, b) =>
          (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity) ||
          a.name.localeCompare(b.name, "ko"),
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "ko"))
  }, [filtered, sortNear, distances])

  // ── "지도에 보이는 기관만" ──
  const viewportSet = useMemo(() => (viewportIds ? new Set(viewportIds) : null), [viewportIds])
  const listBase = useMemo(
    () => (viewportOnly && viewportSet ? sorted.filter((item) => viewportSet.has(item.id)) : sorted),
    [sorted, viewportOnly, viewportSet],
  )

  // ── 선택·호버한 카드는 맨 위로 ──
  const activeSelectedId = filtered.some((item) => item.id === selectedId) ? selectedId : null
  const activeHoverId = filtered.some((item) => item.id === hoverId) ? hoverId : null
  const topIds = [activeHoverId, activeSelectedId].filter((id, index, all) => id && all.indexOf(id) === index)
  const topItems = topIds.map((id) => filtered.find((item) => item.id === id))
  const rest = listBase.filter((item) => !topIds.includes(item.id))
  const shownRest = rest.slice(0, visibleCount)
  const shown = [...topItems, ...shownRest]
  const total = listBase.length
  const remaining = rest.length - shownRest.length

  // 조건이 바뀌면 10곳부터 다시 보여줘요.
  const fitKey = `${tab}|${activeProvince}|${activeDistrict}|${queryKey}`
  useEffect(() => {
    setVisibleCount(PAGE_STEP)
  }, [fitKey, viewportOnly, sortNear])

  // 지도에서 핀을 골라 맨 위로 올라온 카드가 화면 밖이면 보이게 해요.
  useEffect(() => {
    if (!activeSelectedId) return
    const card = document.getElementById("dir-top-card")
    if (!card) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    card.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
  }, [activeSelectedId])

  const toggleSelected = useCallback((id) => setSelectedId((current) => (current === id ? null : id)), [])

  function handleLocate(coords) {
    setUserLocation(coords)
    setSortNear(true)
  }

  function resetFilters() {
    setTab("all")
    setQuery("")
    setProvince("")
    setDistrict("")
    setSelectedId(null)
    setViewportOnly(false)
  }

  const hasFilters = tab !== "all" || query.trim() || activeProvince || viewportOnly

  return (
    <div className="dir-page">
      <PageHeading
        eyebrow="상담기관 찾기"
        title="어디서 상담받을 수 있을까요"
        description="지역과 유형으로 좁혀 보고, 지도에서 위치를 확인해 보세요. 가기 전에는 공식 안내를 꼭 확인해 주세요."
      />

      <section aria-label="조건 선택" className="dir-filters">
        <div className="dir-searchrow">
          <InputGroup className="dir-search">
            <InputGroupAddon align="inline-start" className="dir-search-icon">
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="resource-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="기관 이름이나 주소로 검색 (예: 정신건강복지센터, 강남구)"
              aria-label="기관 이름 또는 주소 검색"
            />
          </InputGroup>
          <FilterSelect
            id="province-filter"
            label="시·도"
            value={activeProvince}
            disabled={!provinces}
            onChange={(value) => {
              setProvince(value)
              setDistrict("")
            }}
            options={[
              { value: "", label: "전체 지역" },
              ...(provinces ?? []).map((name) => ({ value: name, label: name })),
            ]}
          />
          <FilterSelect
            id="district-filter"
            label="시·군·구"
            value={activeDistrict}
            disabled={!districts.length}
            onChange={setDistrict}
            options={[
              { value: "", label: "전체 시·군·구" },
              ...districts.map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>

        <div className="dir-tabs" role="group" aria-label="기관 유형">
          {FACILITY_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
              className="dir-tab"
            >
              {item.label}
              {load.status === "ready" && <span className="dir-tab-count">{tabCounts[item.id].toLocaleString()}</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="dir-layout">
        <section aria-labelledby="results-heading" className="dir-results">
          <div className="dir-resultbar">
            <h2 id="results-heading" className="dir-count" aria-live="polite">
              {load.status === "ready" ? `${total.toLocaleString()}곳` : "기관"}
            </h2>
            <div className="dir-tools">
              {userLocation && (
                <button
                  type="button"
                  aria-pressed={sortNear}
                  onClick={() => setSortNear((value) => !value)}
                  className="dir-toggle"
                >
                  가까운 순
                </button>
              )}
              <button
                type="button"
                aria-pressed={viewportOnly}
                onClick={() => setViewportOnly((value) => !value)}
                className="dir-toggle"
              >
                지도에 보이는 곳만
              </button>
              {hasFilters && (
                <button type="button" onClick={resetFilters} className="dir-reset">
                  조건 초기화
                </button>
              )}
            </div>
          </div>

          {load.status === "loading" && <ResultSkeleton />}

          {load.status === "error" && (
            <div className="dir-empty" role="alert">
              <h3>기관 목록을 불러오지 못했어요</h3>
              <p>잠시 뒤 다시 시도해 주세요. 계속 안 되면 팀에 알려 주세요.</p>
              <button type="button" onClick={loadFacilities}>
                다시 시도
              </button>
            </div>
          )}

          {load.status === "ready" && total === 0 && (
            <div className="dir-empty">
              <h3>조건에 맞는 곳이 없어요</h3>
              <p>
                {viewportOnly
                  ? "지도를 움직이거나 ‘지도에 보이는 곳만’을 꺼서 다시 찾아보세요."
                  : "지역이나 유형을 바꿔서 다시 찾아보세요."}
              </p>
              <button type="button" onClick={resetFilters}>
                조건 모두 지우기
              </button>
            </div>
          )}

          {load.status === "ready" && total > 0 && (
            <>
              <ul className="dir-list">
                {shown.map((item, index) => {
                  const isSelected = item.id === activeSelectedId
                  const hasCoords = item.lat !== null
                  const km = distances?.get(item.id)
                  return (
                    <li
                      key={item.id}
                      id={index === 0 && topIds.length > 0 ? "dir-top-card" : undefined}
                      className="dir-card"
                      data-selected={isSelected || undefined}
                      data-hover={item.id === activeHoverId || undefined}
                      data-clickable={hasCoords || undefined}
                    >
                      <div className="dir-card-meta">
                        <span className="dir-pin dir-pin--dot" data-kind={item.tab} aria-hidden="true" />
                        <span className="dir-tag">{item.category || "기관"}</span>
                        {km !== undefined && <span className="dir-location">내 위치에서 {formatDistance(km)}</span>}
                      </div>
                      <h3 className="dir-card-title">
                        {hasCoords ? (
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleSelected(item.id)}
                            className="dir-card-select"
                          >
                            {item.name}
                          </button>
                        ) : (
                          item.name
                        )}
                      </h3>
                      <p className="dir-card-address">{item.address}</p>
                      {item.phone && <p className="dir-card-phone">{item.phone}</p>}
                      <div className="dir-card-actions">
                        {item.homepage && (
                          <a href={item.homepage} target="_blank" rel="noopener noreferrer" className="dir-link">
                            홈페이지
                            <ArrowUpRight aria-hidden="true" />
                          </a>
                        )}
                        <a href={naverMapLink(item)} target="_blank" rel="noopener noreferrer" className="dir-link">
                          네이버 지도 길찾기
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="dir-more-row">
                <p className="dir-range" aria-live="polite">
                  {total.toLocaleString()}곳 중 {shown.length.toLocaleString()}곳 표시
                </p>
                {remaining > 0 && (
                  <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_STEP)} className="dir-loadmore">
                    {Math.min(PAGE_STEP, remaining)}곳 더 보기
                  </button>
                )}
              </div>
            </>
          )}
          <p className="dir-notice">
            운영 시간·예약 가능 여부는 바뀔 수 있어요. 가기 전에 기관에 직접 확인해 주세요.
          </p>
          <p className="dir-map-privacy dir-map-privacy--list">내 위치는 지도 이동에만 쓰고, 저장하거나 서버로 보내지 않아요.</p>
        </section>

        <aside aria-label="상담기관 지도" className="dir-aside">
          <DirectoryMap
            className="dir-map--sized"
            items={filtered}
            selectedId={activeSelectedId}
            fitKey={fitKey}
            hasCoordsInDb={load.status !== "ready" || data.hasCoords}
            reportViewport={viewportOnly}
            onSelect={toggleSelected}
            onHover={setHoverId}
            onViewportChange={setViewportIds}
            onLocate={handleLocate}
          />
          <ul className="dir-legend" aria-label="핀 모양 안내">
            {FACILITY_TABS.filter((item) => item.id !== "all").map((item) => (
              <li key={item.id}>
                <span className="dir-pin dir-pin--dot" data-kind={item.id} aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="dir-map-privacy dir-map-privacy--aside">내 위치는 지도 이동에만 쓰고, 저장하거나 서버로 보내지 않아요.</p>
        </aside>
      </div>
    </div>
  )
}
