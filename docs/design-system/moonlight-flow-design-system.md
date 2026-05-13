# 달빛 결 디자인 시스템 PRD

## 1. 문서 목적

이 문서는 달빛인생 전체 페이지를 하나의 일관된 디자인 언어로 정리하기 위한 제품/디자인 시스템 기준서다. 작업 0 전수조사에서 확인된 혼합 토큰, 페이지별 임의 class, 불안정한 반응형, 모바일 성능 리스크, 12간지 대화방 정체성 충돌을 해결하기 위한 기준을 확정한다.

이번 문서는 구현 범위를 포함하지 않는다. 코드 변경, 결제 로직 변경, DB 변경, 사주/성향 계산 로직 변경은 하지 않는다.

## 2. 디자인 시스템 이름

**달빛 결 디자인 시스템**

영문 보조명: **Moonlight Flow System**

## 3. 브랜드 메타포

| 대상 | 메타포 | UI 표현 |
|---|---|---|
| 사주 | 네 기둥 | `年 月 日 時`, pillar strip, column rhythm |
| 성향 | 네 축 | `I/E S/N T/F J/P`, axis chip, fusion strip |
| 사주 x 성향 | 타고난 결과 선택 습관의 만남 | `年 月 日 時 × I/E S/N T/F J/P` |
| 12간지 | 대화 캐릭터 세계관 | 쥐/소/호랑이/토끼/용/뱀/말/양/원숭이/닭/개/돼지 |
| 달빛인생 | 결을 천천히 읽는 서비스 | soft paper, moon accent, low-noise flow |

핵심 문장:

> 사주는 타고난 네 기둥을 보고, 성향은 지금의 네 축을 보여준다. 달빛인생은 두 구조를 연결해 나의 결, 관계의 결, 오늘의 결을 읽는다.

## 4. Information Architecture

1차 네비게이션은 5개로 고정한다.

| Nav | 의미 | 대표 route |
|---|---|---|
| 홈 | 전체 허브 | `/` |
| 내 풀이 | 개인 사주/성향/올해 흐름 | `/saju/new`, `/saju/personality`, `/myeongri`, `/daewoon` |
| 관계 | 궁합/성향궁합 | `/compatibility`, `/compatibility/personality` |
| 오늘 | 오늘운세/타로/띠운세/별자리 | `/today-fortune`, `/tarot/daily`, `/zodiac`, `/star-sign` |
| 대화 | 12간지 AI 대화방 | `/dialogue`, `/dialogue/[expert]` |

보조 진입:

- 보관함: `/my`
- 가격/멤버십: `/pricing`, `/membership`
- 코인/결제: `/credits`, `/membership/checkout`
- 계정/프로필: `/login`, `/my/profile`

## 5. Breakpoints

| Breakpoint | 기준 | 목표 |
|---|---|---|
| `360px` | 구형/소형 모바일 최저 기준 | 핵심 CTA 1개 이상 노출, horizontal overflow 없음 |
| `390px` | iPhone 일반 기준 | 입력 step/결과 요약이 한 화면 리듬 유지 |
| `430px` | 큰 모바일 기준 | 카드가 과도하게 넓어지지 않게 max-width 유지 |
| `768px` | tablet 시작 | 1열 중심에서 보조 2열 허용 |
| `1024px` | small desktop/tablet landscape | nav desktop 전환, content max-width 안정화 |
| `1280px` | desktop | 12-column 느낌의 max-width layout |
| `1440px` | wide desktop | 콘텐츠 폭은 늘리지 않고 여백을 브랜드 배경으로 사용 |

구현 기준:

- mobile first.
- 기본 content width는 `min(100%, 30rem)`부터 시작.
- desktop content max width는 `70rem` 내외.
- 1440px 이상에서도 본문 밀도를 무리하게 늘리지 않는다.

## 6. Color Tokens

토큰은 `gyeol`을 새 기준으로 삼고, 기존 `app` 토큰은 점진적으로 alias/compat layer로 유지한다.

### Core

