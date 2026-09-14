// @vitest-environment jsdom
// 2026-09-14 — 하루 1회에 막힌 입력(가족 등)에 '오늘 자세히' 결제 경로가 붙는지.
//   코드(free_daily_limit)로만 판정하고, 버튼은 무료 결과 없이 그 입력의 reading 으로 체크아웃에 간다.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceProvider } from '@/components/payments/price-provider';
import { formatWon, getTasteProductPackage } from '@/lib/payments/catalog';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';

const mocks = vi.hoisted(() => ({ push: vi.fn(), submitError: null as (Error & { code?: string }) | null }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/features/unified-intake/unified-intake', () => ({
  UnifiedIntake: (props: { onResolve: (p: UnifiedBirthProfile) => void }) => (
    <button data-testid="intake" onClick={() => props.onResolve(FAMILY)}>submit</button>
  ),
}));
vi.mock('@/features/unified-intake/submit-today', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/unified-intake/submit-today')>()),
  submitTodayFromProfile: vi.fn(async () => {
    throw mocks.submitError;
  }),
}));

import { TodayFortuneExperience } from './today-fortune-experience';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FAMILY: UnifiedBirthProfile = {
  name: '아버지',
  calendarType: 'solar',
  year: '1962',
  month: '3',
  day: '2',
  hour: '',
  unknownBirthTime: true,
  gender: 'male',
  birthLocationCode: '',
  birthLocationLabel: '',
  birthLatitude: '',
  birthLongitude: '',
  timeRule: 'standard',
  solarTimeMode: 'standard',
  focusTopic: 'today',
  relationshipStatus: '',
  occupation: '',
  currentConcern: '',
  concernNote: '',
  loadedProfileSource: 'manual',
} as UnifiedBirthProfile;

const pkg = getTasteProductPackage('today-detail')!;
const PRICE = formatWon(pkg.price);
const priceMap = { [pkg.id]: { value: pkg.price, label: PRICE, compareValue: null, compareLabel: null } };

let root: Root;
let host: HTMLDivElement;
const fetchMock = vi.fn();

function limitError(code?: string) {
  return Object.assign(new Error('간단운세는 하루 한 번 볼 수 있어요. 내일 다시 만나요.'), { code });
}

async function renderAndSubmit() {
  await act(async () => {
    root.render(
      <PriceProvider map={priceMap}>
        <TodayFortuneExperience initialConcernId="love_contact" />
      </PriceProvider>
    );
  });
  await act(async () => {
    host.querySelector<HTMLButtonElement>('[data-testid="intake"]')!.click();
  });
}

const payButton = () =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('오늘 자세히 보기'));

describe('오늘운세 하루 1회 차단 화면의 결제 경로', () => {
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mocks.push.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it('free_daily_limit 이면 카탈로그 가격 결제 버튼 → 그 입력의 reading 으로 체크아웃', async () => {
    mocks.submitError = limitError('free_daily_limit');
    await renderAndSubmit();

    const button = payButton();
    expect(button?.textContent).toBe(`${PRICE}으로 오늘 자세히 보기`);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, readingId: 'reading-dad' })));
    await act(async () => {
      button!.click();
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/today-fortune/checkout-reading');
    expect(JSON.parse(init.body)).toMatchObject({ year: '1962', month: '3', day: '2', concernId: 'love_contact' });
    expect(mocks.push).toHaveBeenCalledWith(
      '/membership/checkout?product=today-detail&slug=reading-dad&scope=love_contact&from=today-fortune-limit'
    );
  });

  it('reading 을 못 받으면 결제 화면으로 가지 않고 안내만 보인다', async () => {
    mocks.submitError = limitError('free_daily_limit');
    await renderAndSubmit();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: '오류' }), { status: 500 }));
    await act(async () => {
      payButton()!.click();
    });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(host.textContent).toContain('오류');
    expect(payButton()?.disabled).toBe(false);
  });

  it('다른 오류(입력 오류 등)엔 결제 버튼을 붙이지 않는다', async () => {
    mocks.submitError = limitError(undefined);
    await renderAndSubmit();
    expect(payButton()).toBeUndefined();
  });
});
