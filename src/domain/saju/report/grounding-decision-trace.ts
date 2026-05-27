import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import type { SajuInterpretationGrounding } from './grounding-types';

export interface GroundingDecisionBadge {
  label: string;
  tone: 'gold' | 'jade' | 'rose' | 'muted';
}

export interface GroundingDecisionStep {
  title: string;
  body: string;
  emphasis?: string | null;
  tone?: 'default' | 'caution';
}

export interface GroundingDecisionTraceView {
  badges: GroundingDecisionBadge[];
  steps: GroundingDecisionStep[];
  notes: string[];
}

function joinReadable(items: Array<string | null | undefined>) {
  return items.filter((item): item is string => Boolean(item)).join(' · ');
}

function formatSupport(primary: string | null, support: string[], kiyshin: string[]) {
  const parts = [
    primary ? `용신 ${primary}` : null,
    support.length > 0 ? `희신 ${support.join(' · ')}` : null,
    kiyshin.length > 0 ? `기신 ${kiyshin.join(' · ')}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(' / ') || '용신 후보를 아직 확정하지 않았습니다.';
}

function formatTimeRuleLabel(grounding: SajuInterpretationGrounding) {
  const mode = grounding.factJson.calendarConversion.solarTimeMode;
  const jasi = grounding.factJson.calendarConversion.jasiMethod;

  if (mode === 'longitude') return '진태양시 보정';
  if (jasi === 'split') return '조자시 적용';
  if (jasi === 'unified') return '야자시 적용';
  return '표준시 정보';
}

function buildKasiBadge(kasiComparison: KasiSingleInputComparison | null | undefined): GroundingDecisionBadge | null {
  if (!kasiComparison) return null;
  return kasiComparison.issues.length === 0
    ? { label: 'KASI 대조 일치', tone: 'jade' }
    : { label: `KASI 재확인 ${kasiComparison.issues.length}건`, tone: 'rose' };
}

export function buildGroundingDecisionTrace(
  grounding: SajuInterpretationGrounding,
  kasiComparison?: KasiSingleInputComparison | null
): GroundingDecisionTraceView {
  const { factJson, evidenceJson } = grounding;
  const correctionMinutes = factJson.calendarConversion.birthTimeCorrectionMinutes;
  const referenceCards = evidenceJson.classics.cards.filter((card) => card.confidence === '참고');
  const badges: GroundingDecisionBadge[] = [
    { label: '절기 정보 명식', tone: 'gold' },
    { label: formatTimeRuleLabel(grounding), tone: correctionMinutes ? 'gold' : 'muted' },
  ];

  if (factJson.birthInput.birthLocationLabel) {
    badges.push({ label: `출생지 ${factJson.birthInput.birthLocationLabel}`, tone: 'muted' });
  }

  if (correctionMinutes) {
    badges.push({ label: `경도 보정 ${correctionMinutes}분`, tone: 'gold' });
  }

  const kasiBadge = buildKasiBadge(kasiComparison);
  if (kasiBadge) badges.push(kasiBadge);
  if (referenceCards.length > 0) {
    badges.push({ label: `참고 해석 ${referenceCards.length}건`, tone: 'rose' });
  }

  const steps: GroundingDecisionStep[] = [
    {
      title: '명식 계산 방식',
      body: joinReadable([
        `${factJson.pillars.year.ganzi}년주`,
        `${factJson.pillars.month.ganzi}월주`,
        `${factJson.pillars.day.ganzi}일주`,
        factJson.pillars.hour ? `${factJson.pillars.hour.ganzi}시주` : '시주는 미입력',
      ]),
      emphasis: `일간 ${factJson.dayMaster.stem} · ${factJson.dayMaster.element}`,
    },
    {
      title: '시간 보정 여부',
      body: correctionMinutes
        ? `${factJson.birthInput.birthLocationLabel ?? '출생지'} 경도를 반영해 ${correctionMinutes}분 보정했습니다.`
        : factJson.birthInput.hourKnown
          ? '현재 입력 정보에서는 표준시 그대로 명식을 계산했습니다.'
          : '출생시각이 없어 시주 판단을 줄이고 일간·월령·현재 운 중심으로 읽었습니다.',
      emphasis: formatTimeRuleLabel(grounding),
    },
    {
      title: '격국 후보 검토',
      body:
        evidenceJson.pattern.rationale.slice(0, 2).join(' ').trim() ||
        '월령, 투출, 강약 순서를 다시 검토해 격국을 판정했습니다.',
      emphasis: evidenceJson.pattern.name
        ? `최종 판정: ${evidenceJson.pattern.name}${evidenceJson.pattern.tenGod ? ` · ${evidenceJson.pattern.tenGod}` : ''}`
        : '최종 격국은 참고 해석 단계입니다.',
      tone: evidenceJson.pattern.name ? 'default' : 'caution',
    },
    {
      title: '용신 / 희신 / 기신',
      body:
        evidenceJson.yongsin.rationale.slice(0, 2).join(' ').trim() ||
        '격국과 강약, 계절성을 함께 보고 보완 축을 판정했습니다.',
      emphasis: formatSupport(
        evidenceJson.yongsin.primary,
        evidenceJson.yongsin.support,
        evidenceJson.yongsin.kiyshin
      ),
      tone: evidenceJson.yongsin.confidence === '낮음' ? 'caution' : 'default',
    },
    {
      title: '대운 · 세운 · 월운 연결',
      body:
        joinReadable([
          evidenceJson.luckFlow.currentMajorLuck ? `현재 대운 ${evidenceJson.luckFlow.currentMajorLuck}` : null,
          evidenceJson.luckFlow.saewoon ? `세운 ${evidenceJson.luckFlow.saewoon}` : null,
          evidenceJson.luckFlow.wolwoon ? `월운 ${evidenceJson.luckFlow.wolwoon}` : null,
        ]) || '현재 운 데이터는 아직 충분하지 않습니다.',
      emphasis:
        evidenceJson.luckFlow.currentMajorLuckNotes[0] ??
        evidenceJson.luckFlow.saewoonNotes[0] ??
        evidenceJson.luckFlow.wolwoonNotes[0] ??
        null,
    },
  ];

  const notes: string[] = [];

  if (referenceCards.length > 0) {
    notes.push(`참고 해석으로 내려간 카드: ${referenceCards.map((card) => card.label).join(' · ')} · 다른 학파에서는 판정이 달라질 수 있습니다.`);
  }

  if (evidenceJson.yongsin.confidence === '낮음') {
    notes.push('용신 신뢰도가 낮게 표시된 구간입니다. 생활 적용은 보수적으로 읽는 편이 안전합니다.');
  }

  if (kasiComparison?.issues.length) {
    notes.push(`KASI 대조에서는 ${kasiComparison.issues.map((issue) => issue.field).join(', ')} 항목을 다시 확인해 주세요.`);
  }

  if (notes.length === 0) {
    notes.push('현재 핵심 판정에는 참고 단계 경고가 크지 않습니다. 다만 사주는 해석 학파에 따라 강조점이 달라질 수 있습니다.');
  }

  return { badges, steps, notes };
}