| Token | 용도 | 방향 |
|---|---|---|
| `--gyeol-background` | 전체 배경 | warm ivory / low contrast |
| `--gyeol-surface` | 기본 surface | white |
| `--gyeol-paper` | 부드러운 panel | warm paper |
| `--gyeol-paper-strong` | 강조 panel | warmer paper |
| `--gyeol-text` | 본문 | near black |
| `--gyeol-muted` | 보조 텍스트 | muted ink |
| `--gyeol-line` | border | low contrast line |

### Brand

| Token | 용도 | 방향 |
|---|---|---|
| `--gyeol-moon` | 달빛/사주 accent | warm gold |
| `--gyeol-orbit` | 성향/관계 accent | rose pink |
| `--gyeol-fusion` | 사주 x 성향 연결 | teal/fusion |

### Semantic

| Token | 용도 |
|---|---|
| `--gyeol-success` | 저장/완료/연결 성공 |
| `--gyeol-warning` | 주의/확인 필요 |
| `--gyeol-danger` | 오류/위험 안내 |
| `--gyeol-info` | 설명/도움말 |

금지:

- 신규 UI에서 `bg-[#...]`, `text-[#...]`, 임의 `rgba(...)`를 직접 추가하지 않는다.
- 상태 색상은 semantic token으로만 확장한다.
- 과도한 보라/다크모드 중심 UI로 회귀하지 않는다.

## 7. Typography Scale

폰트:

- 기본: Noto Sans KR
- fallback: `"Apple SD Gothic Neo"`, `"Malgun Gothic"`, `system-ui`, `sans-serif`
- 숫자/코드 보조: system mono

| Token | 크기 | 용도 |
|---|---|---|
| `text-xs` | 12px | caption, badge, helper |
| `text-sm` | 14px | body small, form helper |
| `text-md` | 16px | mobile body 기본 |
| `text-lg` | 18px | section title |
| `text-xl` | 22px | page title compact |
| `text-2xl` | clamp 28~36px | hero/page title |
| `text-display` | clamp 34~48px | home hero desktop 한정 |

원칙:

- 모바일 본문은 14px 미만으로 내려가지 않는다.
- 버튼/입력은 14~16px 기준.
- `text-[...]` 직접 지정은 금지하고 scale에 흡수한다.
- 한글 줄바꿈은 `keep-all`을 유지하되 긴 문장은 copy에서 줄인다.

## 8. Spacing Scale

| Token | 값 | 용도 |
|---|---|---|
| `space-1` | 4px | micro |
| `space-2` | 8px | chip 내부 |
| `space-3` | 12px | row gap |
| `space-4` | 16px | mobile section 내부 |
| `space-5` | 20px | panel padding |
| `space-6` | 24px | section gap |
| `space-8` | 32px | page section gap |
| `space-10` | 40px | desktop section gap |

원칙:

- 모바일 section 간격은 20~28px로 제한한다.
- 카드/패널 padding은 모바일 16~20px, desktop 24~28px.
- `p-[...]`, `gap-[...]`, `mt-[...]` 직접 지정은 새 작업에서 금지한다.

## 9. Radius Scale

| Token | 값 | 용도 |
|---|---|---|
| `radius-sm` | 8px | small chip |
| `radius-md` | 12px | input, compact row |
| `radius-lg` | 16px | ChoiceRow, panel |
| `radius-xl` | 22px | hero/result panel |
| `radius-pill` | 9999px | button, badge |

원칙:

- 신규 UI에서 `rounded-[...]` 금지.
- 카드가 아닌 row/list 중심에서는 `radius-md` 또는 `radius-lg` 사용.
- hero/result만 `radius-xl` 허용.

## 10. Shadow Usage

성능 우선 정책:

- 기본 panel은 shadow 없이 border + surface.
- CTA는 아주 약한 shadow 1단계만 허용.
- hero/result emphasis에만 medium shadow 허용.
- mobile bottom nav shadow는 1개만 유지.

금지:

- `shadow-[0_18px_...]` 같은 큰 custom shadow 신규 추가.
- hover에서 shadow 크기 증가.
- `transition-all`과 shadow animation 조합.
- blur + shadow + fixed/sticky 동시 사용.

