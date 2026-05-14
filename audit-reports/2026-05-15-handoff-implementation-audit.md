# Handoff 누락 복구 감사 — 2026-05-15

> Read-only audit of the Claude Design handoff bundle
> `/Users/kionya/ganji-saju/docs/design/ganji-redesign/` against the
> current production code (`/Users/kionya/ganji-saju/src/`).
> 작성: read-only agent. 코드 수정 없음.

---

## 요약 (top-line)

- **P0 (즉시 복구):** 13/13 모션 컴포넌트 모두 production 화면에 **미연결**.
  `src/components/motion/motion-primitives.tsx` 의 13개 export 가 오직
  `src/app/admin/design/motion/gallery-client.tsx` 한 곳에서만 import 되며,
  실제 결제 로딩 / 풀이 로딩 / 결과 페이지에는 정적 카드(`GangiLoadingOverlay`)
  와 일반 텍스트만 노출됨. 즉 `BOARD_MANIFEST.md` 의 "IMPLEMENTED" 13건은 **허위**.
- **P0:** 결제 로딩(`/credits/success` LoadingState, `/membership/success` LoadingState)
  과 풀이 로딩(`GangiLoadingOverlay`) 모두 단순 정적 SectionSurface / 텍스트로
  구성되어 있으며 `MotionCoinSuccess`, `MotionSajuLoading`,
  `MotionPalshjaShuffle` 모두 import 조차 안 됨. handoff Phase 3·4 명시 위반.
- **P1:** `loading.tsx` route-segment loading boundary **0개**. Next.js streaming
  loading UI 자체가 부재.
- **P1:** Production 전반에 toast/spinner 라이브러리 **0개**.
  `Loader2`, `animate-spin`, `sonner`, `react-hot-toast`, `<Toaster>` 모두 부재.
- **P1:** `future-pages/` 디렉토리 의 contract 문서 **3건만** 존재
  (`_consolidated-stubs.md`, `error-pages.md`, `help-center.md`).
  `IMPLEMENTATION_STATUS.md` 가 주장하는 9 SHELL × future doc 매핑은 불일치.
- **POSITIVE:** `any`, `@ts-ignore`, `@ts-expect-error` 0건 — 타입 위반 무.

---

## §1. 13 모션 production 연결 매트릭스

> 모든 행에서 검증 명령: `rg -l "<Component>" src` 가 오직
> `src/components/motion/motion-primitives.tsx`(정의)
> + `src/app/admin/design/motion/gallery-client.tsx`(QA gallery) 만 반환.
> 다른 production 화면 import 0건.

