'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Heart,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TRUST_SIGNALS } from '@/content/moonlight';
import FiveElementOrbitChart from '@/components/saju/five-element-orbit-chart';
// 2026-05-15 handoff PR-F: 62 m-chart — 차트 viewport 진입 시 draw-in.
import { ChartDrawReveal } from '@/components/motion/chart-draw-reveal';
import '@/components/motion/motion-primitives.css';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { Element } from '@/lib/saju/types';
import { cn } from '@/lib/utils';

interface MobileScore {
  key: string;
  label: string;
  score: number;
  summary: string;
}

interface MobileTimelineItem {
  label: string;
  headline: string;
  body: string;
  points?: string[];
}

interface MobilePillar {
  label: string;
  stem: string;
  branch: string;
  stemColor: string;
  branchColor: string;
}

interface MobileEvidence {
  label: string;
  title: string;
  body: string;
}

interface MobileElementValue {
  count: number;
  score: number;
  percentage: number;
  state: string;
}

interface MobileSajuResultStoryProps {
  slug: string;
  birthSummary: string;
  focusBadge: string;
  headline: string;
  dayMasterSummary: string;
  dayMasterLabel: string;
  dayMasterElement: Element;
  dayMasterMetaphor: string;
  dayMasterDescription: string;
  dayMasterTraits: string[];
  keyThemes: string[];
  cautionPatterns: string[];
  favorableChoices: string[];
  scores: MobileScore[];
  primaryAction: { title: string; description: string };
  cautionAction: { title: string; description: string };
  timeline: MobileTimelineItem[];
  pillars: MobilePillar[];
  fiveElementsByElement: Record<Element, MobileElementValue>;
  dominantElement: Element;
  weakestElement: Element;
  supportElements: string[];
  evidenceCards: MobileEvidence[];
  luckyDates: string[];
  cautionDates: string[];
}

interface StorySlide {
  id: string;
  label: string;
  title: string;
  eyebrow: string;
  summary: string;
  detailHref: string;
  detailLabel: string;
  render: () => ReactNode;
}

function StoryBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('saju-mobile-story-body grid gap-3', className)}>{children}</div>;
}