## 11. Layout System

### Mobile Layout

- 1열 flow가 기본.
- 첫 화면에는 title, 설명 1~2줄, CTA 1~2개만 노출.
- 선택지는 card grid보다 `ChoiceRow` 또는 `FlowEntryList` 우선.
- 긴 입력은 active step만 렌더링한다.
- 하단 CTA는 `StickyActionBar`를 사용하고 bottom nav clearance를 존중한다.
- horizontal scroll은 carousel/tarot처럼 의도된 경우 외 금지.

### Tablet Layout

- 768px부터 보조 2열 허용.
- primary content와 secondary panel을 나눌 수 있지만, 입력 form은 여전히 step 중심.
- navigation은 desktop nav로 전환하되, content width는 과도하게 늘리지 않는다.

### Desktop Layout

- max-width 70rem 내외.
- section은 12-column 느낌으로 구성하되, 실제 구현은 CSS grid/flex semantic component 사용.
- page top hero는 본문보다 넓어도 되지만 content density를 늘리지 않는다.
- 결과 화면은 main + side summary를 허용한다.

## 12. AppShell Structure

표준 구조:

```tsx
<AppShell header={<SiteHeader />}>
  <AppPage>
    <PageIntro />
    <PageContent />
    <SafetyNotice />
  </AppPage>
</AppShell>
```

원칙:

- public route는 `AppShell`과 `AppPage`를 기본으로 사용한다.
- auth/print/checkout처럼 예외가 필요한 route는 문서화된 예외로 둔다.
- page-level padding은 AppPage에서 관리하고 route에서 `px-4`를 반복하지 않는다.
- `app-shell.css`와 `mobile-polish.css`의 `!important` 보정은 다음 구현에서 단계적으로 제거한다.

## 13. Header / Footer / BottomNav

### Header

- server shell + client islands로 분리하는 것을 목표로 한다.
- logo, nav link는 server/static 가능 영역.
- auth/credit/notification/menu만 client island.
- desktop nav는 5개 primary nav만 표시한다.

### Mobile Top Header

- logo + 현재 섹션 context + auth/coin/menu 최소 요소.
- 360px에서 brand와 action이 겹치지 않아야 한다.
- mobile menu는 전체 기능 나열보다 빠른 12간지/핵심 flow 중심으로 재정렬한다.

### BottomNav

고정 5개:

- 홈
- 내풀이
- 관계
- 오늘
- 대화

원칙:

- safe-area inset 필수.
- label은 2~3글자 우선.
- center floating effect는 성능/레이아웃 리스크가 크면 제거한다.
- bottom nav clearance는 `--app-mobile-dock-clearance` 하나만 사용한다.

### Footer

- 기존 사업자/정책/면책 문구는 유지.
- 디자인만 `gyeol` token으로 정리.
- footer는 모바일에서 과도하게 길어지지 않도록 회사 정보는 compact definition list로 유지.

## 14. Button 기준

Button semantic variants:

| Variant | 용도 |
|---|---|
| `primary` | 다음/시작/결제 CTA |
| `secondary` | 보조 CTA |
| `outline` | 되돌아가기/다른 선택 |
| `ghost` | 낮은 중요도 action |
| `danger` | 삭제/취소/위험 |
| `link` | 문장 안 링크 |

크기:

- mobile default height: 44px 이상
- primary payment CTA: 48px 이상
- icon button: 40px 이상

금지:

- route별 직접 rounded link 버튼 추가.
- hover translate를 모바일 기본 CTA에 적용.
- CTA가 3개 이상 같은 위계로 한 화면에 노출.

## 15. Form 기준

공통 기준:

- input/select/button touch target 44px 이상.
- label은 항상 존재.
- helper/error text는 field 바로 아래.
- native select 우선, custom select는 필요한 경우만.
- 생년월일시 입력은 기존 `UnifiedBirthInfoFields` 흐름을 유지하되 style만 통일.

모바일:

