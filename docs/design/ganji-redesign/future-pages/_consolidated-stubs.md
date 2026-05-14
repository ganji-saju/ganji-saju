# 통합 SHELL 항목 contract (8건)

> 단독 페이지보다는 시스템·요소 라이브러리 성격이라 한 문서로 묶음.
> 각 항목별로 추후 단독 future doc 으로 분리 가능.

## 1. `lock-screen` — 락스크린 푸시 위젯

- **상태**: SHELL (production OS 락스크린은 PWA 영역).
- **임시 데모**: `/admin/design/motion#m-push` 에서 시각 재현.
- **추후 실 구현**: web-push subscription + service-worker push handler + 푸시 페이로드 디자인 토큰 (이미 일부 구현 됨, `src/lib/notification-preferences.ts`).
- **작업량**: M (PWA manifest + service worker icon + push payload schema 확정).

## 2. `i18n-en` — 영문 (English)

- **상태**: SHELL. 한국어 single-locale 만 노출.
- **추후 실 구현**:
  - `next-intl` 도입.
  - `src/lib/saju/terminology.ts` 의 ko 매핑을 en 으로 mirror.
  - 사주 풀이 자체는 한자/한국어 결이 강해 en 풀이는 별도 카피라이팅 필요.
- **작업량**: L (전체 라우트 locale prefix + 카피 번역 1~2주).

## 3. `tablet` — 태블릿 (1024px)

- **상태**: SHELL. 모든 페이지가 mobile-first + responsive `sm/md/lg` 분기 적용. 별도 tablet-only layout 미구현.
- **추후 실 구현**: 결과 페이지 / 깊은 풀이 / 캘린더에 2 컬럼 grid 분기 추가.
- **작업량**: M (페이지별 6~8개 분기 추가).

## 4. `banners` — 배너 시스템 (7 종) ✅ IMPLEMENTED

- **상태**: 완료.
- **구현**: `src/components/gangi/gangi-banner.tsx` — `<GangiBanner kind="...">` 7 variants:
  - `hero` (pink solid gradient + 한자 deco)
  - `soft` (pink-soft + leading 슬롯)
  - `cosmic` (ink + 별 패턴)
  - `inline` (가격 칩)
  - `sticky` (하단 고정)
  - `success` (jade)
  - `warning` (coral)
- **showcase**: `/admin/design/banners` 에서 7 variant 한눈에 확인.
- **남은 작업**: 기존 inline pink-soft hero 사용처(20+ 페이지)를 점진적으로 GangiBanner 로 마이그레이션 — 후속 PR 에서 화면별 진행.

## 5. `errors` — 에러 (404/500/네트워크) ✅ IMPLEMENTED

- **상태**: 완료.
  - 404: `src/app/not-found.tsx` (PR #68)
  - client 5xx: `src/app/error.tsx`
  - root error: `src/app/global-error.tsx`
- **공통 디자인**: pink-soft(404) / coral-soft(5xx) hero + 干/月 한자 + 재시도 + 홈으로 CTA.
- **네트워크 끊김**: client error boundary 가 fetch 실패 시 자연스럽게 잡음.
- **남은 작업**: 공통 `<ErrorScreen kind="...">` 컴포넌트 추출은 후속 (3개 파일이 거의 동일한 디자인).

## 6. `onboarding` — 온보딩 (4 슬라이드)

- **상태**: SHELL. login → empathy → birth 흐름이 사실상 onboarding. 별도 onboarding 화면 미구현.
- **추후 실 구현**:
  - 신규 가입자 first-visit cookie 로 `/onboarding` redirect.
  - 4 슬라이드 carousel + skip CTA.
- **작업량**: M (cookie / redirect / carousel + 카피).

## 7. `push-modal` — 푸시 알림 권한 모달 ✅ IMPLEMENTED

- **상태**: 완료.
- **구현**: `src/components/notifications/push-permission-modal.tsx` —
  `<PushPermissionModal open onClose onSubscribed onDenied webPushPublicKey>`.
  - 가치 제안 3종 (MoonStar / Clock / Sparkles) → 알림 허용 / 다음에 받기 CTA.
  - 흐름: `Notification.requestPermission` → `serviceWorker.register('/push-sw.js')` →
    `pushManager.subscribe` → POST `/api/notifications/subscribe`.
  - ESC 닫기 + body scroll lock + 모바일 sheet / sm:centered.
  - `onDenied` reason: `'permission-denied' | 'subscribe-failed' | 'unavailable'`.
- **showcase**: `/admin/design/push-modal` — 모달 열기 버튼 + 마지막 이벤트 표시.
- **남은 작업**: caller 트리거 정책(가입 7일차 자동 노출 등)은 별도 PR.

## 8. `terms-modal` — 약관 동의 풀스크린 모달

- **상태**: SHELL. 회원가입 흐름 안 implicit consent 사용. 풀스크린 모달 미구현.
- **추후 실 구현**: GDPR/14세 미만 등 강한 동의가 필요한 시점에만 노출.
- **작업량**: S.
