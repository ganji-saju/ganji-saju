# 미완성 UI 금지문구 '준비 중' 전수 스캔·분류 (2026-06-07)

> 백로그 `project_backlog_forbidden-phrase-guard` 1단계. 닫힌 PR #235 계승.
> 가드 검출 패턴: `준비 중 / 준비중 / 로딩중... / 결과가 없습니다 / Coming soon / TODO / FIXME`
> 스캔 범위: `src/**/*.{ts,tsx}` (`.test.` `.spec.` 제외). TODO/FIXME 노출 0건 확인.

## 요약

| 분류 | 건수 | 처리 방향 |
|---|---|---|
| A. 실노출 '준비 중' — **정리 대상** | 13 | 표준 컴포넌트/확정 카피로 교체 |
| B. 결정 필요 (정책 판단) | 3그룹 | 사용자 확인 후 진행 |
| C. 오탐 — 콘텐츠 자연어 (유지, **가드 설계 제약**) | 5 | 가드가 검출하면 안 됨 |
| D. 비노출 — 코드 주석/변경이력 (무관) | 14 | innerText 가드와 무관, 정리 불필요 |

---

## A. 실노출 '준비 중' — 정리 대상 (13)

실제 사용자 화면에 '준비 중' 텍스트가 렌더되는 지점.

| # | 파일:라인 | 현재 | 노출 조건 | 교체안 |
|---|---|---|---|---|
| A1 | `domain/saju/report/build-report.ts:651` | `title: '강약 계산 준비 중'` | 리포트(seed/미계산 데이터) | "강약 분석 준비 안내" 류 확정 카피 또는 EmptyState |
| A2 | `…/build-report.ts:689` | `title: '격국 계산 준비 중'` | 〃 | 〃 |
| A3 | `…/build-report.ts:731` | `title: '용신 계산 준비 중'` | 〃 | 〃 |
| A4 | `app/api/ai/route.ts:313` | `'강약 계산 준비 중'` | AI 응답 fallback | A1~A3과 통일 |
| A5 | `app/api/ai/route.ts:314` | `pattern: … ?? '격국 계산 준비 중'` | 〃 | 〃 |
| A6 | `components/gangi/gangi-ui.tsx:27` | 엠지쥐선생 `price: '준비 중'` | gangi 리스트 `{price}` 직접 렌더 | `price` 숨김 또는 '출시 예정' |
| A7 | `…/gangi-ui.tsx:32` | 꿈뱀선생 `price: '준비 중'` | 〃 | 〃 |
| A8 | `…/gangi-ui.tsx:35` | 관상원선생 `price: '준비 중'` + desc `'…풀이를 준비 중입니다'` | 〃 | price + desc 동시 교체 |
| A9 | `…/gangi-ui.tsx:38` | 복돼지선생 `price: '준비 중'` + desc `'…작은 행운을 준비 중입니다'` | 〃 | price + desc 동시 교체 |
| A10 | `components/gangi/gangi-market.tsx:487` | `{card.price}` (= '준비 중' 그대로) | coming-soon 카드 렌더 | A6~A9 데이터 교체로 해소, 또는 isComingSoon 분기에서 배지 카피 확정 |
| A11 | `components/classics/classic-evidence-panel.tsx:15` | `'연결 준비 중'` (missing-env) | 고전 근거 패널 상태 | '준비 안내' 확정 카피 |
| A12 | `…/classic-evidence-panel.tsx:16` | `'원문 준비 중'` (db-error) | 〃 | 〃 |
| A13 | `features/saju-intake/saju-intake-page.tsx:1587` | `'결과 준비 중...'` | 결과 로딩 상태 | `<LoadingState />` 표준 |

> 참고: home(`gangi-home-client.tsx:34`)·pricing(`pricing/page.tsx:40`)은 이미
> `card.price !== '준비 중'` 으로 필터링하므로 해당 페이지에서는 노출 0건.
> 그러나 데이터 원본(gangi-ui.tsx)에 '준비 중'이 남아 있어 **다른 렌더 경로
> (gangi 리스트/market/`/guide`)에서 새는 중** → 원본 정리가 근본 해결.

## B. 결정 필요 (정책 판단)