- 긴 form은 step으로 분리.
- active step 외 무거운 영역은 렌더링하지 않는다.
- keyboard open 상태에서 sticky CTA와 composer가 겹치지 않아야 한다.

금지:

- 한 화면에 8개 이상 field를 한꺼번에 노출.
- 성향 체크를 공식 검사처럼 보이게 만드는 UI.
- PII를 helper/debug text로 노출.

## 16. ChoiceRow 기준

ChoiceRow는 카드 대신 선택 row의 기본 단위다.

구조:

- leading glyph/icon
- title
- short description
- optional badge
- selected state

원칙:

- 모바일에서 한 row는 56~72px.
- description은 1~2줄.
- selected state는 border/background만 사용하고 shadow는 사용하지 않는다.
- 2열 card grid보다 row list 우선.

적용 대상:

- 관계 유형
- 관심영역
- 현재 질문
- 프로필 선택
- 12간지 expert 선택
- 가격/상품 선택

## 17. StepShell 기준

StepShell은 입력 flow 표준이다.

구조:

1. compact progress
2. step title
3. step description
4. active step content
5. sticky action

원칙:

- active step만 렌더링한다.
- progress는 `1/4` 또는 짧은 segment로 표현한다.
- 뒤로/다음은 bottom action에 모은다.
- 완료 전 validation error는 step 내부에만 표시한다.

적용 대상:

- 기본 사주 입력
- 성향사주 입력
- 기본 궁합 입력
- 성향궁합 입력
- 오늘운세 입력
- 로그인/회원가입 긴 form 일부

## 18. ResultShell 기준

ResultShell은 모든 결과 화면의 기본이다.

구조:

1. ResultIntro
2. SajuStrip/FusionStrip/TodayStrip/ZodiacStrip
3. 핵심 요약
4. AxisMeter 또는 summary list
5. 본문 section
6. 잠금 영역 또는 deep CTA
7. AI 상담 CTA
8. 저장/공유/보관 CTA
9. SafetyNotice

원칙:

- 무료/유료 권한 분리는 절대 깨지 않는다.
- 공유 카드에는 개인정보를 넣지 않는다.
- 점수는 하나만 강조하지 않고 축 전체를 보여준다.
- 결과 본문은 카드 남발보다 section/list 중심.

적용 대상:

- 기본 사주 결과
- 성향사주 결과
- 기본 궁합 결과
- 성향궁합 결과
- 오늘운세 결과
- 타로 결과

## 19. 12간지 캐릭터 리스트 기준

12간지 대화방은 12간지 캐릭터 세계관을 기본으로 한다.

기준:

- source of truth: `src/lib/dialogue-experts.ts`
- visual source: `GangiCharacter` 또는 후속 `ZodiacCharacter`
- `/dialogue`는 12간지 전체를 기본 노출한다.
- 추천은 "추천 4명"이 아니라 "자주 묻는 흐름" filter/shortcut으로 보조 처리한다.
- `/dialogue/[expert]`의 채팅 형식은 유지한다.

리스트 구조:

- 12개 전체 compact list
- 각 row: glyph, teacherName, label, topic, short CTA
- category filter: 전체 / 내 풀이 / 관계 / 오늘 / 돈과 일 / 마음

금지:

- 12간지 중 일부만 대표로 보이게 만드는 구조.
- 일부 캐릭터만 메인 세계관처럼 보이는 copy.
- 캐릭터 말투 과잉 연기.

## 20. 금지 UI 패턴

- 카드 grid를 3개 이상 연속으로 나열.
- 모바일 첫 화면에 CTA 3개 이상.
- `backdrop-blur` 신규 추가.
- 큰 custom shadow 신규 추가.
- `transition-all` 신규 추가.
- Lottie/framer-motion/carousel library 신규 추가.
- video를 above-the-fold에 자동 재생.
- route별 임의 `text-[...]`, `p-[...]`, `rounded-[...]`, `shadow-[...]`.
- horizontal scroll을 기본 탐색으로 사용.
- 성향 체크를 "공식 MBTI 검사"처럼 보이게 하는 UI.
- 결제/권한 상태가 확인되기 전 유료 본문을 먼저 렌더링.
- 개인정보를 공유 카드, analytics payload, AI 상담 context에 직접 노출.

