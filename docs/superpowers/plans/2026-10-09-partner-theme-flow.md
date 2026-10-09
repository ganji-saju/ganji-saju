# 올해운 노트 구매 흐름 전용 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인플루언서 링크로 온 손님이 결제창 직전까지 '올해운 노트' 테마 화면(랜딩 → 생년월일 입력 → 로그인 → 결제)만 보게 한다.

**Architecture:** 테마는 서버 컴포넌트 `NoteShell` 하나(색 토큰을 inline CSS 변수로 — 새 CSS 파일 없음)로 만들고, `/partner/(theme)` 라우트 그룹 레이아웃과 기존 랜딩이 같이 쓴다. 입력·로그인·결제는 새 페이지지만 사주 해석(`resolveUnifiedBirthInput`)·사주 생성(`POST /api/readings`)·이용권 판정(`resolveNewYearAccess`)·금액(`resolveChargeForUser`)·결제 버튼(`TossMembershipCheckout`)은 기존 코드를 그대로 호출한다. 결제 버튼 안의 간지사주 색은 셸이 `--app-*` 변수를 덮어 테마 색으로 바꾼다.

**Tech Stack:** Next.js 16 App Router(서버 컴포넌트) · React 19 · Tailwind v4 · vitest(`*.spec.ts`, `*.test.tsx`) · Supabase

**Spec:** `docs/superpowers/specs/2026-10-04-partner-theme-flow-design.md` (앞선 설계: `docs/superpowers/specs/2026-10-04-influencer-landing-design.md`)

## Global Constraints

- 색: 바탕 크림 `#FBF7F0` · 글자 딥네이비 `#1F2A44` · 보조 글자 `#5B6478` · 포인트 코랄 `#F26B5B` · 선 `#E8DFD2`. 글자·버튼 대비 4.5:1 이상.
  - ⚠️ 실측(2026-10-09): 코랄 `#F26B5B` 는 크림 위 글자 2.80, 흰 글자 바탕 2.99 로 **미달** → 코랄은 장식(점·밑줄·테두리)만. 글자·버튼용 진한 코랄 `#C8443A`(크림 위 4.53, 흰 글자 4.83). 주 버튼은 딥네이비 바탕 흰 글자(14.26).
- 글꼴: 본문 Pretendard(이미 로드됨, `--font-dalbit-sans`). 제목 둥근 고딕은 **미정** — 이 계획은 제목도 Pretendard 800 으로 만들고, 글꼴 확정 시 Task 7 에서 변수 하나만 바꾼다. 외부 글꼴은 이 경로에서만 불러온다.
- 로고: 없으면 글자 로고 '올해운 노트'.
- 랜딩 문구 B안 그대로: 브랜드 '올해운 노트' · 제목 '내년 내 운, 미리 열어볼까요?' · 부제 '생년월일만 넣으면 2027년 한 해가 달별로 정리돼요.' · 3줄 · 버튼 '2027 운세 열기'.
- 금액: 결제 페이지 금액 = 청구 금액 = 주문 금액 = 19,200원(정가 32,000원, 40%). 파트너 할인 상한 50%(`PARTNER_MAX_DISCOUNT_PERCENT`, 기존 코드). 파트너 쿠키 `ganji_partner` 경로 `/`·7일(기존 코드).
- 한자 금지(화면 전체). 간지사주 헤더·메뉴·로고·하단 탭이 이 흐름에 보이지 않는다. 분석 동의 배너는 법적 요소라 유지.
- 탭 제목·공유 미리보기에 '간지사주'가 나오지 않는다 — 루트 레이아웃 제목 템플릿이 `%s | 간지사주` 라서 `title: { absolute: … }` 필수.
- "결제·풀이 제공: 간지사주(푸꼬컴퍼니) — 결제창과 카드 명세서에 이 이름이 표시됩니다" 안내는 랜딩·결제 페이지에 남긴다(전자상거래 표시). 하단 사업자 정보는 `BUSINESS_INFO` 정본.
- 간지사주 기존 화면의 디자인·동작 불변. `/membership/checkout` 의 파트너 처리 유지.
- 실행 명령: `./scripts/with-node22.sh npm …`. 테스트: `npm test`(node:test `*.test.ts`), `npm run test:spec`(vitest `*.spec.ts`·`*.test.tsx`), `npm run typecheck`.
- 이 Next 는 학습 데이터와 다를 수 있다 — 라우트 그룹·레이아웃·`redirect`·`searchParams` 사용 전 `node_modules/next/dist/docs/` 의 해당 문서를 확인.
- 페이지 파일(`page.tsx`·`layout.tsx`)에서는 Next 가 허용한 이름 외에 export 하지 않는다 — 공용 함수는 `src/features/partner-theme/` 에 둔다.

## Review Focus

1. **할인이 빠진 결제 버튼** — 쿠키는 있는데 계산 결과에 파트너가 없으면(`quote.partner === null`, 비활성 직전 경합 등) 32,000원 결제 버튼이 나오면 안 된다 → '이용할 수 없는 링크' 안내만. (Task 5 테스트)
2. **탭 제목·공유 미리보기의 '간지사주'** — 제목 템플릿·openGraph siteName 때문에 새는 것. (Task 1·Task 6 테스트)
3. **로그인 `next` 악용** — `//evil.com`, `/admin`, `/partner/../admin`(브라우저가 `/admin` 으로 정규화) 같은 값은 `/partner/start` 로. (Task 4 테스트)
4. **남의 사주 주소로 결제 페이지 진입** — 다른 계정이 만든 사주 slug 면 결제 버튼 없이 다시 입력 안내. (Task 5 테스트)
5. **음력·시간 모름·없는 날짜** — 간지사주 `/saju/new` 와 같은 사주 주소가 나와야 재구매 차단이 맞고, 없는 날짜는 입력 화면에 '생년월일을 다시 확인해 주세요.' (Task 3 테스트)

알려진 한계(테스트 대상 아님, 사용자 확인): 결제창에서 실패·취소하면 나이스페이 복귀 경로가 기존 `/membership/checkout`(간지사주 화면, 파트너 쿠키로 19,200원 표시)이다 — 설계 §4 '결제창'은 범위 밖. 세션이 결제 버튼 누르는 순간 만료되면 결제 컴포넌트가 간지사주 `/login` 으로 보낸다(페이지 진입 시 서버가 로그인을 먼저 확인하므로 드묾).

---

## File Structure

| 파일 | 책임 |
|---|---|
| Create `src/features/partner-theme/note-theme.tsx` | 색 토큰 · `NoteShell`(헤더 글자 로고·사업자 정보 하단) · `NoteNotice` · 버튼/카드 클래스 · 제목 스타일 |
| Create `src/features/partner-theme/note-theme.spec.ts` | 대비 4.5:1 가드 |
| Create `src/features/partner-theme/note-theme.test.tsx` | 셸 렌더(글자 로고·사업자 정보·한자 없음) |
| Create `src/app/partner/(theme)/layout.tsx` | `/partner/start·login·checkout` 공통 레이아웃 + 제목(absolute)·noindex |
| Modify `src/app/partner/go/route.ts` | 이동 목적지 → `/partner/start` |
| Create `src/app/partner/go/route.spec.ts` | 쿠키·이동 |
| Create `src/features/partner-theme/partner-birth.ts` | 폼 값 → 사주 입력(간지사주와 같은 해석기) |
| Create `src/features/partner-theme/partner-birth.spec.ts` | `/saju/new` 경로와 같은 slug · 오류 문구 |
| Create `src/app/partner/(theme)/start/page.tsx` | 파트너 확인 → 입력 화면 |
| Create `src/app/partner/(theme)/start/partner-birth-form.tsx` | 입력 폼(클라이언트) → 사주 생성 → 결제 페이지 |
| Create `src/app/partner/(theme)/start/page.test.tsx` | 파트너 없음/있음 |
| Create `src/features/partner-theme/partner-next.ts` (+ `.spec.ts`) | 로그인 후 돌아갈 주소 검증 |
| Create `src/app/partner/(theme)/login/page.tsx` (+ `page.test.tsx`) | 카카오·구글 버튼 |
| Create `src/app/partner/(theme)/checkout/page.tsx` (+ `page.test.tsx`) | 결제 페이지 분기 |
| Modify `src/app/partner-landing/[code]/page.tsx` (+ Create `page.test.tsx`) | 랜딩을 `NoteShell` 로 |

