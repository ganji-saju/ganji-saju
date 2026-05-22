# 점수 시스템 Phase 2+3 통합 작업 지시서
# 라벨/색상 시스템 + UI 컴포넌트 + 잠금 UI

> `saju-score-spec.md` §11의 Phase 2(Tailwind 토큰·라벨)와 Phase 3(UI 컴포넌트)를 통합한 작업 지시서.
>
> **전제 조건**: Phase 1 (`/lib/saju-score/index.ts`의 `computeSajuScore()`)이 동작해야 합니다.
> Phase 1이 아직 완료되지 않았다면 Step 1~2(토큰·라벨)까지만 먼저 작업하고 Step 3부터는 Phase 1 완료 후 진행.
>
> 참조: `saju-score-spec.md`, `naming-policy.md`, `phase-1-task.md`.

---

## 0. 환경 결정 사항 (작업 전 확인)

| 항목 | 결정 |
|------|------|
| 다크모드 | 지원 안 함 |
| 폰트 | 기존 그대로 유지 |
| 컴포넌트 시스템 | 기존 클로드 디자인 시스템 사용 |
| 애니메이션 시스템 | 기존 클로드 애니메이션 시스템 사용 |
| 잠금 UI | Phase 3에 포함 (결제 모달 포함) |

---

## 1. 목표와 비목표

### 목표 (DO)

- Tailwind 색상 토큰 등록 (점수 5단계 + 오행 5종)
- 면책 문구 시스템 구현
- `<LockGate />` 잠금 UI 컴포넌트 (클릭 → 결제 모달)
- `<SajuScoreCard />` 큰 원형 점수 카드
- `<ScoreBreakdownCard />` 5요소 점수 산출 내역 (잠금 포함)
- `<OhaengChart />` 오행 막대 차트
- `<LifetimeKeysCarousel />` 평생 활용 3가지 카드
- 총평 탭 페이지에 컴포넌트 배치
- 모바일 우선 반응형

### 비목표 (DON'T)

- ❌ 실제 결제 로직 (모달 UI만, 결제 플로우는 별도)
- ❌ LLM 호출 (이미 생성된 데이터를 props로 받음)
- ❌ 다크모드 스타일링
- ❌ 도넛 차트 (막대 차트만, 도넛은 Phase 4)
- ❌ 새 디자인 시스템 생성 (기존 것 최대한 활용)

---

## 2. 작업 전 필수 확인 — 기존 코드베이스 파악

**이 단계를 반드시 먼저 진행하세요.** 기존 클로드 디자인 시스템·애니메이션 시스템을 파악해야 새 컴포넌트가 이질감 없이 통합됩니다.

### 2-1. 기존 컴포넌트 파악

```bash
# 기존 컴포넌트 폴더 구조 확인
find src/components -type f -name "*.tsx" | head -40

# 카드 컴포넌트 패턴 확인
cat src/components/ui/card.tsx  # 또는 유사 경로

# 모달 컴포넌트 확인
find src -name "*modal*" -o -name "*Modal*" -o -name "*dialog*" | head -10

# 배지/칩 컴포넌트 확인
find src -name "*badge*" -o -name "*Badge*" -o -name "*chip*" | head -10
```

### 2-2. 기존 디자인 토큰 파악

```bash
# tailwind.config.ts 전체 확인
cat tailwind.config.ts

# 기존 색상 변수 확인
grep -r "colors" tailwind.config.ts | head -30

# CSS 변수 확인 (globals.css 또는 index.css)
grep -E "(--color|--radius|--shadow)" src/styles/globals.css | head -40
```

### 2-3. 기존 애니메이션 시스템 파악

```bash
# 기존 애니메이션 유틸리티 확인
grep -r "animation\|keyframe\|transition" tailwind.config.ts

# Framer Motion 사용 여부
grep -r "framer-motion\|motion\." src --include="*.tsx" | head -10

# 기존 카운트업/숫자 애니메이션 예시 있으면 참고
grep -r "count.*up\|animate.*number\|animat" src --include="*.tsx" | head -10
```

### 2-4. 기존 페이지 구조 파악

```bash
# 총평 탭 컴포넌트 파일 찾기
find src -name "*total*" -o -name "*summary*" -o -name "*overview*" | grep -i "saju\|review\|총평"

# 현재 사주 결과 페이지 구조
cat src/app/saju/[id]/page.tsx  # 또는 유사 경로

# 기존 탭 구조 확인
grep -r "tab\|Tab" src/components --include="*.tsx" | head -20
```

**파악 결과를 보고서 첫 항목으로 제출해주세요.** 기존 시스템 패턴에 맞게 구현 방향을 맞춥니다.

---

> **⚠️ 구현 현황 정정 (2026-05-22 검수 반영)**
> 본 스펙 작성 시점의 가정과 실제 구현이 다음과 같이 다름. 아래 본문의 PascalCase 파일명·`tailwind.config.ts` 표기는 **개념 설명용**이며, 실제는:
> - **컴포넌트 파일명 = kebab-case**(React 통용 관례), **export 명 = PascalCase**(사양 일치):
>   `saju-score-card.tsx`(SajuScoreCard) · `score-breakdown-card.tsx`(ScoreBreakdownCard) · `ohaeng-bar-chart.tsx`(OhaengChart) · `lifetime-keys-carousel.tsx`(LifetimeKeysCarousel) · `lock-gate.tsx`(LockGate)
> - **토큰 = Tailwind v4 `@theme`** — `tailwind.config.ts` **없음**. 색상 토큰은 `src/app/styles/tokens.css` 의 `@theme` 에 CSS 변수(`--color-score-*`, `--color-ohaeng-*`)로 등록.
> - **통합 위치** = `src/app/saju/[slug]/page.tsx` · `src/app/saju/[slug]/premium/page.tsx`.

