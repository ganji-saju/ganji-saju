// @vitest-environment jsdom
// 2026-09-14 — /start 에서 오늘운세가 하루 1회(free_daily_limit)에 막히면 그 입력의 오늘 자세히 결제 버튼이 붙는다.
//   딥링크(?next=today) 화면과 선택 화면(?next 없음) 두 곳 모두. 다른 오류엔 붙이지 않는다(코드로만 판정).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';

const mocks = vi.hoisted(() => ({
  next: 'today' as string | null,
  submitError: null as (Error & { code?: string }) | null,
}));
const FAMILY = { name: '아버지', year: '1962', month: '3', day: '2' } as UnifiedBirthProfile;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => mocks.next }),
}));
vi.mock('@/shared/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AppPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/unified-intake/unified-intake', () => ({
  UnifiedIntake: (props: { onResolve: (p: UnifiedBirthProfile) => void }) => (
    <button data-testid="intake" onClick={() => props.onResolve(FAMILY)}>submit</button>
  ),
}));
vi.mock('@/features/unified-intake/intake-choice', () => ({
  IntakeChoice: (props: { onPick: (i: 'today') => void }) => (
    <button data-testid="pick-today" onClick={() => props.onPick('today')}>today</button>
  ),
}));
vi.mock('@/features/unified-intake/submit-saju', () => ({ submitSajuFromProfile: vi.fn() }));
vi.mock('@/features/unified-intake/submit-today', () => ({
  submitTodayFromProfile: vi.fn(async () => {
    throw mocks.submitError;
  }),
}));
vi.mock('@/components/today-fortune/today-detail-checkout-button', () => ({
  TodayDetailCheckoutButton: (props: { profile: UnifiedBirthProfile; from: string }) => (
    <div data-testid="pay" data-from={props.from} data-name={props.profile.name} />
  ),
}));

import StartClient from './start-client';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const click = (testId: string) =>
  act(async () => {
    host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
  });
const limitError = (code?: string) => Object.assign(new Error('간단운세는 하루 한 번 볼 수 있어요.'), { code });

describe('/start 하루 1회 차단 → 오늘 자세히 결제 버튼', () => {
  beforeEach(async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('딥링크(?next=today): free_daily_limit 이면 그 입력으로 버튼', async () => {
    mocks.next = 'today';
    mocks.submitError = limitError('free_daily_limit');
    await act(async () => root.render(<StartClient />));
    await click('intake');
    const pay = host.querySelector('[data-testid="pay"]');
    expect(pay?.getAttribute('data-from')).toBe('start-limit');
    expect(pay?.getAttribute('data-name')).toBe('아버지');
  });

  it('선택 화면(?next 없음): 오늘운세 카드가 막히면 버튼', async () => {
    mocks.next = null;
    mocks.submitError = limitError('free_daily_limit');
    await act(async () => root.render(<StartClient />));
    await click('intake');
    await click('pick-today');
    expect(host.querySelector('[data-testid="pay"]')?.getAttribute('data-from')).toBe('start-limit');
  });

  it('다른 오류엔 버튼이 없다', async () => {
    mocks.next = 'today';
    mocks.submitError = limitError(undefined);
    await act(async () => root.render(<StartClient />));
    await click('intake');
    expect(host.querySelector('[data-testid="pay"]')).toBeNull();
    expect(host.textContent).toContain('하루 한 번');
  });
});
