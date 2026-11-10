/**
 * facilities CSV 의 주소를 네이버 Geocoding API 로 좌표로 바꿔서,
 * Supabase SQL Editor 에 붙여 넣을 UPDATE 문(.sql)으로 만들어요.
 *
 * 사용법 (frontend 폴더에서):
 *   NCP_API_KEY_ID=... NCP_API_KEY=... node scripts/facilities/geocode-facilities.mjs facilities_rows.csv
 *   node scripts/facilities/geocode-facilities.mjs facilities_rows.csv --dry-run   # 주소 정리 결과만 확인
 *
 * 키는 Naver Cloud Console > Application 의 "Maps" 에서 Geocoding 을 체크한 값이에요.
 * ⚠ 이 키(Secret)는 절대 커밋하거나 NEXT_PUBLIC_ 변수에 넣지 마세요. 터미널 환경변수로만 쓰세요.
 *
 * 결과: scripts/facilities/out/ 에 geocode-cache.json, update-001.sql…, failures.csv
 * 같은 주소는 캐시를 쓰므로 중간에 멈춰도 다시 실행하면 이어서 해요.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ENDPOINT = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "out")
const CHUNK = 500
const CONCURRENCY = 3

export function parseCsv(text) {
  const rows = []
  let row = [], cell = "", quoted = false
  const t = text.replace(/^﻿/, "")
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (quoted) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") { row.push(cell); cell = "" }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = "" }
    else if (ch !== "\r") cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const PROVINCES = ["서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","경기도","강원특별자치도","충청북도","충청남도","전북특별자치도","전라남도","경상북도","경상남도","제주특별자치도"]

/** 같은 낱말 묶음이 연달아 반복되면 한 번만 남겨요. "경북 김천시 경북 김천시 모암길" → "경북 김천시 모암길" */
function dedupeTokens(tokens) {
  let out = tokens
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i + 2 * n <= out.length; ) {
      if (out.slice(i, i + n).join(" ") === out.slice(i + n, i + 2 * n).join(" ")) out = [...out.slice(0, i + n), ...out.slice(i + 2 * n)]
      else i++
    }
  }
  return out
}

/** 지오코딩이 잘 되도록 주소를 정리해요. 예: "서울 강남구 테헤란로1길 5 (역삼동) 3층 -" */
export function cleanAddress(raw) {
  let s = String(raw ?? "")
    .replace(/\([^)]*\)/g, " ") // 괄호 안 설명 제거
    .replace(/,.*$/, "") // 쉼표 뒤(상세주소) 제거
    .replace(/\.\d+호?.*$/, "") // "갈현로 33길32.201호" 의 ".201호"
    .replace(/\s+-\s*$/, "")
    .replace(/([로길])(\d+)(?![\d길번가])/g, "$1 $2") // "효원로12" → "효원로 12" ("테헤란로1길"은 그대로)
    .replace(/\s+(지하)?\s*\d+\s*층.*$/, "") // 층 이하 제거
    .replace(/\s+\d+호.*$/, "")
    .replace(new RegExp(`(^|\\s)(${PROVINCES.join("|")})(?=\\S)`, "g"), "$1$2 ") // "경기도여주시" → "경기도 여주시" (어디에 있든)
    .replace(/\s+/g, " ")
    .trim()
  let tokens = dedupeTokens(s.split(" "))
  if (tokens[0] === "세종특별자치시" && tokens[1] === "세종시") tokens.splice(1, 1) // "세종특별자치시 세종시 …"
  tokens = tokens.filter((t, i) => !(i > 1 && (t === "읍" || t === "면" || t === "동"))) // 홀로 남은 "읍"
  return tokens.join(" ")
}

/** 같은 주소의 다른 표기: "로 66길 17" ↔ "로66길 17", "정읍시충정로" ↔ "정읍시 충정로" */
function variants(addr) {
  const set = new Set([addr])
  set.add(addr.replace(/([로길]) (\d+번?길)/g, "$1$2"))
  set.add(addr.replace(/([로길])(\d+번?길)/g, "$1 $2"))
  set.add(addr.replace(/([가-힣]{1,4}[시군구])([가-힣]{2,}(?:로|길))/g, "$1 $2"))
  return [...set]
}

/** 실패하면 표기를 바꿔 보고, 그래도 안 되면 뒤에서부터 한 토큰씩 줄여서 다시 시도할 후보 목록 */
export function addressCandidates(raw) {
  const base = cleanAddress(raw)
  const tokens = base.split(" ")
  const list = []
  for (let n = tokens.length; n >= 3; n--) {
    for (const v of variants(tokens.slice(0, n).join(" "))) if (!list.includes(v)) list.push(v)
  }
  return list.length ? list : base ? [base] : []
}

export function inKorea(lat, lng) {
  return lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132
}

async function geocodeOnce(query, headers, fetchImpl) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchImpl(`${ENDPOINT}?query=${encodeURIComponent(query)}&count=1`, { headers })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }
    if (res.status === 401 || res.status === 403) throw new Error(`인증 실패(${res.status}): 키와 Geocoding 사용 설정을 확인하세요.`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const hit = json.addresses?.[0]
    if (!hit) return null
    const lat = Number(hit.y), lng = Number(hit.x)
    return Number.isFinite(lat) && Number.isFinite(lng) && inKorea(lat, lng) ? { lat, lng } : null
  }
  throw new Error("요청이 너무 많아요(429). 잠시 뒤 다시 실행하세요.")
}

