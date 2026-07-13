// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemGuideOnboarding } from './system-guide-onboarding';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface RenderOptions {
  open?: boolean;
  initialStepIndex?: number;
  onStepChange?: (stepIndex: number) => void;
  onNavigate?: (stepIndex: number, href: string) => void;
  onDismiss?: (stepIndex: number) => void;
  onComplete?: () => void;
}

let root: Root;
let host: HTMLDivElement;

function renderOnboarding(options: RenderOptions = {}) {
  const props = {
    open: true,
    initialStepIndex: 0,
    onStepChange: vi.fn(),
    onNavigate: vi.fn(),
    onDismiss: vi.fn(),
    onComplete: vi.fn(),
    ...options,
  };

  act(() => {
    root.render(<SystemGuideOnboarding {...props} />);
  });

  return props;
}

function click(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) throw new Error('클릭할 요소가 없습니다.');
  act(() => element.click());
}

function button(name: string) {
  return Array.from(document.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === name || element.getAttribute('aria-label') === name,
  );
}

function link(name: string) {
  return Array.from(document.querySelectorAll('a')).find(
    (element) => element.textContent?.trim() === name,
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('SystemGuideOnboarding', () => {
  it('현재 단계 제목과 진행 정보를 보여준다', () => {
    renderOnboarding();
    expect(document.body.textContent).toContain('내 정보를 먼저 등록해 보세요');
    expect(document.body.textContent).toContain('1 / 6');
  });

  it('dialog의 접근 가능한 이름을 현재 단계 제목에 연결한다', () => {
    renderOnboarding({ initialStepIndex: 2 });
    const dialog = document.querySelector('[role="dialog"]');
    const title = document.querySelector('#system-guide-title');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('system-guide-title');
    expect(dialog?.hasAttribute('aria-label')).toBe(false);
    expect(title?.textContent).toContain('내 사주풀이를 만들어 보세요');
  });

  it('첫 단계에는 이전 버튼이 없고 다음 단계에서 이전과 다음 버튼을 제공한다', () => {
    renderOnboarding();
    expect(button('이전')).toBeUndefined();

    click(button('다음'));

    expect(button('이전')).toBeDefined();
    expect(button('다음')).toBeDefined();
  });

  it('마지막 단계에는 알림, 멤버십, 홈 완료 링크를 모두 제공한다', () => {
    renderOnboarding({ initialStepIndex: 5 });
    expect(document.querySelector('a[href="/notifications"]')?.textContent).toContain('알림 설정');
    expect(document.querySelector('a[href="/membership"]')?.textContent).toContain('멤버십 보기');
    expect(document.querySelector('a[href="/"]')?.textContent).toContain('간지사주 시작하기');
  });

  it.each(['알림 설정', '멤버십 보기'])('%s 기능 이동은 닫기가 아니라 진행 저장 콜백을 호출한다', (label) => {
    const onNavigate = vi.fn();
    const onDismiss = vi.fn();
    renderOnboarding({ initialStepIndex: 5, onNavigate, onDismiss });

    const featureLink = link(label);
    featureLink?.addEventListener('click', (event) => event.preventDefault(), { once: true });
    click(featureLink);

    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledWith(
      5,
      label === '알림 설정' ? '/notifications' : '/membership',
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it.each([
    ['닫기 버튼', () => click(button('닫기'))],
    ['Escape', () => act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))],
    ['배경', () => click(document.querySelector('[data-system-guide-backdrop]'))],
  ])('%s으로 닫으면 현재 단계를 정확히 한 번 전달한다', (_, dismiss) => {
    const onDismiss = vi.fn();
    renderOnboarding({ initialStepIndex: 2, onDismiss });
    dismiss();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(2);
  });

  it('마지막 단계 완료는 onComplete를 호출한다', () => {
    const onComplete = vi.fn();
    renderOnboarding({ initialStepIndex: 5, onComplete });
    const homeLink = link('간지사주 시작하기');
    homeLink?.addEventListener('click', (event) => event.preventDefault(), { once: true });
    click(homeLink);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('열린 동안 초기 단계 변경으로 사용자의 현재 단계를 되감지 않는다', () => {
    const onStepChange = vi.fn();
    renderOnboarding({ onStepChange });
    click(button('다음'));

    act(() => {
      root.render(
        <SystemGuideOnboarding
          open
          initialStepIndex={0}
          onStepChange={onStepChange}
          onNavigate={vi.fn()}
          onDismiss={vi.fn()}
          onComplete={vi.fn()}
        />,
      );
    });

    expect(document.body.textContent).toContain('오늘 흐름부터 가볍게 보세요');
    expect(onStepChange).toHaveBeenCalledWith(1);
  });
});
