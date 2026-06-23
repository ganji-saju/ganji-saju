'use client';

import Link from 'next/link';
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
    actionLabel: '말 방법',
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
    label: '진행하기 좋은 달',
    shortLabel: '좋음',
    guideLabel: '진행하기 좋은 달',
    icon: CheckCircle2,
    badgeClassName: 'yearly-tone-good',
    panelClassName: 'yearly-tone-good',
    dotClassName: 'yearly-tone-good',
  },
  steady: {
    label: '정리하는 달',
    shortLabel: '정리',
    guideLabel: '차분히 정리할 달',
    icon: Sparkles,
    badgeClassName: 'yearly-tone-steady',
    panelClassName: 'yearly-tone-steady',
    dotClassName: 'yearly-tone-steady',
  },
  caution: {
    label: '한 번 더 확인할 달',
    shortLabel: '확인',
    guideLabel: '한 번 더 확인할 달',
    icon: AlertTriangle,
    badgeClassName: 'yearly-tone-caution',
    panelClassName: 'yearly-tone-caution',
    dotClassName: 'yearly-tone-caution',
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
      <p
        key={`${paragraph.slice(0, 24)}-${index}`}
        className="text-[15.5px] leading-[1.78] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
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
    <article className={`rounded-[16px] border px-4 py-3.5 ${meta.panelClassName}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/40 backdrop-blur-sm">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.4px] font-extrabold">{meta.guideLabel}</div>
          <div className="mt-0.5 text-[17.3px] font-extrabold">{flows.length}개월</div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {flows.length ? (
          flows.map((flow) => (
            <a
              key={`${tone}-${flow.month}`}
              href={`#yearly-month-${flow.month}`}
              className="inline-flex h-7 items-center rounded-full bg-white/70 px-2.5 text-[13.2px] font-extrabold backdrop-blur-sm transition-colors"
            >
              {flow.month}월
            </a>
          ))
        ) : (
          <span className="text-[13.8px]">해당 월 없음</span>
        )}
      </div>
    </article>
  );
}