| Motion | Spec 의도 (`source/03_MOTION_IMPLEMENTATION_SPEC.md`) | 현재 코드 연결 | 권고 mount 위치 |
|---|---|---|---|
| **MotionSajuLoading** (51) | 사주 분석 요청 후 결과 대기 6s 루프 | **미연결.** `src/features/saju-intake/saju-intake-page.tsx:1328-1333` 가 `<GangiLoadingOverlay>` (정적 카드, `src/components/gangi/gangi-ui.tsx:235-283`) 사용. `MotionSajuLoading` import 0회. | `src/features/saju-intake/saju-intake-page.tsx:1328` `{isSubmitting && <MotionSajuLoading active />}` 로 교체 또는 `GangiLoadingOverlay` 내부에 mount. |
| **MotionResultReveal** (52) | 결과 카드 stagger 등장 | **미연결.** `src/app/saju/[slug]/page.tsx` (351 lines) 에 `MotionResultReveal`, stagger, animate 키워드 0건. `src/features/today-fortune/today-fortune-result-client.tsx` 는 `TodayScoreReveal`(자체 컴포넌트) 사용, motion primitive 미사용. | `src/app/saju/[slug]/page.tsx:350` AppPage 진입부에서 첫 hydration tick 동안 `<MotionResultReveal>` 1회 mount 후 stagger CSS 적용. |
| **MotionTarotFlip** (53) | 타로 카드 3D flip | **미연결.** `src/app/tarot/daily/pick/tarot-card-picker.tsx`, `src/app/tarot/daily/result/page.tsx` 에 `flip`, `rotateY`, `perspective` 키워드 grep 0건. | `src/app/tarot/daily/pick/tarot-card-picker.tsx` 카드 선택 핸들러 → `selectedCard && isRevealing` 상태에서 `<MotionTarotFlip>` mount. |
| **MotionCoinSuccess** (54) | `/credits/success` 코인 충전 성공 | **미연결.** `src/app/credits/success/page.tsx:33-77` LoadingState 는 `PageHero` + 정적 `FeatureCard`. 성공 분기에도 motion 0건. `BOARD_MANIFEST` 가 "trigger: `/credits/success`" 라 주장하지만 실제 import 없음. | `src/app/credits/success/page.tsx` success path 진입 시 `<MotionCoinSuccess active />` mount. |
| **MotionPageTransition** (55) | router push 시 prefetch overlay | **미연결.** `src/app/layout.tsx`, `template.tsx`, 그 외 어떤 layout 도 `MotionPageTransition` 사용 안 함. | `src/app/template.tsx` 신설하여 route change 시 mount. (현재 `template.tsx` 없음) |
| **MotionModalAppear** (56) | 모달/drawer open | **미연결.** `<details>` 또는 Drawer 컴포넌트 어디에도 적용 안 됨. | `src/components/notifications/push-permission-modal.tsx` 등 모달 컴포넌트 backdrop 진입부에 mount. |
| **MotionToastStack** (57) | 토스트 큐 | **미연결 + 인프라 부재.** 전체 src 에 `sonner`, `react-hot-toast`, `<Toaster>` 0건. 결제·저장 토스트 시스템이 아예 없음. | 결제 후 안내는 현재 페이지 카드만으로 표시. 토스트 도입 시 `src/app/layout.tsx` 에 `<MotionToastStack>` mount. |
| **MotionPushArrive** (58) | push 권한/수신 | **미연결.** `src/components/notifications/push-permission-modal.tsx` 존재하나 production 어디에서도 mount 안 됨 (`rg "PushPermissionModal" src` → admin/showcase + 정의만). | 권한 요청 흐름이 production 에 노출될 때 함께 mount. (현재 production 노출 0) |
| **MotionHanjaMorph** (59) | zodiac chip / 팔자 한자 morph | **미연결.** `src/components/gangi/zodiac-chip.tsx` 는 정적 한자 (`{z.han}`) 만 렌더. morph 0. 사주팔자 한자 표시 컴포넌트에도 motion 0. | zodiac chip 첫 mount 시 또는 사주 결과 페이지 팔자 영역 초기 진입 시. |
| **MotionSpinners** (60) | inline loading | **미연결.** Production 전체 `Loader2`, `animate-spin`, `<Spinner>` 0건 (rg 출력 빈 결과). | 짧은 fetch loading 자리에 inline mount. 현재는 정적 placeholder 만. |
| **MotionInputFocus** (61) | 생년월일/로그인 input focus + 검증 | **미연결.** `src/features/saju-intake/`, `src/app/login/page.tsx` 양쪽 모두 표준 `<Input>` + Tailwind focus ring. motion 0. | birth-info-stepper 의 focus/blur handler 와 강도 bar 자리에 mount. |
| **MotionChartDraw** (62) | 오행/운세 차트 draw-in | **미연결.** `src/components/saju/five-element-orbit-chart.tsx` 에 motion/animate/keyframes 0건 (grep 결과 빈). `FortuneCalendarPanel` 의 tone bar 도 동일. | 5요소 차트 mount 시 IntersectionObserver 로 trigger → `<MotionChartDraw>` overlay. |
| **MotionPalshjaShuffle** (63) | 사주 분석 loading 안 8글자 슬롯 | **미연결.** `GangiLoadingOverlay` (intake 1328·today-detail 133) 내부 마크업은 月 배지 + 3개 step bullet + shimmer 만. 8글자 셔플 슬롯 0. | `GangiLoadingOverlay` 본체 안 또는 `MotionSajuLoading` 내부에 nested mount. |