---

### Task 1: 테마 셸(NoteShell)과 레이아웃

**Files:**
- Create: `src/features/partner-theme/note-theme.tsx`
- Create: `src/features/partner-theme/note-theme.spec.ts`
- Create: `src/features/partner-theme/note-theme.test.tsx`
- Create: `src/app/partner/(theme)/layout.tsx`

**Interfaces:**
- Produces:
  - `NOTE_COLORS: { bg, ink, muted, coral, coralInk, line, card }` (hex 문자열)
  - `NoteShell({ children }: { children: ReactNode })` — 서버 컴포넌트
  - `NoteNotice({ title, children }: { title: string; children?: ReactNode })`
  - `NOTE_PRIMARY_BUTTON: string`, `NOTE_CARD: string` (className)
  - `NOTE_TITLE_STYLE: CSSProperties`
  - `NOTE_METADATA: Metadata` — `{ title: { absolute: '올해운 노트' }, robots: noindex, openGraph: { siteName: '올해운 노트', title: '올해운 노트' } }`

- [ ] **Step 1: 대비 가드 테스트 작성** — `src/features/partner-theme/note-theme.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { NOTE_COLORS } from './note-theme';

// WCAG 2.x 상대 휘도 대비.
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('올해운 노트 색 대비(4.5:1)', () => {
  it.each([
    ['본문 글자', NOTE_COLORS.ink, NOTE_COLORS.bg],
    ['보조 글자', NOTE_COLORS.muted, NOTE_COLORS.bg],
    ['진한 코랄 글자', NOTE_COLORS.coralInk, NOTE_COLORS.bg],
    ['주 버튼 흰 글자', '#FFFFFF', NOTE_COLORS.ink],
    ['코랄 버튼 흰 글자', '#FFFFFF', NOTE_COLORS.coralInk],
    ['카드 위 보조 글자', NOTE_COLORS.muted, NOTE_COLORS.card],
  ])('%s', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('장식용 코랄은 글자 대비 미달 — 글자에 쓰지 않는다(이 값이 바뀌면 이 테스트를 다시 본다)', () => {
    expect(contrast(NOTE_COLORS.coral, NOTE_COLORS.bg)).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: 렌더 테스트 작성** — `src/features/partner-theme/note-theme.test.tsx`

```tsx
// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUSINESS_INFO } from '@/lib/business-info';
import { NOTE_METADATA, NoteNotice, NoteShell } from './note-theme';

describe('NoteShell', () => {
  const html = renderToStaticMarkup(<NoteShell><p>본문</p></NoteShell>);

  it('글자 로고·본문·사업자 정보·약관 링크', () => {
    expect(html).toContain('올해운 노트');
    expect(html).toContain('본문');
    expect(html).toContain(BUSINESS_INFO.companyName);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
  });

  it('결제 버튼 등 재사용 컴포넌트의 간지사주 색 변수를 테마 색으로 덮는다', () => {
    expect(html).toContain('--app-pink:#C8443A');
    expect(html).toContain('--app-ink:#1F2A44');
  });

  it('간지사주 이름·한자 없음(사업자 상호 줄 제외)', () => {
    const withoutBusiness = html.replace(BUSINESS_INFO.companyName, '');
    expect(withoutBusiness).not.toContain('간지사주');
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('NoteNotice', () => {
    expect(renderToStaticMarkup(<NoteNotice title="지금은 이용할 수 없는 링크입니다." />)).toContain('지금은 이용할 수 없는 링크입니다.');
  });

  it('제목은 템플릿을 끊고(absolute) 공유 미리보기 이름도 올해운 노트', () => {
    expect(NOTE_METADATA.title).toEqual({ absolute: '올해운 노트' });
    expect(NOTE_METADATA.openGraph?.siteName).toBe('올해운 노트');
    expect(NOTE_METADATA.robots).toEqual({ index: false, follow: false });
  });
});
```

참고: `BUSINESS_INFO.companyName` 값에 '간지사주'가 들어 있지 않으면 `replace` 는 아무것도 하지 않는다 — 그대로 둔다.

- [ ] **Step 3: 실패 확인**

Run: `./scripts/with-node22.sh npx vitest run src/features/partner-theme/`
Expected: FAIL — `Cannot find module './note-theme'`

- [ ] **Step 4: 구현** — `src/features/partner-theme/note-theme.tsx`

```tsx
// 2026-10-09 올해운 노트(인플루언서 구매 흐름) 테마 — 설계: docs/superpowers/specs/2026-10-04-partner-theme-flow-design.md §3-1
//   색은 inline CSS 변수로 둔다(새 CSS 파일 없음 — 배포 번들에서 CSS 가 빠지는 사고를 피한다).
//   --app-* 덮어쓰기: 재사용하는 간지사주 컴포넌트(결제 버튼·동의 체크)가 이 안에서 테마 색으로 보인다.
//   ⚠️ 코랄(#F26B5B)은 글자 대비 미달 — 장식만. 글자·버튼은 coralInk 또는 ink.
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { BUSINESS_INFO } from '@/lib/business-info';

export const NOTE_COLORS = {
  bg: '#FBF7F0',
  ink: '#1F2A44',
  muted: '#5B6478',
  coral: '#F26B5B',
  coralInk: '#C8443A',
  line: '#E8DFD2',
  card: '#FFFFFF',
} as const;

const THEME_VARS = {
  '--note-bg': NOTE_COLORS.bg,
  '--note-ink': NOTE_COLORS.ink,
  '--note-muted': NOTE_COLORS.muted,
  '--note-coral': NOTE_COLORS.coral,
  '--note-coral-ink': NOTE_COLORS.coralInk,
  '--note-line': NOTE_COLORS.line,
  '--note-card': NOTE_COLORS.card,
  // 제목 글꼴 — 둥근 고딕 확정 전까지 Pretendard. 확정 시 Task 7 에서 이 줄만 바꾼다.
  '--note-title-font': 'var(--font-dalbit-sans), sans-serif',
  '--app-pink': NOTE_COLORS.coralInk,
  '--app-pink-strong': NOTE_COLORS.coralInk,
  '--app-pink-soft': '#FDECE9',
  '--app-ink': NOTE_COLORS.ink,
  '--app-line': NOTE_COLORS.line,
  '--app-copy-muted': NOTE_COLORS.muted,
  '--app-copy-soft': NOTE_COLORS.muted,
} as CSSProperties;

export const NOTE_TITLE_STYLE: CSSProperties = { fontFamily: 'var(--note-title-font)' };
export const NOTE_PRIMARY_BUTTON =
  'block w-full rounded-[14px] bg-[var(--note-ink)] py-3.5 text-center text-[17px] font-extrabold text-white';
export const NOTE_CARD = 'rounded-[18px] border border-[var(--note-line)] bg-[var(--note-card)] p-5';

export const NOTE_METADATA: Metadata = {
  title: { absolute: '올해운 노트' },
  robots: { index: false, follow: false },
  openGraph: { siteName: '올해운 노트', title: '올해운 노트' },
};

// 법정 표기 정본은 BUSINESS_INFO(site-footer.tsx 와 같은 데이터). 그 컴포넌트는 간지사주 링크가 섞인 클라이언트라 데이터만 쓴다.
const BUSINESS_LINES: string[] = [
  ['상호', BUSINESS_INFO.companyName],
  ['대표', BUSINESS_INFO.ceoName],
  ['사업자등록번호', BUSINESS_INFO.businessRegistrationNumber],
  ['통신판매업', BUSINESS_INFO.mailOrderRegistrationNumber],
  ['주소', BUSINESS_INFO.address],
  ['고객센터', BUSINESS_INFO.phone],
  ['이메일', BUSINESS_INFO.email],
  ['운영시간', BUSINESS_INFO.csHours],
]
  .filter(([, value]) => value)
  .map(([label, value]) => `${label}: ${value}`);

export function NoteShell({ children }: { children: ReactNode }) {
  return (
    <div style={THEME_VARS} className="min-h-screen bg-[var(--note-bg)] text-[var(--note-ink)]">
      <div className="mx-auto max-w-[480px] px-4 pb-16 pt-6">
        <header className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--note-coral)]" />
          <span style={NOTE_TITLE_STYLE} className="text-[17px] font-extrabold tracking-[0.02em]">올해운 노트</span>
        </header>
        <div className="mt-6">{children}</div>
        <footer className="mt-12 border-t border-[var(--note-line)] pt-5 text-[12px] leading-[1.6] text-[var(--note-muted)]" aria-label="사업자 정보">
          {BUSINESS_LINES.map((line) => (
            <p key={line} className="m-0">{line}</p>
          ))}
          <p className="m-0 mt-2">
            <a href="/terms">이용약관</a> | <a href="/privacy">개인정보처리방침</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export function NoteNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className={`${NOTE_CARD} text-center`}>
      <h1 style={NOTE_TITLE_STYLE} className="text-[20px] font-extrabold leading-[1.4]">{title}</h1>
      {children ? <div className="mt-3 text-[15px] leading-[1.7] text-[var(--note-muted)]">{children}</div> : null}
    </section>
  );
}
```

- [ ] **Step 5: 레이아웃** — `src/app/partner/(theme)/layout.tsx`

```tsx
// 올해운 노트 흐름(/partner/start·login·checkout) 공통 레이아웃. /partner/go(라우트 핸들러)는 그룹 밖이라 영향 없음.
import type { ReactNode } from 'react';
import { NOTE_METADATA, NoteShell } from '@/features/partner-theme/note-theme';

