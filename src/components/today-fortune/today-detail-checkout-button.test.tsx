// @vitest-environment jsdom
// 2026-09-14 — 로그아웃 상태로 하루 1회에 막힌 프리미엄 멤버가 결제 버튼 → 로그인으로 결제 화면에 오면
//   3,300원을 또 내는 대신 멤버십으로 연다. 상세는 표식이 있어야 POST unlock(혜택 기록)으로 연다.
import fs from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { MemberTodayDetailOpenButton } from './today-detail-checkout-button';
import { consumePendingUnlock } from '@/lib/today-fortune/unlock-marker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('결제 화면 — 멤버십 포함 오늘 자세히', () => {
  it('누르면 그 reading 에 열기 표식을 남기고 상세로 간다', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const href = '/today-fortune/detail?paid=today-detail&sourceSessionId=reading-dad&from=limit';
    await act(async () => root.render(<MemberTodayDetailOpenButton slug="reading-dad" href={href} />));
    await act(async () => host.querySelector('button')!.click());
    expect(push).toHaveBeenCalledWith(href);
    expect(consumePendingUnlock('reading-dad')).toBe(true);
    act(() => root.unmount());
  });

  it('배선 — 결제 화면이 today-detail 에서 프리미엄 멤버를 판정해 결제창 대신 열기 버튼을 둔다', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/membership/checkout/page.tsx'), 'utf8');
    expect(page).toMatch(
      /selectedProduct === 'today-detail' &&\s*slug &&\s*\(await computeMemberFreeEligible\(user\.id, selectedProduct, await getMemberTier\(user\.id\)\)\)/
    );
    // 결제창(TossMembershipCheckout) 분기보다 앞에서 걸러야 한다.
    expect(page.indexOf('<MemberTodayDetailOpenButton')).toBeGreaterThan(0);
    expect(page.indexOf('<MemberTodayDetailOpenButton')).toBeLessThan(page.indexOf('<TossMembershipCheckout'));
  });
});
