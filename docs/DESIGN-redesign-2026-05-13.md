# 간지사주 리디자인 — 실제 코드베이스 적용 가이드

> **📌 이 문서가 디자인 작업의 최우선 참조 문서입니다.**
> 기존 [`docs/DESIGN.md`](./DESIGN.md) 는 보존하지만, 본 리디자인 작업이 진행 중일 동안은
> 본 문서의 결정이 항상 우선합니다. 충돌 시 본 문서를 따르세요.
>
> 이 문서는 `간지사주 리디자인.html` (zip 패키지) 에서 만든 디자인을
> 실제 Next.js 프로젝트(`ganji-saju/`)에 단계별로 옮기는 방법입니다.
> 모든 라우팅(`href`)·서버 로직은 **건드리지 않고** 디자인 토큰과 컴포넌트만 교체합니다.
>
> **진행 현황**:
> - ✅ **PR1** (`redesign/claude-design-2026-05-13`, 머지됨): foundation
>   - 1단계: tokens.css 십이간지 액센트 + 라운드 + 한자 폰트 토큰
>   - 1단계: `layout.tsx` Noto Serif KR (`--font-dalbit-serif`)
>   - 2단계: `src/components/gangi/zodiac-chip.tsx` 신설
>   - 3단계: `site-header.tsx` 한자(干) 인장 brand lockup
>   - 4단계: `site-footer.tsx` 다크 풀 푸터 (모바일 accordion 포함)
> - ✅ **PR2** (`redesign/claude-design-pr2-home-2026-05-13`, 머지됨): 홈 페이지
>   - mockup `screens-a.jsx` 의 5 섹션 (배너 / 무료 quick / 카테고리 탭 / 서비스 그리드 / Bottom CTA) 적용
>   - `gangi-market.tsx` 4 컴포넌트 + `GangiHomeBottomCta` 신설
> - ✅ **PR3** (`redesign/claude-design-pr3-login-2026-05-13`, 머지됨): 로그인 페이지
>   - mockup `screens-b.jsx` `ScreenAuth` 적용 — `'gateway'` LoginMode 추가, 4 SNS 버튼
>   - Apple OAuth 는 별도 PR (PENDING-LINKS 기록)
> - ✅ **PR4** (`redesign/claude-design-pr4-today-2026-05-13`, 머지됨): 오늘운세 결과
>   - mockup `screens-a.jsx` `ScreenToday` 적용 — 4 컴포넌트 (Summary / ScoreReveal / ScoreGrid / PremiumLock) 시각 재설계
>   - 추가 무료 콘텐츠는 하단 `<details>` 로 보존
> - ✅ **PR5** (`redesign/claude-design-pr5-saju-intake-2026-05-13`, 머지됨): 사주 입력
>   - mockup `screens-a.jsx` `ScreenSajuIntake` 완전 재구성 — 3-bar step, STEP N/M, full-width CTA, birth step inline mockup-style 폼 (이름·생일 입력·시각 ZodiacChip card·성별), 동의 단계 제거 (implicit consent + disclosure)
> - ✅ **PR6** (`redesign/claude-design-pr6-saju-result-2026-05-13`, 머지됨): 사주 결과
>   - mockup `screens-a.jsx` `ScreenSajuResult` 5 섹션 적용
> - 🟡 **PR7** (`redesign/claude-design-pr7-saju-deep-2026-05-13`, 진행 중): 깊은 풀이
>   - 신규 라우트 `/saju/[slug]/deep` 신설 — mockup `screens-c.jsx` `ScreenSajuDeep` 6 섹션 (Hero / 사주팔자 detail / 오행 donut / 십성 / 대운 timeline / 평생리포트 upsell)
>   - `SajuScreenNav` 에 "깊은" 탭 추가
>   - 기존 `/overview`·`/nature`·`/elements`·`/premium` 페이지 보존
> - ⏳ PR8 이후: 타로 / 궁합 / 대화방 / MY / 멤버십 / 결제
>
> **매핑 안 되는 버튼/링크**는 [`docs/REDESIGN-PENDING-LINKS.md`](./REDESIGN-PENDING-LINKS.md) 에 누적 — disabled 상태로 표시하고 추후 라우트 연결.

---

## 0. 핵심 원칙