export const metadata = NOTE_METADATA;

export default function PartnerThemeLayout({ children }: { children: ReactNode }) {
  return <NoteShell>{children}</NoteShell>;
}
```

- [ ] **Step 6: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run src/features/partner-theme/ && ./scripts/with-node22.sh npm run typecheck`
Expected: PASS(대비 7 · 렌더 5), tsc 오류 0

- [ ] **Step 7: Commit**

```bash
git add src/features/partner-theme/ 'src/app/partner/(theme)/layout.tsx'
git commit -m "feat(partner): 올해운 노트 테마 셸·레이아웃(대비 4.5:1 가드)"
```

---

### Task 2: 구매 버튼 이동 목적지를 입력 화면으로

**Files:**
- Modify: `src/app/partner/go/route.ts:7`
- Create: `src/app/partner/go/route.spec.ts`

**Interfaces:**
- Consumes: `PARTNER_COOKIE`('ganji_partner'), `normalizePartnerCode` (기존 `src/lib/partners/partner.ts`)
- Produces: `GET /partner/go?code=` → 303 `/partner/start` (Task 3 이 받는다)

- [ ] **Step 1: 테스트 작성** — `src/app/partner/go/route.spec.ts`

```ts
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/partner/go', () => {
  it('코드를 정규화해 쿠키(경로 /·7일)를 심고 /partner/start 로 303', () => {
    const res = GET(new NextRequest('https://ganjisaju.kr/partner/go?code=Abc12'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://ganjisaju.kr/partner/start');
    const cookie = res.cookies.get('ganji_partner');
    expect(cookie?.value).toBe('abc12');
    expect(cookie?.path).toBe('/');
    expect(cookie?.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it('잘못된 코드면 쿠키 없이 같은 곳으로(입력 화면이 이용 불가 안내)', () => {
    const res = GET(new NextRequest('https://ganjisaju.kr/partner/go?code=a'));
    expect(res.headers.get('location')).toBe('https://ganjisaju.kr/partner/start');
    expect(res.cookies.get('ganji_partner')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `./scripts/with-node22.sh npx vitest run src/app/partner/go/route.spec.ts`
Expected: FAIL — location 이 `/membership/checkout?product=new-year`

- [ ] **Step 3: 구현** — `route.ts` 의 주석 1행과 redirect 목적지만 바꾼다

```ts
// 랜딩(별도 도메인)의 구매 버튼이 오는 곳. 파트너 쿠키를 심고 올해운 노트 입력 화면(/partner/start)으로 보낸다.
```
```ts
  const res = NextResponse.redirect(new URL('/partner/start', req.nextUrl.origin), 303);
```

- [ ] **Step 4: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run src/app/partner/go/route.spec.ts`
Expected: PASS (2)

- [ ] **Step 5: Commit**

```bash
git add src/app/partner/go/
git commit -m "feat(partner): 구매 버튼을 올해운 노트 입력 화면으로 연결"
```

---

### Task 3: 생년월일 입력 `/partner/start`

**Files:**
- Create: `src/features/partner-theme/partner-birth.ts`
- Create: `src/features/partner-theme/partner-birth.spec.ts`
- Create: `src/app/partner/(theme)/start/page.tsx`
- Create: `src/app/partner/(theme)/start/partner-birth-form.tsx`
- Create: `src/app/partner/(theme)/start/page.test.tsx`

**Interfaces:**
- Consumes: `NoteNotice`, `NOTE_PRIMARY_BUTTON`, `NOTE_CARD`, `NOTE_TITLE_STYLE` (Task 1); `getActivePartner`, `PARTNER_COOKIE` (기존); `resolveUnifiedBirthInput` (`src/lib/saju/unified-birth-entry.ts`); `toSlug` (`src/lib/saju/pillars.ts`)
- Produces:
  - `interface PartnerBirthForm { calendarType: 'solar' | 'lunar'; year: string; month: string; day: string; hour: string; unknownBirthTime: boolean; gender: string }`
  - `toPartnerBirthInput(form: PartnerBirthForm): { ok: true; input: BirthInput } | { ok: false; error: string }`
  - 제출 성공 시 이동: `/partner/checkout?slug=<POST /api/readings 응답 id>` (Task 5 가 받는다)

배경: 간지사주 입력(`src/features/unified-intake/submit-saju.ts`)은 프로필 → 초안(`applyProfileToSajuDraft`) → `resolveUnifiedBirthInput(…, { requireGender: true })` → `POST /api/readings` 다. 분(minute)·출생지·시간 규칙은 받지 않는다(간지사주 입력도 분이 없고 출생지 기본값은 빈 값, 시간 규칙 'standard'). 같은 해석기를 같은 기본값으로 불러야 같은 사주 주소가 나온다(2026-10-09 임시 테스트로 음력·양력·시간 모름 3건 일치 확인). `/api/readings` 는 비로그인도 사주를 만든다(`userId` null → 로그인 후 본인 사주로 인정, `resolveNewYearAccess` 의 `isOwner`).

