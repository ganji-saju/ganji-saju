'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Heart,
  MapPinned,
  Sparkles,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { GroundingKasiSummary } from '@/components/ai/grounding-kasi-summary';
import { EngineMethodLinks } from '@/components/content/engine-method-links';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SajuInterpretationGrounding } from '@/domain/saju/report';
import type {
  SajuYearlyReport,
  YearlyMonthFlow,
  YearlyTimingWindow,
} from '@/domain/saju/report/yearly-types';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import type { MoonlightCounselorId } from '@/lib/counselors';
import type { SajuReportRuntimeMetadata } from '@/lib/saju/report-metadata';
import type { AiFallbackReason, AiGenerationSource } from '@/server/ai/openai-text';
import type {
  SajuYearlyAiInterpretation,
  SajuYearlyAiMonthlyFlow,
} from '@/server/ai/saju-yearly-interpretation';
import { limitSajuSentences, simplifySajuCopy } from '@/lib/saju/public-copy';

interface Props {
  slug: string;
  targetYear: number;
}

interface YearlyInterpretationResponse {
  ok: boolean;
  readingId: string;
  resolvedReadingId: string;
  readingSource: 'database-reading-id' | 'deterministic-slug';
  targetYear: number;
  counselorId: MoonlightCounselorId;
  promptVersion: string;
  metadata: SajuReportRuntimeMetadata;
  cached: boolean;
  cacheable: boolean;
  cacheKeyType: 'reading_id' | 'reading_slug' | 'unavailable';
  source: AiGenerationSource;
  model: string | null;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
  generationMs: number;
  updatedAt?: string;
  grounding: SajuInterpretationGrounding;
  kasiComparison: KasiSingleInputComparison | null;
  interpretation: SajuYearlyAiInterpretation;
  report: SajuYearlyReport;
  reportText: string;
  stageResults: Array<{
    key: 'narrative' | 'monthly';
    source: AiGenerationSource;
    fallbackReason: AiFallbackReason | null;
    errorMessage: string | null;
    durationMs: number;
  }>;
}

const CATEGORY_ORDER = [
  { key: 'work', label: '일·직업운', color: '#38bdf8' },
  { key: 'wealth', label: '재물운', color: '#34d399' },
  { key: 'love', label: '연애·결혼운', color: '#fb7185' },
  { key: 'relationship', label: '인간관계운', color: '#f59e0b' },
  { key: 'health', label: '건강운', color: '#a78bfa' },
  { key: 'move', label: '이동·변화운', color: '#60a5fa' },
] as const;

const CORE_CATEGORY_ORDER = ['work', 'wealth', 'love', 'relationship'] as const;

const CORE_CATEGORY_GUIDE = {
  work: {
    label: '직장운',
    eyebrow: '일과 평가',
    icon: BriefcaseBusiness,
    opportunityLabel: '기회 장면',
    cautionLabel: '주의 장면',
    actionLabel: '오늘 할 일',
  },
  wealth: {
    label: '재물운',
    eyebrow: '돈의 흐름',
    icon: WalletCards,
    opportunityLabel: '돈 기회',
    cautionLabel: '새는 장면',
    actionLabel: '돈 관리',
  },
  love: {
    label: '연애운',
    eyebrow: '가까운 관계',
    icon: Heart,
    opportunityLabel: '통하는 장면',
    cautionLabel: '엉키는 장면',
    actionLabel: '표현 방법',
  },
  relationship: {
    label: '관계운',
    eyebrow: '사람과 거리',
    icon: UsersRound,
    opportunityLabel: '살리는 장면',
    cautionLabel: '긁히는 장면',
    actionLabel: '거리 조절',
  },
} as const;

const MOMENTUM_META: Record<
  YearlyMonthFlow['momentum'],
  {
    label: string;
    shortLabel: string;
    guideLabel: string;
    icon: LucideIcon;
    badgeClassName: string;
    panelClassName: string;
    dotClassName: string;
  }
