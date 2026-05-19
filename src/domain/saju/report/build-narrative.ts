// 2026-05-15 P2 — narrative 빌더.
// PR #75 (P0) 에서 일주/격국·용신을 사실 카드로 노출했고, PR #76 (P1) 에서 격국 깊이와
// LLM 톤을 강화했음. 본 빌더는 이 5가지 (일간 · 일주 · 격국 · 용신 · 대운/세운)를 하나의
// 단락 narrative 로 엮어 사용자가 "이게 내 사주를 정리한 풀이"라는 인과를 한 호흡으로
// 받게 한다.
//
// 시장 벤치마크상 한국 사주 사이트의 결과 페이지가 인과를 한 단락에 모아 보여줄수록
// 후기 정확도 평가가 높음 (점신·포스텔러 류). 우리는 이 narrative 자리가 비어 있었음.

import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { SajuPersonalizationContext } from './personalization-context';
// PR #150 (B1) — situation 호명 helper.
import {
  buildHonorificPrefix,
  buildSituationActionLine,
  buildSituationClosing,
} from './situation-honor';

export interface SajuNarrativeChip {
  label: string;
  value: string;
}

export interface SajuNarrative {
  /** 헤드라인 1줄 — 일주 + 격국 + 핵심 결. 단정형. PR #150 — userName + situation 있으면 prefix 추가. */
  headline: string;
  /** 본문 3~4문장 — 일간 → 격국 → 용신 → 대운/세운 → 오늘 행동 흐름. PR #150 — situation 있으면 closing 추가. */
  body: string;
  /** 근거 칩 — 일주 · 격국 · 용신 · 대운 등 명리 라벨. */
  chips: SajuNarrativeChip[];
}

/** PR #150 — buildSajuNarrative 의 optional 입력 옵션. 기존 caller 무영향. */
export interface SajuNarrativeOptions {
  /** 사용자 이름 (input.name). 호명에 사용. */
  userName?: string | null;
}