## 3. 산출물 — 파일 목록

```
작업 완료 시 생성/수정되는 파일:

신규 파일:
├── src/components/saju-score/
│   ├── saju-score-card.tsx            # 큰 원형 점수 카드 (export SajuScoreCard)
│   ├── score-breakdown-card.tsx       # 5요소 산출 내역 + 잠금 (export ScoreBreakdownCard)
│   ├── ohaeng-bar-chart.tsx           # 오행 막대 차트 (export OhaengChart)
│   ├── lifetime-keys-carousel.tsx     # 평생 활용 3가지 (export LifetimeKeysCarousel)
│   ├── lock-gate.tsx                  # 🔒 잠금 UI + 결제 모달 (export LockGate)
│   └── index.ts                       # barrel export

수정 파일:
├── src/app/styles/tokens.css          # @theme 점수·오행 색상 토큰 추가 (Tailwind v4 — tailwind.config 없음)
├── src/lib/saju-score/labels.ts       # 면책 문구 함수 보강
└── src/app/saju/[slug]/page.tsx · premium/page.tsx   # 컴포넌트 배치
```

---

## 4. Step 1: Tailwind 토큰 등록

`tailwind.config.ts`에 다음 토큰 추가. **기존 토큰과 충돌 주의** — 추가하기 전 중복 확인.

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        // 점수 5단계 (naming-policy.md 라벨 기준)
        'score': {
          'excellent':     '#ec4899',  // 90~100: 균형이 잘 잡힌 사주 (pink-500)
          'excellent-soft': '#fdf2f8', // bg soft
          'good':          '#10b981',  // 75~89: 강점이 명확한 사주 (emerald-500)
          'good-soft':     '#ecfdf5',
          'neutral':       '#3b82f6',  // 60~74: 흐름이 무난한 사주 (blue-500)
          'neutral-soft':  '#eff6ff',
          'mindful':       '#f59e0b',  // 45~59: 자기 관리가 빛나는 사주 (amber-500)
          'mindful-soft':  '#fffbeb',
          'potential':     '#a855f7',  // 0~44: 보강의 여지가 큰 사주 (purple-500)
          'potential-soft': '#faf5ff',
        },

        // 오행 5종 (naming-policy.md §2 기준: "X 기운" 라벨)
        'ohaeng': {
          'mok':       '#10b981',  // 목 기운 (emerald-500)
          'mok-soft':  '#d1fae5',
          'hwa':       '#f43f5e',  // 화 기운 (rose-500)
          'hwa-soft':  '#ffe4e6',
          'to':        '#f59e0b',  // 토 기운 (amber-500)
          'to-soft':   '#fef3c7',
          'geum':      '#6b7280',  // 금 기운 (gray-500)
          'geum-soft': '#f3f4f6',
          'su':        '#3b82f6',  // 수 기운 (blue-500)
          'su-soft':   '#dbeafe',
        },
      },

      // 카운트업 애니메이션 (기존 시스템에 없으면 추가, 있으면 재사용)
      keyframes: {
        'score-count-up': {
          '0%':   { opacity: '0', transform: 'scale(0.8)' },
          '60%':  { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bar-fill': {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--bar-width)' },
        },
      },
      animation: {
        'score-count-up': 'score-count-up 0.6s ease-out forwards',
        'bar-fill': 'bar-fill 0.8s ease-out forwards',
      },
    },
  },
};
```

**주의**: 기존 keyframes/animation 항목이 있으면 *spread merge*. 덮어쓰기 금지.

### Step 1 검증

```bash
# 토큰이 실제로 클래스 생성되는지 확인
npx tailwindcss --content './src/**/*.tsx' --output /tmp/tw-out.css
grep "score-excellent\|ohaeng-mok" /tmp/tw-out.css | head -10
# 결과가 있어야 PASS
```

---

## 5. Step 2: 라벨 함수 보강 + 면책 문구 시스템

Phase 1에서 만든 `labels.ts`를 보강합니다.

```typescript
// src/lib/saju-score/labels.ts (기존 파일에 추가)

// === 면책 문구 ===
export const SCORE_DISCLAIMER = '사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요.' as const;

// === 점수 → Tailwind 클래스 매핑 ===
export function getScoreColorClasses(level: ScoreLabel['level']) {
  const map = {
    excellent: {
      bg:       'bg-score-excellent',
      bgSoft:   'bg-score-excellent-soft',
      text:     'text-score-excellent',
      textDark: 'text-white',
      ring:     'ring-score-excellent/30',
      gradient: 'from-score-excellent to-pink-600',
      border:   'border-score-excellent/20',
    },
    good: {
      bg:       'bg-score-good',
      bgSoft:   'bg-score-good-soft',
      text:     'text-score-good',
      textDark: 'text-white',
      ring:     'ring-score-good/30',
      gradient: 'from-score-good to-emerald-600',
      border:   'border-score-good/20',
    },
    neutral: {
      bg:       'bg-score-neutral',
      bgSoft:   'bg-score-neutral-soft',
      text:     'text-score-neutral',
      textDark: 'text-white',
      ring:     'ring-score-neutral/30',
      gradient: 'from-score-neutral to-blue-600',
      border:   'border-score-neutral/20',
    },
    mindful: {
      bg:       'bg-score-mindful',
      bgSoft:   'bg-score-mindful-soft',
      text:     'text-score-mindful',
      textDark: 'text-white',
      ring:     'ring-score-mindful/30',
      gradient: 'from-score-mindful to-amber-600',
      border:   'border-score-mindful/20',
    },
    potential: {
      bg:       'bg-score-potential',
      bgSoft:   'bg-score-potential-soft',
      text:     'text-score-potential',
      textDark: 'text-white',
      ring:     'ring-score-potential/30',
      gradient: 'from-score-potential to-purple-600',
      border:   'border-score-potential/20',
    },
  } as const;
  return map[level];
}