**Spec 매트릭스 0/13 connected.** 사용자가 명시한 "QA gallery 만 만들고 production 연결 안 한 것" risk 가 13/13 모두에 해당.

---

## §2. 65 보드 (static + system + future) 누락

`BOARD_MANIFEST.md` 의 자체 status (IMPLEMENTED 56 / SHELL 6 / REFERENCE 4 / TODO 0)
를 신뢰하지 않고 실제 코드에서 재검증:

### §2.1 IMPLEMENTED 표시이지만 코드 실연결이 허위/부분인 보드

| 보드 ID | manifest 상태 | 실제 코드 검증 | 판정 |
|---|---|---|---|
| 13 모션 보드 13건 (`m-loading`~`m-palshja`) | IMPLEMENTED — "production trigger 매핑" | gallery import 만, production import 0건 (§1 표) | **허위 IMPLEMENTED.** 정확히는 `GALLERY_ONLY`. |
| `errors` (404/500) | IMPLEMENTED — `not-found.tsx` + `error.tsx` + `global-error.tsx` | 파일 모두 존재 (`src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`) — 실제 IMPLEMENTED ✓ | OK |
| `push-modal` | IMPLEMENTED — `src/components/notifications/push-permission-modal.tsx` + showcase `/admin/design/push-modal` | 파일 존재, 그러나 production 라우트 중 어디에서도 mount 안 됨 (`rg "PushPermissionModal" src` → 정의 + admin showcase 만). 사용자 노출 없음. | **부분 IMPLEMENTED → 실제 SHELL.** |
| `banners` | IMPLEMENTED + showcase `/admin/design/banners` | `src/components/gangi/gangi-banner.tsx` 가 home/CTA 곳곳에서 사용되는지 추가 검증 필요 (이 감사 범위 외). | 추정 OK (gallery + production import 존재 가능) |
| `tarot-spread` | IMPLEMENTED `/tarot/daily/pick`, `/tarot/daily/result` | 파일 존재 ✓ 그러나 §1.MotionTarotFlip 행 참조 — 플립 모션 부재. 디자인 보드에는 3D flip 이 핵심 요소. | **시각 부분 IMPLEMENTED.** 동작은 정적. |

### §2.2 SHELL 보드 — `future-pages/` 문서 실재 여부

`BOARD_MANIFEST.md` / `IMPLEMENTATION_STATUS.md` 가 주장하는 9 SHELL × future doc 매핑:

| 주장된 future doc | 실제 파일 | 결과 |
|---|---|---|
| `future-pages/help-center.md` | `/Users/kionya/ganji-saju/docs/design/ganji-redesign/future-pages/help-center.md` ✓ | OK |
| `future-pages/error-pages.md` | 위 디렉토리에 존재 ✓ | OK |
| `future-pages/_consolidated-stubs.md` (8건 통합) | 위 디렉토리에 존재 ✓ | OK |
| `future-pages/i18n-en.md` | **부재** (manifest line 127 인용) | **누락** — `_consolidated-stubs.md` 안 §2 로 흡수됨 (실용적 대체 가능하나 manifest 인용 파일 경로 깨짐) |

`docs/design/ganji-redesign/future-pages/` 실제 ls 결과:
```
_consolidated-stubs.md
error-pages.md
help-center.md
```
→ 3 파일. manifest 가 가리키는 9 SHELL 보드 의 future doc 8건 중 단독 분리 0, 통합 1, 단일 표제 2.

### §2.3 SHELL 보드 — 실제 stub route 존재 여부

`source/04_FUTURE_PAGE_IMPLEMENTATION_GUIDE.md` 는 SHELL 의 핵심 요건으로
"실제 route 생성 + visual shell + disabled action" 을 명시했음.