function joinSentences(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

export function buildSajuNarrative(
  data: SajuDataV1 | SajuDataV2,
  personalizationContext: SajuPersonalizationContext | null,
  options: SajuNarrativeOptions = {}
): SajuNarrative {
  const sixtyGapja = personalizationContext?.sixtyGapja ?? null;
  const dayPillar = data.pillars.day;
  const dayGanzi = dayPillar.ganzi;
  const dayKorean = personalizationContext?.dayGanziCode ?? '';
  const dayElement = data.dayMaster.element;
  const patternName = data.pattern?.name ?? null;
  const patternConfidence = data.pattern?.confidence ?? null;
  const patternTougchul = data.pattern?.tougchul ?? false;
  const yongsinPrimary = data.yongsin?.primary?.label ?? null;
  const yongsinSecondary = data.yongsin?.secondary?.[0]?.label ?? null;
  const strengthLevel = data.strength?.level ?? null;
  const majorLuck = data.currentLuck?.currentMajorLuck?.ganzi ?? null;
  const saewoon = data.currentLuck?.saewoon?.ganzi ?? null;
  const wolwoon = data.currentLuck?.wolwoon?.ganzi ?? null;

  // ── 1. headline — 일주 + 격국 + 핵심 결.
  // PR #150 — userSituation 있으면 "[직장인이신 김영민님, ]" prefix 부착.
  const userSituation = personalizationContext?.userSituation ?? null;
  const honorificPrefix = buildHonorificPrefix({
    situation: userSituation,
    userName: options.userName ?? null,
  });
  const baseHeadline = buildHeadline({
    sixtyGapjaTitle: sixtyGapja?.title ?? null,
    dayGanzi,
    dayKorean,
    patternName,
  });
  const headline = honorificPrefix ? `${honorificPrefix}${baseHeadline}` : baseHeadline;

  // ── 2. body — 일간 → 격국 → 용신/강약 → 대운/세운 → 핵심 행동 흐름.
  const sentenceDay = buildDaySentence({
    dayKorean,
    dayGanzi,
    sixtyGapjaCore: sixtyGapja?.core ?? null,
    dayElement,
  });
  const sentencePattern = buildPatternSentence({
    patternName,
    patternConfidence,
    patternTougchul,
    strengthLevel,
  });
  const sentenceYongsin = buildYongsinSentence({
    yongsinPrimary,
    yongsinSecondary,
  });
  const sentenceLuck = buildLuckSentence({
    majorLuck,
    saewoon,
    wolwoon,
  });
  const sentenceAction = buildActionSentence({
    actionCue: sixtyGapja?.actionCue ?? null,
    yongsinPrimary,
  });
  // PR #150 — situation 있으면 본문 끝에 action 한 줄 + 메타 closing 추가.
  const situationAction = buildSituationActionLine({
    situation: userSituation,
    yongsinPrimary,
  });
  const situationClosing = buildSituationClosing({
    situation: userSituation,
    userName: options.userName ?? null,
  });
  const body = joinSentences([
    sentenceDay,
    sentencePattern,
    sentenceYongsin,
    sentenceLuck,
    sentenceAction,
    situationAction,
    situationClosing,
  ]);

  // ── 3. chips — 근거 라벨.
  const chips: SajuNarrativeChip[] = [];
  if (dayKorean || dayGanzi) {
    chips.push({ label: '일주', value: dayKorean ? `${dayKorean}(${dayGanzi})` : dayGanzi });
  }
  if (patternName) {
    chips.push({ label: '격국', value: patternName });
  }
  if (yongsinPrimary) {
    chips.push({ label: '용신', value: yongsinPrimary });
  }
  if (strengthLevel) {
    chips.push({ label: '강약', value: strengthLevel });
  }
  // 2026-05-15: chip 도 한자 옆에 한글 병기. "丁酉" → "정유(丁酉)".
  if (majorLuck) {
    chips.push({ label: '대운', value: withKoreanGanzi(majorLuck) });
  }
  if (saewoon) {
    chips.push({ label: '세운', value: withKoreanGanzi(saewoon) });
  }

  return { headline, body, chips };
}

// ── helpers ────────────────────────────────────────────────────────────────

function buildHeadline({
  sixtyGapjaTitle,
  dayGanzi,
  dayKorean,
  patternName,
}: {
  sixtyGapjaTitle: string | null;
  dayGanzi: string;
  dayKorean: string;
  patternName: string | null;
}): string {
  // 2026-05-19 B06 fix: '${sixtyGapjaTitle} · ${patternName}' 합성이 화면에 '흙·정인격'
  //   같이 일상어와 명리 술어를 점(·) 으로 묶어 어색했던 표기 해소. 자연 한국어로 연결.
  if (sixtyGapjaTitle && patternName) {
    return `${dayKorean || dayGanzi}일주, ${sixtyGapjaTitle}에 ${patternName}의 결을 가진 사주입니다.`;
  }
  if (sixtyGapjaTitle) {
    return `${dayKorean || dayGanzi}일주, ${sixtyGapjaTitle}의 결을 가진 사주입니다.`;
  }
  if (patternName) {
    return `${dayKorean || dayGanzi}일주, ${patternName}의 결이 분명한 사주입니다.`;
  }
  return `${dayKorean || dayGanzi}일주의 흐름을 가진 사주입니다.`;
}

function buildDaySentence({
  dayKorean,
  dayGanzi,
  sixtyGapjaCore,
  dayElement,
}: {
  dayKorean: string;
  dayGanzi: string;
  sixtyGapjaCore: string | null;
  dayElement: string;
}): string {
  const ref = dayKorean ? `${dayKorean}(${dayGanzi})` : dayGanzi;
  if (sixtyGapjaCore) {
    return `${ref} 일간은 ${sixtyGapjaCore}`;
  }
  return `${ref} 일간이 사주의 중심에 있어 ${dayElement} 기운이 첫 반응으로 드러납니다.`;
}

function buildPatternSentence({
  patternName,
  patternConfidence,
  patternTougchul,
  strengthLevel,
}: {
  patternName: string | null;
  patternConfidence: '확정' | '보통' | '낮음' | null;
  patternTougchul: boolean;
  strengthLevel: string | null;
}): string | null {
  if (!patternName) return null;
  const confidenceWord =
    patternConfidence === '확정'
      ? '분명히 자리잡혀'
      : patternConfidence === '보통'
        ? '뚜렷이 보이게'
        : '경향성으로';
  const tougchulNote = patternTougchul ? ' 천간에도 투출되어' : '';
  const strengthNote = strengthLevel ? `${strengthLevel}의 균형 위에서 ` : '';
  return `${strengthNote}${patternName}이 ${confidenceWord}${tougchulNote} 흐름의 기준이 됩니다.`;
}

function buildYongsinSentence({
  yongsinPrimary,
  yongsinSecondary,
}: {
  yongsinPrimary: string | null;
  yongsinSecondary: string | null;
}): string | null {
  if (!yongsinPrimary) return null;
  if (yongsinSecondary) {
    return `보완은 ${yongsinPrimary}을 중심으로, ${yongsinSecondary}을 보조로 두고 일어납니다.`;
  }
  return `보완은 ${yongsinPrimary}을 통해 일어납니다.`;
}

// 2026-05-15 cleanup — 한자 ganzi 옆에 한글 발음 병기.
// "丁酉" → "정유(丁酉)" 형식. 사용자 피드백: 한자 범벅으로 무슨 내용인지 파악 힘듦.
const STEM_HANJA_TO_KOREAN: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const BRANCH_HANJA_TO_KOREAN: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};
function ganziToKorean(ganzi: string): string {
  const stem = STEM_HANJA_TO_KOREAN[ganzi.charAt(0) ?? ''] ?? '';
  const branch = BRANCH_HANJA_TO_KOREAN[ganzi.charAt(1) ?? ''] ?? '';
  return `${stem}${branch}`;
}
function withKoreanGanzi(ganzi: string): string {
  const korean = ganziToKorean(ganzi);
  return korean ? `${korean}(${ganzi})` : ganzi;
}

function buildLuckSentence({
  majorLuck,
  saewoon,
  wolwoon,
}: {
  majorLuck: string | null;
  saewoon: string | null;
  wolwoon: string | null;
}): string | null {
  const parts: string[] = [];
  // 2026-05-15: 한자 ganzi 옆에 한글 발음 병기 — "정유(丁酉) 대운".
  if (majorLuck) parts.push(`${withKoreanGanzi(majorLuck)} 대운`);
  if (saewoon) parts.push(`${withKoreanGanzi(saewoon)} 세운`);
  if (wolwoon) parts.push(`${withKoreanGanzi(wolwoon)} 월운`);
  if (parts.length === 0) return null;
  return `지금은 ${parts.join(' · ')}이 함께 작동합니다.`;
}

function buildActionSentence({
  actionCue,
  yongsinPrimary,
}: {
  actionCue: string | null;
  yongsinPrimary: string | null;
}): string | null {
  if (actionCue) return actionCue;
  if (yongsinPrimary) {
    return `${yongsinPrimary} 결을 생활 안에서 한 가지씩 챙기세요.`;
  }
  return null;
}
