// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';

const mocks = vi.hoisted(() => ({ openSystemGuide: vi.fn() }));

vi.mock('./system-guide-events', () => ({
  openSystemGuide: mocks.openSystemGuide,
}));
vi.mock('@/features/shared-navigation/site-header', () => ({ default: () => <header /> }));
vi.mock('@/components/gangi/gangi-ui', () => ({
  GangiPageHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('@/shared/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  AppPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { SystemGuidePage } from './system-guide-page';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mocks.openSystemGuide.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<SystemGuidePage />));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

describe('SystemGuidePage', () => {
  it('사용방법 제목과 여섯 단계 카드를 모두 보여준다', () => {
    expect(document.querySelector('h1')?.textContent).toContain('사용방법');
    expect(document.querySelectorAll('[data-system-guide-step]')).toHaveLength(6);

    for (const step of SYSTEM_GUIDE_STEPS) {
      expect(document.body.textContent).toContain(step.title);
    }
  });

  it('각 단계의 이동 링크가 승인된 실제 경로를 가리킨다', () => {
    for (const step of SYSTEM_GUIDE_STEPS) {
      expect(document.querySelector(`a[href="${step.primaryHref}"]`)?.textContent).toContain(step.primaryLabel);
    }
  });

  it('처음부터 안내 보기는 첫 단계 수동 안내를 연다', () => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (element) => element.textContent?.trim() === '처음부터 안내 보기',
    );
    if (!button) throw new Error('처음부터 안내 보기 버튼 없음');

    act(() => button.click());

    expect(mocks.openSystemGuide).toHaveBeenCalledOnce();
    expect(mocks.openSystemGuide).toHaveBeenCalledWith(0);
  });

  it('알림 단계에서 알림과 멤버십 경로를 함께 제공한다', () => {
    const notificationStep = document.querySelector('[data-system-guide-step="notifications"]');
    expect(notificationStep?.querySelector('a[href="/notifications"]')).not.toBeNull();
    expect(notificationStep?.querySelector('a[href="/membership"]')).not.toBeNull();
  });
});