- [ ] **Step 1: 같은 사주 주소 테스트** — `src/features/partner-theme/partner-birth.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { toSlug } from '@/lib/saju/pillars';
import { createInitialOnboardingDraft } from '@/features/saju-intake/onboarding-storage';
import { applyProfileToSajuDraft, type UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import { toPartnerBirthInput, type PartnerBirthForm } from './partner-birth';

// 간지사주 /saju/new 제출 경로(submit-saju.ts)를 그대로 재현 — 출생지 없이 입력한 경우.
function slugViaGanjiIntake(form: PartnerBirthForm) {
  const profile = {
    ...form, name: '', birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
    timeRule: 'standard', solarTimeMode: 'standard',
  } as unknown as UnifiedBirthProfile;
  const d = applyProfileToSajuDraft(createInitialOnboardingDraft(), profile);
  const parsed = resolveUnifiedBirthInput(
    {
      calendarType: d.calendarType, timeRule: d.timeRule, year: d.year, month: d.month, day: d.day,
      hour: d.hour, minute: d.minute, unknownBirthTime: d.hour === '', gender: d.gender,
      birthLocationCode: d.birthLocationCode, birthLocationLabel: d.birthLocationLabel,
      birthLatitude: d.birthLatitude, birthLongitude: d.birthLongitude,
    },
    { requireGender: true },
  );
  if (!parsed.ok) throw new Error(parsed.error);
  return toSlug(parsed.input);
}

const base: PartnerBirthForm = { calendarType: 'lunar', year: '1990', month: '5', day: '15', hour: '14', unknownBirthTime: false, gender: 'female' };

describe('toPartnerBirthInput', () => {
  it.each([
    ['음력', base],
    ['양력', { ...base, calendarType: 'solar' as const }],
    ['시간 모름', { ...base, unknownBirthTime: true, hour: '' }],
    ['시간 모름인데 시간 값이 남아 있음', { ...base, unknownBirthTime: true, hour: '9' }],
  ])('%s — 간지사주 입력과 같은 사주 주소', (_label, form) => {
    const result = toPartnerBirthInput(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(toSlug(result.input)).toBe(slugViaGanjiIntake({ ...form, hour: form.unknownBirthTime ? '' : form.hour }));
  });

  it('음력 1990-5-15 14시 여성 = 1990-6-7-14-female-… (실측 고정값)', () => {
    const result = toPartnerBirthInput(base);
    expect(result.ok && toSlug(result.input).startsWith('1990-6-7-14-female-')).toBe(true);
  });

  it('없는 날짜는 간지사주와 같은 안내', () => {
    expect(toPartnerBirthInput({ ...base, calendarType: 'solar', month: '2', day: '31' })).toEqual({ ok: false, error: '생년월일을 다시 확인해 주세요.' });
  });

  it('성별 없으면 실패', () => {
    expect(toPartnerBirthInput({ ...base, gender: '' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `./scripts/with-node22.sh npx vitest run src/features/partner-theme/partner-birth.spec.ts`
Expected: FAIL — `Cannot find module './partner-birth'`

- [ ] **Step 3: 구현** — `src/features/partner-theme/partner-birth.ts`

```ts
// 올해운 노트 입력 → 사주 입력. 간지사주 입력(submit-saju.ts)과 **같은 해석기·같은 기본값**이어야
//   같은 사주로 인식되고 재구매 차단이 맞는다(설계 §3-3). 분·출생지·시간 규칙은 간지사주 입력처럼 받지 않는다.
import type { BirthInput } from '@/lib/saju/types';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';

export interface PartnerBirthForm {
  calendarType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  hour: string;
  unknownBirthTime: boolean;
  gender: string;
}

export function toPartnerBirthInput(form: PartnerBirthForm): { ok: true; input: BirthInput } | { ok: false; error: string } {
  const hour = form.unknownBirthTime ? '' : form.hour;
  const parsed = resolveUnifiedBirthInput(
    {
      calendarType: form.calendarType, timeRule: 'standard', year: form.year, month: form.month, day: form.day,
      hour, minute: '', unknownBirthTime: hour === '', gender: form.gender,
      birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
    },
    { requireGender: true },
  );
  return parsed.ok ? { ok: true, input: parsed.input } : { ok: false, error: parsed.error };
}
```

- [ ] **Step 4: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run src/features/partner-theme/partner-birth.spec.ts`
Expected: PASS (7)

- [ ] **Step 5: 입력 폼(클라이언트)** — `src/app/partner/(theme)/start/partner-birth-form.tsx`

```tsx
'use client';

// 사주 생성은 간지사주와 같은 POST /api/readings. 로그인 여부는 결제 페이지(서버)가 판정해 /partner/login 으로 보낸다.
import { useState } from 'react';
import { toSlug } from '@/lib/saju/pillars';
import { NOTE_CARD, NOTE_PRIMARY_BUTTON } from '@/features/partner-theme/note-theme';
import { toPartnerBirthInput, type PartnerBirthForm } from '@/features/partner-theme/partner-birth';

const FIELD = 'w-full rounded-[12px] border border-[var(--note-line)] bg-white px-3 py-3 text-[17px] text-[var(--note-ink)]';
const HOURS = Array.from({ length: 24 }, (_, h) => String(h));

const checkoutHref = (slug: string) => `/partner/checkout?slug=${encodeURIComponent(slug)}`;

export function PartnerBirthFormView() {
  const [form, setForm] = useState<PartnerBirthForm>({ calendarType: 'solar', year: '', month: '', day: '', hour: '', unknownBirthTime: false, gender: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PartnerBirthForm>) => setForm((prev) => ({ ...prev, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = toPartnerBirthInput(form);
    if (!parsed.ok) return setError(parsed.error);
    setError('');
    setBusy(true);
    let response: Response;
    try {
      response = await fetch('/api/readings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.input) });
    } catch {
      // 간지사주 입력과 같은 규칙: 요청 자체가 실패하면 계산된 사주 주소로 넘어간다(submit-saju.ts).
      return location.assign(checkoutHref(toSlug(parsed.input)));
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!response.ok || !data.id) {
      setBusy(false);
      return setError(data.error ?? '사주를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    location.assign(checkoutHref(data.id));
  }

  return (
    <form onSubmit={submit} className={`${NOTE_CARD} grid gap-4`}>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-[15px] font-bold">달력</legend>
        {(['solar', 'lunar'] as const).map((value) => (
          <label key={value} className={`${FIELD} flex items-center gap-2`}>
            <input type="radio" name="calendarType" checked={form.calendarType === value} onChange={() => set({ calendarType: value })} />
            {value === 'solar' ? '양력' : '음력'}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-3 gap-2">
        <label className="grid gap-1 text-[14px]">년<input className={FIELD} inputMode="numeric" maxLength={4} placeholder="1990" value={form.year} onChange={(e) => set({ year: e.target.value })} required /></label>
        <label className="grid gap-1 text-[14px]">월<input className={FIELD} inputMode="numeric" maxLength={2} placeholder="5" value={form.month} onChange={(e) => set({ month: e.target.value })} required /></label>
        <label className="grid gap-1 text-[14px]">일<input className={FIELD} inputMode="numeric" maxLength={2} placeholder="15" value={form.day} onChange={(e) => set({ day: e.target.value })} required /></label>
      </div>
      <label className="grid gap-1 text-[14px]">
        태어난 시간
        <select className={FIELD} value={form.hour} disabled={form.unknownBirthTime} onChange={(e) => set({ hour: e.target.value })}>
          <option value="">선택</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" checked={form.unknownBirthTime} onChange={(e) => set({ unknownBirthTime: e.target.checked })} />
        태어난 시간을 몰라요
      </label>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-[15px] font-bold">성별</legend>
        {([['female', '여성'], ['male', '남성']] as const).map(([value, label]) => (
          <label key={value} className={`${FIELD} flex items-center gap-2`}>
            <input type="radio" name="gender" checked={form.gender === value} onChange={() => set({ gender: value })} />
            {label}
          </label>
        ))}
      </fieldset>
      {error ? <p role="alert" className="text-[15px] font-bold text-[var(--note-coral-ink)]">{error}</p> : null}
      <button type="submit" disabled={busy} className={NOTE_PRIMARY_BUTTON}>{busy ? '확인하는 중…' : '다음'}</button>
    </form>
  );
}
```

시간을 고르지도 않고 '몰라요'도 안 누르면 `hour === ''` → 시간 모름으로 처리된다(간지사주 입력과 같은 규칙). 바꾸지 않는다.

- [ ] **Step 6: 페이지 테스트** — `src/app/partner/(theme)/start/page.test.tsx`

