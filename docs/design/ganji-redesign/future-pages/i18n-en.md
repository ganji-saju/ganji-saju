# 영문 (English) — i18n-en

> handoff 보드 `i18n-en` (22) SHELL contract.
> 현재 한국어 single-locale 만 노출. 영문 풀이는 별도 카피라이팅 필요.

## 상태

**SHELL** — 별도 라우트 미구현. `_consolidated-stubs.md §2` 에서 통합 안내되던 항목을 본 문서로 분리 (manifest 가 인용하던 파일 경로 정합성 복구, 2026-05-15 PR-H).

## 추후 실 구현 (작업량 L · 1~2주)

### 인프라
- `next-intl` 도입 — Next.js App Router 친화 i18n 라이브러리
- `app/[locale]/...` 라우트 구조 마이그레이션 (또는 `app/(localized)` group routing)
- `middleware.ts` (현 `src/proxy.ts`) 에 locale 분기 추가

### 데이터 매핑
- `src/lib/saju/terminology.ts` 의 ko 매핑을 en 으로 mirror
- 60갑자 일주 캐릭터(`src/data/saju/sixty-gapja-core.json`) 영문 변환
- 격국 / 용신 / 십성 / 12운성 / 신살 등 명리 용어 영문 표기

### 카피라이팅 (가장 큰 작업)
- 사주 풀이 자체가 한자/한국어 문맥에 강하게 의존
- 단순 번역이 아닌 별도 영문 카피라이팅 필요
- `interpretation-rule-table.ts` 의 45개 lead 모두 영문 재작성
- punch-copy / build-narrative / today-fortune 본문 모두 영문 분기 필요

### LLM 풀이
- `src/server/ai/saju-interpretation.ts` 의 prompt 영문 분기
- 영문 사용자의 단정형/유보형 톤 결정 (한국어와 다른 신뢰감 시그널)

## 예상 비용 (대략)

- 인프라 + 라우팅: 3~5일
- 카피라이팅 (수기): 1~2주 (전문 명리 영문 작가 필요 또는 외주)
- LLM prompt 영문 분기 + QA: 2~3일
- **총 2~3주**

## 우선순위

해외 사용자 확보 전략이 명확해진 시점 이후. 현 단계에서는 한국어 single-locale 에 집중하는 게 ROI 면에서 맞음.

## 관련 보드

- `pricing` (KRW 단일, USD 분기 미구현)
- `payment` (Toss 한국 결제, 해외 결제 게이트웨이 별도)
- `tablet` (responsive 처리, locale 와는 별개)

## 참고

- `docs/design/ganji-redesign/source/04_FUTURE_PAGE_IMPLEMENTATION_GUIDE.md` — SHELL 의 정의
- `docs/design/ganji-redesign/BOARD_MANIFEST.md` — manifest row `i18n-en`
- `audit-reports/2026-05-15-handoff-implementation-audit.md §2.2` — 파일 경로 누락 지적