> = {
  rise: {
    label: '밀어도 되는 달',
    shortLabel: '좋음',
    guideLabel: '밀어도 되는 달',
    icon: CheckCircle2,
    badgeClassName: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    panelClassName: 'border-emerald-400/24 bg-emerald-400/8',
    dotClassName: 'border-emerald-300/30 bg-emerald-300/14 text-emerald-100',
  },
  steady: {
    label: '정리하는 달',
    shortLabel: '정리',
    guideLabel: '차분히 정리할 달',
    icon: Sparkles,
    badgeClassName: 'border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy-soft)]',
    panelClassName: 'border-[var(--app-line)] bg-[rgba(255,255,255,0.035)]',
    dotClassName: 'border-[var(--app-line)] bg-[rgba(255,255,255,0.045)] text-[var(--app-copy)]',
  },
  caution: {
    label: '한 번 더 확인할 달',
    shortLabel: '확인',
    guideLabel: '한 번 더 확인할 달',
    icon: AlertTriangle,
    badgeClassName: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
    panelClassName: 'border-rose-400/24 bg-rose-400/8',
    dotClassName: 'border-rose-300/30 bg-rose-300/14 text-rose-100',
  },
};

const YEARLY_AREA_LABEL: Record<YearlyMonthFlow['relatedAreas'][number], string> = {
  work: '일',
  wealth: '돈',
  love: '연애',
  relationship: '관계',
  health: '생활 리듬',
  move: '변화',
};

function splitParagraphs(text: string) {
  return simplifySajuCopy(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderCompactParagraphs(text: string, limit = 2) {
  return splitParagraphs(text)
    .slice(0, limit)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 24)}-${index}`} className="text-sm leading-7 text-[var(--app-copy)]">
        {paragraph}
      </p>
    ));
}

function tightenUiLine(text: string, maxLength = 104) {
  const compact = simplifySajuCopy(text).replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  const sliced = compact.slice(0, maxLength).trim();
  return /[.!?。]$/.test(sliced) ? sliced : `${sliced}...`;
}

function formatUpdatedAt(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function buildMonthlyFallback(flow: SajuYearlyAiMonthlyFlow): YearlyMonthFlow {
  return {
    month: flow.month,
    label: `${flow.month}월`,
    monthlyGanji: null,
    momentum: 'steady',
    theme: `${flow.month}월 흐름`,
    focusQuestion: `${flow.month}월에는 무엇을 먼저 확인해야 할까요?`,
    summary: flow.summary,
    opportunity: flow.focus || '이미 준비된 선택 한두 가지를 먼저 꺼내 보세요.',
    caution: flow.caution || '확정 전에 한 번 더 비교하고 확인하는 편이 좋습니다.',
    action: flow.action || '욕심을 넓히기보다 오늘 할 일을 먼저 좁혀서 움직이세요.',
    relatedAreas: ['work', 'wealth'],
    basis: [],
  };
}

function normalizeMonthlyFlows(
  report: SajuYearlyReport | undefined,
  interpretation: SajuYearlyAiInterpretation
) {
  if (report?.monthlyFlows?.length) return report.monthlyFlows;
  return interpretation.monthlyFlows.map(buildMonthlyFallback);
}

function groupMonthlyFlowsByMomentum(monthlyFlows: YearlyMonthFlow[]) {
  return {
    rise: monthlyFlows.filter((flow) => flow.momentum === 'rise'),
    caution: monthlyFlows.filter((flow) => flow.momentum === 'caution'),
    steady: monthlyFlows.filter((flow) => flow.momentum === 'steady'),
  };
}

function getTopAreaLabel(flow: YearlyMonthFlow) {
  return flow.relatedAreas
    .slice(0, 2)
    .map((area) => YEARLY_AREA_LABEL[area])
    .join(' · ');
}

function MomentumSummaryRow({
  tone,
  flows,
}: {
  tone: YearlyMonthFlow['momentum'];
  flows: YearlyMonthFlow[];
}) {
  const meta = MOMENTUM_META[tone];
  const Icon = meta.icon;

  return (
    <article className={`rounded-[22px] border px-4 py-4 ${meta.panelClassName}`}>
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(8rem,0.42fr)_minmax(0,1fr)] sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current/25 bg-black/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="whitespace-nowrap text-sm font-semibold text-[var(--app-ivory)]">{meta.guideLabel}</div>
          <div className="mt-1 text-xl font-semibold text-[var(--app-gold-text)]">{flows.length}개월</div>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {flows.length ? (
            flows.map((flow) => (
              <a
                key={`${tone}-${flow.month}`}
                href={`#yearly-month-${flow.month}`}
                className="inline-flex min-h-8 items-center justify-center rounded-full border border-current/20 bg-black/10 px-3 text-xs font-semibold text-current transition-colors hover:border-[var(--app-gold)]/40 hover:text-[var(--app-gold-text)]"
              >
                {flow.month}월
              </a>
            ))
          ) : (
            <span className="text-sm leading-7 text-[var(--app-copy-muted)]">해당 월 없음</span>
          )}
        </div>
      </div>
    </article>
  );
}

