# 달빛 결 디자인 토큰 정리 노트

작성일: 2026-05-12
작업 범위: 전역 CSS token, 공통 surface/button/choice/fusion strip 스타일
비범위: 결제, DB, Supabase migration, 사주/성향/궁합 계산, 결과 생성 로직

## 1. 확인한 구조

| 항목 | 확인 내용 |
|---|---|
| global CSS | `src/app/globals.css` |
| CSS import 순서 | Tailwind, `tw-animate-css`, shadcn, `tokens.css`, `base.css`, `components.css`, print, app-shell, home, subpages, mobile polish, dialogue, flow polish |
| Tailwind | Tailwind CSS 4, CSS-first 방식 |
| theme config | 별도 `tailwind.config.*` 없음 |
| PostCSS | `postcss.config.mjs`에서 `@tailwindcss/postcss` 사용 |
| 폰트 | `src/app/layout.tsx`에서 `Noto_Sans_KR`을 `--font-dalbit-sans`로 로드 |
| 기존 token | `src/app/styles/tokens.css`의 `--app-*`, shadcn/Tailwind token |

## 2. 추가한 token

`src/app/styles/tokens.css`에 `--gyeol-*` token layer를 추가했습니다.

### Color

| token | 목적 |
|---|---|
| `--gyeol-color-background` | 전체 배경 |
| `--gyeol-color-surface` | 기본 panel/surface |
| `--gyeol-color-paper` | 부드러운 종이색 section |
| `--gyeol-color-paper-strong` | 더 진한 paper surface |
| `--gyeol-color-moon` | 달빛/사주 네 기둥 강조 |
| `--gyeol-color-moon-soft` | 달빛 soft background |
| `--gyeol-color-orbit` | 주요 CTA/흐름 강조 |
| `--gyeol-color-orbit-soft` | orbit soft background |
| `--gyeol-color-fusion` | 사주×성향 결합/성향 축 강조 |
| `--gyeol-color-fusion-soft` | fusion soft background |
| `--gyeol-color-text` | 기본 텍스트 |
| `--gyeol-color-muted` | 보조 텍스트 |
| `--gyeol-color-line` | 기본 border |

### Radius

| token | 목적 |
|---|---|
| `--gyeol-radius-sm` | 작은 pill/card |
| `--gyeol-radius-md` | 선택 row |
| `--gyeol-radius-lg` | section/panel |
| `--gyeol-radius-xl` | hero/sticky CTA |
| `--gyeol-radius-pill` | button/chip |

### Spacing

`--gyeol-space-1`부터 `--gyeol-space-8`까지 0.25rem 단위 기반 spacing scale을 추가했습니다.

### Type

| token | 목적 |
|---|---|
| `--gyeol-font-size-xs` | caption/badge |
| `--gyeol-font-size-sm` | button/body small |
| `--gyeol-font-size-md` | body |
| `--gyeol-font-size-lg` | section title 보조 |
| `--gyeol-font-size-xl` | card title |
| `--gyeol-font-size-2xl` | mobile hero |
| `--gyeol-line-height-tight` | title |
| `--gyeol-line-height-body` | 본문 |

### Shadow

| token | 목적 |
|---|---|
| `--gyeol-shadow-xs` | border와 구분용 최소 shadow |
| `--gyeol-shadow-sm` | mobile panel 기본 |
| `--gyeol-shadow-md` | CTA/sticky/action |
| `--gyeol-shadow-lg` | desktop 강조용 |

기존보다 shadow를 얕게 잡아 구형 휴대폰에서 paint 비용을 줄이는 방향입니다.

### Motion

| token | 목적 |
|---|---|
| `--gyeol-duration-fast` | hover/active 짧은 전환 |
| `--gyeol-duration-normal` | 일반 전환 |
| `--gyeol-duration-slow` | 제한적 강조 |
| `--gyeol-ease-standard` | 기본 easing |
| `--gyeol-ease-emphasis` | 강조 easing |

## 3. Tailwind theme 연결

`@theme inline`에 `--color-gyeol-*`와 `--shadow-gyeol-*`를 추가해 Tailwind CSS 4 token namespace에서도 참조 가능하게 했습니다.

예시:

```css
--color-gyeol-background: var(--gyeol-color-background);
--shadow-gyeol-sm: var(--gyeol-shadow-sm);
```

## 4. 정리한 공통 스타일

수정 파일:

- `src/app/styles/base.css`
- `src/app/styles/components.css`
- `src/app/styles/home.css`
- `src/app/styles/subpages.css`
- `src/app/styles/flow-polish.css`

정리 내용:

| 영역 | 변경 방향 |
|---|---|
| body background | `--gyeol-color-background` 기준으로 변경 |
| global background accents | pink radial 강도를 줄이고 moon/orbit soft token 사용 |
| app shell | `--gyeol-*` 기반 background, line, shadow 사용 |
| panel/card | blur를 줄이고 `--gyeol-shadow-sm` 중심으로 정리 |
| subpage card | `--gyeol-radius-lg`, `--gyeol-shadow-sm`로 통일 |
| button | `gangi-primary-button`, `gangi-secondary-button`의 radius/shadow/motion을 token 기반으로 조정 |
| flow strip | `gangi-result-flow-strip`을 `--gyeol-*` 기반으로 조정 |

## 5. 새로 준비한 공통 class

후속 컴포넌트 작업에서 바로 사용할 수 있는 class를 추가했습니다.

| class | 목적 |
|---|---|
| `.gyeol-surface` | 기본 surface |
| `.gyeol-panel` | panel surface |
| `.gyeol-section` | section block |
| `.gyeol-list` | list stack |
| `.gyeol-choice-row` | 선택 row |
| `.gyeol-button` | primary CTA |
| `.gyeol-button-secondary` | secondary CTA |
| `.gyeol-fusion-strip` | 사주×성향 결합 strip |
| `.gyeol-fusion-strip-label` | fusion strip label |
| `.gyeol-fusion-strip-body` | 네 기둥×네 축 layout |
| `.gyeol-pillar-rail` | `年 月 日 時` rail |
| `.gyeol-axis-rail` | `I/E S/N T/F J/P` rail |
| `.gyeol-fusion-mark` | `×` mark |
| `.gyeol-sticky-cta` | mobile sticky CTA shell |

## 6. FusionStrip 사용 예시

```html
<div class="gyeol-fusion-strip">
  <div class="gyeol-fusion-strip-label">Moonlight Flow</div>
  <div class="gyeol-fusion-strip-body">
    <div class="gyeol-pillar-rail">
      <span>年</span><span>月</span><span>日</span><span>時</span>
    </div>
    <span class="gyeol-fusion-mark">×</span>
    <div class="gyeol-axis-rail">
      <span>I/E</span><span>S/N</span><span>T/F</span><span>J/P</span>
    </div>
  </div>
</div>
```

## 7. 폰트 처리

폰트 로딩은 변경하지 않았습니다.

- 기존 `Noto_Sans_KR` 유지
- `display: "swap"` 유지
- `preload: false` 유지
- CSS 변수 `--font-dalbit-sans` 유지
- `--font-body`가 `--font-dalbit-sans`, `"Noto Sans KR"`, system fallback을 사용

이번 단계에서는 폰트 weight나 외부 font dependency를 추가하지 않았습니다.

## 8. 성능 고려 사항

이번 변경은 아래 원칙으로 제한했습니다.

- 신규 dependency 없음
- animation library 추가 없음
- image asset 추가 없음
- large blur 확대 없음
- mobile/coarse pointer에서 blur와 shadow를 줄이는 rule 추가
- 기존 `--app-*` token 제거 없이 `--gyeol-*` token을 추가해 회귀 위험 최소화
- 공통 panel/card shadow를 더 얕은 token으로 이동

주의할 점:

- 실제 구형 기기 성능은 정적 CSS 변경만으로 확정할 수 없습니다.
- 다음 단계에서 home, 성향사주, 성향궁합 화면을 실제 기기 또는 throttling으로 측정해야 합니다.
- `SiteHeader` client boundary와 홈 전체 client boundary는 이번 token 작업 범위 밖입니다.

## 9. 수정하지 않은 영역

- 결제 로직
- DB schema
- Supabase migration
- 사주 계산
- 성향 계산
- 궁합 계산
- 결과 생성
- analytics payload
- route 구조
- React/TSX 컴포넌트 로직

## 10. 다음 단계

추천 작업:

`[작업 3] 달빛 결 공통 Shell 컴포넌트 설계 및 구현`

포함 후보:

- `GyeolShell`
- `FlowRow`
- `StepShell`
- `ResultShell`
- `FusionStrip`
- `AxisSummary`
- `StickyCTA`

작업 3부터는 이번에 추가한 `--gyeol-*` token과 `.gyeol-*` class를 실제 컴포넌트에 적용하면 됩니다.
