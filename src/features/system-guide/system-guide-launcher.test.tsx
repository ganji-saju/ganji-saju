// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_GUIDE_STORAGE_KEY } from './system-guide-state';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  hasEnv: true,
  user: null as { id: string } | null,
  authCallback: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  unsubscribe: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/lib/supabase/client', () => ({
  get hasSupabaseBrowserEnv() { return mocks.hasEnv; },
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
      onAuthStateChange: vi.fn((callback) => {
        mocks.authCallback = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      }),
    },
  }),
}));
vi.mock('./system-guide-onboarding', () => ({
  SystemGuideOnboarding: (props: {
    open: boolean;
    initialStepIndex: number;
    onStepChange: (index: number) => void;
    onNavigate: (index: number, href: string) => void;
    onDismiss: (index: number) => void;
    onComplete: () => void;
  }) => props.open ? (
    <div data-testid="guide" data-step={props.initialStepIndex}>
      <button onClick={() => props.onStepChange(3)}>step</button>
      <button onClick={() => props.onNavigate(3, '/saju/new')}>navigate</button>
      <button onClick={() => props.onNavigate(2, '/guide?source=guide')}>same-route</button>
      <button onClick={() => props.onDismiss(props.initialStepIndex)}>dismiss</button>
      <button onClick={props.onComplete}>complete</button>
    </div>
  ) : null,
}));

import { openSystemGuide } from './system-guide-events';
import { isSystemGuideAutoExcludedPath, SystemGuideLauncher } from './system-guide-launcher';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function state(status: string, stepIndex = 0) {
  localStorage.setItem(SYSTEM_GUIDE_STORAGE_KEY, JSON.stringify({ version: 1, status, stepIndex }));
}

async function renderLauncher() {
  await act(async () => { root.render(<SystemGuideLauncher />); });
}

async function navigate(pathname: string) {
  mocks.pathname = pathname;
  await act(async () => { root.render(<SystemGuideLauncher />); });
}

function guide() { return document.querySelector('[data-testid="guide"]'); }
function click(label: string) {
  const target = Array.from(document.querySelectorAll('button')).find((item) => item.textContent === label);
  if (!target) throw new Error(`${label} 버튼 없음`);
  act(() => target.click());
}