### B1. 표준 컴포넌트 카피 자체에 '준비 중' — `feature-unavailable.tsx:25`
```
coming_soon: '출시 준비 중인 기능입니다'
```
'준비 중'을 **대체하기 위한 표준 컴포넌트**인데 카피에 '준비 중'을 포함 → innerText 가드가
이 컴포넌트를 쓰는 모든 공개 페이지에서 트립. **교체안:** `'곧 출시 예정인 기능입니다'`
(가드-세이프). 동일 맥락 `policy-not-ready.tsx`도 확인 필요.

### B2. '검색 결과가 없습니다' enriched 메시지 (3건)
- `features/compatibility/compatibility-input-client.tsx:475`
- `features/saju-intake/saju-intake-page.tsx:691`
- `components/my/profile-manager.tsx:238`

형태: `'검색 결과가 없습니다. 시/군/구 이름이나 영문 지명을 함께 입력해 보세요.'`
→ 이미 **안내가 붙은 개선형**이지만 금지 substring `결과가 없습니다`를 그대로 포함.
**판단 필요:** (a) substring 자체를 금지로 유지 → `'검색 결과가 없어요. …'` 류로 리워딩,
(b) 바(bare) `결과가 없습니다`만 금지하고 enriched 형은 허용 → 가드 정규식을 정밀화.

### B3. 가드 스코프 — 콘텐츠 프로즈 페이지 포함 여부 (C와 직결)
꿈해몽 상세(`/dream-interpretation/[slug]`)는 공개 라우트인데 본문에 '준비 중'이
**자연어**로 등장(C 참조). 가드를 단순 substring + 전체 라우트로 돌리면 즉시 오탐.
**판단 필요:** (a) 가드 대상을 UI 요소(배지/가격/타이틀 셀렉터)로 한정,
(b) 콘텐츠 프로즈 라우트는 스코프 제외, (c) 단어경계/문맥 화이트리스트.

## C. 오탐 — 콘텐츠 자연어 (유지 / 가드가 검출하면 안 됨) (5)

| 파일:라인 | 문맥 | 비고 |
|---|---|---|
| `lib/dream/dream-content.ts:456` | "임신을 **준비 중**인 분들" (용꿈 본문) | 정상 프로즈 |
| `lib/dream/dream-content.ts:630` | "임신을 **준비 중**이거나" (물고기꿈) | 정상 프로즈 |
| `lib/dream/dream-content.ts:729` | "아직 **준비 중**인 일이 있다면" (actionGuide) | 정상 프로즈 |
| `lib/dream-dictionary.ts:1896` | action: "**준비 중**인 일에서 오늘…" | 정상 프로즈 |
| `lib/dream-dictionary.ts:3073` | action: "**준비 중**인 일에서 오늘…" | 정상 프로즈 |

→ 이 5건은 미완성 UI가 아니라 정상 콘텐츠. **2단계 가드는 이걸 통과시켜야** 한다(B3 결정에 종속).

## D. 비노출 — 코드 주석/변경이력 (innerText 가드 무관) (14)

`lock-screen/page.tsx:2,3,12`, `search/page.tsx:384`, `reset-password/page.tsx:349`,
`membership/page.tsx:30`, `help/page.tsx:50`, `home/gangi-home-client.tsx:31`,
`taekil-client.tsx:265`, `notification-center-page.tsx:874`, `content/gangi-market.ts:133`,
`feature-unavailable.tsx:5`, `skeleton-card.tsx:4,5`, `empty-state.tsx:4`,
`loading-state.tsx:4`, `policy-not-ready.tsx:4`

대부분 "이미 정리했다"는 변경이력 주석. 렌더 innerText 가드에는 영향 없음.
(만약 가드를 source-grep 방식으로도 둘 거면 주석은 별도 화이트리스트 필요.)

---

## 다음 단계 제안

1. **B1·B2·B3 정책 3건 확정** (사용자) — 가드 정규식/스코프가 여기서 갈림.
2. **A1~A13 교체** — 표준 컴포넌트(`EmptyState`/`LoadingState`/`FeatureUnavailable`)·확정 카피로.
   gangi 선생 카드(A6~A9)는 원본 데이터 정리가 핵심.
3. **`e2e/incomplete-ui.spec.ts` 재작성** — 확정된 스코프(PUBLIC_PAGES)·정규식으로,
   C(콘텐츠 프로즈) 통과 보장.
