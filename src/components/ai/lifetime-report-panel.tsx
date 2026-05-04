'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BriefcaseBusiness,
  Heart,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { GroundingKasiSummary } from '@/components/ai/grounding-kasi-summary';
import { EngineMethodLinks } from '@/components/content/engine-method-links';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const SECTION_META = [
  { key: 'coreIdentity', label: '타고난 성향' },
  { key: 'strengthBalance', label: '기운의 균형' },
  { key: 'patternAndYongsin', label: '역할과 보완 힌트' },
  { key: 'relationshipPattern', label: '관계 패턴' },
  { key: 'wealthStyle', label: '재물 감각' },
  { key: 'careerDirection', label: '직업 방향' },
  { key: 'healthRhythm', label: '건강 리듬' },
  { key: 'majorLuckTimeline', label: '10년 단위 큰 흐름' },
  { key: 'lifetimeStrategy', label: '평생 활용 전략' },
] as const;

function splitParagraphs(text: string) {
  return simplifySajuCopy(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderParagraphs(text: string) {
  return splitParagraphs(text).map((paragraph, index) => (
    <p key={`${paragraph.slice(0, 24)}-${index}`} className="text-sm leading-8 text-[var(--app-copy)]">
      {paragraph}
    </p>
  ));
}

function FactCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
      <div className="app-caption text-[var(--app-gold-soft)]">{label}</div>
      <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{limitSajuSentences(body, 2)}</p>
    </div>
  );
}

function BasisNotes({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <details className="group mt-5">
      <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
        세부 단서 보기
      </summary>
      <div className="mt-3 grid gap-2">
        {items.map((line) => (
          <div key={line} className="rounded-xl bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy-muted)]">
            {simplifySajuCopy(line)}
          </div>
        ))}
      </div>
    </details>
  );
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
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 transition-colors hover:border-[var(--app-gold)]/30 hover:bg-[var(--app-gold)]/8"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[var(--app-gold)]/22 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="app-caption text-[var(--app-gold-soft)]">{eyebrow}</span>
          <span className="mt-1 block text-base font-semibold leading-6 text-[var(--app-ivory)]">
            {title}
          </span>
          <span className="mt-2 block text-sm leading-6 text-[var(--app-copy-muted)]">
            {body}
          </span>
        </span>
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
    <section className="app-panel p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <div className="app-caption">한 장 요약</div>
          <h3 className="mt-3 font-display text-2xl text-[var(--app-ivory)]">
            긴 풀이는 먼저 이 네 장면만 보셔도 됩니다
          </h3>
          <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
            전문 용어는 아래로 접어두고, 생활에서 바로 느껴지는 돈·일·관계·리듬부터 카드로 분리했습니다.
          </p>
          <div className="mt-4 rounded-[1rem] border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 px-4 py-3">
            <div className="app-caption text-[var(--app-gold-soft)]">평생 기억할 한 줄</div>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">
              {interpretation.lifetimeRule}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <LifetimeSummaryCard
            icon={Sparkles}
            eyebrow="타고난 결"
            title="어떤 환경에서 잘 살아나는가"
            body={report.coreIdentity.bestEnvironment}
            href={`#${getLifetimeSectionId('coreIdentity')}`}
          />
          <LifetimeSummaryCard
            icon={WalletCards}
            eyebrow="재물"
            title="돈을 벌고 지키는 방식"
            body={report.wealthStyle.earningStyle}
            href={`#${getLifetimeSectionId('wealthStyle')}`}
          />
          <LifetimeSummaryCard
            icon={BriefcaseBusiness}
            eyebrow="일"
            title="잘 맞는 일의 구조"
            body={report.careerDirection.fitStructure}
            href={`#${getLifetimeSectionId('careerDirection')}`}
          />
          <LifetimeSummaryCard
            icon={Heart}
            eyebrow="관계"
            title="사람과 거리를 잡는 방식"
            body={report.relationshipPattern.distanceStyle}
            href={`#${getLifetimeSectionId('relationshipPattern')}`}
          />
          <LifetimeSummaryCard
            icon={Activity}
            eyebrow="건강 리듬"
            title="무너질 때 회복하는 법"
            body={report.healthRhythm.recoveryRoutine}
            href={`#${getLifetimeSectionId('healthRhythm')}`}
          />
        </div>
      </div>
    </section>
  );
}

