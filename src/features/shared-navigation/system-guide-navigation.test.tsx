// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEGA_NAV, resolveActiveGroup, MEGA_NAV_BAR } from './mega-nav-data';

const mocks = vi.hoisted(() => ({ push: vi.fn(), onClose: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/guide',
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/lib/supabase/client', () => ({
  hasSupabaseBrowserEnv: false,
  createClient: vi.fn(),
}));
vi.mock('@/components/gangi/zodiac-chip', () => ({
  ZodiacChip: ({ kind }: { kind: string }) => <span data-zodiac={kind} />,
}));
vi.mock('@/components/payments/price-provider', () => ({
  Price: ({ priceKey }: { priceKey: string }) => <span>{priceKey}</span>,
}));
vi.mock('@/features/account/header-logout-button', () => ({ HeaderLogoutButton: () => <button /> }));

import { MegaNavBar } from './mega-nav';
import { MobileNavSheet } from './mobile-nav-sheet';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

async function render(element: React.ReactNode) {
  await act(async () => root.render(element));
}

beforeEach(() => {
  mocks.push.mockClear();
  mocks.onClose.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('system guide navigation', () => {
  it('MEGA_NAV에 standalone 사용방법 링크가 정확히 한 번 있고 /guide를 활성화한다', () => {
    const guideGroups = MEGA_NAV.filter((group) => group.label === '사용방법');

    expect(guideGroups).toEqual([{ label: '사용방법', simple: true, href: '/guide' }]);
    expect(resolveActiveGroup('/guide')).toBe('사용방법');
  });

  it('데스크톱 주 메뉴는 accessible /guide 링크를 패널 없이 렌더한다', async () => {
    await render(<MegaNavBar />);
    const navigation = document.querySelector('nav[aria-label="주 메뉴"]');
    const guideLink = Array.from(navigation?.querySelectorAll('a') ?? []).find(
      (link) => link.textContent?.trim() === '사용방법',
    );

    expect(guideLink?.getAttribute('href')).toBe('/guide');
    act(() => guideLink?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    expect(document.querySelector('.mega-nav-panel')).toBeNull();
  });

  it('1024px desktop 대응 CSS도 기존 회원가입 CTA를 숨기지 않는다', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/features/shared-navigation/mega-nav.css'),
      'utf8',
    );
    const compactDesktop = source.match(
      /@media \(min-width: 1024px\) and \(max-width: 1199px\) \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(compactDesktop).toBeDefined();
    expect(compactDesktop).not.toMatch(/mega-nav-signup[\s\S]*?display:\s*none/);
  });

  it('모바일 전체 메뉴는 /guide 독립 행을 검색과 4개 tab 사이에 렌더한다', async () => {
    await render(<MobileNavSheet open onClose={mocks.onClose} initialActiveLabel="사용방법" />);
    const dialog = document.querySelector('[role="dialog"][aria-label="전체 메뉴"]');
    const search = dialog?.querySelector('.mobile-nav-sheet-search');
    const guide = dialog?.querySelector<HTMLAnchorElement>('.mobile-nav-sheet-guide');
    const tablist = dialog?.querySelector('[role="tablist"]');

    if (!search || !guide || !tablist) throw new Error('모바일 내비게이션 핵심 영역 없음');
    expect(guide?.getAttribute('href')).toBe('/guide');
    expect(search.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(guide.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tablist?.querySelectorAll('[role="tab"]')).toHaveLength(4);

    guide?.addEventListener('click', (event) => event.preventDefault());
    act(() => guide?.click());
    expect(mocks.onClose).toHaveBeenCalledOnce();
  });

  it('/guide에서 모바일 상세 콘텐츠는 운세로 fallback되어 목록과 활성 tab을 유지한다', async () => {
    await render(<MobileNavSheet open onClose={mocks.onClose} initialActiveLabel="사용방법" />);

    expect(document.querySelectorAll('.mobile-nav-sheet-item').length).toBeGreaterThan(0);
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('운세');
  });

  it('모바일 사용방법 링크는 렌더 스타일에서 최소 44px 터치 영역을 가진다', async () => {
    const style = document.createElement('style');
    style.textContent = fs.readFileSync(
      path.join(process.cwd(), 'src/features/shared-navigation/mobile-nav-sheet.css'),
      'utf8',
    );
    document.head.append(style);
    await render(<MobileNavSheet open onClose={mocks.onClose} />);

    const guide = document.querySelector('.mobile-nav-sheet-guide');
    expect(getComputedStyle(guide!).minHeight).toBe('44px');
  });
});

// 🔴 회귀 가드(2026-08-28) — 상단바 순서는 **상품 축**이다. 하단 dock 이 이미 '어디로 가나'를
//   담당하므로 상단이 같은 축이면 겹친다. 그리고 궁합은 홈에서 '추천' 배지를 단 2번째
//   상품인데 상단 진입로가 없었다 — 다시 빠지면 여기서 실패한다.
describe('상단바 우선순위', () => {
  it('주력(사주)이 첫 칸이고 궁합에 진입로가 있다', () => {
    const labels = MEGA_NAV_BAR.map((g) => g.label);
    expect(labels[0]).toBe('사주');
    expect(labels).toContain('궁합');
    // 무료 허브는 유입용이라 결제 메뉴 뒤. 잠금 ON 이면 통째로 사라지므로 앞자리에 두면
    // 환경마다 첫 메뉴가 달라진다.
    const free = labels.indexOf('운세');
    if (free >= 0) expect(free).toBeGreaterThan(labels.indexOf('대화'));
    // 도움말은 마지막.
    expect(labels[labels.length - 1]).toBe('사용방법');
  });

  it('홈에서는 아무 메뉴도 강조하지 않는다', () => {
    // 홈은 어느 메뉴에도 속하지 않는다. 기본값으로 첫 그룹을 칠하면 거짓 강조가 된다.
    expect(resolveActiveGroup('/')).toBe('');
  });

  it('궁합 경로는 궁합 메뉴를 활성화한다(사주로 흡수되지 않는다)', () => {
    expect(resolveActiveGroup('/compatibility')).toBe('궁합');
    expect(resolveActiveGroup('/saju/new')).toBe('사주');
  });
});