beforeEach(() => {
  mocks.pathname = '/';
  mocks.hasEnv = true;
  mocks.user = null;
  mocks.authCallback = null;
  mocks.unsubscribe.mockClear();
  mocks.getUser.mockReset();
  mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.user } }));
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('SystemGuideLauncher', () => {
  it.each([
    ['/login', true], ['/login/help', true], ['/signup', true], ['/signup/confirm', true],
    ['/auth', true], ['/auth/callback', true], ['/pay', true], ['/pay/return', true],
    ['/membership/checkout', true], ['/membership/checkout/confirm', true],
    ['/membership/complete', true], ['/membership/success', true],
    ['/credits/success', true], ['/credits/fail', true],
    ['/legal', true], ['/privacy', true], ['/terms', true], ['/commerce-disclosure', true],
    ['/coin-policy', true],
    ['/digital-content-policy', true], ['/ai-disclaimer', true], ['/subscription-policy', true],
    ['/refund-policy', true], ['/appointment-policy', true],
    ['/admin', true], ['/admin/analytics', true],
    ['/', false], ['/guide', false], ['/membership', false], ['/saju/new', false],
  ])('자동 실행 제외 경로 %s => %s', (pathname, expected) => {
    expect(isSystemGuideAutoExcludedPath(pathname)).toBe(expected);
  });

  it('비로그인 초기 상태에서는 자동으로 열지 않는다', async () => {
    await renderLauncher();
    expect(guide()).toBeNull();
  });

  it('로그인 초기 상태가 new이면 자동으로 연다', async () => {
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    expect(guide()).not.toBeNull();
  });

  it('SIGNED_IN 이벤트 시 new이면 연다', async () => {
    await renderLauncher();
    await act(async () => mocks.authCallback?.('SIGNED_IN', { user: { id: 'user-1' } }));
    expect(guide()).not.toBeNull();
  });

  it('SIGNED_OUT 뒤 늦게 완료된 getUser 로그인 결과를 무시한다', async () => {
    let resolveGetUser!: (value: { data: { user: { id: string } } }) => void;
    mocks.getUser.mockImplementationOnce(() => new Promise((resolve) => { resolveGetUser = resolve; }));
    await renderLauncher();
    act(() => mocks.authCallback?.('SIGNED_OUT', null));
    await act(async () => resolveGetUser({ data: { user: { id: 'stale-user' } } }));
    expect(guide()).toBeNull();
  });

  it('SIGNED_IN 뒤 늦게 완료된 getUser 비로그인 결과가 최신 로그인을 덮지 않는다', async () => {
    let resolveGetUser!: (value: { data: { user: null } }) => void;
    mocks.getUser.mockImplementationOnce(() => new Promise((resolve) => { resolveGetUser = resolve; }));
    await renderLauncher();
    act(() => mocks.authCallback?.('SIGNED_IN', { user: { id: 'fresh-user' } }));
    expect(guide()).not.toBeNull();
    await act(async () => resolveGetUser({ data: { user: null } }));
    expect(guide()).not.toBeNull();
  });

  it.each(['dismissed', 'completed'])('%s 상태는 로그인해도 자동으로 열지 않는다', async (status) => {
    state(status);
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    expect(guide()).toBeNull();
  });

  it('단계 이동, 닫기, 완료 상태를 저장한다', async () => {
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    click('step');
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({ status: 'in_progress', stepIndex: 3 });
    click('dismiss');
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({ status: 'dismissed', stepIndex: 3 });

    act(() => openSystemGuide(5));
    click('complete');
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({ status: 'completed', stepIndex: 5 });
  });

  it('기능 이동은 현재 단계를 진행 중으로 저장하고 닫으며 다음 로그인 마운트에서 복원한다', async () => {
    mocks.user = { id: 'user-1' };
    await renderLauncher();

    click('navigate');

    expect(guide()).toBeNull();
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({
      status: 'in_progress',
      stepIndex: 3,
    });

    act(() => root.unmount());
    host.remove();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await renderLauncher();

    expect(guide()?.getAttribute('data-step')).toBe('3');
  });

  it('기능 목적지에서는 닫힌 채 유지하고 browser back으로 origin에 돌아오면 같은 인스턴스에서 저장 단계를 재개한다', async () => {
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    click('navigate');

    await navigate('/saju/new');
    expect(guide()).toBeNull();

    await navigate('/');
    expect(guide()?.getAttribute('data-step')).toBe('3');
  });

  it('query가 포함된 같은 pathname CTA는 pending을 만들지 않아 이후 자동 실행을 막지 않는다', async () => {
    mocks.pathname = '/guide';
    await renderLauncher();
    act(() => openSystemGuide(2));
    click('same-route');
    expect(guide()).toBeNull();

    await act(async () => mocks.authCallback?.('SIGNED_IN', { user: { id: 'user-1' } }));
    expect(guide()?.getAttribute('data-step')).toBe('2');
  });

  it('/guide 수동 CTA가 /login으로 redirect되면 pending을 해제해 다음 일반 경로에서 자동 실행한다', async () => {
    mocks.pathname = '/guide';
    await renderLauncher();
    act(() => openSystemGuide(3));
    click('navigate');

    await navigate('/login');
    await act(async () => mocks.authCallback?.('SIGNED_IN', { user: { id: 'user-1' } }));
    expect(guide()).toBeNull();

    mocks.user = { id: 'user-1' };
    await navigate('/free');
    expect(guide()?.getAttribute('data-step')).toBe('3');
  });

  it('예상하지 않은 non-excluded redirect도 pending을 해제해 SIGNED_IN 자동 실행을 허용한다', async () => {
    await renderLauncher();
    act(() => openSystemGuide(3));
    click('navigate');

    await navigate('/free');
    await act(async () => mocks.authCallback?.('SIGNED_IN', { user: { id: 'user-1' } }));
    expect(guide()?.getAttribute('data-step')).toBe('3');
  });

  it('수동 이벤트는 인증과 저장 상태에 관계없이 유효한 지정 단계에서 연다', async () => {
    state('completed', 5);
    await renderLauncher();
    act(() => openSystemGuide(2));
    expect(guide()?.getAttribute('data-step')).toBe('2');
    act(() => openSystemGuide(999));
    expect(guide()?.getAttribute('data-step')).toBe('0');
  });

  it.each(['/login', '/signup', '/auth', '/auth/callback', '/pay', '/membership/checkout', '/privacy', '/admin/analytics'])('%s에서는 자동 실행을 막고 수동 실행은 허용한다', async (pathname) => {
    mocks.pathname = pathname;
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    expect(guide()).toBeNull();
    act(() => openSystemGuide(1));
    expect(guide()?.getAttribute('data-step')).toBe('1');
  });

  it('Supabase 환경이 없어도 수동 이벤트는 동작한다', async () => {
    mocks.hasEnv = false;
    await renderLauncher();
    act(() => openSystemGuide());
    expect(guide()?.getAttribute('data-step')).toBe('0');
  });

  it.each(['/login', '/signup', '/auth', '/auth/callback', '/pay', '/membership/checkout', '/privacy', '/admin/analytics'])('자동 실행 모달은 %s로 이동하면 닫힌다', async (pathname) => {
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    expect(guide()).not.toBeNull();
    await navigate(pathname);
    expect(guide()).toBeNull();
  });

  it('수동 실행 모달은 인증 경로로 이동해도 유지된다', async () => {
    await renderLauncher();
    act(() => openSystemGuide(2));
    await navigate('/auth/callback');
    expect(guide()?.getAttribute('data-step')).toBe('2');
  });

  it('localStorage 읽기가 실패하면 자동 실행은 닫고 수동 실행은 허용한다', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    expect(guide()).toBeNull();
    act(() => openSystemGuide(1));
    expect(guide()).not.toBeNull();
    getItem.mockRestore();
  });

  it('localStorage 쓰기가 실패하면 자동 실행은 닫고 수동 실행은 허용한다', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    mocks.user = { id: 'user-1' };
    await renderLauncher();
    expect(guide()).toBeNull();
    act(() => openSystemGuide(1));
    expect(guide()).not.toBeNull();
    setItem.mockRestore();
  });

  it('getUser rejection을 처리해 unhandled rejection을 만들지 않는다', async () => {
    const unhandled = vi.fn();
    window.addEventListener('unhandledrejection', unhandled);
    mocks.getUser.mockRejectedValueOnce(new Error('network'));
    await renderLauncher();
    await act(async () => { await Promise.resolve(); });
    expect(guide()).toBeNull();
    expect(unhandled).not.toHaveBeenCalled();
    window.removeEventListener('unhandledrejection', unhandled);
  });
});