1. **토큰부터 → 컴포넌트 → 페이지** 순서로 옮긴다.
2. **링크/라우팅은 절대 수정 X**. 시각 레이어(스타일, 마크업 구조)만 갱신.
3. 한 번에 전체를 바꾸지 말고, **PR을 페이지 단위로 쪼개기**.
4. 각 PR 마다 `npm run typecheck && npm run build` 통과 확인.

---

## 1단계 · 디자인 토큰 정리 (15분)

**파일:** `src/app/styles/tokens.css`

이미 핑크 토큰(`--app-pink`, `--app-pink-strong`, `--app-pink-soft`, `--app-ink`) 은 잘 잡혀 있습니다. 다음만 추가/정리하세요:

```css
:root {
  /* ——— 이미 있음 ——— */
  --app-pink:         #ff4f9a;   /* 메인 포인트 (CTA) */
  --app-pink-strong:  #d81b72;   /* 강조 (활성/가격) */
  --app-pink-soft:    #fff0f7;   /* 보조면 */
  --app-pink-line:    rgba(255,79,154,0.26);
  --app-ink:          #111114;
  --app-line:         rgba(17,17,20,0.08);

  /* ——— 십이간지 액센트 — 추가 ——— */
  --app-jade:   #0f9f7a;
  --app-sky:    #368ee8;
  --app-plum:   #c04de0;
  --app-coral:  #ff6b6b;
  --app-amber:  #d99020;
  --app-indigo: #5b58d6;

  /* ——— 라운드 — 통일 ——— */
  --app-r-card:  18px;
  --app-r-btn:   14px;
  --app-r-chip:  999px;

  /* ——— 한자 인장 폰트 — 추가 ——— */
  --font-han: "Noto Serif KR", "Source Han Serif K", serif;
}
```

**`src/app/layout.tsx`** 에서 Noto Serif KR 도 next/font 로 추가하세요 (기존 Noto Sans KR 옆에).

---

## 2단계 · 십이간지 캐릭터 컴포넌트 신설 (30분)

**새 파일:** `src/components/gangi/zodiac-chip.tsx`

```tsx
import { cn } from '@/lib/utils';

export const ZODIAC = {
  rat:     { ko: '쥐',  han: '子', color: 'var(--app-indigo)' },
  ox:      { ko: '소',  han: '丑', color: 'var(--app-jade)' },
  tiger:   { ko: '범',  han: '寅', color: 'var(--app-coral)' },
  rabbit:  { ko: '토끼', han: '卯', color: 'var(--app-pink)' },
  dragon:  { ko: '용',  han: '辰', color: 'var(--app-plum)' },
  snake:   { ko: '뱀',  han: '巳', color: 'var(--app-amber)' },
  horse:   { ko: '말',  han: '午', color: 'var(--app-coral)' },
  sheep:   { ko: '양',  han: '未', color: 'var(--app-jade)' },
  monkey:  { ko: '원숭이', han: '申', color: 'var(--app-amber)' },
  rooster: { ko: '닭',  han: '酉', color: 'var(--app-pink-strong)' },
  dog:     { ko: '개',  han: '戌', color: 'var(--app-sky)' },
  pig:     { ko: '돼지', han: '亥', color: 'var(--app-indigo)' },
} as const;

export type ZodiacKey = keyof typeof ZODIAC;

const SIZE = {
  sm: 'h-10 w-10 rounded-[13px] text-[19px]',
  md: 'h-14 w-14 rounded-[18px] text-[26px]',
  lg: 'h-[72px] w-[72px] rounded-[22px] text-[34px]',
  xl: 'h-24 w-24 rounded-[28px] text-[46px]',
};

export function ZodiacChip({
  kind = 'rat', size = 'md', className
}: { kind?: ZodiacKey; size?: keyof typeof SIZE; className?: string }) {
  const z = ZODIAC[kind] ?? ZODIAC.rat;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold text-white relative',
        'before:absolute before:inset-0 before:rounded-[inherit]',
        'before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none',
        SIZE[size], className
      )}
      style={{
        background: z.color,
        fontFamily: 'var(--font-han)',
        letterSpacing: '-0.02em',
      }}
    >
      {z.han}
    </span>
  );
}
```

기존 `gangi-ui.tsx` 의 `GangiZodiacKey` 타입과 호환되므로  
`GANGI_HOME_CARDS` 등에서 그대로 `zodiac: 'dragon'` 이 동작합니다.

---

## 3단계 · 사이트 헤더 교체 (1시간)

**파일:** `src/components/site-header.tsx` (또는 `src/features/shared-navigation/site-header.tsx`)

