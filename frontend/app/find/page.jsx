import { Suspense } from "react"
import { FindPage } from "./find-page"

// 주소(URL)의 검색·탭·지역 값을 읽는 화면이라 Suspense로 감싸요.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <FindPage />
    </Suspense>
  )
}