```tsx
// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'abc12' }) }) }));
vi.mock('@/lib/supabase/server', () => ({ hasSupabaseServiceEnv: true, createServiceClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/partners/partner', async (orig) => ({ ...(await orig<typeof import('@/lib/partners/partner')>()), getActivePartner: vi.fn() }));
vi.mock('./partner-birth-form', () => ({ PartnerBirthFormView: () => <form data-testid="birth-form" /> }));

import { getActivePartner } from '@/lib/partners/partner';
import Page from './page';

describe('/partner/start', () => {
  beforeEach(() => vi.clearAllMocks());

  it('파트너 없음 → 이용 불가 안내, 입력 폼 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('지금은 이용할 수 없는 링크입니다.');
    expect(html).not.toContain('birth-form');
  });

  it('파트너 있음 → 입력 폼, 한자 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce({ code: 'abc12', name: 'A', discountPercent: 40, commissionPercent: 30 });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('birth-form');
    expect(html).not.toMatch(/[一-鿿]/);
  });
});
```

- [ ] **Step 7: 페이지 구현** — `src/app/partner/(theme)/start/page.tsx`

```tsx
// 올해운 노트 — 생년월일 입력(설계 §3-3). 파트너 쿠키가 없거나 비활성이면 안내만(정가 결제로 가지 않게).
import { cookies } from 'next/headers';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getActivePartner, PARTNER_COOKIE } from '@/lib/partners/partner';
import { NOTE_TITLE_STYLE, NoteNotice } from '@/features/partner-theme/note-theme';
import { PartnerBirthFormView } from './partner-birth-form';

export const dynamic = 'force-dynamic';

export default async function PartnerStartPage() {
  const partner = hasSupabaseServiceEnv
    ? await getActivePartner(await createServiceClient(), (await cookies()).get(PARTNER_COOKIE)?.value)
    : null;
  if (!partner) return <NoteNotice title="지금은 이용할 수 없는 링크입니다." />;
  return (
    <>
      <h1 style={NOTE_TITLE_STYLE} className="text-[26px] font-extrabold leading-[1.35]">생년월일을 알려 주세요</h1>
      <p className="mb-5 mt-2 text-[16px] leading-[1.7] text-[var(--note-muted)]">2027년 한 해 흐름을 이 정보로 정리해 드려요.</p>
      <PartnerBirthFormView />
    </>
  );
}
```

- [ ] **Step 8: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run 'src/app/partner/(theme)/start/' src/features/partner-theme/ && ./scripts/with-node22.sh npm run typecheck`
Expected: PASS, tsc 오류 0

- [ ] **Step 9: Commit**

```bash
git add src/features/partner-theme/partner-birth.ts src/features/partner-theme/partner-birth.spec.ts 'src/app/partner/(theme)/start/'
git commit -m "feat(partner): 올해운 노트 생년월일 입력 — 간지사주와 같은 사주 주소"
```

---

### Task 4: 로그인 `/partner/login`

**Files:**
- Create: `src/features/partner-theme/partner-next.ts`
- Create: `src/features/partner-theme/partner-next.spec.ts`
- Create: `src/app/partner/(theme)/login/page.tsx`
- Create: `src/app/partner/(theme)/login/page.test.tsx`

**Interfaces:**
- Consumes: `NOTE_CARD`, `NOTE_PRIMARY_BUTTON`, `NOTE_TITLE_STYLE` (Task 1); 기존 `/api/auth/kakao/start?next=`, `/api/auth/google/start?next=`(둘 다 `/` 로 시작하고 `//` 아닌 값이면 그대로 돌려보냄)
- Produces: `safePartnerNext(raw: string | undefined): string` — `/partner/` 아래 경로만, 아니면 `/partner/start`. Task 5 가 `/partner/login?next=/partner/checkout?slug=…` 로 보낸다.

- [ ] **Step 1: 테스트** — `src/features/partner-theme/partner-next.spec.ts`

```ts
import { describe, expect, it } from 'vitest';
import { safePartnerNext } from './partner-next';

describe('safePartnerNext', () => {
  it('결제 페이지 주소는 그대로', () => {
    expect(safePartnerNext('/partner/checkout?slug=1990-6-7-14-female-key07y0dyy')).toBe('/partner/checkout?slug=1990-6-7-14-female-key07y0dyy');
  });
  it.each([undefined, '', '/admin', '//evil.com/partner/', 'https://evil.com/partner/x', '/partner/../admin', '/partner/%2e%2e/admin', '/partnerx'])(
    '%s → /partner/start',
    (raw) => expect(safePartnerNext(raw)).toBe('/partner/start'),
  );
});
```

- [ ] **Step 2: 실패 확인**

Run: `./scripts/with-node22.sh npx vitest run src/features/partner-theme/partner-next.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현** — `src/features/partner-theme/partner-next.ts`

```ts
// 로그인 후 돌아갈 곳 — 올해운 노트 흐름(/partner/…) 안으로만. 브라우저가 정규화한 경로로 판정한다('/partner/../admin' → '/admin').
const FALLBACK = '/partner/start';

export function safePartnerNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return FALLBACK;
  try {
    const url = new URL(raw, 'https://ganjisaju.kr');
    if (url.origin !== 'https://ganjisaju.kr' || !url.pathname.startsWith('/partner/')) return FALLBACK;
    return `${url.pathname}${url.search}`;
  } catch {
    return FALLBACK;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run src/features/partner-theme/partner-next.spec.ts`
Expected: PASS (9)

- [ ] **Step 5: 페이지 테스트** — `src/app/partner/(theme)/login/page.test.tsx`

```tsx
// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ hasSupabaseServerEnv: true, createClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));

import Page from './page';

const render = async (next?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ next }) }));
const NEXT = '/partner/checkout?slug=s1';

describe('/partner/login', () => {
  beforeEach(() => getUser.mockReset());

  it('비로그인 → 카카오·구글 시작 주소에 next 를 실어 보냄, 이메일 로그인은 작은 링크', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const html = await render(NEXT);
    const encoded = encodeURIComponent(NEXT);
    expect(html).toContain(`/api/auth/kakao/start?next=${encoded}`);
    expect(html).toContain(`/api/auth/google/start?next=${encoded}`);
    expect(html).toContain(`/login?next=${encoded}`);
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('이미 로그인 → next 로 바로 이동', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    await expect(render(NEXT)).rejects.toThrow(`REDIRECT ${NEXT}`);
  });

  it('바깥 주소 next 는 /partner/start 로 바꿔 싣는다', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const html = await render('//evil.com');
    expect(html).toContain(`/api/auth/kakao/start?next=${encodeURIComponent('/partner/start')}`);
  });
});
```

- [ ] **Step 6: 페이지 구현** — `src/app/partner/(theme)/login/page.tsx`

```tsx
// 올해운 노트 — 로그인(설계 §3-4). 카카오·구글만. 기존 시작 경로를 그대로 부르고 next 로 결제 페이지에 돌아온다.
//   카카오 버튼 노랑(#FEE500)은 카카오 로그인 디자인 가이드 색이라 테마 색으로 바꾸지 않는다.
import { redirect } from 'next/navigation';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import { NOTE_CARD, NOTE_PRIMARY_BUTTON, NOTE_TITLE_STYLE } from '@/features/partner-theme/note-theme';
import { safePartnerNext } from '@/features/partner-theme/partner-next';

export const dynamic = 'force-dynamic';

