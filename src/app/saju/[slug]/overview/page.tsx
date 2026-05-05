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
  getPillarEntries,
} from '@/features/saju-detail/saju-screen-helpers';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { resolveReading } from '@/lib/saju/readings';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '내 사주',
    description: '내 사주를 쉬운 말로 먼저 확인하는 화면입니다.',
    robots: { index: false, follow: false },
  };
}

const PILLAR_LABELS: Record<string, string> = {
  '년': '태어난 해',
  '월': '태어난 달',
  '일': '태어난 날',
  '시': '태어난 시간',
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

        <section className="gangi-report-panel p-8 sm:p-10">
          <div className="relative z-10 flex flex-col items-center gap-5 text-center lg:flex-row lg:text-left lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">내 풀이</div>
              <h1 className="mt-4 text-4xl font-black text-[var(--app-ink)] sm:text-5xl">
                내 사주를 쉽게 봅니다
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 text-[var(--app-copy-muted)]">
                먼저 타고난 기질과 오늘 연결되는 포인트만 보고, 전문표는 궁금할 때만 펼쳐보세요.
              </p>
              <p className="mt-2 text-sm text-[var(--app-copy-soft)]">{formatBirthSummary(input)}</p>
            </div>
            <Badge className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
              무료 기본 풀이
            </Badge>
          </div>
        </section>

        <SwipeSectionDeck
          title="처음에는 쉬운 풀이만 봅니다"
          description="전문표보다 성향, 오늘 연결, 다음 행동을 먼저 확인합니다."
        >
          <SwipeSectionSlide
            eyebrow="내 정보"
            title="태어난 정보로 보는 큰 흐름"
            description="한자표 대신 어디에서 어떤 기운이 강하게 보이는지 쉽게 표시합니다."
            navLabel="내 정보"
          >
            <section className="app-panel p-6 sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="app-caption">쉬운 정보</div>
              <h2 className="mt-2 text-2xl font-black text-[var(--app-ivory)]">
                전문표는 접고, 먼저 쉽게 봅니다
              </h2>
            </div>
            <Badge className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
              내 기질
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
                      ? 'border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] shadow-[0_12px_28px_rgba(216,27,114,0.08)]'
                      : 'border-[var(--app-line)] bg-[var(--app-surface-muted)]'
                  }`}
                >
                  <div className={`text-[10px] font-black tracking-[0.08em] ${isDay ? 'text-[var(--app-pink-strong)]' : 'text-[var(--app-copy-soft)]'}`}>
                    {PILLAR_LABELS[label] ?? label}
                  </div>
                  {isDay && <div className="mt-1 text-[11px] font-semibold text-[var(--app-pink-strong)]">나를 가장 잘 보여주는 자리</div>}

                  <div className={`mt-4 border-b pb-3 ${isDay ? 'border-[var(--app-gold)]/20' : 'border-[var(--app-line)]'}`}>
                    <div className="text-[11px] font-semibold text-[var(--app-copy-soft)]">겉으로 보이는 기질</div>
                    <div className={`mt-2 text-lg font-black ${isDay ? 'text-[var(--app-pink-strong)]' : 'text-[var(--app-ivory)]'}`}>
                      {pillar ? ELEMENT_INFO[pillar.stemElement].name : '시간 미입력'}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-[11px] font-semibold text-[var(--app-copy-soft)]">속에 깔린 기질</div>
                    <div className="mt-2 text-lg font-black text-[var(--app-ivory)]">
                      {pillar ? ELEMENT_INFO[pillar.branchElement].name : '미입력'}
                    </div>
                    {!pillar && (
                      <div className="mt-2 text-[10px] text-[var(--app-copy-soft)]">미입력</div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-[var(--app-gold)]/16 bg-[var(--app-surface-muted)] px-5 py-4 text-sm leading-8 text-[var(--app-copy)]">
            내 사주는 {sajuData.dayMaster.metaphor ?? '자연의 상징'}처럼 드러나는 기질을 중심으로 읽습니다.{' '}
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
              <h2 className=" text-2xl text-[var(--app-ivory)]">기본 해석</h2>
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
                <div className=" flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--app-gold)]/22 bg-[var(--app-gold)]/8 text-sm text-[var(--app-gold-text)]">
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
          <article className="gangi-report-panel p-6">
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="app-caption">깊은 사주풀이</div>
                <span className="rounded-full border border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--app-gold-text)]">
                  PREMIUM
                </span>
              </div>
              <div className="mt-3 text-2xl text-[var(--app-gold-text)]">
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
                  className="gangi-primary-button"
                >
                  깊은 사주풀이 열기 <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/membership"
                  className="gangi-secondary-button"
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
