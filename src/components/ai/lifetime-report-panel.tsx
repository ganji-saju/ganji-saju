// Redesign 2026-05-14: 깊은 사주풀이 패널 PR6+ 디자인 언어 전면 적용.
// 데이터 페칭/상태/AI 인터프리테이션 키는 모두 유지. JSX/스타일만 새로 작성.
// - pink-soft hero + 月 한자 인장
// - 4기둥 카드: pink-line + han-font 24px
// - 9 챕터: 토큰 컬러 사이클(pink/jade/amber/indigo/coral) + 번호 배지
// - 대운 타임라인: 세로 핑크 라인 + 현재 dot + cycle 카드
// - readability: 14px / line-height 1.78 / word-break keep-all
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BriefcaseBusiness,
  Heart,
  RefreshCw,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { GroundingKasiSummary } from '@/components/ai/grounding-kasi-summary';
import { EngineMethodLinks } from '@/components/content/engine-method-links';
import type { SajuInterpretationGrounding } from '@/domain/saju/report';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import type { MoonlightCounselorId } from '@/lib/counselors';
import type { SajuReportRuntimeMetadata } from '@/lib/saju/report-metadata';
import type { AiFallbackReason, AiGenerationSource } from '@/server/ai/openai-text';
import type { SajuLifetimeReport } from '@/domain/saju/report/lifetime-types';
import type { SajuLifetimeAiInterpretation } from '@/server/ai/saju-lifetime-interpretation';
import { limitSajuSentences, simplifySajuCopy } from '@/lib/saju/public-copy';

interface Props {
  slug: string;
  targetYear: number;
}

interface LifetimeInterpretationResponse {
  ok: boolean;
  readingId: string;
  resolvedReadingId: string;
  readingSource: 'database-reading-id' | 'deterministic-slug';
  targetYear: number;
  counselorId: MoonlightCounselorId;
  promptVersion: string;
  metadata: SajuReportRuntimeMetadata;
  cached: false;
  cacheable: false;
  source: AiGenerationSource;
  model: string | null;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
  generationMs: number;
  grounding: SajuInterpretationGrounding;
  kasiComparison: KasiSingleInputComparison | null;
  interpretation: SajuLifetimeAiInterpretation;
  report: SajuLifetimeReport;
  reportText: string;
  stageResults: Array<{
    key: 'full';
    source: AiGenerationSource;
    fallbackReason: AiFallbackReason | null;
    errorMessage: string | null;
    durationMs: number;
  }>;
}

// 9개 챕터 메타 — 토큰 컬러 cycling.
const SECTION_META = [
  { key: 'coreIdentity', label: '타고난 성향', tone: 'pink' },
  { key: 'strengthBalance', label: '기운의 균형', tone: 'jade' },
  { key: 'patternAndYongsin', label: '역할과 보완 힌트', tone: 'amber' },
  { key: 'relationshipPattern', label: '관계 패턴', tone: 'coral' },
  { key: 'wealthStyle', label: '재물 감각', tone: 'amber' },
  { key: 'careerDirection', label: '직업 방향', tone: 'indigo' },
  { key: 'healthRhythm', label: '건강 리듬', tone: 'jade' },
  { key: 'majorLuckTimeline', label: '10년 단위 큰 흐름 (대운)', tone: 'pink' },
  { key: 'lifetimeStrategy', label: '평생 활용 전략', tone: 'indigo' },
] as const;

type ToneKey = 'pink' | 'jade' | 'amber' | 'coral' | 'indigo';

const TONES: Record<ToneKey, {
  accent: string;
  soft: string;
  border: string;
  innerBorder: string;
}> = {
  pink: { accent: 'var(--app-pink-strong)', soft: 'var(--app-pink-soft)', border: 'var(--app-pink-line)', innerBorder: 'rgba(216,27,114,0.18)' },
  jade: { accent: 'var(--app-jade)', soft: '#e8f5ee', border: 'rgba(45,135,88,0.22)', innerBorder: 'rgba(45,135,88,0.18)' },
  amber: { accent: '#b87a14', soft: '#fdf6e7', border: 'rgba(184,122,20,0.22)', innerBorder: 'rgba(184,122,20,0.18)' },
  coral: { accent: 'var(--app-coral)', soft: '#fdecec', border: 'rgba(198,69,69,0.22)', innerBorder: 'rgba(198,69,69,0.18)' },
  indigo: { accent: '#4a5cb8', soft: '#eef0fb', border: 'rgba(74,92,184,0.22)', innerBorder: 'rgba(74,92,184,0.18)' },
};