function YearlyVisualMap({ report }: { report: SajuYearlyReport }) {
  const grouped = groupMonthlyFlowsByMomentum(report.monthlyFlows);
  const highlightedGood = report.goodPeriods[0];
  const highlightedCaution = report.cautionPeriods[0];

  return (
    <div className="space-y-3">
      {/* §연간 지도 — momentum 요약 */}
      <section
        className="rounded-[20px] border bg-white p-5"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="flex items-center gap-1.5">
          <MapPinned className="h-4 w-4 text-[var(--app-pink-strong)]" aria-hidden="true" />
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            연간 지도
          </div>
        </div>
        <h3 className="mt-1.5 text-[19.5px] font-extrabold leading-[1.4] text-[var(--app-ink)]">
          먼저 색으로 봅니다
        </h3>
        <p
          className="mt-1.5 text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          진행하기 좋은 달과 한 번 더 확인할 달만 먼저 나눠 봅니다.
        </p>
        <div className="mt-3 grid gap-2">
          <MomentumSummaryRow tone="rise" flows={grouped.rise} />
          <MomentumSummaryRow tone="caution" flows={grouped.caution} />
          <MomentumSummaryRow tone="steady" flows={grouped.steady} />
        </div>
        {/* 2026-05-15 — 긴 strategy 텍스트가 좌우 2열로 들어가면 좁아져 가독성 저하.
            상하 1열로 stack 해 각 카드가 풀 너비 사용. */}
        <div className="mt-3 grid gap-2">
          {highlightedGood ? (
            <div className="yearly-tone-good rounded-[14px] border px-3.5 py-3">
              <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em]">
                가장 쓰기 좋은 구간
              </div>
              <p className="mt-1.5 text-[14.4px] leading-[1.65]" style={{ wordBreak: 'keep-all' }}>
                {highlightedGood.months.map((month) => `${month}월`).join(' · ')} · {highlightedGood.strategy}
              </p>
            </div>
          ) : null}
          {highlightedCaution ? (
            <div className="yearly-tone-caution rounded-[14px] border px-3.5 py-3">
              <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em]">
                확인이 필요한 구간
              </div>
              <p className="mt-1.5 text-[14.4px] leading-[1.65]" style={{ wordBreak: 'keep-all' }}>
                {highlightedCaution.months.map((month) => `${month}월`).join(' · ')} · {highlightedCaution.strategy}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* §12개월 흐름 레일 — 3×4 컬러 그리드 */}
      <section
        className="rounded-[20px] border bg-white p-5"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-[var(--app-pink-strong)]" aria-hidden="true" />
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            12개월 흐름 레일
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {report.monthlyFlows.map((flow) => {
            const meta = MOMENTUM_META[flow.momentum];
            return (
              <a
                key={`year-map-${flow.month}`}
                href={`#yearly-month-${flow.month}`}
                className={`rounded-[12px] border px-2.5 py-2.5 transition-all hover:-translate-y-0.5 ${meta.dotClassName}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[16.1px] font-extrabold">{flow.month}월</span>
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10.9px] font-extrabold backdrop-blur-sm">
                    {meta.shortLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-[12.1px] leading-[1.45]" style={{ wordBreak: 'keep-all' }}>
                  {getTopAreaLabel(flow)}
                </p>
              </a>
            );
          })}
        </div>
        <p
          className="mt-3 text-[13.8px] leading-[1.65] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          색이 진한 달부터 확인하세요.
        </p>
      </section>
    </div>
  );
}

function MonthlyFlowCard({
  flow,
  defaultOpen = false,
}: {
  flow: YearlyMonthFlow;
  defaultOpen?: boolean;
}) {
  const momentumMeta = MOMENTUM_META[flow.momentum];
  const areaLabel = flow.relatedAreas.map((area) => YEARLY_AREA_LABEL[area]).join(' · ');
  const MomentumIcon = momentumMeta.icon;

  return (
    <details
      id={`yearly-month-${flow.month}`}
      className="scroll-mt-28 rounded-[16px] border bg-white p-3.5"
      style={{ borderColor: 'var(--app-line)' }}
      open={defaultOpen ? true : undefined}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[13.8px] font-extrabold text-white"
                style={{ background: 'var(--app-pink)' }}
                aria-hidden="true"
              >
                {flow.month}
              </span>
              <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                {flow.month}월
              </div>
              {/* 2026-05-15 PR 7 응답 2 — Peak/Pitfall 시각 강조 (PR 5 데이터 활용) */}
              {flow.peakKind === 'peak' ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12.1px] font-extrabold text-white"
                  style={{ background: 'var(--app-pink-strong)' }}
                >
                  🚨 PEAK
                </span>
              ) : null}
              {flow.peakKind === 'pitfall' ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12.1px] font-extrabold"
                  style={{ background: '#fff3d6', color: 'var(--app-amber)', border: '1px solid var(--app-amber)' }}
                >
                  ⚠️ PITFALL
                </span>
              ) : null}
            </div>
            <p
              className="mt-2 text-[16.1px] font-extrabold leading-[1.5] text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {tightenUiLine(flow.summary, 78)}
            </p>
            <div className="mt-1 text-[12.6px] text-[var(--app-copy-soft)]">{areaLabel}</div>
          </div>
          <span className={`shrink-0 inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12.1px] font-extrabold ${momentumMeta.badgeClassName}`}>
            <MomentumIcon className="h-3 w-3" aria-hidden="true" />
            {momentumMeta.shortLabel}
          </span>
        </div>
      </summary>

      <div className="mt-3 grid gap-2">
        <div className="yearly-tone-good rounded-[14px] border px-3.5 py-3">
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em]">
            이번 달 바로 할 일
          </div>
          <p className="mt-1.5 text-[15px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
            {tightenUiLine(flow.action, 84)}
          </p>
        </div>
        <div
          className="rounded-[14px] border bg-white px-3.5 py-3"
          style={{ borderColor: 'var(--app-pink-line)', background: 'var(--app-pink-soft)' }}
        >
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            먼저 볼 질문
          </div>
          <p
            className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {simplifySajuCopy(flow.focusQuestion)}
          </p>
        </div>
        <div
          className="rounded-[14px] border bg-white px-3.5 py-3"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            진행해볼 것
          </div>
          <p
            className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {tightenUiLine(flow.opportunity, 104)}
          </p>
        </div>
        <div className="yearly-tone-caution rounded-[14px] border px-3.5 py-3">
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em]">
            한 번 더 확인할 것
          </div>
          <p className="mt-1.5 text-[15px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
            {tightenUiLine(flow.caution, 104)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className="rounded-full border bg-white px-2.5 py-1 text-[12.6px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          {flow.monthlyGanji ?? `${flow.month}월`}
        </span>
      </div>

      {flow.basis.length > 0 ? (
        <details className="group mt-3">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.2px] font-extrabold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <span>이 달 흐름 근거 보기</span>
            <span className="text-[10.4px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
          </summary>
          <div className="mt-2 grid gap-1.5">
            {flow.basis.map((item) => (
              <div
                key={item}
                className="rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.8px] leading-[1.65] text-[var(--app-copy-soft)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {simplifySajuCopy(item)}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </details>
  );
}

function CoreAreaCard({
  item,
  prose,
  defaultOpen = false,
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
  defaultOpen?: boolean;
}) {
  const meta = CORE_CATEGORY_GUIDE[item.key];
  const Icon = meta.icon;

  return (
    <details
      className="rounded-[16px] border bg-white p-4"
      style={{ borderColor: 'var(--app-pink-line)' }}
      open={defaultOpen ? true : undefined}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
              style={{
                background: 'var(--app-pink)',
                boxShadow: '0 6px 14px rgba(216,27,114,0.28)',
              }}
              aria-hidden="true"
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                {meta.eyebrow}
              </div>
              <h3 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">{item.label}</h3>
            </div>
          </div>
          {item.scoreLabel ? (
            <span
              className="shrink-0 rounded-full border bg-white px-2.5 py-1 text-[12.6px] font-extrabold text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              {item.scoreLabel}
            </span>
          ) : null}
        </div>
      </summary>

      <div className="mt-3 grid gap-2">
        <div
          className="rounded-[14px] border p-3.5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            올해 핵심
          </div>
          <p
            className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {tightenUiLine(item.summary, 104)}
          </p>
        </div>
        <div className="yearly-tone-good rounded-[14px] border px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[12.1px] font-extrabold uppercase tracking-[0.06em]">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {meta.opportunityLabel}
          </div>
          <p className="mt-1.5 text-[15px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
            {tightenUiLine(item.opportunity, 100)}
          </p>
        </div>
        <div className="yearly-tone-caution rounded-[14px] border px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[12.1px] font-extrabold uppercase tracking-[0.06em]">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {meta.cautionLabel}
          </div>
          <p className="mt-1.5 text-[15px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
            {tightenUiLine(item.caution, 100)}
          </p>
        </div>
        <div
          className="rounded-[14px] border bg-white px-3.5 py-3"
          style={{ borderColor: 'var(--app-pink-line)' }}
        >
          <div className="flex items-center gap-1.5 text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
            {meta.actionLabel}
          </div>
          <p
            className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {tightenUiLine(item.action, 88)}
          </p>
        </div>
      </div>

      <details className="group mt-3">
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.2px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <span>풀이 자세히 보기</span>
          <span className="text-[10.4px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
        </summary>
        <div
          className="mt-2 space-y-2 rounded-[12px] border p-3.5"
          style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
        >
          {renderCompactParagraphs(prose, 2)}
        </div>
      </details>

      {item.basis.length > 0 ? (
        <details className="group mt-3">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.2px] font-extrabold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <span>올해 흐름 근거 보기</span>
            <span className="text-[10.4px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
          </summary>
          <div className="mt-2 grid gap-1.5">
            {item.basis.map((line) => (
              <div
                key={line}
                className="rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.8px] leading-[1.65] text-[var(--app-copy-soft)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {simplifySajuCopy(line)}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </details>
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
    <article
      className="rounded-[16px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
          style={{ background: 'var(--app-pink)' }}
          aria-hidden="true"
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            {eyebrow}
          </div>
          <h3 className="text-[17.3px] font-extrabold text-[var(--app-ink)]">{label}</h3>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <p
          className="text-[15px] leading-[1.78] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {limitSajuSentences(section.summary, 2)}
        </p>
        <p
          className="text-[15px] leading-[1.78] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {limitSajuSentences(section.caution, 2)}
        </p>
        <p
          className="text-[15px] leading-[1.78] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {limitSajuSentences(section.action, 2)}
        </p>
      </div>
      <details className="group mt-3">
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.2px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <span>풀이 자세히 보기</span>
          <span className="text-[10.4px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
        </summary>
        <div
          className="mt-2 space-y-2 rounded-[12px] border p-3.5"
          style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
        >
          {renderCompactParagraphs(prose, 2)}
        </div>
      </details>
      {basis.length > 0 ? (
        <details className="group mt-3">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.2px] font-extrabold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <span>생활 리듬 근거 보기</span>
            <span className="text-[10.4px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
          </summary>
          <div className="mt-2 grid gap-1.5">
            {basis.map((line) => (
              <div
                key={line}
                className="rounded-[12px] border bg-white px-3.5 py-2.5 text-[13.8px] leading-[1.65] text-[var(--app-copy-soft)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
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
      ? 'yearly-tone-good'
      : 'yearly-tone-caution';
  const captionClassName = '';

  return (
    <article className={`rounded-[16px] border px-4 py-3.5 ${cardClassName}`}>
      <div className={`text-[12.1px] font-extrabold uppercase tracking-[0.06em] ${captionClassName}`}>
        {title}
      </div>
      <div className="mt-3 grid gap-2">
        {windows.map((window) => (
          <div
            key={`${title}-${window.label}-${window.months.join('-')}`}
            className="rounded-[12px] bg-white/70 px-3.5 py-2.5 backdrop-blur-sm"
          >
            <div className="text-[15px] font-extrabold">
              {window.months.map((month) => `${month}월`).join(' · ')}
            </div>
            <p className="mt-1.5 text-[14.4px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
              {window.reason}
            </p>
            <p className="mt-1 text-[13.8px] leading-[1.65]" style={{ wordBreak: 'keep-all', opacity: 0.78 }}>
              {window.strategy}
            </p>
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

  return `좋은 말만 길게 적지 않고, 사람들이 실제로 궁금해하는 ${repeatedAreas} 중심으로 “이번 달 바로 해볼 일 / 한 번 더 확인할 일 / 오늘 할 일”이 먼저 보이게 정리했습니다.`;
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
    <section
      className="rounded-[20px] border bg-white p-5"
      style={{ borderColor: 'var(--app-pink-line)' }}
    >
      <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        월별 핵심 장면
      </div>
      <h3
        className="mt-1 text-[19.5px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {description}
      </p>

      {report ? (
        // 2026-05-15 — 사용자 피드백: "진행하기 좋은 시기 / 한 번 더 확인할 시기 가 2컬럼으로
        // 나오면 글이 길어서 보기 너무 힘들다." → 1열로 stack 해 각 카드가 풀 너비 사용.
        <div className="mt-3 grid gap-2">
          <TimingWindowCard title="진행하기 좋은 시기" windows={report.goodPeriods} tone="good" />
          <TimingWindowCard title="한 번 더 확인할 시기" windows={report.cautionPeriods} tone="caution" />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {monthlyFlows.map((flow) => (
          <MonthlyFlowCard key={`${flow.month}-${flow.summary.slice(0, 12)}`} flow={flow} defaultOpen={flow.month === 1} />
        ))}
      </div>
    </section>
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
  const toneClassName = tone === 'good' ? 'yearly-tone-good' : 'yearly-tone-caution';
  const Icon = tone === 'good' ? CheckCircle2 : AlertTriangle;

  return (
    <article className={`rounded-[16px] border px-4 py-4 ${toneClassName}`}>
      <div className="flex items-center gap-1.5 text-[12.1px] font-extrabold uppercase tracking-[0.06em]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p
            key={item}
            className="text-[15px] leading-[1.7]"
            style={{ wordBreak: 'keep-all' }}
          >
            {item}
          </p>
        ))}
      </div>
    </article>
  );
}

type YearlyChapter = 1 | 2 | 3;

function getChapterFromHash(hash: string): YearlyChapter | null {
  if (hash === '#yearly-chapter-1') return 1;
  if (hash === '#yearly-chapter-2') return 2;
  if (hash === '#yearly-chapter-3') return 3;
  return null;
}

function ChapterNavigation({
  chapter,
  onChange,
}: {
  chapter: YearlyChapter;
  onChange: (chapter: YearlyChapter) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[14px] border bg-white px-3 py-3"
      style={{ borderColor: 'var(--app-line)' }}
    >
      {chapter > 1 ? (
        <button
          type="button"
          onClick={() => onChange((chapter - 1) as YearlyChapter)}
          className="inline-flex h-10 items-center rounded-full border bg-white px-3.5 text-[14.4px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          ← 이전
        </button>
      ) : (
        <span />
      )}
      <div className="text-[13.2px] font-extrabold text-[var(--app-pink-strong)]">
        {chapter} / 3
      </div>
      {chapter < 3 ? (
        <button
          type="button"
          onClick={() => onChange((chapter + 1) as YearlyChapter)}
          className="inline-flex h-10 items-center rounded-full px-4 text-[14.4px] font-extrabold text-white"
          style={{
            background: 'var(--app-pink)',
            boxShadow: '0 8px 18px rgba(216,27,114,0.28)',
          }}
        >
          다음 →
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function DeepReadingLinks({ slug }: { slug: string }) {
  const encodedSlug = encodeURIComponent(slug);
  const links = [
    { label: '일주 본질', body: '내 사주의 기본 축을 봅니다.', href: `/saju/${encodedSlug}/overview` },
    { label: '오행 균형', body: '목·화·토·금·수 균형을 봅니다.', href: `/saju/${encodedSlug}/elements` },
    { label: '성향 구조', body: '성격과 관계 반응을 봅니다.', href: `/saju/${encodedSlug}/nature` },
    { label: '프리미엄 PDF', body: '보관용 화면으로 이어집니다.', href: `/saju/${encodedSlug}/premium/print` },
  ];

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-[14px] border bg-white p-4 transition-all hover:-translate-y-0.5"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-white"
              style={{ background: 'var(--app-pink)' }}
              aria-hidden="true"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <div className="text-[16.1px] font-extrabold text-[var(--app-ink)]">{link.label}</div>
          </div>
          <p
            className="mt-2 text-[14.4px] leading-[1.7] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {link.body}
          </p>
        </Link>
      ))}
    </div>
  );
}

export default function YearlyReportPanel({ slug, targetYear }: Props) {
  const { counselorId } = usePreferredCounselor();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<YearlyInterpretationResponse | null>(null);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [chapter, setChapter] = useState<YearlyChapter>(1);

  useEffect(() => {
    function syncChapterFromHash() {
      const nextChapter = getChapterFromHash(window.location.hash);
      if (!nextChapter) return;
      setChapter(nextChapter);
      window.setTimeout(() => {
        document.getElementById('yearly-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }

    syncChapterFromHash();
    window.addEventListener('hashchange', syncChapterFromHash);

    return () => window.removeEventListener('hashchange', syncChapterFromHash);
  }, []);

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
      <section
        className="rounded-[20px] border p-6"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-center">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[25.3px] font-extrabold"
            style={{
              background: '#fff',
              color: 'var(--app-pink-strong)',
              border: '1px solid var(--app-pink-line)',
              fontFamily: 'var(--font-han)',
              animation: 'gangi-float-y 3.6s ease-in-out infinite',
            }}
            aria-hidden="true"
          >
            年
          </div>
          <div className="mt-3 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            올해 흐름 정리 중
          </div>
          <h2 className="mt-1.5 text-[23px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]">
            {targetYear}년 흐름을 정리하고 있어요
          </h2>
          <p
            className="mt-2 text-[15px] leading-[1.7] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            타고난 사주와 올해·이번 달 흐름을 다시 맞추고, 선택 포인트를 정리하고 있어요.
          </p>
        </div>
        <ul className="mt-5 grid gap-1.5">
          {['올해 12개월 흐름 매칭', '분야별(일·돈·연애·관계) 정리', '월별 결정·주의 시기 산출'].map((label, index) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-[12px] border bg-white px-3.5 py-2.5 text-[14.4px] font-extrabold text-[var(--app-ink)]"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11.5px] font-extrabold text-white"
                style={{ background: 'var(--app-pink)' }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (state === 'error' || !data) {
    return (
      <section
        className="rounded-[20px] border p-5"
        style={{
          background: '#fdecec',
          borderColor: 'rgba(198,69,69,0.22)',
        }}
      >
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
          불러오기 실패
        </div>
        <h3 className="mt-1.5 text-[20.7px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]">
          올해 흐름을 열지 못했어요
        </h3>
        <p
          className="mt-2 text-[15px] leading-[1.7] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {error || '올해 흐름을 불러오지 못했습니다.'}
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full border bg-white px-4 text-[15px] font-extrabold text-[var(--app-ink)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          다시 불러오기
        </button>
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

  function goToChapter(nextChapter: YearlyChapter) {
    setChapter(nextChapter);
    window.setTimeout(() => {
      document.getElementById('yearly-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  const chapterLabels: Record<YearlyChapter, { kicker: string; title: string }> = {
    1: { kicker: '1장', title: '올해 흐름을 바로 읽습니다' },
    2: { kicker: '2장', title: '월별 흐름을 봅니다' },
    3: { kicker: '3장', title: '더 깊게 볼 부분을 고릅니다' },
  };

  return (
    <section id="yearly-report" className="space-y-4">
      {/* §Hero — amber tone (올해) + 年 한자 인장 + counselor 배지 */}
      <section
        className="relative overflow-hidden rounded-[20px] border p-5"
        style={{
          background: 'linear-gradient(180deg, #fdf6e7 0%, #fff 100%)',
          borderColor: 'rgba(184,122,20,0.22)',
          boxShadow: '0 22px 50px -28px rgba(184,122,20,0.22)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(184,122,20,0.18), transparent 70%)' }}
        />

        <div className="relative flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[25.3px] font-extrabold text-white"
            style={{
              background: 'linear-gradient(135deg, #d4982e, #b87a14)',
              boxShadow: '0 10px 22px rgba(184,122,20,0.32)',
              fontFamily: 'var(--font-han)',
            }}
            aria-hidden="true"
          >
            年
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full border bg-white px-2 py-0.5 text-[11.5px] font-extrabold"
                style={{ borderColor: 'rgba(184,122,20,0.28)', color: '#b87a14' }}
              >
                {data.counselorId === 'male' ? '남선생' : '여선생'}
              </span>
              <span
                className="rounded-full border bg-white px-2 py-0.5 text-[11.5px] font-extrabold text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {data.cached ? '✓ 저장됨' : '✦ 새로 정리'}
              </span>
            </div>
            <div
              className="mt-1.5 text-[12.1px] font-extrabold uppercase tracking-[0.06em]"
              style={{ color: '#b87a14' }}
            >
              {targetYear} 올해 흐름 · {chapterLabels[chapter].kicker}
            </div>
            <h2
              className="mt-1 text-[25.3px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {chapterLabels[chapter].title}
            </h2>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-[13.2px] text-[var(--app-copy-muted)]">
          {updatedAtLabel ? <span>최근 생성: {updatedAtLabel}</span> : null}
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-full border bg-white px-2.5 text-[13.2px] font-extrabold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            ↻ 다시 생성
          </button>
        </div>

        {/* 챕터 tabs */}
        <div className="relative mt-4 grid grid-cols-3 gap-1.5">
          {([1, 2, 3] as YearlyChapter[]).map((index) => {
            const active = chapter === index;
            return (
              <button
                key={index}
                type="button"
                onClick={() => goToChapter(index)}
                className="rounded-[12px] border px-2 py-2.5 text-center text-[13.8px] font-extrabold transition-colors"
                style={{
                  background: active ? '#b87a14' : '#fff',
                  borderColor: active ? '#b87a14' : 'rgba(184,122,20,0.22)',
                  color: active ? '#fff' : '#b87a14',
                  boxShadow: active ? '0 6px 14px rgba(184,122,20,0.32)' : undefined,
                }}
              >
                {index === 1 ? '연간 한눈' : index === 2 ? '월별 흐름' : '더 깊게'}
              </button>
            );
          })}
        </div>
      </section>

      {chapter === 1 ? (
        <>
          {/* §올해 한 줄 — pink-soft 가장 큰 강조 */}
          <article
            className="rounded-[20px] border p-5"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              올해 한 줄 먼저
            </div>
            <p
              className="mt-2 text-[20.7px] font-extrabold leading-[1.55] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {interpretation.oneLineSummary}
            </p>
            <div className="mt-3 space-y-2">{renderCompactParagraphs(interpretation.opening, 2)}</div>
          </article>

          <YearlyVisualMap report={data.report} />

          {/* §핵심 키워드 */}
          <section
            className="rounded-[18px] border bg-white p-5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              올해 핵심 키워드
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {interpretation.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border bg-white px-3 py-1.5 text-[13.8px] font-bold text-[var(--app-copy)]"
                  style={{ borderColor: 'var(--app-line)', wordBreak: 'keep-all' }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </section>

          {/* §상하반기 — 2026-05-15 각 카드에 paragraph 3개씩 들어가 매우 긴 콘텐츠. 1열 stack. */}
          <div className="grid gap-2.5">
            <article
              className="rounded-[18px] border bg-white p-5"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-[13.8px] font-extrabold text-white"
                  style={{ background: 'var(--app-pink)', fontFamily: 'var(--font-han)' }}
                  aria-hidden="true"
                >
                  上
                </span>
                <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  상반기 먼저 볼 것
                </div>
              </div>
              <div className="mt-3 space-y-2">{renderCompactParagraphs(interpretation.firstHalf, 3)}</div>
            </article>
            <article
              className="rounded-[18px] border bg-white p-5"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-[13.8px] font-extrabold text-white"
                  style={{ background: 'var(--app-pink)', fontFamily: 'var(--font-han)' }}
                  aria-hidden="true"
                >
                  下
                </span>
                <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  하반기 먼저 볼 것
                </div>
              </div>
              <div className="mt-3 space-y-2">{renderCompactParagraphs(interpretation.secondHalf, 3)}</div>
            </article>
          </div>

          {/* §4 핵심 분야 */}
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              사람들이 가장 많이 묻는 4가지
            </div>
            <h3 className="mt-1 text-[19.5px] font-extrabold leading-snug text-[var(--app-ink)]">
              일·돈·연애·관계 한눈에
            </h3>
            <p
              className="mt-2 text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              각 분야 카드를 펼치면 핵심 / 기회 / 주의 / 행동을 한 줄씩 봅니다.
            </p>
            <div className="mt-3 grid gap-2.5">
              {coreCards.map((item, index) => (
                <CoreAreaCard
                  key={item.key}
                  item={item}
                  prose={interpretation.categories[item.key]}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          </section>

          {/* §건강/이동 — 2026-05-15 SupportAreaCard 가 긴 prose+basis 들고 있음. 1열 stack. */}
          <div className="grid gap-2.5">
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
        </>
      ) : null}

      {chapter === 2 ? (
        <>
          <YearlyMonthlySection report={data.report} interpretation={interpretation} />

          {/* 2026-05-15 — 사용자 피드백: "좋은 시기 활용법 / 조심해야 할 시기 / 행동 조언"
              3컬럼으로 좁아 본문이 5~10자씩 끊김. 1열 stack 으로 풀 너비 본문. */}
          <div className="grid gap-2.5">
            <TimingSummaryBlock title="좋은 시기 활용법" items={data.interpretation.goodPeriods} tone="good" />
            <TimingSummaryBlock title="조심해야 할 시기" items={data.interpretation.cautionPeriods} tone="caution" />
            <article
              className="rounded-[18px] border bg-white p-5"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                행동 조언
              </div>
              <div className="mt-3 space-y-2">
                {data.interpretation.actionAdvice.map((item) => (
                  <p
                    key={item}
                    className="text-[15.5px] leading-[1.78] text-[var(--app-copy)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </article>
          </div>
        </>
      ) : null}

      {chapter === 3 ? (
        <>
          <section
            className="rounded-[20px] border bg-white p-5"
            style={{ borderColor: 'var(--app-pink-line)' }}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full px-2.5 py-1 text-[12.1px] font-extrabold text-white"
                style={{
                  background: 'var(--app-pink)',
                  boxShadow: '0 4px 10px rgba(216,27,114,0.28)',
                }}
              >
                프리미엄 이용권
              </span>
              <span
                className="rounded-full border bg-white px-2.5 py-1 text-[12.1px] font-extrabold text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                별도 열림
              </span>
            </div>
            <h3
              className="mt-3 text-[21.8px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              더 궁금한 부분은 아래 버튼으로 이어보세요
            </h3>
            <p
              className="mt-2 text-[15px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              일주 본질, 오행 균형, 성향 구조는 각각 별도 화면으로 열리게 연결했습니다.
            </p>
            <DeepReadingLinks slug={slug} />
          </section>

          <details className="group" id="yearly-evidence">
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[14px] border bg-white px-5 py-3.5 text-[14.4px] font-extrabold text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <span>계산 정보와 검증 보기</span>
              <span className="text-[11.5px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
            </summary>
            <div className="mt-3 grid gap-3">
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
        </>
      ) : null}

      <ChapterNavigation chapter={chapter} onChange={goToChapter} />
    </section>
  );
}
