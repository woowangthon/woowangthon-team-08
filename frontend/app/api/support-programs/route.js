const endpoint = "https://api.odcloud.kr/api/gov24/v3/serviceList"
const pageSize = 300
const mentalHealthPattern = /정신건강|마음건강|심리상담|심리치료|마음투자|정신질환/

function toProgram(service) {
  const id = service?.서비스ID
  const title = service?.서비스명?.trim()
  if (!id || !title) return null

  const description = service.서비스목적요약?.trim()
  const support = service.지원내용?.trim()
  const searchText = [title, description, support].join(" ").replace(/\s/g, "")
  if (!mentalHealthPattern.test(searchText)) return null

  const source = service.상세조회URL?.trim()
  const url = source && URL.canParse(source) ? new URL(source) : null
  const audience = service.지원대상?.trim() ?? ""
  const deadline = service.신청기한?.trim() ?? ""
  const nationwideTitle = service.소관기관유형 === "중앙행정기관" ? title : ""

  return {
    id,
    title,
    category: "정부24",
    description,
    audience: audience || "공식 안내에서 확인해 주세요.",
    support: support || "공식 안내에서 확인해 주세요.",
    deadline: deadline || "일정 확인 필요",
    application: parseSupportApplication(deadline, service.신청기한유형?.trim() ?? ""),
    regions: classifySupportRegion(audience, nationwideTitle),
    route: service.신청방법?.trim() || "공식 안내에서 확인해 주세요.",
    href: url && ["https:", "http:"].includes(url.protocol) ? url.href : null,
    linkLabel: "정부24 상세 안내",
  }
}

export async function GET() {
  const serviceKey = process.env.GOV24_SERVICE_KEY?.trim()
  if (!serviceKey) return Response.json({ status: "unconfigured" })

  const signal = AbortSignal.timeout(15_000)
  async function fetchPage(page) {
    const url = new URL(endpoint)
    url.search = new URLSearchParams({ page, perPage: pageSize, serviceKey }).toString()
    const response = await fetch(url, { next: { revalidate: 3600 }, signal, redirect: "error" })
    if (!response.ok) throw new Error("정부24 목록 요청 실패")

    const result = await response.json()
    if (!Array.isArray(result?.data) || !Number.isSafeInteger(result.totalCount) || result.totalCount < 0) {
      throw new Error("정부24 목록 응답 형식 오류")
    }
    return result
  }

  try {
    const firstPage = await fetchPage(1)
    if (firstPage.totalCount > 0 && firstPage.data.length === 0) {
      throw new Error("정부24 목록 첫 페이지 누락")
    }

    const services = [...firstPage.data]
    const pageCount = Math.ceil(firstPage.totalCount / (firstPage.data.length || pageSize))
    const batchSize = 6
    for (let page = 2; page <= pageCount; page += batchSize) {
      const pages = await Promise.all(
        Array.from({ length: Math.min(batchSize, pageCount - page + 1) }, (_, offset) => fetchPage(page + offset)),
      )
      for (const result of pages) services.push(...result.data)
    }

    const programs = new Map()
    for (const service of services) {
      const program = toProgram(service)
      if (program) programs.set(program.id, program)
    }
    return Response.json({ status: "ok", programs: [...programs.values()] })
  } catch {
    return Response.json({ status: "unavailable" }, { status: 502 })
  }
}
import { parseSupportApplication } from "../../../lib/support-application.js"
import { classifySupportRegion } from "../../../lib/support-regions.js"

