// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_GUIDE_STORAGE_KEY } from './system-guide-state';

const mocks = vi.hoisted(() => ({
  pathname: '/',
}));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
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
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('SystemGuideLauncher (수동 전용)', () => {
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
  ])('안내 제외 경로 %s => %s', (pathname, expected) => {
    expect(isSystemGuideAutoExcludedPath(pathname)).toBe(expected);
  });

  it('마운트만으로는 절대 자동으로 열리지 않는다(회귀 가드: 자동 실행 제거)', async () => {
    await renderLauncher();
    expect(guide()).toBeNull();
  });

  it('new/in_progress 저장 상태가 있어도 마운트에서 자동으로 열지 않는다', async () => {
    state('in_progress', 2);
    await renderLauncher();
    expect(guide()).toBeNull();
  });

  it('수동 이벤트는 저장 상태와 무관하게 유효한 지정 단계에서 연다', async () => {
    state('completed', 5);
    await renderLauncher();
    act(() => openSystemGuide(2));
    expect(guide()?.getAttribute('data-step')).toBe('2');
  });

  it('수동 이벤트의 잘못된 단계는 0으로 보정한다', async () => {
    await renderLauncher();
    act(() => openSystemGuide(999));
    expect(guide()?.getAttribute('data-step')).toBe('0');
    act(() => openSystemGuide());
    expect(guide()?.getAttribute('data-step')).toBe('0');
  });

  it('단계 이동, 닫기, 완료 상태를 저장한다', async () => {
    await renderLauncher();
    act(() => openSystemGuide(0));
    click('step');
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({ status: 'in_progress', stepIndex: 3 });
    click('dismiss');
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({ status: 'dismissed', stepIndex: 3 });

    act(() => openSystemGuide(5));
    click('complete');
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({ status: 'completed', stepIndex: 5 });
  });

  it('수동 워크스루 중 기능 이동 후 browser back으로 origin에 돌아오면 저장 단계를 재개한다', async () => {
    await renderLauncher();
    act(() => openSystemGuide(0));
    click('navigate');
    expect(guide()).toBeNull();
    expect(JSON.parse(localStorage.getItem(SYSTEM_GUIDE_STORAGE_KEY)!)).toMatchObject({
      status: 'in_progress',
      stepIndex: 3,
    });

    await navigate('/saju/new');
    expect(guide()).toBeNull();

    await navigate('/');
    expect(guide()?.getAttribute('data-step')).toBe('3');
  });

  it('query만 다른 같은 pathname CTA는 pending을 만들지 않아 이후 재개하지 않는다', async () => {
    mocks.pathname = '/guide';
    await renderLauncher();
    act(() => openSystemGuide(2));
    click('same-route');
    expect(guide()).toBeNull();

    await navigate('/saju/new');
    await navigate('/guide');
    expect(guide()).toBeNull();
  });

  it('수동 실행 모달은 인증/제외 경로로 이동해도 유지된다', async () => {
    await renderLauncher();
    act(() => openSystemGuide(2));
    await navigate('/auth/callback');
    expect(guide()?.getAttribute('data-step')).toBe('2');
  });

  it('localStorage 읽기·쓰기가 막혀 있어도 수동 실행은 동작한다', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await renderLauncher();
    act(() => openSystemGuide(1));
    expect(guide()?.getAttribute('data-step')).toBe('1');
    click('dismiss');
    expect(guide()).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
