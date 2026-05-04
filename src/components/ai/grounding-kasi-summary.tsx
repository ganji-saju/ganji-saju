import type { SajuInterpretationGrounding } from '@/domain/saju/report';
import { GroundingDecisionTrace } from '@/components/saju/grounding-decision-trace';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import type { SajuReportRuntimeMetadata } from '@/lib/saju/report-metadata';
import { simplifySajuCopy } from '@/lib/saju/public-copy';

function buildKasiLine(kasiComparison: KasiSingleInputComparison | null | undefined) {
  if (!kasiComparison) {
    return '음양력 대조 정보가 아직 함께 저장되지 않았습니다.';
  }

  if (kasiComparison.issues.length === 0) {
    return `공식 달력 정보와 현재 계산이 일치합니다.`;
  }

  const issueSummary = kasiComparison.issues
    .slice(0, 2)
    .map((issue) => issue.field)
    .join(', ');

  return `공식 달력 정보와 비교했을 때 ${issueSummary} 항목은 한 번 더 확인이 필요합니다.`;
}

function buildFactLines(grounding: SajuInterpretationGrounding) {
  return [
    `나를 나타내는 기운 ${grounding.factJson.dayMaster.stem} · ${grounding.factJson.dayMaster.element}`,
    grounding.evidenceJson.strength.level && grounding.evidenceJson.strength.score !== null
      ? `기운 균형 ${grounding.evidenceJson.strength.level}`
      : null,
    grounding.evidenceJson.pattern.name
      ? `역할 흐름 ${grounding.evidenceJson.pattern.tenGod ?? grounding.evidenceJson.pattern.name}`
      : null,
    grounding.evidenceJson.yongsin.primary
      ? `보완 힌트 ${grounding.evidenceJson.yongsin.primary}`
      : null,
    grounding.evidenceJson.luckFlow.currentMajorLuck
      ? `현재 큰 흐름 ${grounding.evidenceJson.luckFlow.currentMajorLuck}`
      : grounding.evidenceJson.luckFlow.saewoon
        ? `올해 흐름 ${grounding.evidenceJson.luckFlow.saewoon}`
        : null,
  ].filter((line): line is string => Boolean(line)).map(simplifySajuCopy);
}

export function GroundingKasiSummary({
  grounding,
  kasiComparison,
  title = '이 풀이가 보는 핵심 단서',
  id,
  metadata,
}: {
  grounding: SajuInterpretationGrounding;
  kasiComparison?: KasiSingleInputComparison | null;
  title?: string;
  id?: string;
  metadata?: SajuReportRuntimeMetadata | null;
}) {
  const factLines = buildFactLines(grounding);
  const evidenceLines = grounding.evidenceJson.classics.cards
    .slice(0, 3)
    .map((card) => simplifySajuCopy(`${card.label} · ${card.title}`));

  return (
    <section
      id={id}
      className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5"
    >
      <div className="app-caption text-[var(--app-gold-soft)]">{title}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {factLines.map((line) => (
          <span
            key={line}
            className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs leading-6 text-[var(--app-copy-soft)]"
          >
            {line}
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {evidenceLines.map((line) => (
          <div
            key={line}
            className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-7 text-[var(--app-copy)]"
          >
            {line}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-6 text-[var(--app-copy-soft)]">{buildKasiLine(kasiComparison)}</p>
      {metadata ? (
        <p className="mt-2 text-xs leading-6 text-[var(--app-copy-soft)]">
          저장된 풀이를 다시 열어도 같은 흐름을 확인할 수 있습니다.
        </p>
      ) : null}
      <div className="mt-4">
        <GroundingDecisionTrace
          grounding={grounding}
          kasiComparison={kasiComparison}
            title="세부 흐름 보기"
          compact
        />
      </div>
    </section>
  );
}