function LifetimeSectionBody({
  sectionKey,
  interpretation,
  report,
}: {
  sectionKey: (typeof SECTION_META)[number]['key'];
  interpretation: SajuLifetimeAiInterpretation;
  report: SajuLifetimeReport;
}) {
  switch (sectionKey) {
    case 'coreIdentity':
      return (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <FactCard label="반응 방식" body={report.coreIdentity.reactionStyle} />
            <FactCard label="강점 환경" body={report.coreIdentity.bestEnvironment} />
            <FactCard label="무너지기 쉬운 패턴" body={report.coreIdentity.weakPattern} />
          </div>
          <details className="group mt-5">
            <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)]">
              세부 단서 보기
            </summary>
            <div className="mt-3 grid gap-2">
              {report.coreIdentity.basis.map((line) => (
                <div key={line} className="rounded-xl bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                  {simplifySajuCopy(line)}
                </div>
              ))}
            </div>
          </details>
        </>
      );
    case 'strengthBalance':
      return (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <FactCard label="강한 축" body={report.strengthBalance.strongAxis} />
            <FactCard label="약한 축" body={report.strengthBalance.weakAxis} />
            <FactCard label="에너지 소모 방식" body={report.strengthBalance.energyDrain} />
            <FactCard label="회복 방식" body={report.strengthBalance.recovery} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {report.strengthBalance.elementHighlights.map((item) => (
              <div key={item} className="rounded-xl border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--app-copy)]">
                {item}
              </div>
            ))}
          </div>
          <details className="group mt-5">
            <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)]">
              생활 균형 포인트 보기
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.strengthBalance.balanceGuide.map((item) => (
                <span key={item} className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs leading-6 text-[var(--app-copy)]">
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
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <FactCard label="삶의 역할" body={report.patternAndYongsin.patternRole} />
            <FactCard label="보완 방향" body={report.patternAndYongsin.yongsinDirection} />
            <FactCard label="평생 선택 힌트" body={report.patternAndYongsin.choiceRule} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
              <div className="app-caption text-[var(--app-gold-soft)]">살려야 할 기운</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.patternAndYongsin.supportSymbols.map((item) => (
                  <span key={item} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
              <div className="app-caption text-[var(--app-gold-soft)]">조절할 기운</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.patternAndYongsin.cautionSymbols.map((item) => (
                  <span key={item} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs text-rose-100">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <details className="group mt-5">
            <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)]">
              세부 단서 보기
            </summary>
            <div className="mt-3 grid gap-2">
              {report.patternAndYongsin.detailLines.map((line) => (
                <div key={line} className="rounded-xl bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                  {simplifySajuCopy(line)}
                </div>
              ))}
            </div>
          </details>
        </>
      );
    case 'relationshipPattern':
      return (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <FactCard label="거리감" body={report.relationshipPattern.distanceStyle} />
          <FactCard label="감정 표현 방식" body={report.relationshipPattern.expressionStyle} />
          <FactCard label="갈등 지점" body={report.relationshipPattern.conflictTriggers} />
          <FactCard label="오래 가는 법" body={report.relationshipPattern.longevityGuide} />
        </div>
      );
    case 'wealthStyle':
      return (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <FactCard label="돈을 버는 방식" body={report.wealthStyle.earningStyle} />
          <FactCard label="돈을 지키는 방식" body={report.wealthStyle.keepingStyle} />
          <FactCard label="지출 실수 패턴" body={report.wealthStyle.spendingMistakes} />
          <FactCard label="맞는 운영 스타일" body={report.wealthStyle.operatingStyle} />
        </div>
      );
    case 'careerDirection':
      return (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <FactCard label="잘 맞는 일의 구조" body={report.careerDirection.fitStructure} />
          <FactCard label="버티는 일 vs 빛나는 일" body={report.careerDirection.endureVsShine} />
          <FactCard label="독립 / 조직 적성" body={report.careerDirection.independenceStyle} />
          <FactCard label="인정받는 방식" body={report.careerDirection.recognitionStyle} />
        </div>
      );
    case 'healthRhythm':
      return (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <FactCard label="무너질 때 신호" body={report.healthRhythm.warningSignals} />
            <FactCard label="회복 루틴" body={report.healthRhythm.recoveryRoutine} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {report.healthRhythm.habitPoints.map((item) => (
              <span key={item} className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs leading-6 text-[var(--app-copy)]">
                {item}
              </span>
            ))}
          </div>
        </>
      );
    case 'majorLuckTimeline':
      return (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {report.majorLuckTimeline.cycles.map((cycle) => (
            <article key={`${cycle.ageLabel}-${cycle.ganzi}`} className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy-soft)]">
                  {cycle.ageLabel}
                </Badge>
                <Badge
                  className={
                    cycle.phase === '확장기'
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                      : cycle.phase === '정리기'
                        ? 'border-sky-400/20 bg-sky-400/10 text-sky-100'
                        : 'border-[var(--app-gold)]/25 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)]'
                  }
                >
                  {cycle.phase}
                </Badge>
                {cycle.isCurrent ? (
                  <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)]">
                    현재 큰 흐름
                  </Badge>
                ) : null}
              </div>
              <h4 className="mt-3 text-lg font-semibold text-[var(--app-ivory)]">{cycle.ganzi}</h4>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{cycle.summary}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">{cycle.task}</p>
            </article>
          ))}
        </div>
      );
    case 'lifetimeStrategy':
      return (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <FactCard label="잘 될 때의 태도" body={report.lifetimeStrategy.useWhenStrong.join(' ')} />
            <FactCard label="흔들릴 때의 방어법" body={report.lifetimeStrategy.defendWhenShaken.join(' ')} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {interpretation.rememberRules.map((item) => (
              <div key={item} className="rounded-xl border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
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

  if (state === 'loading') {
    return (
      <section id="lifetime-report" className="moon-lunar-panel p-6 sm:p-7">
        <div className="app-starfield" />
        <div className="app-caption">깊은 사주풀이 생성 중</div>
        <h2 className="font-display mt-4 text-3xl text-[var(--app-ivory)]">
          타고난 사주풀이를 정리하고 있습니다
        </h2>
        <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
          타고난 성향과 보완 방향, 큰 흐름을 묶어 다시 열어볼 수 있는 풀이로 재구성하고 있습니다.
        </p>
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={`lifetime-loading-${index}`}
              className="h-28 animate-pulse rounded-[20px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (state === 'error' || !data) {
    return (
      <section id="lifetime-report" className="app-panel space-y-4 border-rose-400/20 p-6">
        <div className="app-caption text-rose-200/80">깊은 사주풀이 오류</div>
        <p className="font-medium text-rose-200">{error || '깊은 사주풀이를 불러오지 못했습니다.'}</p>
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
  const report = data.report;

  return (
    <section id="lifetime-report" className="space-y-6">
      <section className="moon-lunar-panel p-6 sm:p-7">
        <div className="app-starfield" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-caption">깊은 사주풀이 본문</div>
            <h2 className="font-display mt-4 text-3xl text-[var(--app-ivory)]">
              내 사주의 원본 해설서를 평생 풀이로 정리했습니다
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy-muted)]">
              어려운 계산 항목은 뒤로 빼고, “나는 어떤 환경에서 잘 살아나는가”가 먼저 보이도록 정리했습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
              {data.counselorId === 'male' ? '달빛 남선생' : '달빛 여선생'}
            </Badge>
            <Badge className="border-[var(--app-line)] bg-[var(--app-surface-strong)] text-[var(--app-copy-muted)]">
              새로 정리
            </Badge>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[var(--app-copy-soft)]">
          <Button
            onClick={() => setReloadToken((value) => value + 1)}
            variant="outline"
            size="xs"
          >
            다시 생성
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-[var(--app-gold)]/18 bg-[rgba(210,176,114,0.08)] px-5 py-5">
            <div className="space-y-3">{renderParagraphs(interpretation.opening)}</div>
            <div className="mt-5 rounded-[18px] border border-[var(--app-line)] bg-[rgba(7,9,16,0.28)] px-4 py-4">
              <div className="app-caption text-[var(--app-gold-soft)]">이 사주의 평생 힌트</div>
              <p className="mt-3 text-sm leading-8 text-[var(--app-copy)]">{interpretation.lifetimeRule}</p>
            </div>
          </div>
          <div className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5">
            <div className="app-caption text-[var(--app-gold-soft)]">사주명반</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['년주', report.pillars.year],
                ['월주', report.pillars.month],
                ['일주', report.pillars.day],
                ['시주', report.pillars.hour ?? '미입력'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-center">
                  <div className="app-caption">{label}</div>
                  <div className="font-hanja mt-3 text-2xl font-semibold text-[var(--app-ivory)]">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2">
              {interpretation.keywords.map((keyword) => (
                <div key={keyword} className="rounded-xl border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
                  {keyword}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LifetimeAtAGlance interpretation={interpretation} report={report} />

      <section className="app-panel p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.74fr_1.26fr] lg:items-start">
          <div>
            <div className="app-caption">본문 목차</div>
            <h3 className="mt-3 font-display text-2xl text-[var(--app-ivory)]">
              필요한 장으로 바로 이동합니다
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
              처음에는 전체 흐름을 훑고, 다시 볼 때는 돈·일·관계처럼 필요한 장만 골라 들어가도 됩니다.
              세부 계산 단서는 각 장 아래의 접힌 영역으로 분리했습니다.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SECTION_META.map((section, index) => (
              <Link
                key={section.key}
                href={`#${getLifetimeSectionId(section.key)}`}
                className="rounded-[1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 transition-colors hover:border-[var(--app-gold)]/30 hover:bg-[var(--app-gold)]/8"
              >
                <div className="text-xs text-[var(--app-gold-text)]">{index + 1}장</div>
                <div className="mt-1 text-sm font-semibold leading-6 text-[var(--app-ivory)]">
                  {section.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {SECTION_META.map((section, index) => {
        const reportSection = report[section.key];
        const basisLines = 'basis' in reportSection ? reportSection.basis : [];

        return (
          <section
            key={section.key}
            id={getLifetimeSectionId(section.key)}
            className="app-panel scroll-mt-28 p-6 sm:p-7"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
                {index + 1}장
              </Badge>
              <div className="app-caption">{section.label}</div>
            </div>
            <h3 className="font-display mt-3 text-2xl text-[var(--app-ivory)]">
              {reportSection.headline}
            </h3>
            <div className="mt-4 rounded-[20px] border border-[var(--app-gold)]/18 bg-[rgba(210,176,114,0.08)] px-5 py-5">
              <div className="space-y-3">
                {renderParagraphs(interpretation.sections[section.key])}
              </div>
            </div>
            <LifetimeSectionBody
              sectionKey={section.key}
              interpretation={interpretation}
              report={report}
            />
            <BasisNotes items={basisLines} />
          </section>
        );
      })}

      <section className="rounded-[28px] border border-[var(--app-plum)]/30 bg-[rgba(127,92,176,0.12)] p-6 sm:p-7">
        <div className="app-caption text-[var(--app-plum)]">부록: 올해 요약</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className="border-[var(--app-plum)]/30 bg-[rgba(127,92,176,0.14)] text-[var(--app-copy)]">
            {report.yearlyAppendix.yearLabel}
          </Badge>
          <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] text-[var(--app-copy-soft)]">
            {report.yearlyAppendix.yearGanji}
          </Badge>
        </div>
        <h3 className="font-display mt-4 text-2xl text-[var(--app-ivory)]">
          {report.yearlyAppendix.headline}
        </h3>
        <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
          {report.yearlyAppendix.oneLineSummary}
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <FactCard label="상반기" body={report.yearlyAppendix.firstHalf} />
          <FactCard label="하반기" body={report.yearlyAppendix.secondHalf} />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <FactCard label="잘 풀리는 시기" body={report.yearlyAppendix.goodPeriods.join(' ')} />
          <FactCard label="조심할 시기" body={report.yearlyAppendix.cautionPeriods.join(' ')} />
          <FactCard label="행동 조언" body={report.yearlyAppendix.actionAdvice.join(' ')} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={report.yearlyAppendix.ctaAnchor}
            className="moon-action-primary"
          >
            {report.yearlyAppendix.ctaLabel}
          </Link>
        </div>
      </section>

      <details className="group" id="lifetime-evidence">
        <summary className="cursor-pointer list-none rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-sm font-semibold text-[var(--app-copy)] transition-colors group-open:border-[var(--app-gold)]/25 group-open:text-[var(--app-ivory)]">
          세부 단서 확인
        </summary>
        <div className="mt-4 grid gap-4">
          <GroundingKasiSummary
            grounding={data.grounding}
            kasiComparison={data.kasiComparison}
            metadata={data.metadata}
            title="이 깊은 사주풀이가 참고한 세부 단서"
          />
          <EngineMethodLinks
            title="깊은 사주풀이를 읽을 때 같이 보면 좋은 글"
            description="보완 방향, 출생 시간, 큰 흐름처럼 풀이를 더 깊게 보고 싶을 때 필요한 글만 따로 모았습니다."
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
