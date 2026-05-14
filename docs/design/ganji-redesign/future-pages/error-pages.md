# Future: 에러 페이지 (404 / 500 / 네트워크) · 보드 `errors`

> source: `untitled/project/screens-h.jsx:244` (ScreenErrorPages)
> 현재 상태: SHELL — Next.js 기본 `not-found.tsx` / `error.tsx` 미적용.

## 1. 목표
- 404 / 500 / 네트워크 끊김 / 권한 부족 4가지 상태를 동일한 디자인 톤으로.
- 사용자가 어디로 돌아가야 할지 항상 명확한 CTA.

## 2. 진입점
- `not-found.tsx` (404)
- `error.tsx` (5xx, client-side)
- `global-error.tsx` (root error boundary)
- 인증 실패 페이지 (`/login?next=...`) 와는 별도

## 3. 구현 위치
```
src/app/not-found.tsx       — 404
src/app/error.tsx           — client error
src/app/global-error.tsx    — root error
src/features/errors/error-screen.tsx   — 공통 컴포넌트
```

## 4. 디자인 (pink-soft hero + 干 로고)
- 큰 한자 (`?` 404, `!` 500, `✕` network)
- "여긴 비어 있어요" / "잠시 끊겼어요" 같은 친근체
- 1차 CTA: "홈으로", 2차: "이전 화면"

## 5. 분석 이벤트
- `error_page_viewed` { code, path, referer }

## 6. 추정 작업량
**S** (반나절)
