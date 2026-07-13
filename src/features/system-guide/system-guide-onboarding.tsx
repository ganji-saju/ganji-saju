'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  BookOpenText,
  ChartNoAxesCombined,
  MessageCircleMore,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useFocusTrap } from '@/components/common/use-focus-trap';
import {
  SYSTEM_GUIDE_STEPS,
  type SystemGuideStepId,
} from './system-guide-content';

export interface SystemGuideOnboardingProps {
  open: boolean;
  initialStepIndex: number;
  onStepChange: (stepIndex: number) => void;
  onDismiss: (stepIndex: number) => void;
  onComplete: () => void;
}

const STEP_ICONS: Record<SystemGuideStepId, LucideIcon> = {
  profile: UserRound,
  fortune: Sparkles,
  saju: BookOpenText,
  results: ChartNoAxesCombined,
  dialogue: MessageCircleMore,
  notifications: Bell,
};

const LAST_STEP_INDEX = SYSTEM_GUIDE_STEPS.length - 1;

function clampStepIndex(stepIndex: number) {
  return Math.min(LAST_STEP_INDEX, Math.max(0, Math.trunc(stepIndex)));
}

export function SystemGuideOnboarding({
  open,
  initialStepIndex,
  onStepChange,
  onDismiss,
  onComplete,
}: SystemGuideOnboardingProps) {
  const [stepIndex, setStepIndex] = useState(() => clampStepIndex(initialStepIndex));
  const wasOpenRef = useRef(false);
  const trapRef = useFocusTrap<HTMLElement>(open);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStepIndex(clampStepIndex(initialStepIndex));
    }
    wasOpenRef.current = open;
  }, [initialStepIndex, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss(stepIndex);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, open, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const step = SYSTEM_GUIDE_STEPS[stepIndex];
  const StepIcon = STEP_ICONS[step.id];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === LAST_STEP_INDEX;

  function moveTo(nextStepIndex: number) {
    setStepIndex(nextStepIndex);
    onStepChange(nextStepIndex);
  }

  function dismiss() {
    onDismiss(stepIndex);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="사용방법"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="사용방법 닫기"
        data-system-guide-backdrop
        onClick={dismiss}
      />
      <article
        ref={trapRef}
        tabIndex={-1}
        className="relative max-h-[min(calc(100dvh-1.5rem),24rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[22px] border bg-white p-5 shadow-[0_-22px_50px_-18px_rgba(17,17,20,0.32)] focus:outline-none sm:max-h-[calc(100dvh-1.5rem)] sm:p-6"
        style={{
          borderColor: 'var(--app-pink-line)',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="absolute right-3 top-3 grid min-h-11 min-w-11 place-items-center rounded-full text-[var(--app-copy-muted)]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="pr-12">
          <div className="text-[13px] font-extrabold text-[var(--app-pink-strong)]">
            {step.eyebrow} · {stepIndex + 1} / {SYSTEM_GUIDE_STEPS.length}
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {SYSTEM_GUIDE_STEPS.map((item, index) => (
              <span
                key={item.id}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background:
                    index <= stepIndex ? 'var(--app-pink)' : 'var(--app-pink-line)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl text-[var(--app-pink-strong)]"
            style={{ background: 'var(--app-pink-soft)' }}
            aria-hidden="true"
          >
            <StepIcon className="h-7 w-7" />
          </span>
          <h2
            id="system-guide-title"
            className="mt-4 text-[24px] font-extrabold leading-[1.35] tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {step.title}
          </h2>
          <p
            className="mt-2 text-[15px] leading-[1.7] text-[var(--app-copy)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {step.description}
          </p>
        </div>

        <div className="mt-7 grid gap-2">
          <Link
            href={step.primaryHref}
            onClick={dismiss}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16px] font-extrabold text-white"
          >
            {step.primaryLabel}
          </Link>

          {step.secondaryHref && step.secondaryLabel ? (
            <Link
              href={step.secondaryHref}
              onClick={dismiss}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[15px] font-extrabold text-[var(--app-pink-strong)]"
            >
              {step.secondaryLabel}
            </Link>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          {!isFirst ? (
            <button
              type="button"
              onClick={() => moveTo(stepIndex - 1)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border bg-white px-4 font-extrabold text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              이전
            </button>
          ) : null}
          {!isLast ? (
            <button
              type="button"
              onClick={() => moveTo(stepIndex + 1)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border bg-white px-4 font-extrabold text-[var(--app-ink)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              다음
            </button>
          ) : (
            <Link
              href="/"
              onClick={onComplete}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[var(--app-pink)] px-4 font-extrabold text-white"
            >
              간지사주 시작하기
            </Link>
          )}
        </div>
      </article>
    </div>,
    document.body,
  );
}
