import { buildGroundingDecisionTrace } from '@/domain/saju/report/grounding-decision-trace';
import type { SajuInterpretationGrounding } from '@/domain/saju/report';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import { DecisionTracePanel } from '@/components/report/decision-trace-panel';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { DecisionTraceItem, ReportMetadata } from '@/lib/saju/report-contract';

function formatTimeRuleLabel(grounding: SajuInterpretationGrounding) {
  const mode = grounding.factJson.calendarConversion.solarTimeMode;
  const jasi = grounding.factJson.calendarConversion.jasiMethod;

  if (mode === 'longitude') return '진태양시 반영';
  if (jasi === 'split') return '조자시 반영';
  if (jasi === 'unified') return '야자시 반영';
  return '표준시 반영';
}

function formatBirthInputLine(grounding: SajuInterpretationGrounding) {
  const { birthInput } = grounding.factJson;
  const base = `${birthInput.year}.${String(birthInput.month).padStart(2, '0')}.${String(birthInput.day).padStart(2, '0')}`;

  if (!birthInput.hourKnown || birthInput.hour === null) {
    return `${base} · 태어난 시간 미입력`;
  }

  const minute = birthInput.minute ?? 0;
  return `${base} · ${String(birthInput.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function GroundingDecisionTrace({
  grounding,
  kasiComparison,
  title = '세부 흐름 보기',
  compact = false,
}: {
  grounding: SajuInterpretationGrounding;
  kasiComparison?: KasiSingleInputComparison | null;
  title?: string;
  compact?: boolean;
}) {
  const trace = buildGroundingDecisionTrace(grounding, kasiComparison);
  const items: DecisionTraceItem[] = trace.steps.map((step, index) => {
    const input =
      index === 0
        ? formatBirthInputLine(grounding)
        : index === 1
          ? grounding.factJson.birthInput.birthLocationLabel
            ? `${grounding.factJson.birthInput.birthLocationLabel} · ${formatTimeRuleLabel(grounding)}`
            : formatTimeRuleLabel(grounding)
          : undefined;

    const rule =
      index === 0
        ? '양력/음력과 계절 흐름 확인'
        : index === 1
          ? '출생지와 시간 정보 확인'
          : index === 2
            ? '태어난 달의 기운과 전체 균형 확인'
            : index === 3
              ? '전체 균형과 보완 힌트 확인'
              : index === 4
                ? '큰 흐름, 올해 흐름, 이번 달 흐름을 현재 질문과 연결'
                : undefined;

    const result = simplifySajuCopy([step.emphasis, step.body].filter(Boolean).join(' '));
    const note =
      index === trace.steps.length - 1 ? simplifySajuCopy(trace.notes.join(' ')) : undefined;

    let confidence: DecisionTraceItem['confidence'] = 'orthodox';
    if (index === 1 && !grounding.factJson.birthInput.hourKnown) {
      confidence = 'input_limited';
    } else if (step.tone === 'caution') {
      confidence = index === 2 || index === 3 ? 'disputed' : 'reference';
    } else if (index === trace.steps.length - 1 && trace.notes.some((line) => line.includes('참고'))) {
      confidence = 'reference';
    }

    return {
      step: String(index + 1).padStart(2, '0'),
      title: simplifySajuCopy(step.title),
      input,
      rule,
      result,
      confidence,
      note,
    };
  });

  const metadata: ReportMetadata = {
    decisionTrace: items,
  };

  return (
    <DecisionTracePanel
      metadata={metadata}
      timeRule={formatTimeRuleLabel(grounding)}
      isTimeUnknown={!grounding.factJson.birthInput.hourKnown}
      title={title}
      compact={compact}
    />
  );
}