function StoryList({
  items,
  tone = 'gold',
  max = 3,
}: {
  items: string[];
  tone?: 'gold' | 'jade' | 'coral';
  max?: number;
}) {
  const colorClass =
    tone === 'jade'
      ? 'border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 text-[var(--app-jade)]'
      : tone === 'coral'
        ? 'border-[var(--app-coral)]/25 bg-[var(--app-coral)]/10 text-[var(--app-coral)]'
        : 'border-[var(--app-gold)]/22 bg-[var(--app-gold)]/8 text-[var(--app-gold-text)]';

  const visibleItems = items.filter(Boolean).slice(0, max);

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-[1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-3 py-2 text-xs leading-5 text-[var(--app-copy-muted)]">
        이 항목은 상세 화면에서 더 넓게 확인할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {visibleItems.map((item) => (
        <div
          key={item}
          className={cn('rounded-[1rem] border px-3 py-2 text-xs leading-5', colorClass)}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function StoryReadablePanel({
  eyebrow,
  title,
  body,
  tone = 'gold',
}: {
  eyebrow: string;
  title: string;
  body: string;
  tone?: 'gold' | 'jade' | 'coral';
}) {
  const toneClass =
    tone === 'jade'
      ? 'border-[var(--app-jade)]/22 bg-[var(--app-jade)]/8'
      : tone === 'coral'
        ? 'border-[var(--app-coral)]/22 bg-[var(--app-coral)]/8'
        : 'border-[var(--app-gold)]/22 bg-[var(--app-gold)]/8';
  const eyebrowClass =
    tone === 'jade'
      ? 'text-[var(--app-jade)]'
      : tone === 'coral'
        ? 'text-[var(--app-coral)]'
        : 'text-[var(--app-gold-text)]';

  return (
    <div className={cn('rounded-[1.05rem] border px-3 py-3', toneClass)}>
      <div className={cn('text-[10px] font-semibold tracking-[0.14em]', eyebrowClass)}>
        {eyebrow}
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-5 text-[var(--app-ivory)]">
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--app-copy)]">{body}</p>
    </div>
  );
}

function StoryInlineFact({
  label,
  value,
  tone = 'gold',
}: {
  label: string;
  value: string;
  tone?: 'gold' | 'jade' | 'coral';
}) {
  const colorClass =
    tone === 'jade'
      ? 'border-[var(--app-jade)]/20 bg-[var(--app-jade)]/8 text-[var(--app-jade)]'
      : tone === 'coral'
        ? 'border-[var(--app-coral)]/20 bg-[var(--app-coral)]/8 text-[var(--app-coral)]'
        : 'border-[var(--app-gold)]/20 bg-[var(--app-gold)]/8 text-[var(--app-gold-text)]';

  return (
    <div className={cn('rounded-[0.95rem] border px-3 py-2', colorClass)}>
      <div className="text-[10px] font-semibold opacity-80">{label}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--app-copy)]">{value}</div>
    </div>
  );
}

function MiniPillarGrid({ pillars }: { pillars: MobilePillar[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {pillars.map((pillar) => (
        <div
          key={pillar.label}
          className="rounded-[0.95rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-1.5 py-2.5 text-center"
        >
          <div className="text-[10px] text-[var(--app-copy-soft)]">{pillar.label.replace('주', '')}</div>
          <div className="mt-2 text-2xl font-semibold leading-none" style={{ color: pillar.stemColor }}>
            {pillar.stem}
          </div>
          <div className="mt-1 text-xl font-semibold leading-none" style={{ color: pillar.branchColor }}>
            {pillar.branch}
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryActionCard({
  tone,
  eyebrow,
  title,
  body,
}: {
  tone: 'jade' | 'coral' | 'gold';
  eyebrow: string;
  title: string;
  body: string;
}) {
  const toneClass =
    tone === 'jade'
      ? 'border-[var(--app-jade)]/22 bg-[var(--app-jade)]/8'
      : tone === 'coral'
        ? 'border-[var(--app-coral)]/22 bg-[var(--app-coral)]/8'
        : 'border-[var(--app-gold)]/22 bg-[var(--app-gold)]/8';
  const eyebrowClass =
    tone === 'jade'
      ? 'text-[var(--app-jade)]'
      : tone === 'coral'
        ? 'text-[var(--app-coral)]'
        : 'text-[var(--app-gold-text)]';

  return (
    <div className={cn('rounded-[1rem] border px-3 py-3', toneClass)}>
      <div className={cn('text-[10px] font-semibold', eyebrowClass)}>{eyebrow}</div>
      <div className="mt-1 text-sm font-semibold leading-5 text-[var(--app-ivory)]">{title}</div>
      <p className="mt-2 text-xs leading-5 text-[var(--app-copy)]">{body}</p>
    </div>
  );
}

function pickScore(scores: MobileScore[], keys: string[]) {
  return scores.find((score) => keys.includes(score.key)) ?? null;
}

function FieldStoryCard({
  icon: Icon,
  label,
  score,
  body,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  score: number | null;
  body: string;
  href: string;
  tone: 'gold' | 'jade' | 'coral';
}) {
  const toneClass =
    tone === 'jade'
      ? 'border-[var(--app-jade)]/24 bg-[var(--app-jade)]/10'
      : tone === 'coral'
        ? 'border-[var(--app-coral)]/24 bg-[var(--app-coral)]/10'
        : 'border-[var(--app-gold)]/22 bg-[var(--app-gold)]/8';
  const iconClass =
    tone === 'jade'
      ? 'text-[var(--app-jade)]'
      : tone === 'coral'
        ? 'text-[var(--app-coral)]'
        : 'text-[var(--app-gold-text)]';

  return (
    <Link
      href={href}
      className={cn('rounded-[1.05rem] border px-3 py-3 transition-colors hover:border-[var(--app-gold)]/32', toneClass)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-current/20 bg-black/10', iconClass)}>
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        {score !== null ? (
          <span className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-2 py-0.5 text-[11px] text-[var(--app-copy)]">
            {score}점
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--app-ivory)]">{label}</div>
      <p className="mt-1 text-xs leading-5 text-[var(--app-copy-muted)]">{body}</p>
    </Link>
  );
}

export function MobileSajuResultStory({
  slug,
  birthSummary,
  focusBadge,
  headline,
  dayMasterSummary,
  dayMasterLabel,
  dayMasterMetaphor,
  dayMasterTraits,
  keyThemes,
  cautionPatterns,
  favorableChoices,
  scores,
  primaryAction,
  cautionAction,
  timeline,
  pillars,
  fiveElementsByElement,
  dominantElement,
  weakestElement,
  supportElements,
  evidenceCards,
  luckyDates,
  cautionDates,
}: MobileSajuResultStoryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const strongestTimeline = timeline[0] ?? null;
  const monthlyTimeline = timeline.find((item) => item.label.includes('달')) ?? timeline[1] ?? strongestTimeline;
  const wealthScore = pickScore(scores, ['wealth']);
  const careerScore = pickScore(scores, ['career', 'work']);
  const relationshipScore = pickScore(scores, ['relationship', 'love']);
  const rhythmScore = pickScore(scores, ['overall']);
  const rhythmBody =
    cautionPatterns[1] ??
    evidenceCards.find((card) => card.label.includes('강약') || card.title.includes('균형'))?.body ??
    '생활 리듬은 무리하기보다 회복과 확인의 간격을 함께 보는 편이 좋습니다.';

  const slides: StorySlide[] = [
    {
      id: 'summary',
      label: '요약',
      title: '1분 요약',
      eyebrow: focusBadge,
      summary: '핵심 한 줄, 조심할 패턴, 오늘 할 행동을 먼저 봅니다.',
      detailHref: `/saju/${slug}/overview`,
      detailLabel: '사주 전체 보기',
      render: () => (
        <StoryBody className="content-start">
          <div className="rounded-[1.2rem] border border-[var(--app-gold)]/24 bg-[var(--app-gold)]/8 px-4 py-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--app-gold-text)]">
              지금 핵심 한 줄
            </p>
            <h1 className="mt-3 text-[1.32rem] font-semibold leading-tight tracking-tight text-[var(--app-ivory)]">
              {simplifySajuCopy(headline)}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--app-copy)]">{simplifySajuCopy(dayMasterSummary)}</p>
            <p className="mt-3 text-[11px] leading-5 text-[var(--app-copy-soft)]">{birthSummary}</p>
          </div>
          <div className="grid gap-2">
            <StoryReadablePanel
              eyebrow="더 깊게 볼 주제"
              title={keyThemes[0] ?? '핵심 흐름'}
              body={keyThemes[1] ?? '오늘 할 일과 오행 균형을 함께 보면 흐름이 더 또렷해집니다.'}
            />
            <div className="grid grid-cols-2 gap-2">
              <StoryInlineFact
                label="타고난 결"
                value={`${dayMasterLabel} · ${dayMasterMetaphor}`}
              />
              <StoryInlineFact
                label="오늘 할 행동"
                value={favorableChoices[0] ?? primaryAction.description}
                tone="jade"
              />
              <StoryInlineFact
                label="주의할 패턴"
                value={cautionPatterns[0] ?? cautionAction.description}
                tone="coral"
              />
            </div>
          </div>
          <details className="group rounded-[1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-3">
            <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--app-gold-text)]">
              사주 기본표 함께 보기
            </summary>
            <div className="mt-3">
              <MiniPillarGrid pillars={pillars} />
            </div>
          </details>
        </StoryBody>
      ),
    },
    {
      id: 'today',
      label: '오늘',
      title: '오늘과 올해 조언',
      eyebrow: '지금 쓸 힌트',
      summary: '오늘의 행동과 올해의 큰 흐름을 함께 보면 선택이 더 안정됩니다.',
      detailHref: `/saju/${slug}?topic=today`,
      detailLabel: '오늘 흐름 보기',
      render: () => (
        <StoryBody className="content-start">
          <div className="grid gap-2">
            <StoryActionCard
              tone="jade"
              eyebrow="오늘 해볼 것"
              title={primaryAction.title}
              body={primaryAction.description}
            />
            <StoryActionCard
              tone="coral"
              eyebrow="오늘 조심할 것"
              title={cautionAction.title}
              body={cautionAction.description}
            />
          </div>
          {monthlyTimeline ? (
            <div className="rounded-[1rem] border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/7 px-3 py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--app-gold-text)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                올해로 이어지는 흐름
              </div>
              <div className="mt-1 text-sm font-semibold leading-5 text-[var(--app-ivory)]">
                {monthlyTimeline.headline}
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--app-copy-muted)]">{monthlyTimeline.body}</p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[10px] font-semibold text-[var(--app-jade)]">좋은 날짜</div>
              <StoryList items={luckyDates} tone="jade" max={2} />
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold text-[var(--app-coral)]">주의 날짜</div>
              <StoryList items={cautionDates} tone="coral" max={2} />
            </div>
          </div>
        </StoryBody>
      ),
    },
    {
      id: 'fields',
      label: '분야',
      title: '분야별 핵심',
      eyebrow: '돈·일·관계·리듬',
      summary: '많이 묻는 네 가지를 짧은 카드로 먼저 보고, 필요한 분야만 더 들어갑니다.',
      detailHref: `/saju/${slug}/premium#yearly-report`,
      detailLabel: '올해 전략 보기',
      render: () => (
        <StoryBody className="content-start">
          <div className="grid grid-cols-2 gap-2">
            <FieldStoryCard
              icon={WalletCards}
              label="재물"
              score={wealthScore?.score ?? null}
              body={wealthScore?.summary ?? favorableChoices[0] ?? '돈의 흐름은 확장보다 새는 지점을 먼저 확인합니다.'}
              href={`/saju/${slug}?topic=wealth`}
              tone="jade"
            />
            <FieldStoryCard
              icon={BriefcaseBusiness}
              label="일"
              score={careerScore?.score ?? null}
              body={careerScore?.summary ?? '올해 일의 흐름은 평가와 역할 조정 포인트를 먼저 봅니다.'}
              href={`/saju/${slug}?topic=career`}
              tone="gold"
            />
            <FieldStoryCard
              icon={Heart}
              label="관계"
              score={relationshipScore?.score ?? null}
              body={relationshipScore?.summary ?? cautionPatterns[0] ?? '관계는 가까워지는 장면과 거리 조절을 함께 봅니다.'}
              href={`/saju/${slug}?topic=relationship`}
              tone="coral"
            />
            <FieldStoryCard
              icon={Activity}
              label="생활 리듬"
              score={rhythmScore?.score ?? null}
              body={rhythmBody}
              href={`/saju/${slug}/overview`}
              tone="gold"
            />
          </div>
          <StoryReadablePanel
            eyebrow="분야 선택"
            title="지금 고민과 가까운 카드부터 보세요"
            body="재물, 일, 관계, 생활 리듬 중 오늘 가장 신경 쓰이는 장면을 먼저 확인하면 됩니다."
            tone="jade"
          />
        </StoryBody>
      ),
    },
    {
      id: 'elements',
      label: '오행',
      title: '오행 균형',
      eyebrow: `${ELEMENT_INFO[dominantElement].name} 중심`,
      summary: '오행은 수치 합계보다 중심 기운과 보완 기운을 같이 볼 때 읽기가 쉬워집니다.',
      detailHref: `/saju/${slug}/elements`,
      detailLabel: '오행 상세 보기',
      render: () => (
        <StoryBody className="content-start">
          <div className="saju-mobile-story-orbit">
            {/* 2026-05-15 handoff 62 m-chart — viewport 진입 시 SVG polygon + nodes draw-in */}
            <ChartDrawReveal threshold={0.25}>
              <FiveElementOrbitChart
                byElement={fiveElementsByElement}
                dominant={dominantElement}
                weakest={weakestElement}
              />
            </ChartDrawReveal>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StoryActionCard
              tone="gold"
              eyebrow="주도"
              title={ELEMENT_INFO[dominantElement].name}
              body={`${ELEMENT_INFO[dominantElement].traits.slice(0, 2).join(' · ')} 쪽이 먼저 드러납니다.`}
            />
            <StoryActionCard
              tone="jade"
              eyebrow="보완"
              title={ELEMENT_INFO[weakestElement].name}
              body={`${ELEMENT_INFO[weakestElement].traits.slice(0, 2).join(' · ')} 쪽을 생활에서 채우면 균형이 편해집니다.`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {supportElements.slice(0, 3).map((item) => (
              <span
                key={item}
                className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-3 py-1 text-xs text-[var(--app-copy)]"
              >
                {item}
              </span>
            ))}
          </div>
        </StoryBody>
      ),
    },
    {
      id: 'next',
      label: '다음',
      title: '소장과 신뢰',
      eyebrow: '다시 볼 풀이',
      summary: '결과를 본 뒤에는 보관형 리포트와 대화로 이어갈 수 있습니다.',
      detailHref: `/saju/${slug}/premium`,
      detailLabel: '긴 사주풀이 보기',
      render: () => (
        <StoryBody className="content-start">
          {strongestTimeline ? (
            <div className="rounded-[1.15rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-4 py-4">
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--app-gold-text)]">
                {strongestTimeline.label}
              </div>
              <div className="mt-2 text-base font-semibold leading-6 text-[var(--app-ivory)]">
                {strongestTimeline.headline}
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--app-copy-muted)]">
                {strongestTimeline.body}
              </p>
            </div>
          ) : null}
          <StoryList items={favorableChoices} tone="jade" max={2} />
          <StoryList items={cautionPatterns} tone="coral" max={2} />
          <div className="flex flex-wrap gap-2">
            {dayMasterTraits.slice(0, 3).map((trait) => (
              <span
                key={trait}
                className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-3 py-1 text-xs text-[var(--app-copy)]"
              >
                {trait}
              </span>
            ))}
          </div>
          <div className="grid gap-2">
            {TRUST_SIGNALS.slice(0, 3).map((signal) => (
              <div
                key={signal.title}
                className="rounded-[1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] px-3 py-2"
              >
                <div className="text-xs font-semibold text-[var(--app-ivory)]">{signal.title}</div>
                <p className="mt-1 text-[11px] leading-5 text-[var(--app-copy-muted)]">{signal.body}</p>
              </div>
            ))}
            <Link
              href={`/saju/${slug}/premium`}
              className="gangi-primary-button"
            >
              긴 사주풀이로 이어보기
            </Link>
            <Link
              href="/dialogue"
              className="gangi-secondary-button"
            >
              달빛인생에 이어서 묻기
            </Link>
          </div>
        </StoryBody>
      ),
    },
  ];

  const activeSlide = slides[activeIndex] ?? slides[0];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === slides.length - 1;

  function goTo(index: number) {
    setActiveIndex(Math.min(Math.max(index, 0), slides.length - 1));
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;

    const delta = event.changedTouches[0]?.clientX - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goTo(activeIndex + 1);
    if (delta > 0) goTo(activeIndex - 1);
  }

  return (
    <section className="saju-mobile-story lg:hidden" aria-label="모바일 사주 결과 요약">
      <div className="saju-mobile-story-shell">
        <div className="saju-mobile-story-progress">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              className={cn(
                'saju-mobile-story-progress-dot',
                index <= activeIndex && 'saju-mobile-story-progress-dot-active'
              )}
              aria-label={`${slide.label} 슬라이드로 이동`}
            >
              <span>{slide.label}</span>
            </button>
          ))}
        </div>

        <div
          className="saju-mobile-story-card"
          onTouchStart={(event) => {
            touchStartXRef.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={handleTouchEnd}
        >
          <div className="saju-mobile-story-card-head">
            <div className="min-w-0">
              <div className="app-caption text-[var(--app-gold-text)]">{activeSlide.eyebrow}</div>
              <h2 className="mt-1 text-[1.55rem] font-semibold tracking-tight text-[var(--app-ivory)]">
                {activeSlide.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--app-copy-muted)]">
                {activeSlide.summary}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs text-[var(--app-copy-muted)]">
                {activeIndex + 1}/{slides.length}
              </span>
              <Link href={activeSlide.detailHref} className="saju-mobile-story-detail-link">
                {activeSlide.detailLabel}
              </Link>
            </div>
          </div>

          {activeSlide.render()}

          <div className="saju-mobile-story-card-foot">
            <Button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              disabled={isFirst}
              variant="secondary"
              size="sm"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              이전
            </Button>
            {isLast ? (
              <Link
                href="/saju/new"
                className="gangi-secondary-button"
              >
                새 리포트
              </Link>
            ) : (
              <Button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                size="sm"
              >
                다음
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
