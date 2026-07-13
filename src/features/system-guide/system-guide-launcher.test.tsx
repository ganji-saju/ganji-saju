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
}));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/lib/supabase/client', () => ({
  get hasSupabaseBrowserEnv() { return mocks.hasEnv; },
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mocks.user } })),
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
    onDismiss: (index: number) => void;
    onComplete: () => void;
  }) => props.open ? (
    <div data-testid="guide" data-step={props.initialStepIndex}>
      <button onClick={() => props.onStepChange(3)}>step</button>
      <button onClick={() => props.onDismiss(props.initialStepIndex)}>dismiss</button>
      <button onClick={props.onComplete}>complete</button>
    </div>
  ) : null,
}));

import { openSystemGuide } from './system-guide-events';
import { SystemGuideLauncher } from './system-guide-launcher';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

function state(status: string, stepIndex = 0) {
  localStorage.setItem(SYSTEM_GUIDE_STORAGE_KEY, JSON.stringify({ version: 1, status, stepIndex }));
}

async function renderLauncher() {
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

  it('수동 이벤트는 인증과 저장 상태에 관계없이 유효한 지정 단계에서 연다', async () => {
    state('completed', 5);
    await renderLauncher();
    act(() => openSystemGuide(2));
    expect(guide()?.getAttribute('data-step')).toBe('2');
    act(() => openSystemGuide(999));
    expect(guide()?.getAttribute('data-step')).toBe('0');
  });

  it.each(['/login', '/signup', '/auth/callback'])('%s에서는 자동 실행을 막고 수동 실행은 허용한다', async (pathname) => {
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
});