// === 오행 → Tailwind 클래스 매핑 ===
export const OHAENG_COLOR_CLASSES = {
  '목': { bg: 'bg-ohaeng-mok',  soft: 'bg-ohaeng-mok-soft',  text: 'text-ohaeng-mok' },
  '화': { bg: 'bg-ohaeng-hwa',  soft: 'bg-ohaeng-hwa-soft',  text: 'text-ohaeng-hwa' },
  '토': { bg: 'bg-ohaeng-to',   soft: 'bg-ohaeng-to-soft',   text: 'text-ohaeng-to'  },
  '금': { bg: 'bg-ohaeng-geum', soft: 'bg-ohaeng-geum-soft', text: 'text-ohaeng-geum'},
  '수': { bg: 'bg-ohaeng-su',   soft: 'bg-ohaeng-su-soft',   text: 'text-ohaeng-su'  },
} as const;
```

---

## 6. Step 3: `<LockGate />` — 잠금 UI + 결제 모달

**모든 "자세히 →" 버튼에 공통으로 사용하는 컴포넌트.** 이걸 먼저 만들어야 Step 4~5에서 가져다 씁니다.

### 6-1. Props

```typescript
interface LockGateProps {
  factorId: 'F1' | 'F2' | 'F3' | 'F4' | 'F5';  // 잠금 해제될 항목
  factorTitle: string;                             // "일주 본질"
  navigateTo?: string;                             // 유료 사용자용 링크 (탭 앵커)
  isUnlocked?: boolean;                            // 결제 완료 여부
  className?: string;
}
```

### 6-2. 동작 방식

```
무료 사용자:
  [🔒 자세히 →]  ← 클릭
    ↓
  결제 모달 열림
    - 제목: "일주 본질 자세한 풀이"
    - 내용: 간단한 가치 설명
    - 가격: 550원
    - CTA: "풀이 보기" 버튼
    - 닫기: X 버튼 또는 배경 클릭

유료 사용자 (isUnlocked = true):
  [자세히 →]  ← 클릭 → navigateTo 링크로 이동 (탭 딥링크)
```

### 6-3. 구현 명세

```typescript
// src/components/saju-score/LockGate.tsx
'use client';

import { useState } from 'react';
// 기존 Modal/Dialog 컴포넌트 import (Step 2에서 확인한 경로)
// import { Modal } from '@/components/ui/modal';

interface LockGateProps {
  factorId: 'F1' | 'F2' | 'F3' | 'F4' | 'F5';
  factorTitle: string;
  navigateTo?: string;
  isUnlocked?: boolean;
  className?: string;
}

// 팩터별 결제 유도 문구 (한 줄)
const FACTOR_VALUE_LINES: Record<LockGateProps['factorId'], string> = {
  F1: '일주 60갑자 캐릭터 풀이와 타고난 성향의 구체적 패턴',
  F2: '격국 종류와 본인 격국의 강도 — 사회적 역할의 명확성',
  F3: '용신·기신 구체 풀이와 평생 보강 가이드',
  F4: '부족·과다 기운의 일상 적용 — 구체적 보강 방법',
  F5: '작동하는 신살 목록과 각각의 의미 및 활용법',
};

const PRICE = '550원';

