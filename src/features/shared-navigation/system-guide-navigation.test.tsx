// @vitest-environment jsdom

import fs from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEGA_NAV, resolveActiveGroup } from './mega-nav-data';

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