## 21. 성능 원칙

성능 목표:

- Mobile LCP: 2.5s 이하 목표
- INP: 200ms 이하 목표
- CLS: 0.1 이하 목표

원칙:

- Server Component 우선.
- client component는 interaction island로 쪼갠다.
- `SiteHeader`는 server/static과 auth/credit island를 분리한다.
- Toss SDK는 결제 route에서만 로드한다.
- 타로 이미지와 hero video는 route 단위 lazy loading.
- active step 외 form section은 렌더링하지 않는다.
- blur/shadow/animation은 최소화한다.
- icon은 개별 import 유지.
- bundle analyzer 도입은 별도 작업으로 검토한다.

## 22. 페이지군별 적용 순서

| 순서 | 페이지군 | 목표 |
|---|---|---|
| 1 | Token/CSS foundation | `gyeol` 기준 token과 app alias 정리 |
| 2 | AppShell/Nav | header, bottom nav, footer 통일 |
| 3 | 공통 컴포넌트 | Button/Form/ChoiceRow/StepShell/ResultShell 기준화 |
| 4 | 홈 | 나의 결/관계의 결/오늘의 결 hub 유지 |
| 5 | 내 풀이 | 기본 사주, 성향사주, 올해 흐름 통일 |
| 6 | 관계 | 기본 궁합, 성향궁합 통일 |
| 7 | 오늘 | 오늘운세, 타로, 띠운세, 별자리 통일 |
| 8 | 대화 | 12간지 전체 체계로 재정렬 |
| 9 | 보관함/가격 | list/row 중심으로 정리 |
| 10 | QA/성능 | screenshot QA, smoke, build, performance pass |

## 23. QA 기준

### 자동 검수

package.json에 존재하는 명령만 사용한다.

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `git diff --check`
- `npm run smoke`
- `npm run preflight`

### 자동 스크린샷 QA

대상 breakpoint:

- 360px
- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px

대상 route:

- `/`
- `/saju/new`
- `/saju/personality`
- `/saju/personality/result`
- `/saju/[slug]` 샘플
- `/compatibility`
- `/compatibility/personality`
- `/compatibility/personality/result`
- `/today-fortune`
- `/tarot/daily`
- `/zodiac`
- `/star-sign`
- `/dialogue`
- `/dialogue/dragon`
- `/my`
- `/pricing`

### 수동 QA

- iOS Safari
- Android Chrome
- 구형 모바일 또는 throttled device
- 로그인/비로그인 상태
- 결제 CTA 표시/실패 복귀
- 저장/재조회
- 공유 카드 PII 비노출
- analytics payload PII 비노출

### Visual QA 기준

- header/bottom nav가 모든 route에서 같은 위치/크기.
- 모바일 첫 화면에서 핵심 CTA 노출.
- 카드 grid 과다 사용 감소.
- 입력 flow가 active step 중심.
- 결과 화면이 ResultShell 구조.
- 12간지 대화방이 12개 캐릭터 세계관으로 보임.
- 360px에서 horizontal overflow 없음.

## 24. Do Not Modify

다음 영역은 디자인 적용 중 의미/비즈니스 로직을 수정하지 않는다.

- 사주 계산 엔진
- 성향 계산/점수 엔진
- 성향궁합/성향사주 facts/score/report logic
- 결제/권한/entitlement logic
- Supabase migration
- AI prompt/business logic
- 개인정보 저장/조회 policy
- 12간지 persona 데이터의 의미

## 25. 다음 단계

[작업 2]에서는 이 문서를 기준으로 코드 변경 없이 먼저 token 정리 범위를 확정하거나, 요청에 따라 `src/app/styles/tokens.css`와 공통 CSS의 additive cleanup부터 시작한다.

추천 진행:

1. `gyeol` token alias 정리.
2. Button/Input/Panel semantic class 기준 추가.
3. `SiteHeader` client island 분리 계획 수립.
4. 각 route군 적용 전 screenshot baseline 확보.