export function LockGate({
  factorId,
  factorTitle,
  navigateTo,
  isUnlocked = false,
  className = '',
}: LockGateProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 유료 사용자: 바로 링크 이동
  if (isUnlocked && navigateTo) {
    return (
      <a
        href={navigateTo}
        className={`text-sm font-medium text-gray-600 hover:text-gray-900
                    flex items-center gap-1 transition-colors ${className}`}
      >
        자세히 →
      </a>
    );
  }

  // 무료 사용자: 잠금 버튼 + 모달
  return (
    <>
      {/* 잠금 버튼 */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={`text-sm font-medium text-gray-400 flex items-center gap-1
                    hover:text-gray-600 transition-colors cursor-pointer ${className}`}
        aria-label={`${factorTitle} 자세한 풀이 보기 (유료)`}
      >
        <span>🔒</span>
        <span>자세히 →</span>
      </button>

      {/* 결제 유도 모달 */}
      {isModalOpen && (
        <LockPaymentModal
          factorTitle={factorTitle}
          valueLine={FACTOR_VALUE_LINES[factorId]}
          price={PRICE}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
```

### 6-4. 결제 유도 모달

```typescript
// LockGate.tsx 내부 (또는 별도 파일)

interface LockPaymentModalProps {
  factorTitle: string;
  valueLine: string;
  price: string;
  onClose: () => void;
}

function LockPaymentModal({
  factorTitle,
  valueLine,
  price,
  onClose,
}: LockPaymentModalProps) {
  // 기존 Modal 컴포넌트 있으면 래핑. 없으면 아래 직접 구현.
  return (
    // 기존 Modal 컴포넌트 구조에 맞게 조정
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm mx-4
                   shadow-xl"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">더 자세한 풀이가 있어요</p>
            <h3 className="text-lg font-bold text-gray-900">
              {factorTitle} 자세한 풀이
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 가치 설명 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            {valueLine}
          </p>
        </div>

        {/* 가격 + CTA */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-500 bg-gray-100
                           px-3 py-1.5 rounded-full">
            {price}
          </span>
          <button
            onClick={() => {
              // TODO: 실제 결제 플로우 (Phase 6에서 구현)
              // 지금은 콘솔 로그만
              console.log(`[결제 예정] factorId, price: ${price}`);
              onClose();
            }}
            className="flex-1 bg-pink-500 hover:bg-pink-600 text-white
                       font-semibold py-2.5 rounded-xl transition-colors"
          >
            풀이 보기
          </button>
        </div>

        {/* 하단 안내 */}
        <p className="text-xs text-gray-400 text-center mt-3">
          결제 후 보관함에서 다시 볼 수 있어요
        </p>
      </div>
    </div>
  );
}
```

**모달 스타일 주의사항**:
- 기존 모달 컴포넌트 있으면 반드시 재사용
- `fixed inset-0` z-index는 기존 전역 z-index 체계에 맞게 조정
- 모바일에서는 bottom sheet(`items-end`), 데스크탑에서는 center modal(`sm:items-center`)

---

## 7. Step 4: `<SajuScoreCard />` — 큰 원형 점수 카드

### 7-1. Props

```typescript
interface SajuScoreCardProps {
  score: import('@/lib/saju-score').SajuScore;
  animateOnMount?: boolean;  // default: true
  className?: string;
}
```

### 7-2. 시각 명세

```
╭──────────────────────────────╮
│                              │
│    ╭─────────────────╮       │
│    │  ╭───────────╮  │       │  ← 외곽 링: score 색상, ring-4, opacity-20
│    │  │           │  │       │  ← 내부 원: score-soft bg
│    │  │    83     │  │       │  ← 숫자: text-6xl font-bold, score 색상
│    │  │           │  │       │
│    │  │ 강점이 명확한│  │       │  ← label.title: text-lg font-semibold
│    │  │   사주      │  │       │
│    │  ╰───────────╯  │       │
│    ╰─────────────────╯       │
│                              │
│  본인 자리를 알면 빠르게 자리잡는 │  ← label.subtitle: text-sm text-gray-600
│           사주                │
│                              │
│ ─────────────────────────── │
│                              │
│  사주는 좋고 나쁨이 없습니다.  │  ← SCORE_DISCLAIMER: text-xs text-gray-400
│  활용도가 다를 뿐이에요.       │
│                              │
╰──────────────────────────────╯
```

### 7-3. 구현 명세

```typescript
// src/components/saju-score/SajuScoreCard.tsx
'use client';

import { useEffect, useState } from 'react';
import type { SajuScore } from '@/lib/saju-score';
import { getScoreColorClasses, SCORE_DISCLAIMER } from '@/lib/saju-score/labels';

export function SajuScoreCard({
  score,
  animateOnMount = true,
  className = '',
}: SajuScoreCardProps) {
  // 카운트업 애니메이션
  const [displayScore, setDisplayScore] = useState(animateOnMount ? 0 : score.total);

  useEffect(() => {
    if (!animateOnMount) return;

    // 기존 애니메이션 시스템에 있으면 그걸 사용.
    // 없으면 아래 패턴 사용.
    const duration = 1000;  // 1초
    const start = performance.now();
    const target = score.total;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOut 커브
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [score.total, animateOnMount]);

  const colors = getScoreColorClasses(score.label.level);

  return (
    <div className={`rounded-2xl p-5 ${colors.bgSoft} ${className}`}>
      {/* 원형 점수 */}
      <div className="flex flex-col items-center py-4">
        {/* 외곽 링 */}
        <div className={`relative w-40 h-40 rounded-full ring-4 ${colors.ring}
                         flex items-center justify-center`}>
          {/* 내부 원 */}
          <div className={`w-32 h-32 rounded-full ${colors.bgSoft}
                           flex flex-col items-center justify-center gap-1`}>
            {/* 점수 숫자 */}
            <span
              className={`text-5xl font-bold tabular-nums ${colors.text}`}
              aria-label={`${score.total}점`}
            >
              {displayScore}
            </span>
            {/* 라벨 */}
            <span className={`text-sm font-semibold ${colors.text} text-center
                              leading-tight px-2`}>
              {score.label.title}
            </span>
          </div>
        </div>

        {/* 부제 */}
        <p className="mt-3 text-sm text-gray-600 text-center leading-relaxed">
          {score.label.subtitle}
        </p>
      </div>

      {/* 구분선 + 면책 문구 */}
      <div className="border-t border-gray-200/60 pt-3 mt-1">
        <p className="text-xs text-gray-400 text-center leading-relaxed">
          {SCORE_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
```

**기존 시스템 체크**:
- `requestAnimationFrame` 카운트업이 기존 애니메이션 시스템에 있으면 그것으로 교체
- `rounded-2xl`, `ring-4` 등은 기존 카드 스타일 반경에 맞게 조정

---

## 8. Step 5: `<ScoreBreakdownCard />` — 5요소 산출 내역 + 잠금

### 8-1. Props

```typescript
interface ScoreBreakdownCardProps {
  score: SajuScore;
  isUnlocked?: boolean;  // 결제 완료 여부 (전체 공통)
  onClickFactor?: (factorId: 'F1'|'F2'|'F3'|'F4'|'F5') => void;
  className?: string;
}
```

### 8-2. 시각 명세

```
╭─────────────────────────────────────────╮
│ 📊 점수 산출 내역                    83  │
│ 왜 이 점수가 나왔는지       [라벨 칩]    │
├─────────────────────────────────────────┤
│                                         │
│  ①  일주 본질                  +17점    │
│     타고난 성향의 안정도               │
│     ████████████████████░░░            │  ← 20칸 프로그레스바, 17/20
│                         [🔒 자세히 →]   │
│                                         │
│  ②  격국 작동도                +15점    │
│     사회적 역할의 명확성              │
│     ███████████████░░░░░░░             │
│                         [🔒 자세히 →]   │
│  ... (F3, F4, F5 동일 패턴) ...        │
│                                         │
│  ─────────────────────────────         │
│  합계                          83점     │
│                                         │
╰─────────────────────────────────────────╯
```

### 8-3. 팩터 메타 데이터

```typescript
const FACTOR_META = [
  {
    id: 'F1' as const,
    emoji: '①',
    title: '일주 본질',
    subtitle: '타고난 성향의 안정도',
    navigateTo: '#tab-seongyang',  // 성향 탭 앵커
  },
  {
    id: 'F2' as const,
    emoji: '②',
    title: '격국 작동도',
    subtitle: '사회적 역할의 명확성',
    navigateTo: '#tab-myeongshik',  // 명식 탭 앵커
  },
  {
    id: 'F3' as const,
    emoji: '③',
    title: '용신·기신 균형',
    subtitle: '보강 흐름의 작동',
    navigateTo: '#tab-myeongshik',
  },
  {
    id: 'F4' as const,
    emoji: '④',
    title: '오행 균형',
    subtitle: '다섯 기운의 균형',
    navigateTo: '#tab-ohaeng',  // 오행 탭 앵커
  },
  {
    id: 'F5' as const,
    emoji: '⑤',
    title: '합충·신살',
    subtitle: '관계와 작용의 부드러움',
    navigateTo: '#tab-myeongshik',
  },
] as const;
```

**앵커 경로**: 실제 탭 앵커 ID는 기존 코드에서 확인 후 맞게 수정.

### 8-4. 구현 명세

```typescript
// src/components/saju-score/ScoreBreakdownCard.tsx

export function ScoreBreakdownCard({
  score,
  isUnlocked = false,
  className = '',
}: ScoreBreakdownCardProps) {
  const label = score.label;
  const colors = getScoreColorClasses(label.level);

  return (
    <div className={`rounded-2xl bg-white border border-gray-100
                     shadow-sm overflow-hidden ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4
                      border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">왜 이 점수가 나왔는지</p>
          <h3 className="text-base font-bold text-gray-900">📊 점수 산출 내역</h3>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${colors.text}`}>
            {score.total}
          </span>
          <div className={`text-xs font-medium mt-0.5 ${colors.text}`}>
            {label.title}
          </div>
        </div>
      </div>

      {/* 팩터 목록 */}
      <div className="divide-y divide-gray-50">
        {FACTOR_META.map((meta) => {
          const factorScore = score.breakdown[meta.id];
          const barWidth = (factorScore / 20) * 100;

          return (
            <div key={meta.id} className="px-5 py-4">
              {/* 상단: 번호·제목·점수 */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{meta.emoji}</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {meta.title}
                  </span>
                </div>
                <span className={`text-sm font-bold ${colors.text}`}>
                  +{factorScore}점
                </span>
              </div>

              {/* 부제 */}
              <p className="text-xs text-gray-500 mb-2 pl-6">{meta.subtitle}</p>

              {/* 프로그레스 바 + 잠금 버튼 */}
              <div className="flex items-center gap-3 pl-6">
                {/* 프로그레스 바 */}
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colors.bg}
                                 animate-bar-fill`}
                    style={{
                      '--bar-width': `${barWidth}%`,
                      width: `${barWidth}%`,
                    } as React.CSSProperties}
                  />
                </div>

                {/* 잠금 / 이동 버튼 */}
                <LockGate
                  factorId={meta.id}
                  factorTitle={meta.title}
                  navigateTo={meta.navigateTo}
                  isUnlocked={isUnlocked}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 합계 */}
      <div className="flex items-center justify-between px-5 py-4
                      bg-gray-50 border-t border-gray-100">
        <span className="text-sm font-semibold text-gray-700">합계</span>
        <span className={`text-xl font-bold ${colors.text}`}>
          {score.total}점
        </span>
      </div>
    </div>
  );
}
```

---

## 9. Step 6: `<OhaengChart />` — 오행 막대 차트

### 9-1. Props

```typescript
interface OhaengChartProps {
  data: import('@/lib/saju-score').OhaengChartData;
  showGuidance?: boolean;  // default: true
  guidanceText?: string;   // LLM 생성 텍스트 (Phase 5에서 채워짐)
  className?: string;
}
```

### 9-2. 시각 명세

```
╭────────────────────────────────────────╮
│ 🍃 다섯 기운 분포                       │
├────────────────────────────────────────┤
│                                        │
│  목 기운  ████░░░░░░░░  2개            │  ← 색: ohaeng-mok
│  화 기운  ████████░░░░  4개            │  ← 색: ohaeng-hwa
│  토 기운  ████░░░░░░░░  2개            │  ← 색: ohaeng-to
│  금 기운  ░░░░░░░░░░░░  0개  [보강 필요]│  ← 색: ohaeng-geum, 보강 배지
│  수 기운  ██████████░░  5개  [과다]    │  ← 색: ohaeng-su, 과다 배지
│                                        │
│  균형 점수  ●●●●○  16/20              │
│                                        │
├────────────────────────────────────────┤
│ ✨ 보강할 기운                         │  ← guidanceText 또는 기본 텍스트
│ 금 기운 (단단함과 결단): 체크리스트,   │
│ 정기 회고 같은 구조가 평생 보강이 됩니다│
╰────────────────────────────────────────╯
```

### 9-3. 구현 명세

```typescript
// src/components/saju-score/OhaengChart.tsx
'use client';

import type { OhaengChartData } from '@/lib/saju-score';
import { OHAENG_COLOR_CLASSES } from '@/lib/saju-score/labels';

const OHAENG_ORDER = ['목', '화', '토', '금', '수'] as const;
type Ohaeng = typeof OHAENG_ORDER[number];

// 각 오행의 기본 보강 가이드 (Phase 5에서 LLM이 대체함)
const DEFAULT_GUIDANCE: Record<Ohaeng, string> = {
  '목': '목 기운(자라남과 추진): 새로운 시작과 도전적 계획이 보강이 됩니다.',
  '화': '화 기운(표현과 열정): 발표, 강의, 기록 같은 표현하는 자리가 보강이 됩니다.',
  '토': '토 기운(담아냄과 안정): 규칙적인 루틴과 안정된 환경이 보강이 됩니다.',
  '금': '금 기운(단단함과 결단): 체크리스트, 정기 회고 같은 단단한 구조가 보강이 됩니다.',
  '수': '수 기운(흐름과 깊이): 사색, 학습, 깊이 있는 관계가 보강이 됩니다.',
};

export function OhaengChart({
  data,
  showGuidance = true,
  guidanceText,
  className = '',
}: OhaengChartProps) {
  // 부족/과다 설명 자동 생성
  const autoGuidanceText = (() => {
    if (!showGuidance) return null;
    if (guidanceText) return guidanceText;
    if (data.lack.length === 0 && data.excess.length === 0) return null;

    const parts: string[] = [];
    if (data.lack.length > 0) {
      data.lack.forEach(oh => parts.push(DEFAULT_GUIDANCE[oh]));
    }
    return parts.join(' ');
  })();

  return (
    <div className={`rounded-2xl bg-white border border-gray-100
                     shadow-sm overflow-hidden ${className}`}>
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">🍃 다섯 기운 분포</h3>
      </div>

      {/* 막대 차트 */}
      <div className="px-5 py-4 space-y-3">
        {OHAENG_ORDER.map((oh) => {
          const count = data.counts[oh];
          const barWidth = (count / 5) * 100;  // 5개를 100%로
          const isLack = data.lack.includes(oh);
          const isExcess = data.excess.includes(oh);
          const colorClass = OHAENG_COLOR_CLASSES[oh];

          return (
            <div key={oh} className="flex items-center gap-3">
              {/* 라벨 */}
              <span className="text-sm text-gray-700 w-14 shrink-0 font-medium">
                {data.labels[oh]}  {/* "목 기운" 등 naming-policy 적용 */}
              </span>

              {/* 막대 */}
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                {count > 0 ? (
                  <div
                    className={`h-full rounded-full animate-bar-fill
                                ${isExcess ? `${colorClass.bg} opacity-70` : colorClass.bg}`}
                    style={{
                      '--bar-width': `${barWidth}%`,
                      width: `${barWidth}%`,
                    } as React.CSSProperties}
                  />
                ) : (
                  // 0개: 점선 표시
                  <div className="h-full w-full border-2 border-dashed
                                  border-gray-200 rounded-full" />
                )}
              </div>

              {/* 개수 */}
              <span className="text-sm text-gray-500 w-8 text-right tabular-nums shrink-0">
                {count}개
              </span>

              {/* 배지 */}
              <div className="w-16 shrink-0">
                {isLack && (
                  <span className="text-xs bg-amber-50 text-amber-600
                                   px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                    보강 필요
                  </span>
                )}
                {isExcess && (
                  <span className="text-xs bg-gray-100 text-gray-500
                                   px-2 py-0.5 rounded-full font-medium">
                    과다
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 균형 점수 */}
      <div className="px-5 pb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">균형 점수</span>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full
                ${i < Math.round(data.balanceScore / 4)
                  ? 'bg-emerald-400'
                  : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-gray-700">
          {data.balanceScore}/20
        </span>
      </div>

      {/* 보강 가이드 카드 */}
      {autoGuidanceText && (
        <div className="mx-5 mb-5 rounded-xl bg-amber-50/60
                        border border-amber-100 p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">
            ✨ 보강할 기운
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {autoGuidanceText}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 10. Step 7: `<LifetimeKeysCarousel />` — 평생 활용 3가지

`saju-total-review-llm-spec.md`의 LLM 출력 `lifetime_keys` 배열을 렌더링하는 컴포넌트.

### 10-1. Props

```typescript
interface LifetimeKey {
  title: string;    // "금 기운 들이기"
  subtitle: string; // "단단한 구조가 평생 보강"
  body: string;     // "체크리스트·예산표·정기 회고..."
}

interface LifetimeKeysCarouselProps {
  keys: [LifetimeKey, LifetimeKey, LifetimeKey];  // 항상 3개
  className?: string;
}
```

### 10-2. 카드 색상 고정

```typescript
const KEY_CARD_COLORS = [
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', badge: '강한 환경' },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-100',  badge: '약한 자리' },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-100',    badge: '핵심 활용법' },
] as const;
```

### 10-3. 구현 (가로 스크롤)

```typescript
// src/components/saju-score/LifetimeKeysCarousel.tsx

export function LifetimeKeysCarousel({ keys, className = '' }: LifetimeKeysCarouselProps) {
  return (
    <div className={className}>
      <h3 className="text-base font-bold text-gray-900 px-1 mb-3">
        🎯 평생 활용 핵심 3가지
      </h3>

      {/* 가로 스크롤 (모바일) / 세로 스택 (데스크탑) */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory
                      scrollbar-none sm:flex-col sm:overflow-visible">
        {keys.map((key, i) => {
          const colors = KEY_CARD_COLORS[i];
          return (
            <div
              key={i}
              className={`flex-none w-72 sm:w-full rounded-xl border p-4
                          snap-start ${colors.bg} ${colors.border}`}
            >
              {/* 뱃지 */}
              <span className={`text-xs font-semibold ${colors.text}
                                bg-white/60 px-2 py-0.5 rounded-full`}>
                {colors.badge}
              </span>

              {/* 제목·부제 */}
              <p className={`text-base font-bold mt-2 ${colors.text}`}>
                {key.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {key.subtitle}
              </p>

              {/* 본문 */}
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                {key.body}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 11. Step 8: 총평 탭 페이지 통합

기존 총평 탭 컴포넌트에 새 컴포넌트를 **배치**합니다.

### 11-1. 배치 순서 (saju-score-spec.md §5-1 기준)

```typescript
// 총평 탭 컴포넌트 (기존 파일 수정)

// Props 예시: 기존 + 새 점수 데이터
interface TotalReviewTabProps {
  // 기존 props
  sajuData: SajuData;
  llmOutput: {
    one_line_summary: string;
    main_narrative: { ... };
    lifetime_keys: [LifetimeKey, LifetimeKey, LifetimeKey];
  };
  context: { relationship_status: string; occupation_status: string; concern: string };
  
  // 새 props
  score: SajuScore;
  isUnlocked?: boolean;
}

export function TotalReviewTab({ sajuData, llmOutput, score, isUnlocked }: TotalReviewTabProps) {
  return (
    <div className="space-y-4 pb-8">

      {/* 1. 사주팔자 8글자 카드 (기존 유지) */}
      <ExistingSajuPillarsCard sajuData={sajuData} />

      {/* 2. 큰 점수 카드 (NEW) */}
      <SajuScoreCard score={score} />

      {/* 3. 한 줄 요약 (기존 → LLM 출력으로 교체) */}
      <OneLineSummaryCard text={llmOutput.one_line_summary} />

      {/* 4. 컨텍스트 카드 (기존 유지) */}
      <ExistingContextCard context={context} />

      {/* 5. 본문 4단락 (기존 → LLM 출력으로 교체) */}
      <NarrativeSection paragraphs={llmOutput.main_narrative} />

      {/* 6. 평생 활용 3가지 (NEW) */}
      <LifetimeKeysCarousel keys={llmOutput.lifetime_keys} />

      {/* 7. 점수 산출 내역 (NEW) */}
      <ScoreBreakdownCard score={score} isUnlocked={isUnlocked} />

      {/* 8. 오행 차트 (NEW) */}
      <OhaengChart data={score.ohaengChart} />

      {/* 9. 일주·격국·용신 칩 (기존 유지) */}
      <ExistingSajuChips sajuData={sajuData} score={score} />

      {/* 10. 더 깊게 보기 CTA (기존 유지) */}
      <ExistingDeepDiveCTA />

    </div>
  );
}
```

**기존 컴포넌트 이름**: `ExistingSajuPillarsCard` 등은 실제 코드베이스 확인 후 정확한 이름으로 교체.

### 11-2. 데이터 흐름

```
서버 컴포넌트 (page.tsx)
  ↓
  computeSajuScore(sajuData)  → score: SajuScore
  callLLM(sajuData, score)    → llmOutput: { one_line_summary, main_narrative, lifetime_keys }
  ↓
클라이언트 컴포넌트 (TotalReviewTab)
  ↓
  SajuScoreCard, ScoreBreakdownCard, OhaengChart, LifetimeKeysCarousel
```

---

## 12. Step 9: 반응형 최적화

### 12-1. 기준

- **모바일 우선** (스크린샷 기준: ~390px)
- 데스크탑 분기: `sm:` (640px), `md:` (768px)

### 12-2. 주요 반응형 포인트

| 컴포넌트 | 모바일 | 데스크탑 |
|---------|------|--------|
| SajuScoreCard | 원 w-40 h-40 | 원 sm:w-48 sm:h-48 |
| ScoreBreakdownCard | 꽉 참 | max-w-lg mx-auto |
| OhaengChart | 막대 라벨 w-14 | sm:w-20 |
| LifetimeKeysCarousel | 가로 스크롤 | sm:세로 스택 |
| LockGate 모달 | bottom sheet | 중앙 모달 |

### 12-3. 스크롤바 숨기기 (스크롤은 되고 스크롤바는 안 보임)

```css
/* globals.css에 추가 */
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
```

---

## 13. 수용 기준 체크리스트

### Step 1~2 (토큰·라벨)

- [ ] `npx tailwindcss` 빌드 후 `score-excellent`, `ohaeng-mok` 등 클래스 생성 확인
- [ ] 기존 토큰과 충돌 없음
- [ ] `SCORE_DISCLAIMER` 상수 존재
- [ ] `getScoreColorClasses()` 5개 레벨 모두 반환 정상

### Step 3 (LockGate)

- [ ] 무료 사용자: 🔒 아이콘 + "자세히 →" 표시
- [ ] 클릭 → 모달 열림
- [ ] 모달 제목에 factorTitle 반영됨 ("일주 본질 자세한 풀이")
- [ ] 모달 550원 표시
- [ ] 모달 닫기 (X 버튼 + 배경 클릭) 동작
- [ ] 유료 사용자 (`isUnlocked=true`): 🔒 없음, 클릭 → navigateTo 이동

### Step 4 (SajuScoreCard)

- [ ] 카운트업 애니메이션 동작 (0 → 83, 1초)
- [ ] 5개 score level 각각 다른 색상 확인
- [ ] 면책 문구 "사주는 좋고 나쁨이 없습니다..." 항상 표시
- [ ] 라벨에 "결" 단어 없음 (`naming-policy.md` 정책)
- [ ] 같은 점수 두 번 렌더시 결과 동일 (결정론)

### Step 5 (ScoreBreakdownCard)

- [ ] 5개 팩터 모두 표시 (F1~F5)
- [ ] 각 팩터에 LockGate 연결
- [ ] 프로그레스 바 폭이 점수에 비례 (17점 → 85%)
- [ ] 합계 행 표시
- [ ] 합계 = F1+F2+F3+F4+F5

### Step 6 (OhaengChart)

- [ ] 5개 오행 모두 표시
- [ ] 라벨이 "목 기운" 등 `naming-policy.md` §2 기준 ("결" 단어 없음)
- [ ] 0개 오행: 점선 막대 + "보강 필요" 배지
- [ ] 4개 이상 오행: "과다" 배지
- [ ] 균형 점수 ●●●●○ 형태 표시
- [ ] 보강 가이드 텍스트 표시

### Step 7 (LifetimeKeysCarousel)

- [ ] 3개 카드 표시
- [ ] 각 카드: 뱃지 + 제목 + 부제 + 본문
- [ ] 모바일: 가로 스크롤 동작
- [ ] 데스크탑: 세로 스택

### Step 8 (페이지 통합)

- [ ] 총평 탭에 새 컴포넌트 순서대로 배치됨
- [ ] 기존 컴포넌트 (사주팔자 카드, 컨텍스트 카드 등) 깨지지 않음
- [ ] 전체 스크롤 자연스러움
- [ ] 기존 탭 네비게이션 정상 동작

### Step 9 (반응형)

- [ ] 390px 모바일에서 가로 overflow 없음
- [ ] 768px 데스크탑에서 레이아웃 안정
- [ ] LockGate 모달: 모바일 bottom sheet, 데스크탑 center 확인
- [ ] LifetimeKeysCarousel: 모바일 가로 스크롤 확인

---

## 14. 즉시 복사 프롬프트

```
ganjisaju.kr 사주 총평 점수 시스템 Phase 2+3 (UI 컴포넌트)를 구축해줘.

작업 지시서: phase-2-3-task.md
참조: saju-score-spec.md, naming-policy.md

## 작업 순서

Step 0 (필수): 아래 명령어로 기존 코드베이스 파악 먼저 해줘.
  - 기존 컴포넌트 구조 (ui 폴더, 모달/카드/배지)
  - tailwind.config.ts 기존 토큰
  - 기존 애니메이션 시스템
  - 총평 탭 현재 파일 경로
  파악 결과를 보고서로 먼저 제출하고, 내 확인 후 Step 1 진행.

Step 1: Tailwind 토큰 등록
Step 2: 라벨 함수 보강 + 면책 문구
Step 3: <LockGate /> 잠금 UI + 결제 모달 (결제 로직 구현 제외)
Step 4: <SajuScoreCard />
Step 5: <ScoreBreakdownCard />
Step 6: <OhaengChart />
Step 7: <LifetimeKeysCarousel />
Step 8: 총평 탭 페이지 통합
Step 9: 반응형 최적화

## 핵심 제약

1. 기존 클로드 디자인 시스템 최대한 재사용. 새 라이브러리 추가 금지.
2. 기존 애니메이션 시스템 재사용. 없는 것만 추가.
3. 다크모드 처리 금지.
4. 실제 결제 로직 구현 금지 (모달 UI + console.log만).
5. naming-policy.md 어휘 정책 준수:
   - 오행 라벨: "목 기운 / 화 기운 / 토 기운 / 금 기운 / 수 기운"
   - 점수 라벨: "균형이 잘 잡힌 사주" 등 — "결" 단어 금지
   - 면책 문구: 항상 "사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요."

## 보고 형식

Step 0 완료 시:
- 기존 컴포넌트 구조 요약
- 기존 tailwind 토큰 목록
- 기존 애니메이션 유틸리티 목록
- 총평 탭 파일 경로
- "Step 1 진행해도 될까요?" 확인 요청

각 Step 완료 시:
- 생성/수정된 파일 목록 + 줄 수
- 수용 기준 체크리스트 해당 항목 ✅/❌

모든 Step 완료 시:
- 전체 수용 기준 체크리스트 (phase-2-3-task.md §13)
- 스크린샷 또는 컴포넌트 렌더 결과
- 기존 컴포넌트 깨진 항목 있으면 명시
```

---

## 15. 구현 중 자주 막히는 부분

### 15-1. 기존 모달이 없는 경우

기존 모달 컴포넌트를 못 찾으면 `LockGate` 안에 직접 구현(Step 3 §6-4)을 그대로 사용. 나중에 기존 시스템과 통합해도 됨.

### 15-2. Tailwind JIT에서 동적 클래스 문제

`--bar-width` CSS 변수로 동적 너비를 제어하는데, Tailwind JIT가 동적 클래스를 purge할 수 있음.

```typescript
// 대안: style prop으로 직접 제어
<div
  style={{ width: `${barWidth}%` }}
  className="h-full rounded-full bg-score-excellent"
/>
```

### 15-3. 카운트업 애니메이션이 기존 시스템과 충돌

기존 시스템에 카운트업 유틸이 있으면 그걸 씀. 없으면 `useCountUp` hook으로 분리:

```typescript
function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}
```

### 15-4. OhaengChart 막대 바 폭 계산

"5개를 100%로" 기준이 사실 최대 8개인 사주에서 너무 좁게 보일 수 있음.

```typescript
// 옵션 A: 5개 기준 (spec 그대로)
const barWidth = (count / 5) * 100;  // 5개 = 100%

// 옵션 B: 최대 개수 기준 (더 균형 있어 보임)
const maxCount = Math.max(...Object.values(data.counts));
const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
```

옵션 A는 스펙 기준, 옵션 B는 시각적으로 더 좋음. 취향에 맞게 선택.

### 15-5. navigateTo 탭 앵커가 없는 경우

기존 탭이 URL 해시가 아닌 상태(state)로 관리되는 경우, `navigateTo`를 문자열 링크 대신 `onClickFactor` 콜백으로 처리:

```typescript
// ScoreBreakdownCard에서 navigateTo 대신 콜백 사용
onClickFactor={(id) => {
  // 기존 탭 전환 로직에 맞게 처리
  setActiveTab(TAB_MAP[id]);
}}
```

---

## 16. 한 줄 요약

> **Step 0에서 기존 코드베이스를 먼저 파악하고, 기존 시스템을 최대한 재사용. 잠금 UI는 결제 로직 없이 모달 UI만. `naming-policy.md` 어휘 정책 (X 기운, 사주 라벨, 면책 문구) 반드시 준수.**