export default async function PartnerLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safePartnerNext((await searchParams).next);
  if (hasSupabaseServerEnv) {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (user) redirect(next);
  }
  const q = `next=${encodeURIComponent(next)}`;
  return (
    <section className={`${NOTE_CARD} grid gap-3`}>
      <h1 style={NOTE_TITLE_STYLE} className="text-[22px] font-extrabold leading-[1.4]">로그인하고 이어서 볼게요</h1>
      <p className="text-[15px] leading-[1.7] text-[var(--note-muted)]">결제한 운세를 언제든 다시 열어 볼 수 있게 계정에 저장해요.</p>
      <a href={`/api/auth/kakao/start?${q}`} className="block w-full rounded-[14px] bg-[#FEE500] py-3.5 text-center text-[17px] font-extrabold text-[#191919]">카카오로 계속하기</a>
      <a href={`/api/auth/google/start?${q}`} className={NOTE_PRIMARY_BUTTON}>구글로 계속하기</a>
      <a href={`/login?${q}`} className="mt-1 text-center text-[14px] text-[var(--note-muted)] underline">이메일로 로그인</a>
    </section>
  );
}
```

- [ ] **Step 7: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run 'src/app/partner/(theme)/login/' src/features/partner-theme/ && ./scripts/with-node22.sh npm run typecheck`
Expected: PASS, tsc 오류 0

- [ ] **Step 8: Commit**

```bash
git add src/features/partner-theme/partner-next.ts src/features/partner-theme/partner-next.spec.ts 'src/app/partner/(theme)/login/'
git commit -m "feat(partner): 올해운 노트 로그인 화면(카카오·구글, next 는 /partner 안으로만)"
```

---

### Task 5: 결제 페이지 `/partner/checkout`

**Files:**
- Create: `src/app/partner/(theme)/checkout/page.tsx`
- Create: `src/app/partner/(theme)/checkout/page.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `NoteNotice`, `NOTE_CARD`, `NOTE_PRIMARY_BUTTON`, `NOTE_TITLE_STYLE`
  - Task 3 이 보내는 `?slug=`
  - Task 4: `/partner/login?next=`
  - 기존: `getActivePartner(service, raw)`, `PARTNER_COOKIE`, `PARTNER_PACKAGE_ID`('taste_new_year_2027_partner') · `resolveNewYearAccess(slug, year): { reading, user, hasAccess, isOwner }` (`src/lib/new-year-access.ts`) · `resolveChargeForUser(pkg, viewer, couponInput, { env, partner }): ChargeQuote` + `couponEnvForHost(host)` (`src/lib/coupons/coupon-charge.ts`) · `getPackage`, `formatWon`, `NEW_YEAR_TARGET_YEAR` (`src/lib/payments/catalog.ts`) · `getPaymentProvider()` (`src/lib/payments/provider.ts`) · `TossMembershipCheckout`(default export, `src/components/membership/toss-membership-checkout.tsx` — 동의 체크 포함)
- Produces: 화면만.

분기 순서(설계 §3-5·§5):
1. 파트너 없음 → '지금은 이용할 수 없는 링크입니다.'(결제 버튼 없음)
2. slug 없음 또는 사주 없음 → `/partner/start` 로 redirect
3. 비로그인 → `/partner/login?next=/partner/checkout?slug=…`
4. 남의 사주(`!isOwner`) → 안내 + 다시 입력 링크
5. 이미 볼 수 있음(`hasAccess`) → '이미 받은 운세가 있어요' + `/saju/<slug>/new-year/2027`
6. 계산 결과에 파트너 없음(`!quote.partner`) → 1번과 같은 안내(32,000원 버튼 금지 — Review Focus 1)
7. 결제: 정가 취소선 · 청구액 · 할인율 · 결제 버튼 · 결제 주체 안내

- [ ] **Step 1: 테스트** — `src/app/partner/(theme)/checkout/page.test.tsx`

```tsx
// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'abc12' }) }),
  headers: async () => new Headers({ host: 'ganjisaju.kr' }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));
vi.mock('@/lib/supabase/server', () => ({ hasSupabaseServiceEnv: true, createServiceClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/partners/partner', async (orig) => ({ ...(await orig<typeof import('@/lib/partners/partner')>()), getActivePartner: vi.fn() }));
vi.mock('@/lib/new-year-access', () => ({ resolveNewYearAccess: vi.fn() }));
vi.mock('@/lib/coupons/coupon-charge', () => ({ couponEnvForHost: () => 'production', resolveChargeForUser: vi.fn() }));
vi.mock('@/lib/payments/provider', () => ({ getPaymentProvider: () => 'nicepay' }));
vi.mock('@/components/membership/toss-membership-checkout', () => ({
  default: (p: { packageId: string; amount: number; product?: string; slug?: string; entrySource?: string }) => (
    <div data-testid="pay" data-package={p.packageId} data-amount={p.amount} data-product={p.product} data-slug={p.slug} data-from={p.entrySource} />
  ),
}));

import { getActivePartner } from '@/lib/partners/partner';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { resolveChargeForUser } from '@/lib/coupons/coupon-charge';
import Page from './page';

const partner = { code: 'abc12', name: 'A', discountPercent: 40, commissionPercent: 30 };
const user = { id: 'u1' };
const quote = { listAmount: 32000, discountWon: 12800, chargeAmount: 19200, percent: 40, couponCode: null, reason: null, claim: null, memberPercent: 0, partner };
const render = async (slug?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ slug }) }));

describe('/partner/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActivePartner).mockResolvedValue(partner);
    vi.mocked(resolveNewYearAccess).mockResolvedValue({ reading: {}, user, hasAccess: false, isOwner: true } as never);
    vi.mocked(resolveChargeForUser).mockResolvedValue(quote as never);
  });

  it('정상 → 32,000원 취소선 · 19,200원(40%) · 파트너판 결제 버튼 · 결제 주체 안내', async () => {
    const html = await render('s1');
    expect(html).toContain('32,000원');
    expect(html).toContain('19,200원');
    expect(html).toContain('40%');
    expect(html).toContain('data-package="taste_new_year_2027_partner"');
    expect(html).toContain('data-amount="19200"');
    expect(html).toContain('data-product="new-year"');
    expect(html).toContain('data-slug="s1"');
    expect(html).toContain('data-from="partner"');
    expect(html).toContain('결제·풀이 제공: 간지사주(푸꼬컴퍼니)');
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('파트너 없음 → 안내만, 결제 버튼 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce(null);
    const html = await render('s1');
    expect(html).toContain('지금은 이용할 수 없는 링크입니다.');
    expect(html).not.toContain('data-testid="pay"');
  });

  it('계산 결과에 파트너가 빠지면(정가 청구 위험) 결제 버튼 없음', async () => {
    vi.mocked(resolveChargeForUser).mockResolvedValueOnce({ ...quote, partner: null, chargeAmount: 32000, discountWon: 0, percent: 0 } as never);
    const html = await render('s1');
    expect(html).not.toContain('data-testid="pay"');
    expect(html).not.toContain('32,000원 결제');
  });

  it('slug 없음 → 입력 화면', async () => {
    await expect(render()).rejects.toThrow('REDIRECT /partner/start');
  });

  it('사주 없음 → 입력 화면', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: null, user: null, hasAccess: false, isOwner: false } as never);
    await expect(render('s1')).rejects.toThrow('REDIRECT /partner/start');
  });

  it('비로그인 → 올해운 노트 로그인(next=결제 페이지)', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: {}, user: null, hasAccess: false, isOwner: false } as never);
    await expect(render('s1')).rejects.toThrow(`REDIRECT /partner/login?next=${encodeURIComponent('/partner/checkout?slug=s1')}`);
  });

  it('남의 사주 → 결제 버튼 없이 다시 입력 안내', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: {}, user, hasAccess: false, isOwner: false } as never);
    const html = await render('s1');
    expect(html).toContain('href="/partner/start"');
    expect(html).not.toContain('data-testid="pay"');
  });

  it('이미 구매 → 풀이 보러 가기(간지사주 신년운세 화면)', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: {}, user, hasAccess: true, isOwner: true } as never);
    const html = await render('s1');
    expect(html).toContain('이미 받은 운세가 있어요');
    expect(html).toContain('href="/saju/s1/new-year/2027"');
    expect(html).not.toContain('data-testid="pay"');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `./scripts/with-node22.sh npx vitest run 'src/app/partner/(theme)/checkout/'`
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: 구현** — `src/app/partner/(theme)/checkout/page.tsx`

