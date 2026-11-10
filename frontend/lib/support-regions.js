const gwangjuDistricts = "광산구 남구 동구 북구 서구"
const jeonnamDistricts = "목포시 여수시 순천시 나주시 광양시 담양군 곡성군 구례군 고흥군 보성군 화순군 장흥군 강진군 해남군 영암군 무안군 함평군 영광군 장성군 완도군 진도군 신안군"

// The list uses city, county, and autonomous district names for residence filters.
const regions = [
  ["서울특별시 서울시 서울", "강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구"],
  ["부산광역시 부산시 부산", "강서구 금정구 기장군 남구 동구 동래구 부산진구 북구 사상구 사하구 서구 수영구 연제구 영도구 중구 해운대구"],
  ["대구광역시 대구시 대구", "군위군 남구 달서구 달성군 동구 북구 서구 수성구 중구"],
  ["인천광역시 인천시 인천", "강화군 검단구 계양구 남동구 미추홀구 부평구 서구 연수구 영종구 옹진군 제물포구"],
  ["전남광주통합특별시 전남광주", `${gwangjuDistricts} ${jeonnamDistricts}`],
  ["대전광역시 대전시 대전", "대덕구 동구 서구 유성구 중구"],
  ["울산광역시 울산시 울산", "남구 동구 북구 울주군 중구"],
  ["세종특별자치시 세종시 세종", ""],
  ["경기도 경기", "가평군 고양시 과천시 광명시 광주시 구리시 군포시 김포시 남양주시 동두천시 부천시 성남시 수원시 시흥시 안산시 안성시 안양시 양주시 양평군 여주시 연천군 오산시 용인시 의왕시 의정부시 이천시 파주시 평택시 포천시 하남시 화성시"],
  ["강원특별자치도 강원도 강원", "강릉시 고성군 동해시 삼척시 속초시 양구군 양양군 영월군 원주시 인제군 정선군 철원군 춘천시 태백시 평창군 홍천군 화천군 횡성군"],
  ["충청북도 충북", "괴산군 단양군 보은군 영동군 옥천군 음성군 제천시 증평군 진천군 청주시 충주시"],
  ["충청남도 충남", "계룡시 공주시 금산군 논산시 당진시 보령시 부여군 서산시 서천군 아산시 예산군 천안시 청양군 태안군 홍성군"],
  ["전북특별자치도 전라북도 전북", "고창군 군산시 김제시 남원시 무주군 부안군 순창군 완주군 익산시 임실군 장수군 전주시 정읍시 진안군"],
  ["경상북도 경북", "경산시 경주시 고령군 구미시 김천시 문경시 봉화군 상주시 성주군 안동시 영덕군 영양군 영주시 영천시 예천군 울릉군 울진군 의성군 청도군 청송군 칠곡군 포항시"],
  ["경상남도 경남", "거제시 거창군 고성군 김해시 남해군 밀양시 사천시 산청군 양산시 의령군 진주시 창녕군 창원시 통영시 하동군 함안군 함양군 합천군"],
  ["제주특별자치도 제주도 제주", "서귀포시 제주시"],
]

export const supportRegions = Object.fromEntries(regions.map(([names, districts]) => [
  names.split(" ")[0], districts ? districts.split(" ") : [],
]))

const provinceScopes = new Map(regions.flatMap(([names, districts]) => {
  const [province, ...aliases] = names.split(" ")
  const scope = { province, districts: districts ? districts.split(" ") : [] }
  return [province, ...aliases].map((name) => [name, scope])
}))
for (const [aliases, districts] of [["광주광역시", gwangjuDistricts], ["전라남도 전남", jeonnamDistricts]]) {
  for (const alias of aliases.split(" ")) {
    provinceScopes.set(alias, { province: "전남광주통합특별시", districts: districts.split(" "), legacy: true })
  }
}

const districtNames = [...new Set(Object.values(supportRegions).flat())]
const alternatives = (names) => [...names].sort((a, b) => b.length - a.length).join("|")
const provincePattern = alternatives(provinceScopes.keys())
const districtPattern = alternatives(districtNames)
const place = `(?:(?<province>${provincePattern})(?:\\s*(?<district>${districtPattern}))?|(?<local>${districtPattern}))`
const residenceSuffix = "(?:\\s*(?:관내|내)?\\s*(?:에|에서|의)?\\s*(?:실제\\s*|\\d+\\s*(?:년|개월)\\s*이상\\s*)?(?:거주|주민등록(?:을|이|상)|주소(?:를|가))|민(?![가-힣]))"
const residencePatterns = [
  new RegExp(`(?<![가-힣])${place}${residenceSuffix}`, "g"),
  new RegExp(`(?:주민등록상|거주지(?:가|는)?|주소지(?:가|는)?)\\s*${place}(?![가-힣]|\\s+[가-힣]+[시군구읍면동](?=\\s|에|$))`, "g"),
]

export function classifySupportRegion(audience, nationwideTitle = "") {
  if (/미거주|비거주|거주하지|거주자.{0,8}제외|지역.{0,8}제외/.test(audience)) return null

  const matches = residencePatterns.flatMap((pattern) => [...audience.matchAll(pattern)])
  const scopes = new Map()
  for (const { groups } of matches) {
    const district = groups.district || groups.local
    const parent = provinceScopes.get(groups.province)
    if (district) {
      const parents = parent ? [parent.province] : Object.keys(supportRegions).filter(
        (province) => supportRegions[province].includes(district),
      )
      if (parents.length !== 1 || (parent && !parent.districts.includes(district))) return null
      scopes.set(`${parents[0]}/${district}`, { province: parents[0], district })
    } else if (parent?.legacy) {
      for (const name of parent.districts) {
        scopes.set(`${parent.province}/${name}`, { province: parent.province, district: name })
      }
    } else if (parent) {
      scopes.set(parent.province, { province: parent.province })
    }
  }

  if (scopes.size) {
    const districts = new Set([...scopes.values()].filter((scope) => scope.district).map((scope) => scope.province))
    return [...scopes.values()].filter((scope) => scope.district || !districts.has(scope.province))
  }

  const nationwideAudience = /(?:전국\s*(?:민|국민|청년|거주자)|전\s+국민)(?![가-힣])|거주\s*지역\s*(?:제한\s*)?없음/
  if (nationwideAudience.test(audience)) return []
  return /^전\s*국민(?:\s|$)/.test(nationwideTitle) && !/거주|주민등록|주소지/.test(audience) ? [] : null
}

export function matchesSupportRegion(scopes, province, district) {
  if (!province) return true
  if (!scopes) return false
  return scopes.length === 0 || scopes.some((scope) => (
    scope.province === province && (!district || !scope.district || scope.district === district)
  ))
}
