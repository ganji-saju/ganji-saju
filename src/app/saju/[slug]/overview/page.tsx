import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, Lock } from 'lucide-react';
import { SwipeSectionDeck, SwipeSectionSlide } from '@/components/layout/swipe-section-deck';
import { Badge } from '@/components/ui/badge';
import { SAJU_BASIC_SECTIONS, SAJU_PREMIUM_SECTIONS } from '@/content/moonlight';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import {
  formatBirthSummary,
  formatHiddenStems,
  getPillarEntries,
} from '@/features/saju-detail/saju-screen-helpers';
import SiteHeader from '@/features/shared-navigation/site-header';
import { resolveReading } from '@/lib/saju/readings';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '사주',
    description: '사주 원국과 기본 해석 진입 화면입니다.',
    robots: { index: false, follow: false },
  };
}

const PILLAR_LABELS: Record<string, string> = {
  '년': '년주 (年柱)',
  '월': '월주 (月柱)',
  '일': '일주 (日柱)',
  '시': '시주 (時柱)',
};

export default async function SajuOverviewPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const { input, sajuData } = reading;
  const pillars = getPillarEntries(sajuData);

  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <SajuScreenNav slug={slug} current="overview" />

        {/* ─── HERO ─── */}
        <section className="moon-lunar-panel p-8 sm:p-10">
          <div className="app-starfield" />
          <div className="relative z-10 flex flex-col items-center gap-5 text-center lg:flex-row lg:text-left lg:items-end lg:justify-between">
            <div>
              <div className="font-hanja text-[10px] tracking-[0.62em] text-[var(--app-gold)]/60">四 柱 命 理</div>
              <h1 className="mt-4 font-display text-5xl font-semibold text-[var(--app-gold-text)] sm:text-6xl">
                사주
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 text-[var(--app-copy-muted)]">
                태어난 년·월·일·시의 네 기둥에 깃든 하늘의 결을 읽어드립니다.
              </p>
              <p className="mt-2 text-sm text-[var(--app-copy-soft)]">{formatBirthSummary(input)}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="app-moon-orb h-16 w-16" />
              <div className="text-xs tracking-[0.42em] text-[var(--app-gold-soft)]">
                일간 <span className="font-hanja">{sajuData.dayMaster.stem}</span>
              </div>
            </div>
          </div>
        </section>

        <SwipeSectionDeck
          title="사주 기본 화면을 한 장씩 넘겨 봅니다"
          description="사주 기본표와 해석 진입을 분리해 처음 보는 화면의 부담을 줄였습니다."
        >
          <SwipeSectionSlide
            eyebrow="기본표"
            title="사주 기본표 네 기둥"
            description="년·월·일·시의 기본 구조를 먼저 확인합니다."
            navLabel="기본표"
          >
            {/* ─── 사주 기본표 4기둥 ─── */}
            <section className="app-panel p-6 sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="app-caption">사주 기본표</div>
              <h2 className="mt-2 font-display text-2xl text-[var(--app-ivory)]">
                선생님의 四柱
              </h2>
            </div>
            <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]">
              일간 {sajuData.dayMaster.stem}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {pillars.map(({ label, pillar }) => {
              const isDay = label === '일';
              return (
                <article
                  key={label}
                  className={`rounded-[1.35rem] border px-4 py-5 text-center transition-colors ${
                    isDay
                      ? 'border-[var(--app-gold)]/42 bg-[linear-gradient(180deg,rgba(212,176,106,0.16),rgba(12,16,28,0.96))] shadow-[0_0_28px_rgba(212,176,106,0.1)]'
                      : 'border-[var(--app-line)] bg-[var(--app-surface-muted)]'
                  }`}
                >
                  <div className={`text-[10px] tracking-[0.28em] ${isDay ? 'text-[var(--app-gold)]' : 'text-[var(--app-copy-soft)]'}`}>
                    {PILLAR_LABELS[label] ?? label}
                  </div>
                  {isDay && <div className="mt-1 text-[9px] tracking-[0.18em] text-[var(--app-gold)]/60">나의 본질</div>}

                  {/* 천간 */}
                  <div className={`mt-4 border-b pb-3 ${isDay ? 'border-[var(--app-gold)]/20' : 'border-[var(--app-line)]'}`}>
                    <div className="text-[9px] tracking-[0.2em] text-[var(--app-copy-soft)]">천간</div>
                    <div className={`font-hanja mt-1 text-4xl font-semibold ${isDay ? 'text-[var(--app-gold-text)]' : 'text-[var(--app-ivory)]'}`}>
                      {pillar?.stem ?? '?'}
                    </div>
                  </div>

                  {/* 지지 */}
                  <div className="mt-3">
                    <div className="text-[9px] tracking-[0.2em] text-[var(--app-copy-soft)]">지지</div>
                    <div className="font-hanja mt-1 text-3xl font-semibold text-[var(--app-ivory)]">
                      {pillar?.branch ?? '?'}
                    </div>
                    {pillar && (
                      <div className="font-hanja mt-2 text-[10px] text-[var(--app-copy-soft)]">
                        {formatHiddenStems(pillar) ?? '—'}
                      </div>
                    )}
                    {!pillar && (
                      <div className="mt-2 text-[10px] text-[var(--app-copy-soft)]">미입력</div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-[var(--app-gold)]/16 bg-[var(--app-surface-muted)] px-5 py-4 text-sm leading-8 text-[var(--app-copy)]">
            일간{' '}
            <span className="font-hanja text-base text-[var(--app-gold-text)]">
              {sajuData.dayMaster.stem}
            </span>
            은 {sajuData.dayMaster.metaphor ?? '자연의 상징'}로 읽습니다.{' '}
            {sajuData.dayMaster.description}
          </div>
            </section>
          </SwipeSectionSlide>

          <SwipeSectionSlide
            eyebrow="다음 선택"
            title="기본 해석과 깊은 사주풀이"
            description="무료 기본 해석과 보관형 풀이 진입을 한 화면에서 고릅니다."
            navLabel="해석"
          >
            {/* ─── 기본 해석 + 깊은 사주풀이 ─── */}
            <section className="grid gap-5 lg:grid-cols-[1fr_0.96fr]">

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-[var(--app-ivory)]">기본 해석</h2>
              <Badge className="border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 text-[var(--app-jade)]">무료</Badge>
            </div>

            {SAJU_BASIC_SECTIONS.map((section, index) => (
              <Link
                key={section.slug}
                href={
                  section.slug === 'nature'
                    ? `/saju/${slug}/nature`
                    : section.slug === 'elements'
                      ? `/saju/${slug}/elements`
                      : `/saju/${slug}`
                }
                className="moon-wisdom-link-card group flex items-start gap-4"
                data-tone="gold"
              >
                <div className="font-hanja flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--app-gold)]/22 bg-[var(--app-gold)]/8 text-sm text-[var(--app-gold-text)]">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-[var(--app-ivory)]">{section.title}</div>
                  <p className="mt-1.5 text-sm leading-7 text-[var(--app-copy-muted)]">{section.description}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-copy-soft)] opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>

          {/* 깊은 사주풀이 paywall */}
          <article className="moon-lunar-panel p-6">
            <div className="app-starfield" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="app-caption">깊은 사주풀이</div>
                <span className="rounded-full border border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--app-gold-text)]">
                  PREMIUM
                </span>
              </div>
              <div className="mt-3 font-display text-2xl text-[var(--app-gold-text)]">
                나의 깊은 사주풀이
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
                7가지 항목을 평생 소장용 풀이로 정리합니다. 타고난 성향, 올해 흐름, 재물·일·관계 조언까지 한 번에 이어집니다.
              </p>

              <div className="mt-5 space-y-2">
                {SAJU_PREMIUM_SECTIONS.map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-3 rounded-[1rem] border px-4 py-3 text-sm ${
                      i < 2
                        ? 'border-[var(--app-gold)]/18 bg-[var(--app-gold)]/6 text-[var(--app-copy)]'
                        : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]'
                    }`}
                  >
                    {i >= 2 && <Lock className="h-3 w-3 shrink-0 text-[var(--app-copy-soft)]" />}
                    {i < 2 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-gold)]/70" />}
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <Link
                  href={`/saju/${slug}/premium`}
                  className="moon-action-primary"
                >
                  깊은 사주풀이 열기 <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/membership"
                  className="moon-action-secondary moon-action-compact"
                >
                  플랜 비교 보기
                </Link>
              </div>
            </div>
          </article>
            </section>
          </SwipeSectionSlide>
        </SwipeSectionDeck>

      </AppPage>
    </AppShell>
  );
}