| 보드 | manifest claim | 실제 route 검증 |
|---|---|---|
| `help-center` (08-4) SHELL | `/help` 라우트 신규 SHELL | `src/app/help/page.tsx` 존재 ✓ |
| `lock-screen` (18-0) SHELL | `/admin/design/motion#m-push` 데모로 대체 | 별도 `/lock-screen` route 없음 (`ls src/app/lock-screen` → NOT EXISTS). admin gallery 안 데모 대체는 허용 가능하나 **stub route 부재**. |
| `i18n-en` (22) SHELL | future doc 만 | route 없음 → spec 요건 "visual shell route" 미충족 |
| `tablet` (23) SHELL | responsive 기본 + SHELL | 별도 route 없음 (responsive 안에 포함) — 허용 가능 |
| `onboarding` (26) SHELL | "login → empathy → birth 흐름이 사실상 onboarding" | `/onboarding` route 없음 (`ls src/app/onboarding` → NOT EXISTS). 별도 visual shell 미구현. **누락**. |
| `terms-modal` (28) SHELL | "회원가입 흐름 내 implicit consent" | 별도 modal component 미구현 — claim 자체가 SHELL 정의를 만족하지 않음 |

**SHELL 누락:** `lock-screen`, `i18n-en`, `onboarding`, `terms-modal` — 4건 모두
manifest 는 SHELL 로 분류하나 실제 route/component 가 아예 없음.

### §2.4 IN_PROGRESS / 누락 보드 종합

manifest 가 TODO 0건 으로 보고하나 실질 누락 (코드+문서 어느 쪽도 충족 못함):

- 모션 13건 → production import 0
- `push-modal` → 컴포넌트 존재하나 production mount 0
- `lock-screen`, `i18n-en`, `onboarding`, `terms-modal` → SHELL route 부재
- `tarot-spread` 의 3D flip → 시각 동작 부재

---

## §3. 핵심 risk (사용자 명시 절대 원칙 기준)

`docs/design/ganji-redesign/00_CLAUDE_CODE_REDESIGN_RECOVERY_PROMPT.md` 의
"절대 금지" 항목 기준:

### Risk A — "QA gallery 만 만들고 production 연결 안 한 것"

> 인용: "모션 보드를 QA gallery만 만들고 실제 로딩/결제 화면에 연결하지 않은
> 채 완료 처리하지 말 것." (`00_CLAUDE_CODE_REDESIGN_RECOVERY_PROMPT.md:23`)

**위반 13/13.** §1 매트릭스 전체. 정의 파일 `src/components/motion/motion-primitives.tsx`
+ 단일 import 위치 `src/app/admin/design/motion/gallery-client.tsx`.
`rg -l "Motion(SajuLoading|ResultReveal|TarotFlip|CoinSuccess|PageTransition|ModalAppear|ToastStack|PushArrive|HanjaMorph|Spinners|InputFocus|ChartDraw|PalshjaShuffle)" src`
출력:
```
src/components/motion/motion-primitives.tsx
src/app/admin/design/motion/gallery-client.tsx
```
→ production 라우트 0건.

### Risk B — "결제 로딩과 풀이 로딩은 반드시 motion 연결"

> 인용: Phase 3 "이번 작업의 핵심" (`00_CLAUDE_CODE_REDESIGN_RECOVERY_PROMPT.md:236-237`),
> Phase 4 (300-307).

**위반.** 검증:

- `src/app/credits/success/page.tsx:33-77` LoadingState — `PageHero` + `SectionSurface` + `FeatureCard` (모두 정적). `MotionCoinSuccess` 없음.
- `src/app/membership/success/page.tsx:107-117` LoadingState — `CenteredCard` 정적, iconChar `'…'`. `MotionCoinSuccess`/`MotionSajuLoading` 없음.
- `src/app/membership/complete/page.tsx` — 검증 필요, 다만 동일 패턴 추정.
- `src/features/saju-intake/saju-intake-page.tsx:1328-1333` — `GangiLoadingOverlay` (정적 月 배지 + 3 bullet + shimmer). `MotionSajuLoading`, `MotionPalshjaShuffle` 없음.
- `src/features/today-fortune/today-fortune-detail-client.tsx:132-137` — 동일 `GangiLoadingOverlay`.

