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

const APP_VARS = {
  '--app-pink': NOTE_COLORS.coralInk,
  '--app-pink-strong': NOTE_COLORS.coralInk,
  '--app-pink-soft': '#FDECE9',
  '--app-ink': NOTE_COLORS.ink,
  '--app-line': NOTE_COLORS.line,
  '--app-copy-muted': NOTE_COLORS.muted,
  '--app-copy-soft': NOTE_COLORS.muted,
};

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
  ...APP_VARS,
} as CSSProperties;

// body 로 포털되는 컴포넌트(결제 하단 바)에도 닿도록 같은 값을 body 규칙으로도 심는다.
const BODY_VARS_CSS = `body{${Object.entries(APP_VARS).map(([k, v]) => `${k}:${v}`).join(';')}}`;

export const NOTE_TITLE_STYLE: CSSProperties = { fontFamily: 'var(--note-title-font)' };
export const NOTE_PRIMARY_BUTTON =
  'block w-full rounded-[14px] bg-[var(--note-ink)] py-3.5 text-center text-[17px] font-extrabold text-white';
export const NOTE_CARD = 'rounded-[18px] border border-[var(--note-line)] bg-[var(--note-card)] p-5';

// 루트 레이아웃의 description·openGraph·twitter 는 필드별로 상속되므로(간지사주 문구·이미지) 전부 직접 지정한다.
const NOTE_DESCRIPTION = '생년월일만 넣으면 2027년 한 해가 달별로 정리돼요.';
export const NOTE_METADATA: Metadata = {
  title: { absolute: '올해운 노트' },
  description: NOTE_DESCRIPTION,
  applicationName: '올해운 노트',
  robots: { index: false, follow: false },
  openGraph: { siteName: '올해운 노트', title: '올해운 노트', description: NOTE_DESCRIPTION, images: [] },
  twitter: { card: 'summary', title: '올해운 노트', description: NOTE_DESCRIPTION, images: [] },
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
      <style>{BODY_VARS_CSS}</style>
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
