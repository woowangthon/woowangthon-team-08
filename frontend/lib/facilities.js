/**
 * 상담기관(facilities) 데이터: Supabase 테이블 조회, 탭 분류, 지역 나누기, 검색, 거리 계산.
 * 화면(React)과 분리해 두어서 규칙만 바꿀 때 이 파일만 고치면 돼요.
 */

// ── 탭 ─────────────────────────────────────────────
// 탭 이름은 여기서 한 번만 정해요. (id는 주소창(URL)에도 쓰여요)
export const FACILITY_TABS = [
  { id: "all", label: "전체" },
  { id: "public", label: "공공 기관" },
  { id: "private", label: "민간상담센터" },
  { id: "hospital", label: "병원" },
]

// DB의 category_code(24종) → 탭. 목록에 없는 새 값은 "전체"에서만 보여요.
// 2026-11 기준 3,214건: 공공 640 · 민간 398 · 병원 2,176
const CATEGORY_TAB = {
  // 공공 기관
  기초정신건강복지센터: "public",
  광역정신건강복지센터: "public",
  보건소: "public",
  자살예방센터: "public",
  기초중독관리통합지원센터: "public",
  광역중독관리통합지원센터: "public",
  아동청소년정신건강지원시설: "public",
  // 병원
  의원: "hospital",
  병원: "hospital",
  종합병원: "hospital",
  정신병원: "hospital",
  요양병원: "hospital",
  한방병원: "hospital",
  한의원: "hospital",
  마약류중독자치료보호기관: "hospital",
  // 민간상담센터 (사회복귀·재활·생활 시설)
  공동생활가정: "private",
  주간재활시설: "private",
  정신요양시설: "private",
  직업재활시설: "private",
  종합시설: "private",
  생활시설: "private",
  지역사회전환시설: "private",
  중독자재활시설: "private",
  생산품판매시설: "private",
}

export function tabOfCategory(categoryCode) {
  return CATEGORY_TAB[categoryCode] ?? "other"
}

// ── 지역 ───────────────────────────────────────────
// 주소 맨 앞 단어(시·도)를 짧은 이름으로 바꿔요. 같은 지역의 옛 이름도 함께 처리해요.
const PROVINCE_SHORT = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  강원도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라북도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
}
const PROVINCE_ORDER = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
]

// 시·군·구는 주소의 두 번째 단어가 "~시/군/구"일 때만 써요. (세종처럼 구가 없는 곳은 비워 둬요)
function parseRegion(address) {
  const [first = "", second = ""] = address.trim().split(/\s+/)
  const province = PROVINCE_SHORT[first] ?? first
  const district = /(시|군|구)$/.test(second) && province !== "세종" ? second : ""
  return { province, district }
}

// ── 한 줄(row) → 화면에서 쓰는 모양 ──────────────────
function cleanHomepage(value) {
  const text = (value ?? "").trim()
  if (!text) return ""
  return /^https?:\/\//i.test(text) ? text : `https://${text}`
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeSearchText(text) {
  return String(text ?? "").toLocaleLowerCase("ko-KR").replace(/\s+/g, "")
}

function normalizeFacility(row) {
  const address = (row.address ?? "").trim()
  const category = (row.category_code ?? "").trim()
  const { province, district } = parseRegion(address)
  const lat = toNumber(row.lat)
  const lng = toNumber(row.lng)
  const hasCoords = lat !== null && lng !== null
  const name = (row.name ?? "").trim()
  return {
    id: String(row.id),
    name,
    category,
    tab: tabOfCategory(category),
    phone: (row.phone ?? "").trim(),
    address,
    homepage: cleanHomepage(row.homepage),
    province,
    district,
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    searchText: normalizeSearchText(`${name} ${address} ${category}`),
  }
}

// ── Supabase에서 전부 가져오기 ───────────────────────
const PAGE_SIZE = 1000 // Supabase는 한 번에 가져오는 행 수에 상한이 있을 수 있어서 나눠서 가져와요.
const COLUMNS = "id,name,category_code,phone,address,homepage"

async function fetchAllRows(supabase, columns) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("facilities")
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

/**
 * facilities 테이블을 모두 가져와 화면용 모양으로 바꿔요.
 * lat/lng 컬럼이 아직 없으면(좌표 SQL을 실행하기 전) 좌표 없이 가져와요.
 */
export async function fetchFacilities(supabase) {
  let rows
  try {
    rows = await fetchAllRows(supabase, `${COLUMNS},lat,lng`)
  } catch (error) {
    // 42703: 컬럼이 없음 → 좌표 없이 다시 시도
    if (error?.code !== "42703") throw error
    rows = await fetchAllRows(supabase, COLUMNS)
  }
  const facilities = rows.map(normalizeFacility)

  const provinces = [...new Set(facilities.map((item) => item.province).filter(Boolean))].sort(
    (a, b) => {
      const ai = PROVINCE_ORDER.indexOf(a)
      const bi = PROVINCE_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b, "ko")
    },
  )
  const districtsByProvince = {}
  for (const item of facilities) {
    if (!item.province || !item.district) continue
    ;(districtsByProvince[item.province] ??= new Set()).add(item.district)
  }
  for (const key of Object.keys(districtsByProvince)) {
    districtsByProvince[key] = [...districtsByProvince[key]].sort((a, b) => a.localeCompare(b, "ko"))
  }
  return {
    facilities,
    provinces,
    districtsByProvince,
    hasCoords: facilities.some((item) => item.lat !== null),
  }
}

// ── 거리 ───────────────────────────────────────────
export function distanceKm(a, b) {
  const toRad = (degree) => (degree * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

export function formatDistance(km) {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`
}

// ── 네이버 지도 링크 ────────────────────────────────
// 네이버 지도에서 장소를 검색한 화면으로 열어요(그 화면에서 "길찾기"를 누를 수 있어요).
export function naverMapLink(facility) {
  return `https://map.naver.com/p/search/${encodeURIComponent(`${facility.name} ${facility.address}`)}`
}
