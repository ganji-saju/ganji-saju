// Redesign 2026-05-17 — PageHero / SectionSurface / SectionHeader / FeatureCard /
// ProductGrid / ActionCluster → inline + design token + Tailwind utility
// (PR #193 / #198 / #206 / #207 와 동일 패턴).
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '명리',
  description: '타고난 기질, 다섯 기운, 반복되는 관계 패턴을 쉬운 말로 확인하는 달빛인생 명리 화면입니다.',
  alternates: {
    canonical: '/myeongri',
  },
};

const EXPLORATIONS = [
  {
    title: '타고난 기질',
    body: '내가 어떤 상황에서 편해지고, 어떤 장면에서 예민해지는지 기본 결을 살펴봅니다.',
    hook: '나는 어떤 결의 사람인가',
    href: '/saju/new',
    badge: '기질',
  },
  {
    title: '다섯 기운의 균형',
    body: '무엇이 넘치고 무엇이 부족한지, 일상에서 어떤 방식으로 힘이 붙거나 빠지는지 살펴봅니다.',
    hook: '내 안의 다섯 기운은 어디서 흔들리는가',
    href: '/saju/new',
    badge: '균형',
  },
  {
    title: '반복되는 관계 패턴',
    body: '돈, 일, 사람, 책임이 내 삶에서 어떤 모습으로 반복되는지 쉽게 풀어봅니다.',
    hook: '왜 늘 비슷한 관계와 역할이 반복되는가',
    href: '/myeongri/ten-gods',
    badge: '패턴',
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

export default async function MyeongriPage() {
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5 sm:space-y-6">
        <GangiPageHeader title="명리" backHref="/" />

        {/* Hero */}
        <section className="px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold"
              style={{
                border: '1px solid var(--app-pink-line)',
                background: 'var(--app-pink-soft)',
                color: 'var(--app-pink-strong)',
              }}
            >
              명리 쉽게 보기
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                border: '1px solid var(--app-line)',
                background: '#ffffff',
                color: 'var(--app-copy-muted)',
              }}
            >
              일간 · 오행 · 십신
            </span>
          </div>
          <h1
            className="mt-3 text-[24px] font-extrabold leading-tight tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            내 안에서 반복되는 패턴을 바로 봅니다
          </h1>
          <p
            className="mt-2 text-[14px] leading-[1.7]"
            style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
          >
            긴 개념 설명 대신, 내 결과로 이어지는 입구만 남겼습니다.
          </p>
        </section>

        {/* §1 내 패턴의 바탕 */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>내 패턴의 바탕</div>
          <h2
            className="mt-1.5 text-[20px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            반복되는 장면의 이유를 내 사주 위에서 확인합니다
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {EXPLORATIONS.map((item) => (
              <div key={item.title} style={SOFT_FEATURE_STYLE}>
                <div
                  className="text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  {item.badge}
                </div>
                <h3
                  className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight"
                  style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-1.5 text-[12.5px] leading-[1.65]"
                  style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                >
                  {item.hook}
                </p>
              </div>
            ))}
          </div>
        </article>

        {/* §2 내 사주로 이어보기 (로그인 + reading 있을 때) */}
        {readingSlug ? (
          <article className="mx-[0.25rem]" style={PANEL_STYLE}>
            <div style={KICKER_STYLE}>내 사주로 이어보기</div>
            <h2
              className="mt-1.5 text-[20px] font-extrabold leading-snug tracking-tight"
              style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
            >
              내 사주 위에서 바로 확인할 수 있습니다
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={`/saju/${readingSlug}`}
                className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[13.5px] font-extrabold text-white"
                style={{
                  background: 'var(--app-pink)',
                  boxShadow: '0 12px 28px rgba(216, 27, 114, 0.32)',
                }}
              >
                내 통합 결과 보기
              </Link>
              <Link
                href={`/saju/${readingSlug}/elements`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-[13.5px] font-extrabold"
                style={{
                  border: '1px solid var(--app-line)',
                  color: 'var(--app-ink)',
                  boxShadow: '0 12px 28px -24px rgba(17, 17, 20, 0.32)',
                }}
              >
                내 오행 바로 보기
              </Link>
            </div>
          </article>
        ) : null}

        {/* §3 탐구 주제 — 같은 EXPLORATIONS 의 href Link 형식 */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>탐구 주제</div>
          <h2
            className="mt-1.5 text-[20px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            명리 안에서 가장 자주 다시 보게 되는 세 가지
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {EXPLORATIONS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="block rounded-[0.95rem] transition"
                style={{
                  border: '1px solid var(--app-line)',
                  background: '#ffffff',
                  padding: '0.95rem',
                }}
              >
                <div
                  className="text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  {item.badge}
                </div>
                <h3
                  className="mt-1 text-[14px] font-extrabold leading-snug tracking-tight"
                  style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-1.5 text-[12.5px] leading-[1.65]"
                  style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
                >
                  {item.hook} →
                </p>
              </Link>
            ))}
          </div>
        </article>
      </AppPage>
    </AppShell>
  );
}