function splitParagraphs(text: string) {
  return simplifySajuCopy(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderParagraphs(text: string) {
  return splitParagraphs(text).map((paragraph, index) => (
    <p
      key={`${paragraph.slice(0, 24)}-${index}`}
      className="text-[14px] leading-[1.78] text-[var(--app-copy)]"
      style={{ wordBreak: 'keep-all' }}
    >
      {paragraph}
    </p>
  ));
}

function FactCard({ label, body, tone = 'pink' }: { label: string; body: string; tone?: ToneKey }) {
  const palette = TONES[tone];
  return (
    <div
      className="rounded-[14px] border bg-white p-4"
      style={{ borderColor: palette.innerBorder }}
    >
      <div
        className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
        style={{ color: palette.accent }}
      >
        {label}
      </div>
      <p
        className="mt-2 text-[13.5px] leading-[1.7] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {limitSajuSentences(body, 2)}
      </p>
    </div>
  );
}

function BasisNotes({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <details className="group mt-4">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border bg-white px-4 py-3 text-[12.5px] font-extrabold text-[var(--app-copy-muted)]"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <span>풀이 배경 보기</span>
        <span className="text-[10px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
      </summary>
      <div className="mt-2 grid gap-2">
        {items.map((line) => (
          <div
            key={line}
            className="rounded-[12px] border bg-white px-4 py-3 text-[12.5px] leading-[1.7] text-[var(--app-copy-soft)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            {simplifySajuCopy(line)}
          </div>
        ))}
      </div>
    </details>
  );
}

function uniqueLifetimeBasisLines(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      items
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function getLifetimeBasisLines(
  sectionKey: (typeof SECTION_META)[number]['key'],
  report: SajuLifetimeReport,
) {
  if (sectionKey === 'patternAndYongsin') {
    return uniqueLifetimeBasisLines([
      ...report.patternAndYongsin.basis,
      ...report.patternAndYongsin.detailLines,
    ]);
  }
  const reportSection = report[sectionKey] as { basis?: string[] };
  return uniqueLifetimeBasisLines(reportSection.basis ?? []);
}

function getLifetimeSectionId(sectionKey: (typeof SECTION_META)[number]['key']) {
  return `lifetime-${sectionKey}`;
}

function LifetimeSummaryCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  href,
  tone,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  tone: ToneKey;
}) {
  const palette = TONES[tone];
  return (
    <Link
      href={href}
      className="group block rounded-[16px] border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(216,27,114,0.12)]"
      style={{ borderColor: palette.innerBorder }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
          style={{
            background: palette.accent,
            boxShadow: `0 6px 14px ${palette.accent}40`,
          }}
          aria-hidden="true"
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <div
            className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
            style={{ color: palette.accent }}
          >
            {eyebrow}
          </div>
          <div className="mt-0.5 text-[14.5px] font-extrabold leading-[1.4] text-[var(--app-ink)]">
            {title}
          </div>
          <p
            className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {body}
          </p>
        </div>
      </div>
    </Link>
  );
}

function LifetimeAtAGlance({
  interpretation,
  report,
}: {
  interpretation: SajuLifetimeAiInterpretation;
  report: SajuLifetimeReport;
}) {
  return (
    <section
      className="rounded-[20px] border p-5"
      style={{
        background: 'var(--app-pink-soft)',
        borderColor: 'var(--app-pink-line)',
      }}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        한 장 요약
      </div>
      <h3
        className="mt-1.5 text-[20px] font-extrabold leading-[1.35] tracking-tight text-[var(--app-ink)]"
        style={{ wordBreak: 'keep-all' }}
      >
        먼저 이 장면만 보세요
      </h3>
      <article
        className="mt-4 rounded-[14px] border bg-white p-4"
        style={{ borderColor: 'var(--app-pink-line)' }}
      >
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          기억할 한 줄
        </div>
        <p
          className="mt-2 text-[14.5px] leading-[1.7] font-bold text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {interpretation.lifetimeRule}
        </p>
      </article>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <LifetimeSummaryCard
          icon={Sparkles}
          eyebrow="타고난 결"
          title="어떤 환경에서 잘 살아나는가"
          body={report.coreIdentity.bestEnvironment}
          href={`#${getLifetimeSectionId('coreIdentity')}`}
          tone="pink"
        />
        <LifetimeSummaryCard
          icon={WalletCards}
          eyebrow="재물"
          title="돈을 벌고 지키는 방식"
          body={report.wealthStyle.earningStyle}
          href={`#${getLifetimeSectionId('wealthStyle')}`}
          tone="amber"
        />
        <LifetimeSummaryCard
          icon={BriefcaseBusiness}
          eyebrow="일"
          title="잘 맞는 일의 구조"
          body={report.careerDirection.fitStructure}
          href={`#${getLifetimeSectionId('careerDirection')}`}
          tone="indigo"
        />
        <LifetimeSummaryCard
          icon={Heart}
          eyebrow="관계"
          title="사람과 거리를 잡는 방식"
          body={report.relationshipPattern.distanceStyle}
          href={`#${getLifetimeSectionId('relationshipPattern')}`}
          tone="coral"
        />
        <LifetimeSummaryCard
          icon={Activity}
          eyebrow="건강 리듬"
          title="무너질 때 회복하는 법"
          body={report.healthRhythm.recoveryRoutine}
          href={`#${getLifetimeSectionId('healthRhythm')}`}
          tone="jade"
        />
      </div>
    </section>
  );
}

// 2026-05-15 PR 2 응답 2 — 8단 sub-section ExpandableCard 재설계.
// 현재 cycle 은 default expanded, 나머지는 접힘. summary/task fallback 유지 (회귀 보호).
function MajorLuckTimeline({
  report,
}: {
  report: SajuLifetimeReport;
}) {
  const palette = TONES.pink;
  return (
    <div className="relative mt-4 pl-8">
      {/* 세로 라인 */}
      <span
        aria-hidden="true"
        className="absolute left-3 top-2 bottom-2 w-[2px] rounded-full"
        style={{ background: 'var(--app-pink-line)' }}
      />
      <div className="space-y-3">
        {report.majorLuckTimeline.cycles.map((cycle) => (
          <div key={`${cycle.ageLabel}-${cycle.ganzi}`} className="relative">
            {/* dot */}
            <span
              aria-hidden="true"
              className="absolute -left-[1.7rem] top-3 grid h-5 w-5 place-items-center rounded-full"
              style={{
                background: cycle.isCurrent ? palette.accent : '#fff',
                border: `2px solid ${cycle.isCurrent ? palette.accent : 'var(--app-pink-line)'}`,
                boxShadow: cycle.isCurrent ? '0 4px 12px rgba(216,27,114,0.35)' : undefined,
              }}
            >
              {cycle.isCurrent ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
            </span>
            <details
              open={cycle.isCurrent}
              className="group rounded-[14px] border bg-white"
              style={{
                borderColor: cycle.isCurrent ? palette.accent : 'var(--app-line)',
                background: cycle.isCurrent ? palette.soft : '#fff',
                boxShadow: cycle.isCurrent ? '0 14px 28px -16px rgba(216,27,114,0.22)' : undefined,
              }}
            >
              <summary className="flex cursor-pointer list-none flex-col gap-2 p-4 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--app-copy-muted)]"
                    style={{ borderColor: 'var(--app-line)' }}
                  >
                    {cycle.ageLabel}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold text-white"
                    style={{ background: palette.accent }}
                  >
                    {cycle.phase}
                  </span>
                  {cycle.isCurrent ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold text-white"
                      style={{
                        background: 'var(--app-ink)',
                        boxShadow: '0 4px 10px rgba(15,23,42,0.22)',
                      }}
                    >
                      ✦ 현재 흐름
                    </span>
                  ) : null}
                  {/* 2026-05-15 PR 7 응답 2 — 12운성 chip (PR 6 산출 활용) */}
                  {cycle.twelveStage ? (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold"
                      style={{
                        background: '#eef0f8',
                        borderColor: 'rgba(82, 102, 162, 0.22)',
                        color: 'var(--app-indigo)',
                      }}
                    >
                      {cycle.twelveStage}지
                    </span>
                  ) : null}
                  {/* 2026-05-15 PR 7 응답 2 — 원진 chip (사주 원국 자리와 원진 페어 발생 시) */}
                  {cycle.wonjinWith && cycle.wonjinWith.length > 0 ? (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold"
                      style={{
                        background: '#fff3d6',
                        borderColor: 'rgba(212, 148, 38, 0.32)',
                        color: 'var(--app-amber)',
                      }}
                      title={`원진 페어 자리: ${cycle.wonjinWith.join(' · ')}`}
                    >
                      원진 · {cycle.wonjinWith[0]}
                    </span>
                  ) : null}
                  <span
                    aria-hidden="true"
                    className="ml-auto text-[12px] font-bold text-[var(--app-copy-muted)] transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <h4
                    className="text-[18px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
                    style={{ fontFamily: 'var(--font-han)' }}
                  >
                    {cycle.ganzi}
                  </h4>
                  {cycle.chapterTitle ? (
                    <span
                      className="text-[12.5px] font-bold leading-[1.45] text-[var(--app-pink-strong)]"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      {cycle.chapterTitle}
                    </span>
                  ) : null}
                </div>
                {cycle.hook ? (
                  <p
                    className="text-[13.5px] leading-[1.65] text-[var(--app-copy)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {cycle.hook}
                  </p>
                ) : (
                  <p
                    className="text-[13.5px] leading-[1.65] text-[var(--app-copy)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {cycle.summary}
                  </p>
                )}
              </summary>

              <div
                className="grid gap-3 border-t px-4 py-4"
                style={{ borderColor: cycle.isCurrent ? palette.accent : 'var(--app-line)' }}
              >
                {cycle.chapterBody ? (
                  <CycleSection label="이 10년 흐름" body={cycle.chapterBody} />
                ) : null}
                {cycle.mental ? <CycleSection label="내면·멘탈 🧠" body={cycle.mental} /> : null}
                {cycle.relationship ? (
                  <CycleSection label="관계·로맨스 💞" body={cycle.relationship} />
                ) : null}
                {cycle.wealthCareer ? (
                  <CycleSection label="돈·커리어 💰" body={cycle.wealthCareer} />
                ) : null}
                {cycle.practicalActions && cycle.practicalActions.length > 0 ? (
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                      개운법 🧭
                    </div>
                    <ol className="mt-2 grid gap-2">
                      {cycle.practicalActions.map((action, index) => (
                        <li
                          key={`${cycle.ganzi}-action-${index}`}
                          className="rounded-[12px] border bg-white p-3"
                          style={{ borderColor: 'var(--app-pink-line)' }}
                        >
                          <div className="text-[11.5px] font-bold text-[var(--app-pink-strong)]">
                            {index + 1}. {action.what}
                          </div>
                          <p
                            className="mt-1 text-[12.5px] leading-[1.6] text-[var(--app-copy)]"
                            style={{ wordBreak: 'keep-all' }}
                          >
                            <span className="font-bold text-[var(--app-copy-muted)]">왜 ›</span> {action.reason}
                          </p>
                          <p
                            className="mt-0.5 text-[12.5px] leading-[1.6] text-[var(--app-copy)]"
                            style={{ wordBreak: 'keep-all' }}
                          >
                            <span className="font-bold text-[var(--app-copy-muted)]">어떻게 ›</span> {action.how}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {cycle.closingNote ? (
                  <CycleSection
                    label="마지막 한마디 ✨"
                    body={cycle.closingNote}
                    tone="emphasis"
                  />
                ) : null}
                {/* fallback — 8 sub-section 미산출 시 기존 summary/task 노출 */}
                {!cycle.chapterBody && !cycle.mental ? (
                  <CycleSection label="흐름 요약" body={cycle.summary} />
                ) : null}
                {!cycle.practicalActions || cycle.practicalActions.length === 0 ? (
                  cycle.task ? <CycleSection label="해야 할 일" body={cycle.task} /> : null
                ) : null}
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

function CycleSection({
  label,
  body,
  tone = 'default',
}: {
  label: string;
  body: string;
  tone?: 'default' | 'emphasis';
}) {
  return (
    <div
      className="rounded-[10px] px-3 py-2"
      style={
        tone === 'emphasis'
          ? {
              background: 'var(--app-pink-soft)',
              border: '1px solid var(--app-pink-line)',
            }
          : undefined
      }
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        {label}
      </div>
      <p
        className="mt-1 text-[13px] leading-[1.7] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {body}
      </p>
    </div>
  );
}

function LifetimeSectionBody({
  sectionKey,
  tone,
  interpretation,
  report,
}: {
  sectionKey: (typeof SECTION_META)[number]['key'];
  tone: ToneKey;
  interpretation: SajuLifetimeAiInterpretation;
  report: SajuLifetimeReport;
}) {
  switch (sectionKey) {
    case 'coreIdentity':
      return (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <FactCard label="반응 방식" body={report.coreIdentity.reactionStyle} tone={tone} />
          <FactCard label="강점 환경" body={report.coreIdentity.bestEnvironment} tone={tone} />
          <FactCard label="무너지기 쉬운 패턴" body={report.coreIdentity.weakPattern} tone={tone} />
        </div>
      );
    case 'strengthBalance':
      return (
        <>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <FactCard label="강한 축" body={report.strengthBalance.strongAxis} tone={tone} />
            <FactCard label="약한 축" body={report.strengthBalance.weakAxis} tone={tone} />
            <FactCard label="에너지 소모 방식" body={report.strengthBalance.energyDrain} tone={tone} />
            <FactCard label="회복 방식" body={report.strengthBalance.recovery} tone={tone} />
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {report.strengthBalance.elementHighlights.map((item) => (
              <div
                key={item}
                className="rounded-[12px] border bg-white px-4 py-2.5 text-[13px] leading-[1.65] text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)', wordBreak: 'keep-all' }}
              >
                {item}
              </div>
            ))}
          </div>
          <details className="group mt-4">
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] border bg-white px-4 py-3 text-[12.5px] font-extrabold text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <span>생활 균형 포인트 보기</span>
              <span className="text-[10px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {report.strengthBalance.balanceGuide.map((item) => (
                <span
                  key={item}
                  className="rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--app-copy)]"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  {simplifySajuCopy(item)}
                </span>
              ))}
            </div>
          </details>
        </>
      );
    case 'patternAndYongsin':
      return (
        <>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <FactCard label="삶의 역할" body={report.patternAndYongsin.patternRole} tone={tone} />
            <FactCard label="보완 방향" body={report.patternAndYongsin.yongsinDirection} tone={tone} />
            <FactCard label="평생 선택 힌트" body={report.patternAndYongsin.choiceRule} tone={tone} />
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div
              className="rounded-[14px] border bg-white p-4"
              style={{ borderColor: 'rgba(45,135,88,0.18)' }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                살려야 할 기운
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {report.patternAndYongsin.supportSymbols.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold"
                    style={{
                      background: '#e8f5ee',
                      borderColor: 'rgba(45,135,88,0.22)',
                      color: 'var(--app-jade)',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="rounded-[14px] border bg-white p-4"
              style={{ borderColor: 'rgba(198,69,69,0.18)' }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
                조절할 기운
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {report.patternAndYongsin.cautionSymbols.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold"
                    style={{
                      background: '#fdecec',
                      borderColor: 'rgba(198,69,69,0.22)',
                      color: 'var(--app-coral)',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    case 'relationshipPattern':
      return (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <FactCard label="거리감" body={report.relationshipPattern.distanceStyle} tone={tone} />
          <FactCard label="감정 표현 방식" body={report.relationshipPattern.expressionStyle} tone={tone} />
          <FactCard label="갈등 지점" body={report.relationshipPattern.conflictTriggers} tone={tone} />
          <FactCard label="오래 가는 법" body={report.relationshipPattern.longevityGuide} tone={tone} />
        </div>
      );
    case 'wealthStyle':
      return (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <FactCard label="돈을 버는 방식" body={report.wealthStyle.earningStyle} tone={tone} />
          <FactCard label="돈을 지키는 방식" body={report.wealthStyle.keepingStyle} tone={tone} />
          <FactCard label="지출 실수 패턴" body={report.wealthStyle.spendingMistakes} tone={tone} />
          <FactCard label="맞는 운영 스타일" body={report.wealthStyle.operatingStyle} tone={tone} />
        </div>
      );
    case 'careerDirection':
      return (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <FactCard label="잘 맞는 일의 구조" body={report.careerDirection.fitStructure} tone={tone} />
          <FactCard label="버티는 일 vs 빛나는 일" body={report.careerDirection.endureVsShine} tone={tone} />
          <FactCard label="독립 / 조직 적성" body={report.careerDirection.independenceStyle} tone={tone} />
          <FactCard label="인정받는 방식" body={report.careerDirection.recognitionStyle} tone={tone} />
        </div>
      );
    case 'healthRhythm':
      return (
        <>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <FactCard label="무너질 때 신호" body={report.healthRhythm.warningSignals} tone={tone} />
            <FactCard label="회복 루틴" body={report.healthRhythm.recoveryRoutine} tone={tone} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {report.healthRhythm.habitPoints.map((item) => (
              <span
                key={item}
                className="rounded-full border bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {item}
              </span>
            ))}
          </div>
        </>
      );
    case 'majorLuckTimeline':
      return <MajorLuckTimeline report={report} />;
    case 'lifetimeStrategy':
      return (
        <>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <FactCard label="잘 될 때의 태도" body={report.lifetimeStrategy.useWhenStrong.join(' ')} tone={tone} />
            <FactCard label="흔들릴 때의 방어법" body={report.lifetimeStrategy.defendWhenShaken.join(' ')} tone={tone} />
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {interpretation.rememberRules.map((item) => (
              <div
                key={item}
                className="rounded-[12px] border bg-white px-4 py-2.5 text-[13px] leading-[1.65] text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)', wordBreak: 'keep-all' }}
              >
                {item}
              </div>
            ))}
          </div>
        </>
      );
  }
}

export default function LifetimeReportPanel({ slug, targetYear }: Props) {
  const { counselorId } = usePreferredCounselor();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<LifetimeInterpretationResponse | null>(null);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState('loading');
      setError('');

      try {
        const response = await fetch('/api/interpret/lifetime', {
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
          | LifetimeInterpretationResponse
          | { error?: string }
          | null;

        if (!response.ok || !payload || !('ok' in payload) || payload.ok !== true) {
          setError(payload && 'error' in payload && payload.error ? payload.error : '깊은 사주풀이를 불러오지 못했습니다.');
          setState('error');
          return;
        }

        setData(payload);
        setState('ready');
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') return;
        setError('깊은 사주풀이를 불러오는 중 오류가 발생했습니다.');
        setState('error');
      }
    }

    void load();
    return () => controller.abort();
  }, [slug, targetYear, counselorId, reloadToken]);

  // §Loading — pink-soft + 月 한자 배지 + 진행 단계
  if (state === 'loading') {
    return (
      <section
        id="lifetime-report"
        className="rounded-[20px] border p-6"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-center">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[22px] font-extrabold"
            style={{
              background: '#fff',
              color: 'var(--app-pink-strong)',
              border: '1px solid var(--app-pink-line)',
              fontFamily: 'var(--font-han)',
              animation: 'gangi-float-y 3.6s ease-in-out infinite',
            }}
            aria-hidden="true"
          >
            月
          </div>
          <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            깊은 사주풀이 생성 중
          </div>
          <h2 className="mt-1.5 text-[20px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]">
            타고난 사주를 정리하고 있어요
          </h2>
          <p className="mt-2 text-[13px] leading-[1.7] text-[var(--app-copy-muted)]" style={{ wordBreak: 'keep-all' }}>
            성향·관계·재물·일·건강·대운·평생 전략까지 9개 챕터로 묶어드릴게요.
          </p>
        </div>
        <ul className="mt-5 grid gap-1.5">
          {['타고난 성향과 보완 방향 정리', '10년 단위 대운 흐름 매칭', '평생 활용 전략 작성'].map((label, index) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-[12px] border bg-white px-3.5 py-2.5 text-[12.5px] font-extrabold text-[var(--app-ink)]"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white"
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

  // §Error — coral
  if (state === 'error' || !data) {
    return (
      <section
        id="lifetime-report"
        className="rounded-[20px] border p-5"
        style={{
          background: '#fdecec',
          borderColor: 'rgba(198,69,69,0.22)',
        }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
          불러오기 실패
        </div>
        <h3 className="mt-1.5 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]">
          깊은 사주풀이를 열지 못했어요
        </h3>
        <p className="mt-2 text-[13px] leading-[1.7] text-[var(--app-copy)]" style={{ wordBreak: 'keep-all' }}>
          {error || '깊은 사주풀이를 불러오지 못했습니다.'}
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="mt-4 inline-flex h-11 items-center justify-center gap-1.5 rounded-full border bg-white px-4 text-[13px] font-extrabold text-[var(--app-ink)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <RefreshCw className="h-4 w-4" />
          다시 불러오기
        </button>
      </section>
    );
  }

  const interpretation = data.interpretation;
  const report = data.report;

  return (
    <section id="lifetime-report" className="space-y-4">
      {/* §Hero — pink-soft + 月 인장 + counselor 배지 + 사주표 */}
      <section
        className="relative overflow-hidden rounded-[20px] border p-5"
        style={{
          background: 'linear-gradient(180deg, var(--app-pink-soft) 0%, #fff 100%)',
          borderColor: 'var(--app-pink-line)',
          boxShadow: '0 22px 50px -28px rgba(216,27,114,0.22)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,79,154,0.18), transparent 70%)' }}
        />

        <div className="relative flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[22px] font-extrabold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
              boxShadow: '0 10px 22px rgba(216,27,114,0.32)',
              fontFamily: 'var(--font-han)',
            }}
            aria-hidden="true"
          >
            月
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold text-[var(--app-pink-strong)]"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                {data.counselorId === 'male' ? '달빛 남선생' : '달빛 여선생'}
              </span>
              <span
                className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                ✦ 깊은 풀이
              </span>
            </div>
            <h2
              className="mt-1.5 text-[22px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              내 사주를 자세히
              <br />
              정리했습니다
            </h2>
            <p
              className="mt-2 text-[13px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              어떤 환경에서 잘 살아나는지, 어디서 무리하기 쉬운지 먼저 봅니다.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="relative mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[12px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          다시 생성
        </button>

        {/* 4기둥 */}
        <div className="relative mt-4 grid grid-cols-4 gap-2">
          {[
            ['년주', report.pillars.year],
            ['월주', report.pillars.month],
            ['일주', report.pillars.day],
            ['시주', report.pillars.hour ?? '미입력'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[12px] border bg-white p-2.5 text-center"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                {label}
              </div>
              <div
                className="mt-1 text-[18px] font-extrabold text-[var(--app-ink)]"
                style={{ fontFamily: 'var(--font-han)' }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* 키워드 chips */}
        {interpretation.keywords.length > 0 ? (
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {interpretation.keywords.slice(0, 6).map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border bg-white px-2.5 py-1 text-[11.5px] font-bold text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* §Opening + lifetime rule */}
      <section
        className="rounded-[20px] border bg-white p-5"
        style={{ borderColor: 'var(--app-pink-line)' }}
      >
        <div className="space-y-2.5">{renderParagraphs(interpretation.opening)}</div>
        <article
          className="mt-4 rounded-[14px] border p-4"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            이 사주의 평생 힌트
          </div>
          <p
            className="mt-2 text-[14px] leading-[1.7] font-bold text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {interpretation.lifetimeRule}
          </p>
        </article>
      </section>

      <LifetimeAtAGlance interpretation={interpretation} report={report} />

      {/* §챕터 nav */}
      <section className="rounded-[20px] border bg-white p-5" style={{ borderColor: 'var(--app-line)' }}>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          바로 보기
        </div>
        <h3 className="mt-1 text-[17px] font-extrabold leading-snug text-[var(--app-ink)]">
          필요한 장으로 바로 이동합니다
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECTION_META.map((section, index) => {
            const palette = TONES[section.tone];
            return (
              <Link
                key={section.key}
                href={`#${getLifetimeSectionId(section.key)}`}
                className="flex items-center gap-2.5 rounded-[12px] border bg-white p-3 transition-colors hover:bg-[var(--app-pink-soft)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                  style={{ background: palette.accent }}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] font-extrabold text-[var(--app-ink)]">
                  {section.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* §9개 챕터 */}
      {SECTION_META.map((section, index) => {
        const reportSection = report[section.key];
        const basisLines = getLifetimeBasisLines(section.key, report);
        const palette = TONES[section.tone];

        return (
          <section
            key={section.key}
            id={getLifetimeSectionId(section.key)}
            className="scroll-mt-28 rounded-[20px] border bg-white p-5"
            style={{ borderColor: palette.border }}
          >
            <div className="flex items-center gap-2">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] text-[14px] font-extrabold text-white"
                style={{
                  background: palette.accent,
                  boxShadow: `0 6px 14px ${palette.accent}40`,
                  fontFamily: 'var(--font-han)',
                }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
                  style={{ color: palette.accent }}
                >
                  {index + 1}장 · {section.label}
                </div>
                <h3
                  className="mt-0.5 text-[19px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {reportSection.headline}
                </h3>
              </div>
            </div>

            <article
              className="mt-4 rounded-[14px] border p-4"
              style={{
                background: palette.soft,
                borderColor: palette.border,
              }}
            >
              <div className="space-y-2.5">
                {renderParagraphs(interpretation.sections[section.key])}
              </div>
            </article>

            <LifetimeSectionBody
              sectionKey={section.key}
              tone={section.tone}
              interpretation={interpretation}
              report={report}
            />
            <BasisNotes items={basisLines} />
          </section>
        );
      })}

      {/* §부록 — 올해 요약 (lifetime 구매자에게는 보너스) */}
      <section
        className="rounded-[20px] border p-5"
        style={{
          background: 'linear-gradient(180deg, #eef0fb 0%, #fff 100%)',
          borderColor: 'rgba(74,92,184,0.22)',
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold"
            style={{ borderColor: 'rgba(74,92,184,0.22)', color: '#4a5cb8' }}
          >
            부록
          </span>
          <span
            className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold"
            style={{ borderColor: 'rgba(74,92,184,0.22)', color: '#4a5cb8' }}
          >
            {report.yearlyAppendix.yearLabel} · {report.yearlyAppendix.yearGanji}
          </span>
        </div>
        <h3 className="mt-2 text-[19px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
          {report.yearlyAppendix.headline}
        </h3>
        <p className="mt-2 text-[13.5px] leading-[1.7] text-[var(--app-copy)]" style={{ wordBreak: 'keep-all' }}>
          {report.yearlyAppendix.oneLineSummary}
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <FactCard label="상반기" body={report.yearlyAppendix.firstHalf} tone="indigo" />
          <FactCard label="하반기" body={report.yearlyAppendix.secondHalf} tone="indigo" />
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <FactCard label="잘 풀리는 시기" body={report.yearlyAppendix.goodPeriods.join(' ')} tone="jade" />
          <FactCard label="조심할 시기" body={report.yearlyAppendix.cautionPeriods.join(' ')} tone="coral" />
          <FactCard label="행동 조언" body={report.yearlyAppendix.actionAdvice.join(' ')} tone="amber" />
        </div>
        <div className="mt-4">
          <Link
            href={report.yearlyAppendix.ctaAnchor}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            {report.yearlyAppendix.ctaLabel}
          </Link>
        </div>
      </section>

      {/* §증거/계산 정보 */}
      <details className="group" id="lifetime-evidence">
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[14px] border bg-white px-5 py-3.5 text-[12.5px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <span>계산 정보와 검증 보기</span>
          <span className="text-[10px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
        </summary>
        <div className="mt-3 grid gap-3">
          <GroundingKasiSummary
            grounding={data.grounding}
            kasiComparison={data.kasiComparison}
            metadata={data.metadata}
            title="풀이 배경"
          />
          <EngineMethodLinks
            title="더 알고 싶을 때만 보는 글"
            description="출생 시간, 큰 흐름처럼 배경이 궁금할 때만 확인하세요."
            slugs={[
              'why-pattern-judgments-diverge',
              'why-yongsin-is-hard',
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
