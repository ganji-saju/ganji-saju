# Claude Code Master Prompt — 간지사주 리디자인 전체 적용

## 작업 목표
첨부 handoff bundle의 `README.md`를 먼저 읽고, `project/간지사주 리디자인.html`을 처음부터 끝까지 읽은 뒤 모든 import 파일을 따라가서 실제 Next.js 코드베이스에 디자인을 적용한다.

사용자 목표는 **34개 정적 보드 + 13개 모션 보드의 디자인 요소를 누락 없이 적용**하는 것이다. 실제 handoff HTML 안에는 디자인 시스템/컴포넌트/시스템/디바이스 보드도 포함되어 있으므로, 먼저 보드 매니페스트를 생성하고 “구현 대상 / 참조 시스템 / 미래 구현”으로 분류한다.

외부 `https://api.anthropic.com/v1/design/...` URL이 인증 또는 fetch 문제로 열리지 않으면, 첨부 zip의 `untitled/project`를 source of truth로 사용한다.

---

## 절대 원칙
1. **README → HTML → imports 순서로 읽는다.** HTML만 보거나 일부 screen 파일만 보지 말 것.
2. **토큰 → 프리미티브 → 레이아웃 → 페이지 → 모션 → QA** 순서로 작업한다.
3. 서버 로직, 결제 로직, Supabase auth, 라우팅 href, 분석 이벤트는 임의 변경하지 않는다.
4. 기존 구현 페이지는 실제 데이터/기능을 유지하고 시각 레이어만 교체한다.
5. 미구현 페이지는 실제 기능을 만들지 말고 **디자인 shell/stub route**로 만든다.
6. stub route는 사용자에게 “준비 중” 또는 disabled 상태를 명확히 보여주고, 실제 결제/상담/저장 동작을 연결하지 않는다.
7. 모션 보드는 선택사항이 아니다. 13개 전부 구현 또는 QA gallery에 재현해야 한다.
8. `prefers-reduced-motion`을 반드시 지원한다.
9. 타입 에러를 `any`로 덮지 않는다.
10. 완료 전 `lint`, `typecheck`, `test`, `build`를 실행한다.

---

## 0단계 — 소스 확인 및 매니페스트 생성

다음을 실행하고 결과를 `docs/design/ganji-redesign/`에 저장한다.

```bash
rg "DCSection|DCArtboard|Motion[A-Z]|Screen[A-Z]" .
rg "ZODIAC|gj-|--gj-|Stage|Sprite|animate" .
```

생성할 문서:

```txt
docs/design/ganji-redesign/README.md
docs/design/ganji-redesign/BOARD_MANIFEST.md
docs/design/ganji-redesign/MOTION_SPEC.md
docs/design/ganji-redesign/FUTURE_PAGE_IMPLEMENTATION_GUIDE.md
docs/design/ganji-redesign/IMPLEMENTATION_STATUS.md
```

`BOARD_MANIFEST.md`에는 모든 `DCArtboard`의 `sectionId`, `id`, `label`, `component`, `source file`, `target route/component`, `status`를 표로 적는다. 보드가 1개라도 누락되면 완료 처리하지 않는다.

---

## 1단계 — 디자인 토큰 이식

source of truth:

```txt
project/tokens.css
project/ui.jsx
project/적용 가이드.md
```

적용 항목:

- Noto Sans KR 유지
- Noto Serif KR / `--font-han` 추가
- pink CTA system
- ink colors
- line colors
- zodiac accent colors: jade, sky, plum, coral, amber, indigo
- radius scale: card/button/chip
- card/pop/ink shadow
- mobile width reference: 390px
- dock, header, banner, card, badge, chip, input, button class tokens

권장 매핑:

```css
:root {
  --app-pink: #ff4f9a;
  --app-pink-strong: #d81b72;
  --app-pink-soft: #fff0f7;
  --app-pink-line: rgba(255,79,154,0.26);
  --app-ink: #111114;
  --app-line: rgba(17,17,20,0.08);
  --app-jade: #0f9f7a;
  --app-sky: #368ee8;
  --app-plum: #c04de0;
  --app-coral: #ff6b6b;
  --app-amber: #d99020;
  --app-indigo: #5b58d6;
  --app-r-card: 18px;
  --app-r-btn: 14px;
  --app-r-chip: 999px;
  --font-han: "Noto Serif KR", "Source Han Serif K", serif;
}
```

---

## 2단계 — 공통 컴포넌트 구축

생성 또는 교체 후보:

```txt
src/components/gangi/zodiac-chip.tsx
src/components/gangi/gj-card.tsx
src/components/gangi/gj-button.tsx
src/components/gangi/gj-badge.tsx
src/components/gangi/gj-banner.tsx
src/components/gangi/gj-dock.tsx
src/components/gangi/gj-motion.tsx
src/components/site-header.tsx 또는 기존 header 위치
src/components/site-footer.tsx
```

필수 구현:

- `ZodiacChip`: 12지 한자, 색상, size `sm/md/lg/xl`, Noto Serif KR
- Header: `干` 인장 로고, `간지사주`, `간지사주 · 오늘운세`, credit pill, MY 버튼
- Dock: 홈, 사주추가, 무료운세 FAB, 대화방, 보관함
- Footer: dark full footer, 회사 법적 정보 보존
- Card: white card, soft card, ink card, pink banner, service card
- Badge: FREE, HOT, 추천, VIP, PAID, NEW
- Input/Button: 56px senior-friendly touch target

---

## 3단계 — 라우트/페이지 전략

### 3.1 이미 구현된 페이지
기존 기능과 데이터 로딩을 유지하고 JSX/스타일만 디자인으로 교체한다.

우선 적용:

```txt
/                                  01 홈
/saju/new                          02-1~02-3 사주입력
/saju/[slug]                       03 사주 결과
/today-fortune                     04 오늘운세
/tarot 또는 /tarot/daily           05 타로
/compatibility/input, /compatibility/[id] 06 궁합
/dialogue                          07 대화방
/my                                08 MY
/membership                        09 멤버십
/login                             10 로그인
/pay 또는 /checkout                16 결제 페이지
```

### 3.2 아직 구현되지 않은 페이지
디자인 shell route를 생성해도 된다. 단, 아래 조건을 지킨다.

- 실제 서버 mutation을 연결하지 않는다.
- 결제/상담/저장/탈퇴 같은 위험 액션은 disabled 또는 mock 상태로 둔다.
- “준비 중” 배지를 표시한다.
- 파일명은 나중에 구현자가 쉽게 찾을 수 있게 별도 feature 폴더로 둔다.
- 각 페이지마다 `docs/design/ganji-redesign/future-pages/{route}.md` 구현 문서를 만든다.

권장 구조:

```txt
src/features/design-stubs/pages/<page-name>-shell.tsx
src/features/design-stubs/mock-data/<page-name>.ts
src/app/<route>/page.tsx
```

`src/app/<route>/page.tsx`는 shell만 import한다.

---

## 4단계 — 정적 보드 적용 기준

보드마다 다음 작업을 수행한다.

1. `BOARD_MANIFEST.md`에서 보드를 하나 선택한다.
2. 원본 component 파일과 function을 확인한다.
3. 현재 코드의 target route/component를 찾는다.
4. 기능이 있으면 기존 데이터와 핸들러를 유지한다.
5. 기능이 없으면 shell route + mock data + future-page doc를 만든다.
6. 상태를 `TODO → IN_PROGRESS → IMPLEMENTED → QA_PASS`로 바꾼다.

정적 보드 디자인 요소:

- 390px mobile artboard 기준의 spacing
- sticky glass header
- bottom dock
- rounded card system
- zodiac hanja chip
- pink CTA and soft pink panels
- black/ink premium card
- evidence/result cards
- price/coin pill
- skeleton/loading/empty/error states
- full footer on desktop
- tablet and desktop responsive layouts

---

## 5단계 — 모션 보드 13개 전부 구현

source of truth:

```txt
project/animations.jsx
project/screens-l.jsx
project/screens-m.jsx
project/screens-n.jsx
```

구현 방식:

- Framer Motion이 있으면 Framer Motion 사용
- 없으면 CSS keyframes + React state 사용
- `Stage` playback UI를 그대로 production에 넣지 않는다.
- 대신 각 실제 화면 상황에 맞는 animation primitive로 변환한다.
- QA용으로 `/design/motion` 또는 `/admin/design/motion` gallery route를 만든다.

필수 모션:

```txt
51 사주 분석 로딩
52 결과 카드 등장
53 타로 카드 플립
54 코인 충전 성공
55 페이지 전환
56 모달 등장
57 토스트 시퀀스
58 푸시 알림 도착
59 한자 변환
60 로딩 스피너 6종
61 인풋 포커스/검증
62 차트 그리기
63 사주팔자 셔플
```

각 모션은 `MOTION_SPEC.md`에 구현 위치, duration, trigger, reduced-motion 대체, QA status를 기록한다.

---

## 6단계 — QA / Acceptance Criteria

필수 검수:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

또는 실제 package manager가 pnpm/yarn이면 해당 명령으로 실행한다.

화면 검수:

- 360px
- 390px
- 768px
- 1024px
- 1280px
- 1440px

검수 항목:

- 모든 보드가 manifest에 있음
- 모든 구현 대상 보드가 route/component에 연결됨
- 미구현 기능은 shell + future doc 존재
- 13개 모션이 gallery에서 확인 가능
- reduced motion에서 과한 애니메이션이 꺼짐
- 기존 href, auth, pay, tracking handler 임의 변경 없음
- footer 법적 정보 보존
- SEO/title/meta 깨짐 없음
- 접근성: button label, aria-label, focus ring, keyboard navigation

---

## 완료 보고 형식

```txt
## 변경 요약
- 추가:
- 수정:
- 생성한 stub route:
- 생성한 future docs:

## 보드 적용 현황
- 정적 보드: n/n
- 모션 보드: 13/13
- 시스템/컴포넌트 보드: n/n

## 모션 적용 현황
- 51:
- 52:
...
- 63:

## QA 결과
- lint:
- typecheck:
- test:
- build:

## 남은 리스크
-
```
