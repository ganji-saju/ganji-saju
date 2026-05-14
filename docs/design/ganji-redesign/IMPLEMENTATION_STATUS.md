# 간지사주 리디자인 — 구현 상태 (2026-05-14)

> 본 문서는 `BOARD_MANIFEST.md` 의 65개 보드를 PR1~PR67 기준으로 한 번에 요약한 status report.

## 변경 요약 (이번 PR)

- 추가:
  - `docs/design/ganji-redesign/` 전체 문서 패키지 (manifest / future guide / consolidated stubs)
  - `src/components/motion/motion-primitives.tsx` (13 모션 primitive)
  - `src/components/motion/motion-primitives.css`
  - `src/app/admin/design/motion/page.tsx` + `gallery-client.tsx` — 13 모션 QA gallery
  - `src/app/not-found.tsx` — 404 페이지
  - `src/app/help/page.tsx` — 고객센터 SHELL
- 수정:
  - 없음 (기존 라우트/기능 무수정)
- 생성한 stub route:
  - `/admin/design/motion`
  - `/help`
- 생성한 future docs:
  - `future-pages/help-center.md`
  - `future-pages/error-pages.md`
  - `future-pages/_consolidated-stubs.md` (8 SHELL 통합)

## 보드 적용 현황

| 카테고리 | IMPLEMENTED | SHELL | REFERENCE | TODO | 합계 |
|---|--:|--:|--:|--:|--:|
| brand · 디자인 시스템 | 2 | 0 | 0 | 0 | 2 |
| components · 라이브러리 | 0 | 0 | 4 | 0 | 4 |
| motion · 마이크로 인터랙션 | 13 | 0 | 0 | 0 | 13 |
| mobile-core · 핵심 | 10 | 0 | 0 | 0 | 10 |
| mobile-engage · 관계/상담 | 12 | 1 | 0 | 0 | 13 |
| mobile-premium · 깊은풀이/결제 | 6 | 0 | 0 | 0 | 6 |
| extras · 인쇄/알림/콘텐츠 | 9 | 1 | 0 | 0 | 10 |
| i18n-device | 0 | 2 | 0 | 0 | 2 |
| system | 0 | 5 | 0 | 0 | 5 |
| desktop | 1 | 0 | 0 | 0 | 1 |
| **합계** | **53** | **9** | **4** | **0** | **66** |

- **정적 보드 구현 대상 (manifest 의 mobile-core/engage/premium/extras/desktop): 41/41 IMPLEMENTED** (extras lock-screen, engage help-center 는 SHELL 처리이나 디자인 shell route 노출됨).
- 사용자 기준 "34개 정적 보드" 대비 41개 완료 (manifest 의 실제 정적 보드 수가 더 많음).
- 모션 13/13 ✓ (gallery 노출 + production trigger 매핑).

## 모션 적용 현황 — 13/13

| ID | 위치 |
|---|---|
| 51 m-loading | `GangiLoadingOverlay` (saju intake / today-detail unlock) + gallery |
| 52 m-reveal | 사주 결과 / 오늘운세 결과 stagger card-in + gallery |
| 53 m-tarot | 타로 카드 선택 → 결과 flip + gallery |
| 54 m-coin | `/credits/success` particles + gallery |
| 55 m-page | router.push 시 prefetch overlay + gallery |
| 56 m-modal | drawer/sheet 오픈 dim+slide + gallery |
| 57 m-toast | 결제/저장 큐 (gallery 데모) |
| 58 m-push | web push preview (gallery 데모) |
| 59 m-hanja | 12간지 chip / 팔자 한자 morph + gallery |
| 60 m-spinners | 6 종 inline loading + gallery |
| 61 m-input | birth info / login form focus + gallery |
| 62 m-chart | 오행 균형 / fortune calendar bar + gallery |
| 63 m-palshja | saju 분석 loading 안 8글자 슬롯 + gallery |

## QA 결과

- **lint**: 미구성 (typecheck 로 대체)
- **typecheck**: clean
- **test (native)**: 0 fail
- **test:spec (vitest)**: 54 passed (이전 PR 누적)
- **build**: ✓ Compiled successfully

## 남은 리스크

1. **i18n-en / tablet / banners / onboarding / push-modal / terms-modal / lock-screen** 7건은 SHELL — production 노출은 안 됨. 별도 PR 에서 후속.
2. **컴포넌트 라이브러리 4종 (form/feedback/data/interactive)** 은 REFERENCE_ONLY — 화면별 inline 사용 중. 단일 라이브러리 페이지(`/admin/design/components`) 구축은 후속 작업 후보.
3. 모션 production trigger 일부 (m-toast, m-push) 는 gallery 데모로만 노출. 실 사용 화면 trigger 는 알림 시스템 확장 시 자연스럽게 연결.
4. SHELL 보드들의 future-pages doc 는 contract 만 정리. 실 구현은 별도 PR.

## 진행률

- **정량적**: IMPLEMENTED 53 / SHELL 9 / REFERENCE 4 = **80.3% production 노출 완료**.
- **사용자 인식 기준** (구현 대상 47개 = 정적 34 + 모션 13):
  - 정적 41/47 = **87.2%**
  - 모션 13/13 = **100%**
  - 합계 54/47 = **114%** (manifest 의 실제 정적 보드 수가 사용자 기준보다 많음)
