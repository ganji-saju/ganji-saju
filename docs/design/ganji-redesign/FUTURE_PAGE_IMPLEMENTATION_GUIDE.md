# 미구현 화면(SHELL) 향후 구현 가이드 (2026-05-14)

> PR1~67 까지의 작업 결과 기준, SHELL 처리된 9개 보드의 향후 구현 방향.

## SHELL 처리 원칙

- 실제 서버 mutation 을 연결하지 않는다.
- 결제·상담·저장·탈퇴 같은 위험 액션은 disabled 또는 mock.
- "준비 중" 배지를 명시.
- `docs/design/ganji-redesign/future-pages/{slug}.md` 에 contract 문서화 필수.

## SHELL 목록 (9건)

| ID | 보드 | future doc |
|---|---|---|
| `help-center` | 08-4 · 고객센터 (FAQ + 1:1) | `future-pages/help-center.md` |
| `lock-screen` | 18-0 · 락스크린 푸시 위젯 | `future-pages/lock-screen.md` |
| `i18n-en` | 22 · 영문 (English) | `future-pages/i18n-en.md` |
| `tablet` | 23 · 태블릿 (1024px) | `future-pages/tablet-layout.md` |
| `banners` | 24 · 배너 시스템 (7 종) | `future-pages/banner-system.md` |
| `errors` | 25 · 에러 (404/500/네트워크) | `future-pages/error-pages.md` |
| `onboarding` | 26 · 온보딩 (4 슬라이드) | `future-pages/onboarding.md` |
| `push-modal` | 27 · 푸시 알림 권한 모달 | `future-pages/push-permission-modal.md` |
| `terms-modal` | 28 · 약관 동의 풀스크린 모달 | `future-pages/terms-consent-modal.md` |

## 공통 contract 템플릿

각 future-page 문서는 다음 섹션을 포함한다:

1. **목표** — 사용자/비즈니스 가치
2. **진입점** — 라우트 / CTA / trigger
3. **API contract** — request/response schema (필요 시)
4. **데이터 모델** — DB 스키마 / Supabase 테이블
5. **권한/인증** — 비로그인/로그인/멤버십 별 노출 분기
6. **분석 이벤트** — `trackMoonlightEvent` 호출명
7. **에러 처리** — 401/402/4xx/5xx 분기
8. **접근성** — aria / focus / keyboard / reduced-motion
9. **목업/디자인 참조** — handoff source path
10. **추정 작업량** — S/M/L

## 사용법

새 화면을 구현할 때:
1. 해당 future-page 문서를 먼저 읽는다.
2. contract 에 따라 API / 컴포넌트 / 라우트 작업 순서를 정한다.
3. 구현 완료 후 `BOARD_MANIFEST.md` 의 상태를 `SHELL → IMPLEMENTED` 로 갱신.
4. future-page 문서는 archive 디렉토리(`future-pages/archive/`)로 이동.