```tsx
// 올해운 노트 — 결제 페이지(설계 §3-5). 파트너판만 다룬다.
//   금액은 /membership/checkout·prepare 와 같은 resolveChargeForUser(같은 getUser 결과) → 화면 금액 = order.amount = PG 청구액.
//   이용권 판정은 신년운세 화면과 같은 resolveNewYearAccess(사주 정체성 + 신년운세·평생 이용권).
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import TossMembershipCheckout from '@/components/membership/toss-membership-checkout';
import { couponEnvForHost, resolveChargeForUser } from '@/lib/coupons/coupon-charge';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { getActivePartner, PARTNER_COOKIE, PARTNER_PACKAGE_ID } from '@/lib/partners/partner';
import { formatWon, getPackage, NEW_YEAR_TARGET_YEAR } from '@/lib/payments/catalog';
import { getPaymentProvider } from '@/lib/payments/provider';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { NOTE_CARD, NOTE_PRIMARY_BUTTON, NOTE_TITLE_STYLE, NoteNotice } from '@/features/partner-theme/note-theme';

export const dynamic = 'force-dynamic';

const UNAVAILABLE = <NoteNotice title="지금은 이용할 수 없는 링크입니다." />;

export default async function PartnerCheckoutPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const slug = (await searchParams).slug?.trim();
  const partner = hasSupabaseServiceEnv
    ? await getActivePartner(await createServiceClient(), (await cookies()).get(PARTNER_COOKIE)?.value)
    : null;
  if (!partner) return UNAVAILABLE;
  if (!slug) redirect('/partner/start');

  const access = await resolveNewYearAccess(slug, NEW_YEAR_TARGET_YEAR);
  if (!access.reading) redirect('/partner/start');
  if (!access.user) redirect(`/partner/login?next=${encodeURIComponent(`/partner/checkout?slug=${slug}`)}`);
  if (!access.isOwner) {
    return (
      <NoteNotice title="이 계정에서 만든 사주가 아니에요">
        <a href="/partner/start" className="underline">생년월일 다시 넣기</a>
      </NoteNotice>
    );
  }
  if (access.hasAccess) {
    return (
      <NoteNotice title="이미 받은 운세가 있어요">
        <a href={`/saju/${encodeURIComponent(slug)}/new-year/${NEW_YEAR_TARGET_YEAR}`} className={`${NOTE_PRIMARY_BUTTON} mt-2`}>풀이 보러 가기</a>
      </NoteNotice>
    );
  }

  const pkg = getPackage(PARTNER_PACKAGE_ID)!;
  const quote = await resolveChargeForUser(pkg, access.user, null, {
    env: couponEnvForHost((await headers()).get('host')),
    partner,
  });
  // 파트너 할인이 빠진 계산(비활성 직전 경합 등)으로 정가를 청구하지 않는다. prepare 의 409 가 최종 방어.
  if (!quote.partner) return UNAVAILABLE;

  return (
    <>
      <h1 style={NOTE_TITLE_STYLE} className="text-[26px] font-extrabold leading-[1.35]">2027 운세</h1>
      <section className={`${NOTE_CARD} mt-5`}>
        <p className="text-[15px] text-[var(--note-muted)] line-through">{formatWon(quote.listAmount)}</p>
        <p className="text-[28px] font-extrabold">
          {formatWon(quote.chargeAmount)} <span className="text-[16px] text-[var(--note-coral-ink)]">({quote.percent}% 할인)</span>
        </p>
        <div className="mt-4">
          <TossMembershipCheckout
            provider={getPaymentProvider()}
            packageId={pkg.id}
            plan="premium"
            product="new-year"
            amount={quote.chargeAmount}
            orderName={pkg.name}
            slug={slug}
            entrySource="partner"
          />
        </div>
        <p className="mt-3 text-[13px] leading-[1.6] text-[var(--note-muted)]">
          결제·풀이 제공: 간지사주(푸꼬컴퍼니) — 결제창과 카드 명세서에 이 이름이 표시됩니다.
        </p>
      </section>
    </>
  );
}
```

`plan="premium"`: `/membership/checkout` 이 상품 결제 때 넘기는 값과 같다(`normalizePlanSlug(undefined)` → 'premium'). prepare 는 `packageId` 로 상품을 정한다. `entrySource="partner"` 는 prepare 가 `from` 으로 받아 주문 metadata·퍼널에 그대로 남긴다(허용 목록 없음 — 2026-10-09 확인).

- [ ] **Step 4: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run 'src/app/partner/(theme)/checkout/' && ./scripts/with-node22.sh npm run typecheck`
Expected: PASS (8), tsc 오류 0

- [ ] **Step 5: 결제 원장 가드 확인**

Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: fail 0. `src/lib/payments/coupon-chokepoint.test.ts`(주문 insert 1곳·createPaymentOrder 1곳·PG 결제창 1곳)는 이 페이지가 결제 컴포넌트를 재사용하므로 **수정 없이** 통과해야 한다. 실패하면 페이지가 결제창·주문을 직접 만들고 있다는 뜻 — 가드를 고치지 말고 페이지를 고친다.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/partner/(theme)/checkout/'
git commit -m "feat(partner): 올해운 노트 결제 페이지 — 기존 금액 계산·결제 버튼 재사용"
```

---

### Task 6: 랜딩을 올해운 노트 테마로

**Files:**
- Modify: `src/app/partner-landing/[code]/page.tsx`
- Create: `src/app/partner-landing/[code]/page.test.tsx`

**Interfaces:**
- Consumes: `NoteShell`, `NoteNotice`, `NOTE_CARD`, `NOTE_PRIMARY_BUTTON`, `NOTE_TITLE_STYLE`, `NOTE_METADATA` (Task 1)
- Produces: 화면만. 구매 버튼 주소 `${CANONICAL_SITE_URL}/partner/go?code=…`(변경 없음)

- [ ] **Step 1: 테스트** — `src/app/partner-landing/[code]/page.test.tsx`

```tsx
// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone)' }) }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn(async () => ({ rpc: vi.fn(async () => ({})) })) }));
vi.mock('@/lib/partners/partner', async (orig) => ({ ...(await orig<typeof import('@/lib/partners/partner')>()), getActivePartner: vi.fn() }));
vi.mock('@/lib/payments/price-resolver', () => ({ resolvePackagePrice: vi.fn(async () => 32000) }));

import { getActivePartner } from '@/lib/partners/partner';
import Page, { metadata } from './page';

const render = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ code: 'abc12' }) }));

describe('올해운 노트 랜딩', () => {
  beforeEach(() => vi.clearAllMocks());

  it('B안 문구 · 32,000→19,200(40%) · 구매 버튼 · 결제 주체 안내 · 테마 셸', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce({ code: 'abc12', name: 'A', discountPercent: 40, commissionPercent: 30 });
    const html = await render();
    for (const text of ['내년 내 운, 미리 열어볼까요?', '생년월일만 넣으면 2027년 한 해가 달별로 정리돼요.', '2027 운세 열기', '32,000원', '19,200원', '40% 할인', '결제·풀이 제공: 간지사주(푸꼬컴퍼니)']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('/partner/go?code=abc12');
    expect(html).toContain('--note-bg:#FBF7F0');
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('없는 코드 → 안내만, 구매 버튼 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce(null);
    const html = await render();
    expect(html).toContain('지금은 이용할 수 없는 링크입니다.');
    expect(html).not.toContain('/partner/go');
  });

  it('탭 제목에 간지사주 템플릿이 붙지 않는다', () => {
    expect(metadata.title).toEqual({ absolute: '올해운 노트 — 2027 운세' });
    expect(metadata.openGraph?.siteName).toBe('올해운 노트');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `./scripts/with-node22.sh npx vitest run 'src/app/partner-landing/'`
Expected: FAIL — `--note-bg` 없음, title 이 문자열

- [ ] **Step 3: 구현** — `page.tsx` 에서 `BUSINESS_INFO`·`BUSINESS_LINES`·자체 footer 를 지우고(셸이 그린다) 아래처럼 바꾼다. 방문 집계·가격 계산·구매 주소 로직은 그대로.

```tsx
// 2026-10-04 인플루언서 전용 신년운세 랜딩(설계 §3-3) · 2026-10-09 올해운 노트 테마(partner-theme-flow 설계 §3-2).
// 호스트 전환은 src/proxy.ts → partnerLandingRewritePath. 마이그레이션 090 미적용이면 '이용 불가' 안내로 닫힌다.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { formatWon, getPackage } from '@/lib/payments/catalog';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { applyPartnerPrice, getActivePartner, PARTNER_PACKAGE_ID } from '@/lib/partners/partner';
import { kstDateKey } from '@/lib/admin/analytics-rollup';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { shouldCountPartnerVisit } from '@/lib/partners/partner-host';
import { NOTE_CARD, NOTE_METADATA, NOTE_PRIMARY_BUTTON, NOTE_TITLE_STYLE, NoteNotice, NoteShell } from '@/features/partner-theme/note-theme';