현재 헤더는 흰 배경 + 잉크 텍스트 컨셉으로 잘 잡혀 있으나, **로고 마크 + 한자 인장** 만 추가하면 됩니다.

```tsx
<Link href="/" className="flex items-center gap-2.5 ...">
  {/* 새로 추가 — 한자 인장 마크 */}
  <span
    className="grid h-8 w-8 place-items-center rounded-[10px] text-white"
    style={{
      background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
      fontFamily: 'var(--font-han)',
      fontWeight: 700, fontSize: 18,
      boxShadow: '0 4px 12px rgba(216,27,114,0.28)'
    }}
  >干</span>
  <div className="leading-tight">
    <div className="text-[11px] font-semibold text-[var(--app-pink-strong)]">
      달빛인생 · 오늘운세
    </div>
    <div className="text-[17px] font-extrabold tracking-tight">
      간지사주
    </div>
  </div>
</Link>
```

⚠️ **건드리지 말 것:** `signOut()`, `useEffect`, `MOBILE_QUICK_LINKS`, `PRIMARY_NAV_ITEMS`, supabase 로직.

---

## 4단계 · 사이트 푸터 교체 (1시간)

**파일:** `src/components/site-footer.tsx`

기존 푸터는 회사 정보만 있어요. 디자인 안의 **다크 풀 푸터**로 교체:

```tsx
const FOOTER_NAV = {
  '운세': [
    ['오늘의 운세', '/today-fortune'],
    ['타로 한 장', '/tarot/daily'],
    ['띠운세', '/zodiac'],
    ['별자리', '/star-sign'],
    ['꿈해몽', '/dream-interpretation'],
  ],
  '사주': [
    ['내 사주 풀이', '/saju/new'],
    ['궁합', '/compatibility/input'],
    ['올해 흐름', '/daewoon'],
    ['좋은 날 택일', '/taekil'],
    ['대화 상담', '/dialogue'],
  ],
  '계정': [
    ['로그인', '/login'],
    ['MY', '/my'],
    ['보관함', '/my/results'],
    ['결제내역', '/my/billing'],
    ['멤버십', '/membership'],
  ],
  '고객센터': [
    ['☎ 010-8123-9184', 'tel:010-8123-9184'],
    ['알림 설정', '/notifications'],
    ['이용약관', '/terms'],
    ['개인정보처리방침', '/privacy'],
    ['가격 안내', '/pricing'],
  ],
};
```

HTML 파일의 `SiteFooter` 컴포넌트 마크업을 그대로 TSX 로 옮기고, `<a>` → `<Link>` 만 교체.

⚠️ **건드리지 말 것:** `companyItems` 의 사업자등록번호, 주소, 대표자 정보 — 법적 고지 사항.

---

## 5단계 · 페이지별 적용 순서 (체크리스트)

각 페이지마다 **별도 PR** 로 진행하세요.

| 우선순위 | 페이지 | 파일 | 디자인 캔버스 보드 |
|---|---|---|---|
| ⭐⭐⭐ | 홈 | `src/features/home/gangi-home-client.tsx` | 01 · 홈 |
| ⭐⭐⭐ | 로그인 | `src/app/login/page.tsx` | 10 · 로그인 (SNS 4종) |
| ⭐⭐⭐ | 오늘운세 | `src/app/today-fortune/page.tsx` | 04 · 오늘운세 |
| ⭐⭐⭐ | 사주 입력 | `src/features/saju-intake/saju-intake-page.tsx` | 02 · 사주 입력 |
| ⭐⭐ | 사주 결과 | `src/app/saju/[slug]/page.tsx` | 03 · 사주 결과 |
| ⭐⭐ | 사주 깊은 풀이 | `src/app/saju/[slug]/premium/page.tsx` | 12 · 깊은 사주 풀이 |
| ⭐⭐ | 타로 | `src/app/tarot/page.tsx` | 05 · 타로 |
| ⭐⭐ | 궁합 | `src/features/compatibility/compatibility-result-view.tsx` | 06 · 궁합 |
| ⭐ | 대화방 | `src/components/dialogue/dialogue-chat-panel.tsx` | 07 · 대화방 |
| ⭐ | MY | `src/app/my/page.tsx` | 08 · MY |
| ⭐ | 멤버십 | `src/app/membership/page.tsx` | 09 · 멤버십 |
| ⭐ | 결제 | `src/app/pay/page.tsx` | 13 · 결제 페이지 |