function YearlyVisualMap({ report }: { report: SajuYearlyReport }) {
  const grouped = groupMonthlyFlowsByMomentum(report.monthlyFlows);
  const highlightedGood = report.goodPeriods[0];
  const highlightedCaution = report.cautionPeriods[0];

  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(24rem,0.85fr)_minmax(0,1.15fr)]">
      <article className="rounded-[28px] border border-[var(--app-gold)]/20 bg-[rgba(210,176,114,0.075)] px-5 py-5">
        <div className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-[var(--app-gold-text)]" aria-hidden="true" />
          <div className="app-caption text-[var(--app-gold-soft)]">연간 지도</div>
        </div>
        <h3 className="mt-3 text-2xl font-semibold leading-8 text-[var(--app-ivory)]">
          먼저 색으로 봅니다
        </h3>
        <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
          밀어도 되는 달과 한 번 더 확인할 달만 먼저 나눠 봅니다.
        </p>
        <div className="mt-5 grid gap-3">
          <MomentumSummaryRow tone="rise" flows={grouped.rise} />
          <MomentumSummaryRow tone="caution" flows={grouped.caution} />
          <MomentumSummaryRow tone="steady" flows={grouped.steady} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {highlightedGood ? (
            <div className="rounded-[18px] border border-emerald-400/18 bg-emerald-400/6 px-4 py-3">
              <div className="app-caption text-emerald-100">가장 쓰기 좋은 구간</div>
              <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">
                {highlightedGood.months.map((month) => `${month}월`).join(' · ')} · {highlightedGood.strategy}
              </p>
            </div>
          ) : null}
          {highlightedCaution ? (
            <div className="rounded-[18px] border border-rose-400/18 bg-rose-400/6 px-4 py-3">
              <div className="app-caption text-rose-100">확인이 필요한 구간</div>
              <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">
                {highlightedCaution.months.map((month) => `${month}월`).join(' · ')} · {highlightedCaution.strategy}
              </p>
            </div>
          ) : null}
        </div>
      </article>

      <article className="rounded-[28px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[var(--app-gold-text)]" aria-hidden="true" />
          <div className="app-caption text-[var(--app-gold-soft)]">12개월 흐름 레일</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {report.monthlyFlows.map((flow) => {
            const meta = MOMENTUM_META[flow.momentum];

            return (
              <a
                key={`year-map-${flow.month}`}
                href={`#yearly-month-${flow.month}`}
                className={`group rounded-[18px] border px-3 py-3 transition-colors hover:border-[var(--app-gold)]/36 ${meta.dotClassName}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold">{flow.month}월</span>
                  <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px]">
                    {meta.shortLabel}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[var(--app-copy)]">
                  {getTopAreaLabel(flow)}
                </p>
              </a>
            );
          })}
        </div>
        <p className="mt-4 text-sm leading-7 text-[var(--app-copy-muted)]">
          색이 진한 달부터 확인하고, 나머지는 일정이 생길 때 다시 열어보는 방식이 가장 덜 피곤합니다.
        </p>
      </article>
    </section>
  );
}

function MonthlyFlowCard({ flow }: { flow: YearlyMonthFlow }) {
  const momentumMeta = MOMENTUM_META[flow.momentum];
  const areaLabel = flow.relatedAreas.map((area) => YEARLY_AREA_LABEL[area]).join(' · ');
  const MomentumIcon = momentumMeta.icon;

  return (
    <article
      id={`yearly-month-${flow.month}`}
      className="scroll-mt-28 rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="app-caption text-[var(--app-gold-soft)]">{flow.month}월</div>
          <div className="mt-1 text-xs text-[var(--app-copy-soft)]">{areaLabel}</div>
        </div>
        <Badge className={`${momentumMeta.badgeClassName} gap-1.5`}>
          <MomentumIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {momentumMeta.label}
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-7 text-[var(--app-ivory)]">{tightenUiLine(flow.summary, 104)}</p>
      <div className="mt-4 rounded-[18px] border border-emerald-400/18 bg-emerald-400/6 px-4 py-3">
        <div className="app-caption text-emerald-100">이번 달 바로 할 일</div>
        <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{tightenUiLine(flow.action, 84)}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy-soft)]">
          {flow.monthlyGanji ?? `${flow.month}월`}
        </Badge>
      </div>

      <details className="group mt-4">
        <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
          이 달 자세히 보기
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="rounded-[16px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
            <div className="app-caption text-[var(--app-gold-soft)]">먼저 볼 질문</div>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{simplifySajuCopy(flow.focusQuestion)}</p>
          </div>
          <div className="rounded-[16px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
            <div className="app-caption text-[var(--app-gold-soft)]">밀어볼 것</div>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{tightenUiLine(flow.opportunity, 104)}</p>
          </div>
          <div className="rounded-[16px] border border-rose-400/18 bg-rose-400/6 px-4 py-3">
            <div className="app-caption text-rose-100">한 번 더 확인할 것</div>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{tightenUiLine(flow.caution, 104)}</p>
          </div>
        </div>
      </details>

      {flow.basis.length > 0 ? (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
            풀이 배경 보기
          </summary>
          <div className="mt-3 grid gap-2">
            {flow.basis.map((item) => (
              <div key={item} className="rounded-xl bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                {simplifySajuCopy(item)}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function CoreAreaCard({
  item,
  prose,
}: {
  item: {
    key: (typeof CORE_CATEGORY_ORDER)[number];
    label: string;
    eyebrow: string;
    scoreLabel: string | null;
    summary: string;
    opportunity: string;
    caution: string;
    action: string;
    basis: string[];
  };
  prose: string;
}) {
  const meta = CORE_CATEGORY_GUIDE[item.key];
  const Icon = meta.icon;

  return (
    <article className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="app-caption text-[var(--app-gold-soft)]">{meta.eyebrow}</div>
            <h3 className="mt-1 text-xl font-semibold text-[var(--app-ivory)]">{item.label}</h3>
          </div>
        </div>
        {item.scoreLabel ? (
          <Badge className="shrink-0 border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy-soft)]">
            {item.scoreLabel}
          </Badge>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
          <div className="app-caption text-[var(--app-gold-soft)]">올해 핵심</div>
          <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{tightenUiLine(item.summary, 104)}</p>
        </div>
        <div className="rounded-[18px] border border-emerald-400/18 bg-emerald-400/6 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.opportunityLabel}
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{tightenUiLine(item.opportunity, 100)}</p>
        </div>
        <div className="rounded-[18px] border border-rose-400/18 bg-rose-400/6 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.cautionLabel}
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{tightenUiLine(item.caution, 100)}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-gold-soft)]">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.actionLabel}
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{tightenUiLine(item.action, 88)}</p>
        </div>
      </div>
      <details className="group mt-4">
        <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
          풀이 자세히 보기
        </summary>
        <div className="mt-3 space-y-3 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
          {renderCompactParagraphs(prose, 2)}
        </div>
      </details>
      {item.basis.length > 0 ? (
        <details className="group mt-4">
        <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
          풀이 배경 보기
        </summary>
          <div className="mt-3 grid gap-2">
            {item.basis.map((line) => (
              <div key={line} className="rounded-xl bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy-muted)]">
            {simplifySajuCopy(line)}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function SupportAreaCard({
  label,
  eyebrow,
  section,
  prose,
  basis,
}: {
  label: string;
  eyebrow: string;
  section: SajuYearlyReport['categories']['health'];
  prose: string;
  basis: string[];
}) {
  const Icon = label.startsWith('건강') ? Activity : MapPinned;

  return (
    <article className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[var(--app-gold)]/20 bg-[var(--app-gold)]/8 text-[var(--app-gold-text)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <div className="app-caption text-[var(--app-gold-soft)]">{eyebrow}</div>
          <h3 className="mt-1 text-lg font-semibold text-[var(--app-ivory)]">{label}</h3>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-sm leading-7 text-[var(--app-copy)]">{limitSajuSentences(section.summary, 2)}</p>
        <p className="text-sm leading-7 text-[var(--app-copy-muted)]">{limitSajuSentences(section.caution, 2)}</p>
        <p className="text-sm leading-7 text-[var(--app-copy)]">{limitSajuSentences(section.action, 2)}</p>
      </div>
      <details className="group mt-4">
        <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
          풀이 자세히 보기
        </summary>
        <div className="mt-3 space-y-3 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
          {renderCompactParagraphs(prose, 2)}
        </div>
      </details>
      {basis.length > 0 ? (
        <details className="group mt-4">
        <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
          풀이 배경 보기
        </summary>
          <div className="mt-3 grid gap-2">
            {basis.map((line) => (
              <div key={line} className="rounded-xl bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                {line}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function TimingWindowCard({
  title,
  windows,
  tone,
}: {
  title: string;
  windows: YearlyTimingWindow[];
  tone: 'good' | 'caution';
}) {
  const cardClassName =
    tone === 'good'
      ? 'border-emerald-400/20 bg-emerald-400/8'
      : 'border-rose-400/20 bg-rose-400/8';
  const captionClassName = tone === 'good' ? 'text-emerald-100' : 'text-rose-100';

  return (
    <article className={`rounded-[22px] border px-4 py-4 ${cardClassName}`}>
      <div className={`app-caption ${captionClassName}`}>{title}</div>
      <div className="mt-4 grid gap-3">
        {windows.map((window) => (
          <div
            key={`${title}-${window.label}-${window.months.join('-')}`}
            className="rounded-[16px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
          >
            <div className="text-sm font-semibold text-[var(--app-ivory)]">
              {window.months.map((month) => `${month}월`).join(' · ')}
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{window.reason}</p>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy-muted)]">{window.strategy}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildMonthlySectionTitle(report: SajuYearlyReport) {
  return `${report.year}년 1월부터 12월까지, 실제로 먼저 확인할 장면을 달별로 정리했습니다`;
}

function buildMonthlySectionDescription(report: SajuYearlyReport) {
  const repeatedAreas = [...new Set(report.monthlyFlows.flatMap((flow) => flow.relatedAreas))]
    .map((area) => YEARLY_AREA_LABEL[area])
    .slice(0, 4)
    .join(' · ');

  return `좋은 말만 길게 적지 않고, 사람들이 실제로 궁금해하는 ${repeatedAreas} 중심으로 “이번 달 밀어도 되는 일 / 한 번 더 확인할 일 / 오늘 할 일”이 먼저 보이게 정리했습니다.`;
}

function YearlyMonthlySection({
  report,
  interpretation,
}: {
  report?: SajuYearlyReport;
  interpretation: SajuYearlyAiInterpretation;
}) {
  const monthlyFlows = normalizeMonthlyFlows(report, interpretation);
  const title = report ? buildMonthlySectionTitle(report) : '1월부터 12월까지 핵심 장면을 먼저 정리했습니다';
  const description = report
    ? buildMonthlySectionDescription(report)
    : '월별 핵심 문장만 빠르게 확인하고, 필요한 달만 다시 펼쳐보실 수 있게 정리했습니다.';

  return (
    <div className="mt-6">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-soft)]">
        월별 핵심 장면
      </div>
      <h3 className="mt-3 text-xl font-semibold text-[var(--app-ivory)]">{title}</h3>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy-muted)]">{description}</p>

      {report ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TimingWindowCard title="밀어도 되는 시기" windows={report.goodPeriods} tone="good" />
          <TimingWindowCard title="한 번 더 확인할 시기" windows={report.cautionPeriods} tone="caution" />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {monthlyFlows.map((flow) => (
          <MonthlyFlowCard key={`${flow.month}-${flow.summary.slice(0, 12)}`} flow={flow} />
        ))}
      </div>
    </div>
  );
}

function TimingSummaryBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'good' | 'caution';
}) {
  const eyebrowClassName = tone === 'good' ? 'text-emerald-100' : 'text-rose-100';
  const Icon = tone === 'good' ? CheckCircle2 : AlertTriangle;

  return (
    <article className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] ${eyebrowClassName}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <p key={item} className="text-sm leading-7 text-[var(--app-copy)]">
            {item}
          </p>
        ))}
      </div>
    </article>
  );
}

export default function YearlyReportPanel({ slug, targetYear }: Props) {
  const { counselorId } = usePreferredCounselor();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<YearlyInterpretationResponse | null>(null);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState('loading');
      setError('');

      try {
        const response = await fetch('/api/interpret/yearly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readingId: slug,
            targetYear,
            counselorId,
            regenerate: reloadToken > 0,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as
          | YearlyInterpretationResponse
          | { error?: string }
          | null;

        if (!response.ok || !payload || !('ok' in payload) || payload.ok !== true) {
          setError(payload && 'error' in payload && payload.error ? payload.error : '올해 흐름을 불러오지 못했습니다.');
          setState('error');
          return;
        }

        setData(payload);
        setState('ready');
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') return;
        setError('올해 흐름을 불러오는 중 오류가 발생했습니다.');
        setState('error');
      }
    }

    void load();

    return () => controller.abort();
  }, [slug, targetYear, counselorId, reloadToken]);

  const updatedAtLabel = useMemo(
    () => formatUpdatedAt(data?.updatedAt),
    [data?.updatedAt]
  );

  if (state === 'loading') {
    return (
      <section className="gangi-report-panel p-6">
        <div className="app-caption">올해 흐름 정리 중</div>
        <h2 className=" mt-4 text-3xl text-[var(--app-ivory)]">
          {targetYear}년 흐름을 정리하고 있습니다
        </h2>
        <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
          타고난 사주와 올해·이번 달 흐름을 다시 맞추고, 올해의 선택 포인트를 쉽게 정리하고 있습니다.
        </p>
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={`yearly-loading-${index}`}
              className="h-28 animate-pulse rounded-[20px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (state === 'error' || !data) {
    return (
      <section className="app-panel space-y-4 border-rose-400/20 p-6">
        <div className="app-caption text-rose-200/80">올해 흐름 오류</div>
        <p className="font-medium text-rose-200">{error || '올해 흐름을 불러오지 못했습니다.'}</p>
        <Button
          onClick={() => setReloadToken((value) => value + 1)}
          variant="outline"
          className="w-fit border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-ivory)] hover:bg-[var(--app-surface-strong)]"
        >
          다시 불러오기
        </Button>
      </section>
    );
  }

  const interpretation = data.interpretation;
  const coreCards = CORE_CATEGORY_ORDER.map((key) => {
    const section = data.report.categories[key];
    const referenceTopic = key === 'work' ? 'career' : key;
    const reference = data.report.referenceReports[referenceTopic];
    const scoreLabel = reference.score !== null ? `${reference.focusLabel} ${reference.score}점` : null;

    return {
      key,
      label: CORE_CATEGORY_GUIDE[key].label,
      eyebrow: CORE_CATEGORY_GUIDE[key].eyebrow,
      scoreLabel,
      summary: section.summary,
      opportunity: section.opportunity,
      caution: section.caution,
      action: section.action,
      basis: section.basis,
    };
  });

  return (
    <section id="yearly-report" className="gangi-report-panel p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="app-caption">{targetYear} 올해 흐름</div>
          <h2 className=" mt-4 text-3xl text-[var(--app-ivory)]">
            올해 흐름을 바로 읽습니다
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
            {data.counselorId === 'male' ? '달빛 남선생' : '달빛 여선생'}
          </Badge>
          <Badge className="border-[var(--app-line)] bg-[var(--app-surface-strong)] text-[var(--app-copy-muted)]">
            {data.cached ? '저장됨' : '새로 정리'}
          </Badge>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[var(--app-copy-soft)]">
        {updatedAtLabel ? <span>최근 생성: {updatedAtLabel}</span> : null}
        <Button
          onClick={() => setReloadToken((value) => value + 1)}
          variant="outline"
          size="xs"
        >
          다시 생성
        </Button>
      </div>

      <div className="mt-6 rounded-[24px] border border-[var(--app-gold)]/18 bg-[rgba(210,176,114,0.08)] px-5 py-5">
        <div className="app-caption text-[var(--app-gold-soft)]">올해 한 줄 먼저</div>
        <p className=" mt-4 text-lg font-semibold leading-8 text-[var(--app-ivory)]">
          {interpretation.oneLineSummary}
        </p>
        <div className="mt-4 space-y-3">{renderCompactParagraphs(interpretation.opening, 2)}</div>
      </div>

      <YearlyVisualMap report={data.report} />

      <div className="mt-6">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-soft)]">
          올해 핵심 키워드
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {interpretation.keywords.map((keyword) => (
            <Badge
              key={keyword}
              className="h-auto rounded-full border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-left text-xs leading-6 text-[var(--app-copy)]"
            >
              {keyword}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
          <div className="app-caption text-[var(--app-gold-soft)]">상반기 먼저 볼 것</div>
          <div className="mt-4 space-y-3">{renderCompactParagraphs(interpretation.firstHalf, 3)}</div>
        </article>
        <article className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
          <div className="app-caption text-[var(--app-gold-soft)]">하반기 먼저 볼 것</div>
          <div className="mt-4 space-y-3">{renderCompactParagraphs(interpretation.secondHalf, 3)}</div>
        </article>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-soft)]">
          사람들이 가장 많이 묻는 4가지
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy-muted)]">
          일, 돈, 연애, 관계에서 먼저 볼 장면만 나눠 정리했습니다.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {coreCards.map((item) => (
            <CoreAreaCard
              key={item.key}
              item={item}
              prose={interpretation.categories[item.key]}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SupportAreaCard
          label="건강·생활 리듬"
          eyebrow="리듬 관리"
          section={data.report.categories.health}
          prose={interpretation.categories.health}
          basis={data.report.categories.health.basis}
        />
        <SupportAreaCard
          label="이동·변화"
          eyebrow="자리와 이동"
          section={data.report.categories.move}
          prose={interpretation.categories.move}
          basis={data.report.categories.move.basis}
        />
      </div>

      <YearlyMonthlySection report={data.report} interpretation={interpretation} />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <TimingSummaryBlock title="좋은 시기 활용법" items={data.interpretation.goodPeriods} tone="good" />
        <TimingSummaryBlock title="조심해야 할 시기" items={data.interpretation.cautionPeriods} tone="caution" />
        <article className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
          <div className="app-caption text-[var(--app-gold-soft)]">행동 조언</div>
          <div className="mt-4 space-y-3">
            {data.interpretation.actionAdvice.map((item) => (
              <p key={item} className="text-sm leading-7 text-[var(--app-copy)]">
                {item}
              </p>
            ))}
          </div>
        </article>
      </div>

      <details className="group mt-6" id="yearly-evidence">
        <summary className="cursor-pointer list-none rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
          풀이 배경 보기
        </summary>
        <div className="mt-4 grid gap-4">
          <GroundingKasiSummary
            grounding={data.grounding}
            kasiComparison={data.kasiComparison}
            metadata={data.metadata}
            title="풀이 배경"
          />
          <EngineMethodLinks
            title="더 깊게 보고 싶을 때만 보는 글"
            description="출생 시간이나 큰 흐름이 궁금할 때만 확인하세요."
            slugs={[
              'how-to-read-daewoon-and-sewoon-together',
              'what-if-birth-hour-is-unknown',
              'how-far-to-trust-gongmang-and-shinsal',
            ]}
            ctaHref="/method"
            ctaLabel="관련 글 더 보기"
            compact
          />
        </div>
      </details>
    </section>
  );
}
