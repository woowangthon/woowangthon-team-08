# 마음결

청년 마음건강 첫걸음 서비스 (Next.js 16 + AI SDK).

## 실행 방법

1. Node.js 20 이상 설치
2. 이 `frontend` 폴더를 VS Code로 엽니다.
3. 터미널에서 패키지 설치:
   ```
   npm install
   ```
4. `.env.example`을 복사해 `.env.local`을 만들고 `GOOGLE_GENERATIVE_AI_API_KEY`를 채웁니다.
   (Google AI Studio에서 발급한 Gemini API 키)
   (키가 없어도 화면은 열리지만 채팅·요약 기능은 동작하지 않습니다.)
5. 개발 서버 실행:
   ```
   npm run dev
   ```
6. 브라우저에서 http://localhost:3000 을 엽니다.

## 페이지

- `/` 홈 · `/chat` 마음 정리 · `/summary` 상담 메모 · `/find` 상담기관 찾기 · `/support` 지원제도 탐색 · `/login` 로그인 · `/signup` 회원가입 (로그인·가입은 화면만 있고 Supabase 연결은 TODO)