---

## 6단계 · 페이지 적용 패턴 (예: 홈)

1. `frames/.../간지사주 리디자인.html` 을 브라우저에서 열고  
   해당 보드를 **우클릭 → 페이지 검사** 로 마크업 구조 확인
2. 각 `className="gj-..."` → Tailwind 클래스 또는 `--app-*` 토큰 사용한 inline-style 로 변환
3. **데이터는 기존 소스 그대로** 사용:
   - 홈 → `GANGI_HOME_CARDS` 그대로
   - 사주 결과 → 기존 `evidence`, `report.summary` 등
4. **이벤트/링크는 절대 수정 X**:
   - `onTrack`, `trackMoonlightEvent` 등 분석 콜백 유지
   - `href`, `onClick={signOut}` 등 동작 그대로
5. **변경된 것은 오직:**
   - 헤더 마크업 (위 3단계)
   - 카드 외관 (`bg-white rounded-[18px] border` + 한자 인장)
   - 컬러 매핑 (`text-[var(--app-pink-strong)]` 일관 적용)

---

## 7단계 · 로그인 페이지 적용 예시 (가장 깔끔)

**파일:** `src/app/login/page.tsx`

```tsx
// 현재 supabase auth 로직은 그대로 두고, JSX 만 교체
// "10 · 로그인 (SNS 4종)" 보드의 마크업을 복사
// 4개 버튼:
<button onClick={signInWithKakao}>  카카오로 시작하기 </button>
<button onClick={signInWithGoogle}> Google로 계속하기 </button>
<button onClick={signInWithApple}>  Apple로 계속하기 </button>
<button onClick={() => setMode('email')}> 이메일로 로그인 </button>
```

⚠️ supabase 의 OAuth 핸들러는 이미 존재할 가능성이 높습니다.  
`signInWithOAuth({ provider: 'kakao' })` 같은 호출만 그대로 두고 버튼 디자인만 교체하세요.

---

## 8단계 · QA 체크리스트

배포 전 다음 확인:

- [ ] 360px / 390px / 768px / 1280px 에서 깨짐 없음
- [ ] 시니어 모드(글자 크게) 에서 줄바꿈 자연스러움
- [ ] 모든 `href` 가 기존과 동일한지 git diff 로 확인
- [ ] supabase 인증, toss 결제, kasi 캘린더 호출 동작
- [ ] `npm run typecheck`, `npm test`, `npm run build` 통과
- [ ] DESIGN.md 의 "피해야 할 톤" (다크네이비, 골드, 리포트형) 잔재 없음

---

## 9단계 · 빠르게 시작하려면

가장 작은 단위로 시작하기:

1. **[10분]** `tokens.css` 에 십이간지 액센트 6색 + Noto Serif KR 추가
2. **[30분]** `zodiac-chip.tsx` 신설 — 그 자체로 어디서나 사용 가능
3. **[1시간]** 헤더에 한자 인장 로고 + "달빛인생" 태그 추가
4. **[1시간]** 푸터를 다크 풀 푸터로 교체
5. **[2시간]** 홈 페이지 카드 그리드에 `ZodiacChip` 적용

여기까지만 해도 사이트 전체에서 새 디자인 시스템이 느껴집니다.

---

## 참고: 디자인 캔버스 ↔ 실제 코드 매핑표

| 캔버스 컴포넌트 | 실제 파일 위치 |
|---|---|
| `<ZodiacChip>` | `src/components/gangi/zodiac-chip.tsx` (신설) |
| `<AppHeader>` (home) | `src/features/shared-navigation/site-header.tsx` |
| `<AppHeader>` (page) | `src/components/gangi/gangi-ui.tsx` → `GangiPageHeader` |
| `<Dock>` | `src/features/home/mobile-home-dock.tsx` |
| `<SiteFooter>` | `src/components/site-footer.tsx` |
| `.gj-card` | shadcn `<Card>` + Tailwind |
| `.gj-btn-primary` | `<Button>` (이미 핑크 토큰 사용 중) |
| `.gj-banner.tone-pink` | `src/components/gangi/gangi-market.tsx` → `GangiSeasonBanner` |
| `.gj-service-card` | `gangi-market.tsx` → `GangiServiceCardLink` |

→ 대부분 **이미 컴포넌트가 존재**합니다. 디자인 시스템 v1 (`gangi-ui.tsx`) 위에 새 토큰/마크업만 덧입히세요.