export async function geocodeAddress(raw, headers, fetchImpl = fetch) {
  for (const query of addressCandidates(raw)) {
    const hit = await geocodeOnce(query, headers, fetchImpl)
    if (hit) return { ...hit, matched: query }
  }
  return null
}

export function buildSql(rows) {
  const values = rows.map((r) => `(${Number(r.id)}, ${r.lat.toFixed(7)}, ${r.lng.toFixed(7)})`).join(",\n  ")
  return `update public.facilities f set lat = v.lat, lng = v.lng\nfrom (values\n  ${values}\n) as v(id, lat, lng)\nwhere f.id = v.id;\n`
}

async function main() {
  const [file, ...flags] = process.argv.slice(2)
  if (!file) { console.error("사용법: node geocode-facilities.mjs <facilities.csv> [--dry-run | --retry]"); process.exit(1) }
  const dry = flags.includes("--dry-run")
  const [head, ...body] = parseCsv(fs.readFileSync(file, "utf8"))
  const col = (name) => head.indexOf(name)
  const [iId, iAddr] = [col("id"), col("address")]
  if (iId < 0 || iAddr < 0) throw new Error("CSV 에 id, address 컬럼이 필요해요.")
  const items = body.filter((r) => r[iId]).map((r) => ({ id: r[iId], address: r[iAddr] }))

  if (dry) {
    for (const it of items.slice(0, 15)) console.log(it.address, "→", addressCandidates(it.address)[0])
    console.log(`총 ${items.length}건 (dry-run: 호출 안 함)`)
    return
  }
  const keyId = process.env.NCP_API_KEY_ID, key = process.env.NCP_API_KEY
  if (!keyId || !key) throw new Error("환경변수 NCP_API_KEY_ID, NCP_API_KEY 를 설정하세요.")
  const headers = { "x-ncp-apigw-api-key-id": keyId, "x-ncp-apigw-api-key": key, accept: "application/json" }

  fs.mkdirSync(OUT, { recursive: true })

  // --retry: 지난번 failures.csv 에 있던 주소만, 고친 규칙으로 다시 시도해요. (이미 성공한 건 건드리지 않아요)
  if (flags.includes("--retry")) {
    const failPath = path.join(OUT, "failures.csv")
    const ids = new Set(parseCsv(fs.readFileSync(failPath, "utf8")).slice(1).map((r) => r[0]).filter(Boolean))
    const targets = items.filter((i) => ids.has(i.id))
    console.log(`재시도 ${targets.length}건`)
    const ok = [], fail = []
    for (const it of targets) {
      const hit = await geocodeAddress(it.address, headers)
      if (hit) ok.push({ id: it.id, lat: hit.lat, lng: hit.lng })
      else fail.push(it)
    }
    if (ok.length) fs.writeFileSync(path.join(OUT, "retry-update.sql"), buildSql(ok))
    fs.writeFileSync(path.join(OUT, "failures-retry.csv"), "id,address\n" + fail.map((f) => `${f.id},"${String(f.address).replace(/"/g, '""')}"`).join("\n"))
    console.log(`성공 ${ok.length}건 / 실패 ${fail.length}건 → retry-update.sql, failures-retry.csv`)
    return
  }

  const cachePath = path.join(OUT, "geocode-cache.json")
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {}
  const todo = [...new Set(items.map((i) => cleanAddress(i.address)))].filter((a) => a && !(a in cache))
  console.log(`주소 ${todo.length}건 변환 시작 (캐시 ${Object.keys(cache).length}건)`)

  let done = 0
  const queue = items.filter((i) => todo.includes(cleanAddress(i.address)))
  const seen = new Set()
  const unique = queue.filter((i) => { const k = cleanAddress(i.address); if (seen.has(k)) return false; seen.add(k); return true })
  async function worker() {
    while (unique.length) {
      const it = unique.shift()
      cache[cleanAddress(it.address)] = (await geocodeAddress(it.address, headers)) ?? null
      if (++done % 50 === 0) { console.log(`${done}/${todo.length}`); fs.writeFileSync(cachePath, JSON.stringify(cache)) }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  fs.writeFileSync(cachePath, JSON.stringify(cache))

  const ok = [], fail = []
  for (const it of items) {
    const hit = cache[cleanAddress(it.address)]
    if (hit) ok.push({ id: it.id, lat: hit.lat, lng: hit.lng })
    else fail.push(it)
  }
  for (let i = 0; i < ok.length; i += CHUNK) {
    fs.writeFileSync(path.join(OUT, `update-${String(i / CHUNK + 1).padStart(3, "0")}.sql`), buildSql(ok.slice(i, i + CHUNK)))
  }
  fs.writeFileSync(path.join(OUT, "failures.csv"), "id,address\n" + fail.map((f) => `${f.id},"${String(f.address).replace(/"/g, '""')}"`).join("\n"))
  console.log(`성공 ${ok.length}건 / 실패 ${fail.length}건 → ${OUT}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1) })
}
