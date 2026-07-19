'use client';

import Link from 'next/link';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';
import { openSystemGuide } from './system-guide-events';

export function SystemGuidePage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5 sm:space-y-6">
        <GangiPageHeader title="사용방법" backHref="/" />

        <section
          className="rounded-[20px] border px-5 py-6 sm:px-7 sm:py-8"
          style={{
            borderColor: 'var(--app-pink-line)',
            background: 'var(--app-pink-soft)',
          }}
        >
          <p className="text-[12.6px] font-extrabold tracking-[0.04em] text-[var(--app-pink-strong)]">
            처음 오셨나요?
          </p>
          <h1
            className="mt-2 text-[27.6px] font-extrabold leading-tight tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            간지사주 사용방법
          </h1>
          <p
            className="mt-3 max-w-2xl text-[15.5px] leading-[1.7] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            내 정보 등록부터 알림 확인까지, 필요한 순서대로 따라 해보세요. 원하는 단계부터 바로 시작해도 괜찮아요.
          </p>
        </section>

        <section aria-labelledby="guide-steps-title">
          <div className="px-1">
            <p className="text-[12.6px] font-extrabold tracking-[0.04em] text-[var(--app-pink-strong)]">
              6단계 안내
            </p>
            <h2 id="guide-steps-title" className="mt-1 text-[20.7px] font-extrabold text-[var(--app-ink)]">
              하나씩 시작해 보세요
            </h2>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {SYSTEM_GUIDE_STEPS.map((step) => (
              <article
                key={step.id}
                data-system-guide-step={step.id}
                className="flex min-h-[230px] flex-col rounded-[18px] border bg-white p-5 shadow-[0_16px_38px_-28px_rgba(17,17,20,0.32)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <p className="text-[12.6px] font-extrabold tracking-[0.04em] text-[var(--app-pink-strong)]">
                  {step.eyebrow}
                </p>
                <h3
                  className="mt-2 text-[18.4px] font-extrabold leading-snug text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-2 text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {step.description}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Link
                    href={step.primaryHref}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] bg-[var(--app-pink)] px-4 text-[14px] font-extrabold text-white"
                  >
                    {step.primaryLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {step.secondaryHref && step.secondaryLabel ? (
                    <Link
                      href={step.secondaryHref}
                      className="inline-flex min-h-11 items-center justify-center rounded-[12px] border bg-white px-4 text-[14px] font-extrabold text-[var(--app-copy-muted)]"
                      style={{ borderColor: 'var(--app-line)' }}
                    >
                      {step.secondaryLabel}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-[var(--app-line)] bg-white p-5 text-center sm:p-6">
          <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">화면을 보며 차근차근 따라갈까요?</h2>
          <p className="mt-1.5 text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]">
            첫 단계부터 짧은 안내를 다시 열어드릴게요.
          </p>
          <button
            type="button"
            onClick={() => openSystemGuide(0)}
            className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--app-pink)] px-6 text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.26)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            처음부터 안내 보기
          </button>
        </section>
      </AppPage>
    </AppShell>
  );
}
