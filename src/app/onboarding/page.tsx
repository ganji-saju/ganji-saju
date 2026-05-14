// 2026-05-15 handoff PR-H: 보드 `onboarding` (26) SHELL 라우트.
// 4 슬라이드 carousel + skip CTA visual stub. first-visit cookie / redirect 흐름은
// 후속 PR (실 기능). 현재는 layout + mock data + "준비 중" badge.
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export const metadata: Metadata = {
  title: '온보딩 (준비 중)',
  description: '간지사주 시작 가이드 — 4개 슬라이드로 핵심 기능을 안내합니다.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/onboarding' },
};

const SLIDES = [
  {
    eyebrow: '01 / 04',
    title: '생년월일 한 번이면 충분해요',
    body: '시간 모르셔도 괜찮아요. 양력/음력 자동 변환하고 출생지 보정까지 함께 해드립니다.',
    icon: '生',
  },
  {
    eyebrow: '02 / 04',
    title: '오늘 흐름과 깊은 풀이',
    body: '오늘운세는 무료로, 깊은 사주 풀이는 작은 코인이나 1회 결제로 열어볼 수 있어요.',
    icon: '今',
  },
  {
    eyebrow: '03 / 04',
    title: '대화로 더 묻기',
    body: '풀이 결과를 바탕으로 선생님과 대화하며 다음 행동을 함께 잡아갈 수 있어요.',
    icon: '話',
  },
  {
    eyebrow: '04 / 04',
    title: '오늘부터 시작하세요',
    body: '결과는 항상 보관함에 남고, 알림으로 매일 한 줄씩 받아볼 수도 있습니다.',
    icon: '始',
  },
];

export default function OnboardingShellPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="시작 가이드" backHref="/" />

        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-white"
              style={{ background: 'var(--app-amber)' }}
            >
              준비 중
            </span>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              4 슬라이드 가이드
            </div>
          </div>
          <h1
            className="mt-2 text-[20px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            처음 오셨다면 1분만 살펴보세요
          </h1>
          <p
            className="mt-2 text-[12.5px] leading-[1.7] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            아직 자동 노출 흐름은 준비 중입니다. 현재는 시안만 살펴볼 수 있어요.
          </p>
        </article>

        <section className="grid gap-3">
          {SLIDES.map((slide) => (
            <article
              key={slide.eyebrow}
              className="rounded-[18px] border bg-white p-5"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] text-white"
                  style={{
                    background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                    fontFamily: 'var(--font-han)',
                    fontSize: 28,
                    fontWeight: 700,
                    boxShadow: '0 10px 22px rgba(216,27,114,0.28)',
                  }}
                  aria-hidden="true"
                >
                  {slide.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                    {slide.eyebrow}
                  </div>
                  <h2
                    className="mt-1 text-[15px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {slide.title}
                  </h2>
                  <p
                    className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--app-copy)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {slide.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <div className="grid gap-2">
          <Link
            href="/saju/new"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            사주 입력하고 시작하기
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border bg-white px-5 text-[13px] font-bold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            나중에
          </Link>
        </div>
      </AppPage>
    </AppShell>
  );
}