→ Phase 3·4 의 완료 조건 ("기존 결제 상태에서 spinner가 보이던 위치가 motion
component로 교체된다", "기존 spinner/skeleton만 보이던 풀이 생성 로딩이 motion으로
교체된다") **모두 미충족**.

### Risk C — "미구현 페이지는 visual shell/stub route"

> 인용: `source/04_FUTURE_PAGE_IMPLEMENTATION_GUIDE.md:6-7`
> "실제 route 생성, 디자인 레이아웃 구현, mock data, 버튼 disabled, 준비 중 badge".

**부분 위반.** §2.3 표 참고. `/help` 만 정상 stub route. `/lock-screen`,
`/onboarding` 등 4건 manifest 에 SHELL 로 표기하나 실제 route 없음. SHELL 의 spec 정의 (visual shell route) 불일치.

### Risk D — "타입 에러 any 덮기"

> 인용: `00_CLAUDE_CODE_REDESIGN_RECOVERY_PROMPT.md:24`

**위반 없음.** `grep -rn "as any\|@ts-ignore\|@ts-nocheck\|@ts-expect-error" src` → 0건.

### Risk E — Streaming loading boundary 부재

`find src/app -name "loading.tsx"` → **0건**. Next.js App Router 의
route-segment loading UI 가 전혀 없어, fetch race 시 사용자에게 빈 화면 노출.
handoff 가 명시한 risk 는 아니나 모션 미연결과 같은 뿌리 (loading state 인프라 부재).

### Risk F — Toast/Spinner 인프라 부재

`rg -l "sonner|react-hot-toast|<Toaster|use-toast"` → 0건.
`rg -l "Loader2|animate-spin|<Spinner"` → 0건 (production 영역).
→ Phase 2 의 m-toast/m-spinners 가 production 연결 가능한 hook 자체 없음.

---

## §4. 권장 복구 PR 순서

### P0 — 즉시 (1~2일)

**PR-A · 결제 로딩 motion 연결**

- `src/app/credits/success/page.tsx:33` `LoadingState()` 안 `<PageHero>` 아래에
  `<MotionSajuLoading active />` mount + status === 'success' 분기에 새
  `<MotionCoinSuccess active />` mount.
- `src/app/membership/success/page.tsx:107` `LoadingState()` 의 `iconChar='…'`
  CenteredCard 를 `<MotionSajuLoading>` 으로 교체. success 분기에
  `<MotionCoinSuccess>` 추가.
- `src/app/membership/complete/page.tsx` 동일 패턴 적용 (추가 검증 후).
- `useReducedMotion()` fallback 으로 정적 카드 유지 — 이미 `motion-primitives.tsx:14-22` 에 hook 존재.

**PR-B · 풀이 로딩 motion 연결**

- `src/components/gangi/gangi-ui.tsx:235-283` `GangiLoadingOverlay` 본체
  내부에 `<MotionSajuLoading>` + `<MotionPalshjaShuffle>` 을 nested mount.
  외부 호출자(`src/features/saju-intake/saju-intake-page.tsx:1328`,
  `src/features/today-fortune/today-fortune-detail-client.tsx:132`)는 그대로 두고
  내부만 교체 → 영향 범위 최소.
- 또는 `GangiLoadingOverlay` 를 deprecate 하고 호출자에서 직접
  `<MotionSajuLoading>` 사용.

**PR-C · 사주 결과 reveal**

- `src/app/saju/[slug]/page.tsx:350` AppPage 진입부에 `<MotionResultReveal>`
  1회 mount + stagger CSS 적용.
- `src/features/today-fortune/today-fortune-result-client.tsx` `TodayScoreReveal`
  에 `<MotionResultReveal>` 합치거나 교체.

**PR-D · `BOARD_MANIFEST.md` 거짓 status 정정**

- 모션 13행 IMPLEMENTED → `GALLERY_ONLY` 로 강등.
- `push-modal` IMPLEMENTED → SHELL 로 강등.
- §2.3 누락 SHELL 4건(lock-screen, i18n-en, onboarding, terms-modal) 명시.
- IMPLEMENTATION_STATUS.md 진행률 80.3% → 실측 재계산.

### P1 — 1주

**PR-E · 타로 카드 플립**

- `src/app/tarot/daily/pick/tarot-card-picker.tsx` 카드 선택 핸들러 →
  `<MotionTarotFlip>` mount.

**PR-F · 차트 draw-in**

- `src/components/saju/five-element-orbit-chart.tsx` IntersectionObserver →
  `<MotionChartDraw>` overlay.

**PR-G · SHELL route 누락 복구**

- `/onboarding/page.tsx` — login → empathy → birth 4 슬라이드 visual shell.
- `/lock-screen/page.tsx` — push 위젯 디자인 stub (실제 OS 권한 요청 없음).
- `i18n-en` — `future-pages/i18n-en.md` 분리 작성 (현재 `_consolidated-stubs.md §2` 만).
- `terms-modal` — 약관 동의 풀스크린 modal 컴포넌트 (회원가입 흐름에 mount 분리).

**PR-H · loading.tsx route segments**

- 적어도 `src/app/saju/[slug]/loading.tsx`, `src/app/today-fortune/loading.tsx`,
  `src/app/credits/loading.tsx` 3건 생성하여 `<MotionSajuLoading>` 즉시 노출.

### P2 — 이후

**PR-I · Toast 시스템 도입 + m-toast 연결**

- `sonner` 또는 자체 toast provider 도입.
- 결제 성공/실패 안내를 toast 로 추가.
- `src/app/layout.tsx` 에 `<MotionToastStack>` mount.

**PR-J · 인풋 focus motion**

- `src/features/saju-intake/birth-info-stepper.tsx`(추정) 의 input focus/validate
  핸들러 → `<MotionInputFocus>` mount.

**PR-K · `push-modal` production mount**

- 알림 권한 요청 흐름이 실제로 사용자에게 노출되는 지점 (예: 알림 센터
  최초 진입) 에서 `<PushPermissionModal>` + `<MotionPushArrive>` mount.

**PR-L · Hanja morph**

- `src/components/gangi/zodiac-chip.tsx` 첫 mount 시 `<MotionHanjaMorph>` overlay 또는
  사주 결과 페이지 팔자 영역 진입 시 mount.

---

## §5. 검증 명령어 + 출력

### §5.1 13 모션 production 연결 검사

```bash
$ rg -l "Motion(SajuLoading|ResultReveal|TarotFlip|CoinSuccess|PageTransition|ModalAppear|ToastStack|PushArrive|HanjaMorph|Spinners|InputFocus|ChartDraw|PalshjaShuffle)" src
src/components/motion/motion-primitives.tsx
src/app/admin/design/motion/gallery-client.tsx
```

→ 정의 파일 + gallery 단 2건. production import 0건.

### §5.2 결제/풀이 로딩 상태 위치

```bash
$ rg -n "LoadingState\(|isPending|isSubmitting|GangiLoadingOverlay" \
    src/app/credits/success/page.tsx \
    src/app/membership/success/page.tsx \
    src/features/saju-intake/saju-intake-page.tsx \
    src/features/today-fortune/today-fortune-detail-client.tsx
src/app/credits/success/page.tsx:33:function LoadingState() {
src/app/credits/success/page.tsx:249:  if (status === 'loading') {
src/app/credits/success/page.tsx:250:    return <LoadingState />;
src/app/membership/success/page.tsx:107:function LoadingState() {
src/app/membership/success/page.tsx:302:  if (status === 'loading') return <LoadingState />;
src/features/saju-intake/saju-intake-page.tsx:392:  const [isSubmitting, setIsSubmitting] = useState(false);
src/features/saju-intake/saju-intake-page.tsx:1328:      {isSubmitting ? (
src/features/saju-intake/saju-intake-page.tsx:1329:        <GangiLoadingOverlay
src/features/today-fortune/today-fortune-detail-client.tsx:133:        <GangiLoadingOverlay
```

→ 4개 핵심 loading 분기 모두 발견. 그 어디에도 motion primitive 사용 안 됨.

### §5.3 `loading.tsx` route segments

```bash
$ find src/app -name "loading.tsx"
(empty)
```

→ 0건.

### §5.4 Toast / Spinner 인프라

```bash
$ rg -l "sonner|react-hot-toast|<Toaster|use-toast" src
(empty)

$ rg -l "Loader2|animate-spin" src
(empty)

$ rg -l "spinner|Spinner" src
src/components/motion/motion-primitives.css
src/components/motion/motion-primitives.tsx
src/app/admin/design/motion/gallery-client.tsx
```

→ production 노출 0건. spinner 도 motion gallery 안에만.

### §5.5 SHELL 라우트 존재 여부

```bash
$ ls src/app/lock-screen   # NOT EXISTS
$ ls src/app/onboarding    # NOT EXISTS
$ ls src/app/help          # page.tsx
$ ls src/app/admin/design  # banners, motion, push-modal
```

→ `/help` 만 정상 SHELL route. `/lock-screen`, `/onboarding` 부재.

### §5.6 future-pages 문서 실재

```bash
$ ls /Users/kionya/ganji-saju/docs/design/ganji-redesign/future-pages/
_consolidated-stubs.md
error-pages.md
help-center.md
```

→ 3건. manifest 가 인용한 `future-pages/i18n-en.md` (BOARD_MANIFEST.md:127),
나머지 6 SHELL 단독 문서 모두 부재. `_consolidated-stubs.md` 가 통합.

### §5.7 타입 위반 검사

```bash
$ grep -rn "as any\|@ts-ignore\|@ts-nocheck\|@ts-expect-error" src | wc -l
       0
```

→ 위반 0. 이 부분은 handoff 원칙 준수.

### §5.8 GangiLoadingOverlay 본체 (motion mount 자리 후보)

`src/components/gangi/gangi-ui.tsx:235-283` — 정적 月 한자 + 3 step bullet +
shimmer line 3개. `<MotionPalshjaShuffle>` (8글자 슬롯) 와 `<MotionSajuLoading>`
(팔자/한자/점성 6초 루프) 가 본래 들어가야 할 자리. 현재 0.

### §5.9 PushPermissionModal — 정의는 존재하나 production mount 부재

```bash
$ rg -n "PushPermissionModal" src
src/app/admin/design/push-modal/showcase-client.tsx:6
src/app/admin/design/push-modal/showcase-client.tsx:63
src/app/admin/design/push-modal/page.tsx:35
src/app/admin/design/push-modal/page.tsx:80
src/app/admin/design/push-modal/page.tsx:87
src/components/notifications/push-permission-modal.tsx:27
src/components/notifications/push-permission-modal.tsx:47
src/components/notifications/push-permission-modal.tsx:53
```

→ 정의 + admin/design/push-modal showcase 만. production 페이지 mount 0.
`BOARD_MANIFEST.md:137` 의 "IMPLEMENTED" 주장과 불일치.

---

## §6. 한 줄 결론

**디자인 토큰·zodiac chip·정적 페이지 layout 은 잘 들어갔으나,
이번 handoff 의 가장 명시적인 요구사항이었던 "13 모션 production 연결" 과
"결제·풀이 로딩 motion 교체" 는 0% 달성.** 모든 motion primitive 가
gallery-only 상태이며, `BOARD_MANIFEST.md` 가 보고하는 "IMPLEMENTED 13/13"
은 실제 production 화면이 아닌 admin gallery 노출을 IMPLEMENTED 로 잘못
분류한 결과. 복구 PR-A·B·C (P0 3건) 가 실제 사용자 경험 개선의 80%를 차지하므로
이 셋 부터 즉시 착수 권고.
