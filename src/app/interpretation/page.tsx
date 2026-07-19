// Redesign 2026-05-17 — PageHero / SectionSurface / SectionHeader / FeatureCard /
// ProductGrid → inline + design token + Tailwind utility (PR #193 / #198 / #206 / #207).
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { WISDOM_CARDS, toneClasses } from '@/content/moonlight';

export const metadata: Metadata = {
  title: '해석',
  description: '사주, 명리, 타로, 궁합, 별자리, 띠운세 중 지금의 질문에 맞는 해석 입구를 고르실 수 있습니다.',
  alternates: { canonical: '/interpretation' },
};

const QUICK_GUIDE = [
  {
    title: '오래 볼 풀이가 필요할 때',
    body: '사주와 명리에서 나의 바탕, 오행, 대운, 올해 흐름을 먼저 확인합니다.',
    href: '/saju/new',
    cta: '사주 시작',
  },
  {
    title: '상대와의 관계가 궁금할 때',
    body: '내 정보와 상대 정보를 넣고 관계의 흐름, 갈등 지점, 보완점을 봅니다.',
    href: '/compatibility/input',
    cta: '궁합 보기',
  },
  {
    title: '오늘 마음을 가볍게 보고 싶을 때',
    body: '타로, 별자리, 띠운세처럼 부담 없는 입구에서 하루 흐름을 살핍니다.',
    href: '/tarot/daily',
    cta: '가볍게 열기',
  },
] as const;

const PANEL_STYLE = {
  border: '1px solid rgba(17, 17, 20, 0.08)',
  borderRadius: '1.25rem',
  background: '#ffffff',
  padding: '1.4rem 1.15rem',
  boxShadow: '0 16px 38px -28px rgba(17, 17, 20, 0.32)',
} as const;

const SOFT_FEATURE_STYLE = {
  border: '1px solid var(--app-pink-line)',
  borderRadius: '0.95rem',
  background: 'var(--app-pink-soft)',
  padding: '0.95rem',
} as const;

const KICKER_STYLE = {
  color: 'var(--app-pink-strong)',
  fontSize: '0.76rem',
  fontWeight: 760,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
} as const;

export default function InterpretationPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5 sm:space-y-6">
        <GangiPageHeader title="해석" backHref="/" />

        {/* Hero */}
        <section className="px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-[12px] px-2.5 py-1 text-[12.6px] font-extrabold"
              style={{
                border: '1px solid var(--app-pink-line)',
                background: 'var(--app-pink-soft)',
                color: 'var(--app-pink-strong)',
              }}
            >
              해석 허브
            </span>
            <span
              className="inline-flex items-center rounded-[12px] px-2.5 py-1 text-[12.6px] font-bold"
              style={{
                border: '1px solid var(--app-line)',
                background: '#ffffff',
                color: 'var(--app-copy-muted)',
              }}
            >
              바로 선택
            </span>
          </div>
          <h1
            className="mt-3 text-[27.6px] font-extrabold leading-tight tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            지금 궁금한 해석을 바로 고르세요
          </h1>
          <p
            className="mt-2 text-[16.1px] leading-[1.7]"
            style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
          >
            사주·궁합·타로 중 지금 필요한 풀이로 바로 이동합니다.
          </p>
        </section>

        {/* §1 빠른 시작 — 세 가지 길 */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>빠른 시작</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            가장 많이 찾는 세 가지 길
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {QUICK_GUIDE.map((item) => (
              <div key={item.title} style={SOFT_FEATURE_STYLE}>
                <h3
                  className="text-[17.3px] font-extrabold leading-snug tracking-tight"
                  style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-1.5 text-[14.4px] leading-[1.65]"
                  style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                >
                  {item.body}
                </p>
                <Link
                  href={item.href}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[13.8px] font-extrabold"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  {item.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </article>

        {/* §2 해석 입구 — WISDOM_CARDS (사주/명리/타로/궁합/별자리/띠 등) */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>해석 입구</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            필요한 서비스만 골라서 열어보세요
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {WISDOM_CARDS.map((card) => {
              const tone = toneClasses(card.tone);
              return (
                <Link
                  key={card.slug}
                  href={card.href}
                  className="block rounded-[0.95rem] transition"
                  style={{
                    border: '1px solid var(--app-line)',
                    background: '#ffffff',
                    padding: '0.95rem',
                  }}
                >
                  <span
                    className={`text-[12.1px] font-extrabold uppercase tracking-[0.22em] ${tone.text}`}
                  >
                    {card.hanja}
                  </span>
                  <h3
                    className={`mt-1 text-[17.3px] font-extrabold leading-snug tracking-tight ${tone.text}`}
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="mt-1.5 text-[14.4px] leading-[1.65]"
                    style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                  >
                    {card.hook}
                  </p>
                  <span
                    className={`mt-2.5 inline-flex items-center gap-1.5 text-[13.8px] font-extrabold ${tone.text}`}
                  >
                    바로 열기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </article>
      </AppPage>
    </AppShell>
  );
}
