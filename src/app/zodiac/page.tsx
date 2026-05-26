// Redesign 2026-05-17 — PageHero / SectionSurface / SectionHeader / FeatureCard / ActionCluster
// layout component → inline + design token + Tailwind utility (PR #193 credits/success
// CenteredCard 패턴 + PR #198 saju/today-detail 패턴). 비즈니스 로직 (profile / featured /
// personalized slug 계산) 무수정.
import Link from 'next/link';
import type { Metadata } from 'next';
import { ZODIAC_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildZodiacSlugFromProfile } from '@/lib/profile-personalization';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GANGI_ZODIAC, GangiCharacter, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacBirthCheck } from './zodiac-birth-check';

export const metadata: Metadata = {
  title: '내 띠 운세',
  description:
    '생년월일과 입춘 기준으로 내 띠를 먼저 확인하고 오늘의 흐름을 가볍게 살펴보세요.',
  alternates: {
    canonical: '/zodiac',
  },
};

export default async function ZodiacPage() {
  const profile = await getOptionalSignedInProfile();
  const personalizedSlug = buildZodiacSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const featured =
    personalizedSlug ? ZODIAC_FORTUNES.find((item) => item.slug === personalizedSlug) ?? null : null;
  const featuredMeta = featured ? ZODIAC_META[featured.slug as keyof typeof ZODIAC_META] : null;
  const hasPersonalizedProfile = Boolean(profile && personalizedSlug);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5 sm:space-y-6">
        <GangiPageHeader title="내 띠 운세" backHref="/free" />

        {/* Hero — pink-soft badge + title */}
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
              띠운세
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                border: '1px solid var(--app-line)',
                background: '#ffffff',
                color: 'var(--app-copy-muted)',
              }}
            >
              빠른 무료 탐색
            </span>
          </div>
          <h1
            className="mt-3 text-[24px] font-extrabold leading-tight tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            내 띠 하나를 먼저 봅니다
          </h1>
        </section>

        {/* 12띠 선택 grid — pink-soft panel */}
        <section
          className="mx-[0.25rem]"
          style={{
            border: '1px solid var(--app-pink-line)',
            borderRadius: '1.25rem',
            background: 'var(--app-pink-soft)',
            padding: '1.1rem 1rem',
            boxShadow: '0 14px 32px -28px rgba(216, 27, 114, 0.32)',
          }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
            style={{ color: 'var(--app-pink-strong)' }}
          >
            12띠 바로 선택
          </div>
          <h2
            className="mt-1.5 text-[16px] font-extrabold tracking-tight"
            style={{ color: 'var(--app-ink)' }}
          >
            띠를 골라 오늘운을 보세요
          </h2>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {GANGI_ZODIAC.map((zodiac) => (
              <Link
                key={zodiac.key}
                href={`/zodiac/${zodiac.key}`}
                className="rounded-[0.9rem] bg-white px-2 py-3 text-center transition"
                style={{ border: '1px solid var(--app-line)' }}
              >
                <GangiCharacter zodiac={zodiac.key} size="sm" className="mx-auto" />
                <span
                  className="mt-1.5 block text-[11px] font-bold"
                  style={{ color: 'var(--app-ink)' }}
                >
                  {zodiac.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 추천 띠 card — featured 있으면 detail, 없으면 안내 */}
        <section
          className="mx-[0.25rem] text-center"
          style={{
            border: '1px solid rgba(17, 17, 20, 0.08)',
            borderRadius: '1.25rem',
            background: '#ffffff',
            padding: '1.4rem 1.1rem',
            boxShadow: '0 16px 38px -28px rgba(17, 17, 20, 0.32)',
          }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
            style={{ color: 'var(--app-pink-strong)' }}
          >
            {hasPersonalizedProfile ? '내 띠' : '생년월일로 확인'}
          </div>
          <h2
            className="mt-1.5 text-[20px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            {hasPersonalizedProfile && featured ? `내 띠는 ${featured.label}` : '내 띠를 자동으로 맞춰볼까요?'}
          </h2>
          <div className="mt-4 text-[48px]" aria-hidden="true">
            {featuredMeta?.symbol ?? '🎂'}
          </div>
          {featured && featuredMeta ? (
            <article
              className="mx-auto mt-5 max-w-[28rem] rounded-[14px] p-4 text-left"
              style={{
                border: '1px solid var(--app-pink-line)',
                background: 'var(--app-pink-soft)',
              }}
            >
              <div
                className="text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                {featured.label}의 2026년
              </div>
              <p
                className="mt-1.5 text-[13px] leading-[1.7]"
                style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
              >
                {featuredMeta.yearlyMessage}. {featured.todayFocus}
              </p>
            </article>
          ) : (
            <ZodiacBirthCheck />
          )}
        </section>

        {/* 하단 CTA — featured면 내 띠 바로 보기, 사주 프로필 있으면 사주로 이어보기 */}
        {featured || readingSlug ? (
          <div className="mx-[0.25rem] grid gap-2 sm:grid-cols-2">
            {featured ? (
              <Link
                href={`/zodiac/${featured.slug}`}
                className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[13.5px] font-extrabold text-white"
                style={{
                  background: 'var(--app-pink)',
                  boxShadow: '0 12px 28px rgba(216, 27, 114, 0.32)',
                }}
              >
                내 띠 바로 보기 →
              </Link>
            ) : null}
            {readingSlug ? (
              <Link
                href={`/saju/${readingSlug}`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-[13.5px] font-extrabold"
                style={{
                  border: '1px solid var(--app-line)',
                  color: 'var(--app-ink)',
                  boxShadow: '0 12px 28px -24px rgba(17, 17, 20, 0.32)',
                }}
              >
                내 사주로 이어보기
              </Link>
            ) : null}
          </div>
        ) : null}
      </AppPage>
    </AppShell>
  );
}