export const metadata: Metadata = { ...NOTE_METADATA, title: { absolute: '올해운 노트 — 2027 운세' } };
export const dynamic = 'force-dynamic';

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const service = await createServiceClient();
  const partner = await getActivePartner(service, code);
  if (!partner) {
    return <NoteShell><NoteNotice title="지금은 이용할 수 없는 링크입니다." /></NoteShell>;
  }
  // 봇·미리보기 크롤러는 세지 않는다. 집계 실패(테이블·함수 미적용 포함)는 랜딩을 막지 않는다.
  if (shouldCountPartnerVisit((await headers()).get('user-agent'))) {
    await Promise.resolve(
      service.rpc('increment_partner_visit', { p_code: partner.code, p_day: kstDateKey(new Date().toISOString()) }),
    ).then(() => undefined, () => undefined);
  }
  const list = await resolvePackagePrice(getPackage(PARTNER_PACKAGE_ID)!.id);
  const price = applyPartnerPrice(list, partner);
  const buyHref = `${CANONICAL_SITE_URL}/partner/go?code=${encodeURIComponent(partner.code)}`;
  return (
    <NoteShell>
      {/* 2026-10-04 랜딩 문구 B안(사용자 선택) */}
      <h1 style={NOTE_TITLE_STYLE} className="text-[30px] font-extrabold leading-[1.3]">내년 내 운, 미리 열어볼까요?</h1>
      <p className="mt-3 text-[17px] leading-[1.7] text-[var(--note-muted)]">생년월일만 넣으면 2027년 한 해가 달별로 정리돼요.</p>
      <ul className="mt-5 grid gap-2 text-[16px] leading-[1.6]">
        <li>✓ 돈·사람·일, 신경 쓰이는 흐름 한눈에</li>
        <li>✓ 달마다 &ldquo;이번 달 할 일&rdquo; 한 줄 정리</li>
        <li>✓ 저장해 두고 새해 내내 꺼내 보기</li>
      </ul>
      <section className={`${NOTE_CARD} mt-7`}>
        <p className="text-[15px] text-[var(--note-muted)] line-through">{formatWon(list)}</p>
        <p className="text-[28px] font-extrabold">
          {formatWon(price.chargeAmount)} <span className="text-[16px] text-[var(--note-coral-ink)]">({price.percent}% 할인)</span>
        </p>
        <a href={buyHref} className={`${NOTE_PRIMARY_BUTTON} mt-4`}>2027 운세 열기</a>
        <p className="mt-3 text-[13px] leading-[1.6] text-[var(--note-muted)]">결제·풀이 제공: 간지사주(푸꼬컴퍼니) — 결제 화면에 이 이름이 표시됩니다.</p>
      </section>
    </NoteShell>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `./scripts/with-node22.sh npx vitest run 'src/app/partner-landing/' && ./scripts/with-node22.sh npm run typecheck`
Expected: PASS (3), tsc 오류 0

- [ ] **Step 5: Commit**

```bash
git add 'src/app/partner-landing/'
git commit -m "feat(partner): 랜딩을 올해운 노트 테마 셸로(문구 B안 유지, 탭 제목 분리)"
```

---

### Task 7: (사용자 확정 후에만) 제목 둥근 고딕

**사용자가 글꼴을 확정하기 전에는 이 작업을 하지 않는다.** 확정되지 않은 채 머지해도 제목은 Pretendard 800 으로 나온다.

**Files:**
- Create: `src/app/fonts/<확정 글꼴>.woff2` (+ 라이선스 문서 `src/app/fonts/<확정 글꼴>-LICENSE.txt`)
- Modify: `src/features/partner-theme/note-theme.tsx` (`--note-title-font` 한 줄 + `next/font/local` 선언)
- Modify: `src/features/partner-theme/note-theme.test.tsx` (글꼴 변수 단언 1개)

- [ ] **Step 1: 글꼴 파일·라이선스** — 배포처 공식 페이지에서 woff2(굵게 1종)와 라이선스 전문을 받아 위 경로에 둔다. 외부 CDN 로드 금지(CSP 'self').
- [ ] **Step 2: 테스트 추가** — `note-theme.test.tsx` 에

```tsx
  it('제목 글꼴 변수는 확정 글꼴을 먼저 쓴다', () => {
    expect(html).toMatch(/--note-title-font:var\(--font-note-title\)/);
  });
```

- [ ] **Step 3: 실패 확인** — `npx vitest run src/features/partner-theme/note-theme.test.tsx` → FAIL
- [ ] **Step 4: 구현** — `note-theme.tsx` 맨 위에

```tsx
import localFont from 'next/font/local';

const noteTitleFont = localFont({ src: '../../app/fonts/<확정 글꼴>.woff2', display: 'swap', preload: false, variable: '--font-note-title' });
```

`THEME_VARS` 의 `'--note-title-font'` 를 `'var(--font-note-title), var(--font-dalbit-sans), sans-serif'` 로, `NoteShell` 바깥 div 의 className 앞에 `${noteTitleFont.variable} ` 를 붙인다.
- [ ] **Step 5: 통과 확인** — vitest PASS · `npm run build` 성공(글꼴 경로 오류는 빌드에서만 드러난다)
- [ ] **Step 6: Commit** — `git commit -m "feat(partner): 올해운 노트 제목 글꼴 <이름>"`

---

### Task 8: 전체 검증 · 실화면 · 기록

- [ ] **Step 1: 전체 테스트**

Run: `./scripts/with-node22.sh npm test && ./scripts/with-node22.sh npm run test:spec && ./scripts/with-node22.sh npm run typecheck && ./scripts/with-node22.sh npm run build`
Expected: 전부 fail 0 · 빌드 성공

- [ ] **Step 2: 간지사주 기존 화면 불변 확인** — `git diff origin/main --stat` 에 `src/app/membership/`, `src/components/`, `src/app/layout.tsx`, `src/app/globals.css` 가 없어야 한다.

- [ ] **Step 3: 실화면(staging 또는 로컬 dev)** — 테스트 파트너 코드로 390px 화면 캡처: 랜딩 → `/partner/go` → `/partner/start` 입력 → `/partner/login` → `/partner/checkout` 19,200원. 확인 항목: 간지사주 헤더·메뉴·하단 탭 없음 · 탭 제목 '올해운 노트' · 결제 버튼·동의 체크가 테마 색 · 한자 없음. 결제창 금액 19,200원은 사용자 확인.

- [ ] **Step 4: 배포 번들 확인** — 배포 후 `/partner/start` 응답 HTML 에서 `--note-bg:#FBF7F0` 를 grep(이번 PR 에만 있는 값).

- [ ] **Step 5: PROGRESS.md 맨 위 새 섹션 + 커밋** — 날짜·수행 내용·실제 검증 결과·남은 일(글꼴 확정·Task 7, 결제 실패 복귀 화면).
