/**
 * Saju Data V2 upgrade layer
 *
 * 사용 위치:
 * - 기존 saju-data/v1 파일 옆에 추가하거나, v1 파일 하단에 병합합니다.
 * - import 경로 './saju-data-v1'은 현재 프로젝트 파일명에 맞게 수정하세요.
 *
 * 목표:
 * 1) v1 계산 결과를 보존하면서 v2 해석/검증 레이어를 추가
 * 2) 해석 문장을 evidence 기반 claim 단위로 검증 가능하게 구성
 * 3) 캐시/마이그레이션/현재운 재계산 정책을 명확화
 */

import type { BirthInput, Branch, Element, Stem } from '@/lib/saju/types';
import {
  FRIENDLY_BLOCK_LABEL,
  FRIENDLY_CONFIDENCE_LABEL,
  FRIENDLY_ELEMENT_ACTIONS,
  FRIENDLY_ELEMENT_HINT,
  FRIENDLY_ELEMENT_LABEL,
  classifyStrengthBucket,
} from '@/lib/saju/terminology';
import {
  normalizeToSajuDataV1,
  SAJU_DATA_V1,
  SAJU_RULE_SET_V1,
  type SajuDataV1,
  type SajuFiveElements,
  type SajuPillar,
  type SajuPillars,
  type SajuSymbolRef,
  type TenGodCode,
} from './saju-data-v1';

export const SAJU_DATA_V2 = 'saju-data/v2' as const;
export const SAJU_RULE_SET_V2 = 'moonlight-rules/v2' as const;

// 받침 유무로 한국어 조사를 고른다. 동적 라벨(동반/주의 등 받침이 갈리는 값)에 사용.
function hasBatchim(value: string) {
  const trimmed = value.trim();
  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;

  return code % 28 !== 0;
}

function withParticle(value: string, consonantParticle: string, vowelParticle: string) {
  return `${value}${hasBatchim(value) ? consonantParticle : vowelParticle}`;
}

export type SajuDataVersionV2 = typeof SAJU_DATA_V2;
export type SajuValidationSeverity = 'error' | 'warning' | 'info';
export type SajuVerificationStatus = 'pass' | 'pass-with-warnings' | 'fail';
export type SajuClaimConfidence = 'high' | 'medium' | 'low';
export type SajuContentTone = 'balanced' | 'coaching' | 'technical' | 'short';
export type SajuReadingMode = 'summary' | 'deep' | 'coaching' | 'technical';

export interface SajuEvidenceRef {
  /** 예: pillars.day.stem, strength.score */
  path: string;
  /** UI 노출용 근거 설명 */
  label: string;
  /** 스냅샷 값. 개인 정보가 들어갈 수 있으면 저장하지 말고 label만 사용 */
  value?: string | number | boolean | null;
}

export interface SajuVerifiedClaim {
  id: string;
  text: string;
  confidence: SajuClaimConfidence;
  evidence: SajuEvidenceRef[];
  caveat?: string;
}

export interface SajuInterpretationBlock {
  id: string;
  title: string;
  summary: string;
  claims: SajuVerifiedClaim[];
  actions: string[];
  antiClaims: string[];
  tags: string[];
  tone: SajuContentTone;
}

export interface SajuModernInterpretation {
  profile: {
    mode: SajuReadingMode;
    tone: SajuContentTone;
    locale: 'ko-KR';
    generatedAt: string;
  };
  executiveSummary: string;
  blocks: SajuInterpretationBlock[];
  nextBestActions: string[];
  disclaimers: string[];
}

export interface SajuValidationIssue {
  code: string;
  severity: SajuValidationSeverity;
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
  fixHint?: string;
}

export interface SajuVerificationReport {
  status: SajuVerificationStatus;
  score: number;
  checkedAt: string;
  issues: SajuValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface SajuLoadOptions {
  now?: string;
  mode?: SajuReadingMode;
  tone?: SajuContentTone;
  /** 저장된 currentLuck가 오래되었을 때 v1 재계산을 강제할지 여부 */
  recomputeVolatile?: boolean;
  /** 검증 실패 시 throw */
  strict?: boolean;
  timezone?: string;
  location?: string | null;
  /**
   * V1 baseline metadata.engineVersion 라벨 (debug 용).
   * 2026-05-20 — V2-4 internal builder (multi-year cycle) 가 trace 라벨 보존 위해 사용.
   */
  engineVersion?: string;
}

export interface SajuDataV2 extends Omit<SajuDataV1, 'schemaVersion' | 'metadata'> {
  schemaVersion: SajuDataVersionV2;
  metadata: SajuDataV1['metadata'] & {
    ruleSetVersion: typeof SAJU_RULE_SET_V2;
    parentSchemaVersion: typeof SAJU_DATA_V1;
    parentRuleSetVersion: typeof SAJU_RULE_SET_V1 | string;
    migratedAt: string;
    qualityScore: number;
    verificationStatus: SajuVerificationStatus;
  };
  interpretation: SajuModernInterpretation;
  verification: SajuVerificationReport;
  legacy: {
    schemaVersion: typeof SAJU_DATA_V1;
    ruleSetVersion: typeof SAJU_RULE_SET_V1 | string;
  };
}

const STEM_ELEMENTS: Record<Stem, Element> = {
  甲: '목',
  乙: '목',
  丙: '화',
  丁: '화',
  戊: '토',
  己: '토',
  庚: '금',
  辛: '금',
  壬: '수',
  癸: '수',
};

const ELEMENT_HANJA: Record<Element, string> = {
  목: '木',
  화: '火',
  토: '土',
  금: '金',
  수: '水',
};

const BRANCH_HIDDEN_STEMS: Record<Branch, Stem[]> = {
  子: ['癸'],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙'],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '戊', '庚'],
  午: ['丁', '己'],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛'],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲'],
};

const ELEMENT_SEQUENCE: Element[] = ['목', '화', '토', '금', '수'];
const SCORE_EPSILON = 0.05;
const VOLATILE_LUCK_TTL_DAYS = 32;

// 2026-05-14: 행동 가이드는 src/lib/saju/terminology.ts 의 FRIENDLY_ELEMENT_ACTIONS
// 단일 소스를 사용한다 (요즘말로 정리된 문장들).
const ELEMENT_ACTION_MAP = FRIENDLY_ELEMENT_ACTIONS;

const PROHIBITED_INTERPRETATION_PATTERNS = [
  /반드시/g,
  /100%/g,
  /무조건/g,
  /죽음|수명|질병 확정|암에 걸/g,
  /합격 보장|당첨 보장|투자 수익 보장/g,
];

export function loadSajuDataV2(
  input: BirthInput,
  storedValue: unknown,
  options: SajuLoadOptions = {}
): SajuDataV2 {
  const now = options.now ?? new Date().toISOString();

  if (isSajuDataV2(storedValue)) {
    const verified = verifySajuData(storedValue, now);
    if (options.strict && verified.status === 'fail') {
      throw new Error(formatVerificationFailure(verified));
    }

    if (!options.recomputeVolatile && !isLuckStale(storedValue.metadata.calculatedAt, now)) {
      return {
        ...storedValue,
        verification: verified,
        metadata: {
          ...storedValue.metadata,
          qualityScore: verified.score,
          verificationStatus: verified.status,
        },
      };
    }
  }

  // 2026-05-20 — V2-4 internal builder: multi-year cycle 의 referenceDate 가
  //   세운/월운 ganzi 계산 시 사용되도록 V1 fallback path 에 now (calculatedAt)
  //   + engineVersion (trace 라벨) 전달.
  const v1 = normalizeToSajuDataV1(input, storedValue, {
    timezone: options.timezone,
    location: options.location,
    calculatedAt: now,
    engineVersion: options.engineVersion,
  });

  return upgradeSajuDataV1ToV2(v1, options);
}

export function upgradeSajuDataV1ToV2(
  base: SajuDataV1,
  options: SajuLoadOptions = {}
): SajuDataV2 {
  const now = options.now ?? new Date().toISOString();
  const report = verifySajuData(base, now);

  if (options.strict && report.status === 'fail') {
    throw new Error(formatVerificationFailure(report));
  }

  const interpretation = buildModernInterpretation(base, report, {
    now,
    mode: options.mode ?? 'coaching',
    tone: options.tone ?? 'balanced',
  });

  return {
    ...base,
    schemaVersion: SAJU_DATA_V2,
    metadata: {
      ...base.metadata,
      ruleSetVersion: SAJU_RULE_SET_V2,
      parentSchemaVersion: SAJU_DATA_V1,
      parentRuleSetVersion: base.metadata.ruleSetVersion ?? SAJU_RULE_SET_V1,
      migratedAt: now,
      qualityScore: report.score,
      verificationStatus: report.status,
    },
    interpretation,
    verification: report,
    legacy: {
      schemaVersion: SAJU_DATA_V1,
      ruleSetVersion: base.metadata.ruleSetVersion ?? SAJU_RULE_SET_V1,
    },
  };
}

export function verifySajuData(data: SajuDataV1 | SajuDataV2, checkedAt = new Date().toISOString()): SajuVerificationReport {
  const issues: SajuValidationIssue[] = [];

  verifyRequiredShape(data, issues);
  verifyPillars(data.pillars, data.dayMaster, issues);
  verifyFiveElements(data.fiveElements, issues);
  verifyStrength(data, issues);
  verifyYongsin(data, issues);
  verifyLuckFreshness(data, checkedAt, issues);
  verifyInterpretationIfPresent(data, issues);

  const summary = {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    infos: issues.filter((issue) => issue.severity === 'info').length,
  };

  const score = clamp100(100 - summary.errors * 18 - summary.warnings * 6 - summary.infos * 2);
  const status: SajuVerificationStatus =
    summary.errors > 0 ? 'fail' : summary.warnings > 0 ? 'pass-with-warnings' : 'pass';

  return {
    status,
    score,
    checkedAt,
    issues,
    summary,
  };
}

function verifyRequiredShape(data: SajuDataV1 | SajuDataV2, issues: SajuValidationIssue[]) {
  if (!data.input) {
    pushIssue(issues, 'MISSING_INPUT', 'error', 'input', '입력 스냅샷이 없습니다.');
  }
  if (!data.metadata) {
    pushIssue(issues, 'MISSING_METADATA', 'error', 'metadata', '계산 메타데이터가 없습니다.');
  }
  if (!data.pillars?.year || !data.pillars.month || !data.pillars.day) {
    pushIssue(issues, 'MISSING_REQUIRED_PILLARS', 'error', 'pillars', '년·월·일주는 필수입니다.');
  }
}

function verifyPillars(
  pillars: SajuPillars,
  dayMaster: SajuDataV1['dayMaster'],
  issues: SajuValidationIssue[]
) {
  const entries: Array<[keyof SajuPillars, SajuPillar | null]> = [
    ['year', pillars.year],
    ['month', pillars.month],
    ['day', pillars.day],
    ['hour', pillars.hour],
  ];

  for (const [key, pillar] of entries) {
    if (!pillar) continue;
    const path = `pillars.${key}`;
    const expectedGanzi = `${pillar.stem}${pillar.branch}`;
    if (pillar.ganzi !== expectedGanzi) {
      pushIssue(issues, 'PILLAR_GANZI_MISMATCH', 'error', `${path}.ganzi`, '간지가 천간+지지와 일치하지 않습니다.', expectedGanzi, pillar.ganzi);
    }

    const expectedElement = STEM_ELEMENTS[pillar.stem];
    if (expectedElement && pillar.stemElement !== expectedElement) {
      pushIssue(issues, 'PILLAR_STEM_ELEMENT_MISMATCH', 'error', `${path}.stemElement`, '천간 오행 매핑이 일치하지 않습니다.', expectedElement, pillar.stemElement);
    }

    const expectedHidden = BRANCH_HIDDEN_STEMS[pillar.branch] ?? [];
    const actualHidden = pillar.hiddenStems?.map((hidden) => hidden.stem) ?? [];
    if (!sameArray(expectedHidden, actualHidden)) {
      pushIssue(issues, 'HIDDEN_STEMS_MISMATCH', 'warning', `${path}.hiddenStems`, '숨은 기운(지장간) 배열이 대조표와 달라요.', expectedHidden, actualHidden, '숨은 기운 대조표를 단일 소스로 분리하고 테스트 케이스를 고정하세요.');
    }

    if (key === 'day' && pillar.stemTenGod !== null) {
      pushIssue(issues, 'DAY_STEM_TENGOD_SHOULD_BE_NULL', 'error', `${path}.stemTenGod`, '내 핵심 기질(일간)의 관계 역할(십신)은 비어 있어야 해요.', null, pillar.stemTenGod);
    }

    if (key !== 'day' && pillar.stemTenGod === null) {
      pushIssue(issues, 'NON_DAY_STEM_TENGOD_MISSING', 'warning', `${path}.stemTenGod`, '태어난 해·달·시간의 관계 역할(십신)이 비어 있어요.');
    }
  }

  if (dayMaster.stem !== pillars.day?.stem) {
    pushIssue(issues, 'DAY_MASTER_STEM_MISMATCH', 'error', 'dayMaster.stem', '내 핵심 기질(일간)이 태어난 날 묶음과 일치하지 않아요.', pillars.day?.stem, dayMaster.stem);
  }

  if (dayMaster.element !== pillars.day?.stemElement) {
    pushIssue(issues, 'DAY_MASTER_ELEMENT_MISMATCH', 'error', 'dayMaster.element', '내 핵심 기질의 오행이 태어난 날 묶음의 오행과 일치하지 않아요.', pillars.day?.stemElement, dayMaster.element);
  }
}

function verifyFiveElements(fiveElements: SajuFiveElements, issues: SajuValidationIssue[]) {
  const values = ELEMENT_SEQUENCE.map((element) => fiveElements.byElement[element]);
  const scoreSum = round1(values.reduce((sum, value) => sum + (value?.score ?? 0), 0));
  const countSum = values.reduce((sum, value) => sum + (value?.count ?? 0), 0);
  const percentageSum = round1(values.reduce((sum, value) => sum + (value?.percentage ?? 0), 0));

  if (Math.abs(scoreSum - fiveElements.totalScore) > SCORE_EPSILON) {
    pushIssue(issues, 'FIVE_ELEMENT_SCORE_SUM_MISMATCH', 'error', 'fiveElements.totalScore', '오행 총점이 세부 점수 합계와 다릅니다.', scoreSum, fiveElements.totalScore);
  }

  if (countSum !== fiveElements.totalCount) {
    pushIssue(issues, 'FIVE_ELEMENT_COUNT_SUM_MISMATCH', 'error', 'fiveElements.totalCount', '오행 count 합계가 totalCount와 다릅니다.', countSum, fiveElements.totalCount);
  }

  if (fiveElements.totalScore > 0 && Math.abs(percentageSum - 100) > 0.6) {
    pushIssue(issues, 'FIVE_ELEMENT_PERCENTAGE_SUM_DRIFT', 'warning', 'fiveElements.byElement', '오행 percentage 합계가 100%에서 벗어났습니다.', 100, percentageSum);
  }

  const maxScore = Math.max(...ELEMENT_SEQUENCE.map((element) => fiveElements.byElement[element]?.score ?? -Infinity));
  const minScore = Math.min(...ELEMENT_SEQUENCE.map((element) => fiveElements.byElement[element]?.score ?? Infinity));
  const dominantCandidates = ELEMENT_SEQUENCE.filter((element) => Math.abs((fiveElements.byElement[element]?.score ?? 0) - maxScore) <= SCORE_EPSILON);
  const weakestCandidates = ELEMENT_SEQUENCE.filter((element) => Math.abs((fiveElements.byElement[element]?.score ?? 0) - minScore) <= SCORE_EPSILON);

  if (!dominantCandidates.includes(fiveElements.dominant)) {
    pushIssue(issues, 'DOMINANT_ELEMENT_MISMATCH', 'error', 'fiveElements.dominant', 'dominant가 최고 점수 오행과 일치하지 않습니다.', dominantCandidates, fiveElements.dominant);
  }

  if (!weakestCandidates.includes(fiveElements.weakest)) {
    pushIssue(issues, 'WEAKEST_ELEMENT_MISMATCH', 'error', 'fiveElements.weakest', 'weakest가 최저 점수 오행과 일치하지 않습니다.', weakestCandidates, fiveElements.weakest);
  }

  if (dominantCandidates.length > 1) {
    pushIssue(issues, 'DOMINANT_ELEMENT_TIE', 'info', 'fiveElements.dominant', 'dominant 후보가 복수입니다. UI에서 공동 우세로 표시하는 것이 안전합니다.', dominantCandidates, fiveElements.dominant);
  }

  if (weakestCandidates.length > 1) {
    pushIssue(issues, 'WEAKEST_ELEMENT_TIE', 'info', 'fiveElements.weakest', 'weakest 후보가 복수입니다. UI에서 공동 약세로 표시하는 것이 안전합니다.', weakestCandidates, fiveElements.weakest);
  }
}

function verifyStrength(data: SajuDataV1 | SajuDataV2, issues: SajuValidationIssue[]) {
  if (!data.strength) {
    pushIssue(issues, 'MISSING_STRENGTH', 'warning', 'strength', '신강/신약 판정이 없습니다.');
    return;
  }

  const { score, level } = data.strength;
  if (score < 5 || score > 95) {
    pushIssue(issues, 'STRENGTH_SCORE_OUT_OF_RANGE', 'error', 'strength.score', '신강/신약 점수 범위가 5~95를 벗어났습니다.', '5..95', score);
  }

  const expectedLevel = score >= 67 ? '신강' : score <= 43 ? '신약' : '중화';
  if (level !== expectedLevel) {
    pushIssue(issues, 'STRENGTH_LEVEL_THRESHOLD_MISMATCH', 'error', 'strength.level', '신강/신약 level이 score 임계값과 일치하지 않습니다.', expectedLevel, level);
  }
}

function verifyYongsin(data: SajuDataV1 | SajuDataV2, issues: SajuValidationIssue[]) {
  const yongsin = data.yongsin;
  if (!yongsin) {
    pushIssue(issues, 'MISSING_YONGSIN', 'warning', 'yongsin', '도움이 되는 핵심 기운(용신) 풀이가 아직 만들어지지 않았어요.');
    return;
  }

  if (!yongsin.candidates?.length) {
    pushIssue(issues, 'YONGSIN_CANDIDATES_MISSING', 'warning', 'yongsin.candidates', '도움 기운 후보가 비어 있어 결과를 검증하기 어려워요.');
  } else {
    const [first] = yongsin.candidates;
    if (first && yongsin.primary.value !== first.primary.value) {
      pushIssue(issues, 'YONGSIN_PRIMARY_NOT_TOP_CANDIDATE', 'error', 'yongsin.primary', '1순위 도움 기운이 후보 점수 1위와 달라요.', first.primary.value, yongsin.primary.value);
    }

    for (let i = 1; i < yongsin.candidates.length; i += 1) {
      if (yongsin.candidates[i - 1].score < yongsin.candidates[i].score) {
        pushIssue(issues, 'YONGSIN_CANDIDATES_NOT_SORTED', 'warning', 'yongsin.candidates', '도움 기운 후보가 점수 높은 순으로 정렬되어 있지 않아요.');
        break;
      }
    }
  }

  if (!yongsin.confidence) {
    pushIssue(issues, 'YONGSIN_CONFIDENCE_MISSING', 'warning', 'yongsin.confidence', '도움 기운 풀이의 확신도 표시가 없어요.');
  }

  const cautionValues = new Set((yongsin.kiyshin ?? []).map((symbol) => symbol.value));
  if (cautionValues.has(yongsin.primary.value)) {
    pushIssue(issues, 'YONGSIN_PRIMARY_OVERLAPS_KIYSHIN', 'error', 'yongsin.kiyshin', '도움이 되는 기운(용신)과 조절할 기운(기신)이 같은 값으로 겹쳤어요.', yongsin.primary.value, [...cautionValues]);
  }
}

function verifyLuckFreshness(data: SajuDataV1 | SajuDataV2, checkedAt: string, issues: SajuValidationIssue[]) {
  if (!data.currentLuck) {
    pushIssue(issues, 'MISSING_CURRENT_LUCK', 'warning', 'currentLuck', '현재운 데이터가 없습니다.');
    return;
  }

  if (isLuckStale(data.metadata.calculatedAt, checkedAt)) {
    pushIssue(
      issues,
      'CURRENT_LUCK_STALE',
      'warning',
      'metadata.calculatedAt',
      `${VOLATILE_LUCK_TTL_DAYS}일이 넘은 흐름 데이터예요. 올해/이번 달 흐름을 다시 계산하는 편이 좋아요.`,
      `within ${VOLATILE_LUCK_TTL_DAYS} days`,
      data.metadata.calculatedAt,
      '올해·이번 달 흐름은 화면을 열 때마다 새로 계산하거나 유효기간을 함께 저장하세요.'
    );
  }

  if (data.input.gender && !data.majorLuck?.length) {
    pushIssue(issues, 'MAJOR_LUCK_MISSING_WITH_GENDER', 'warning', 'majorLuck', '성별을 입력했는데 긴 흐름(10년 단위) 데이터가 비어 있어요.');
  }

  if (!data.input.gender && data.majorLuck?.length) {
    pushIssue(issues, 'MAJOR_LUCK_EXISTS_WITHOUT_GENDER', 'info', 'majorLuck', '성별을 입력하지 않았는데 긴 흐름(10년 단위)이 미리 계산되어 있어요. 입력 흐름을 확인하세요.');
  }
}

function verifyInterpretationIfPresent(data: SajuDataV1 | SajuDataV2, issues: SajuValidationIssue[]) {
  if (!isSajuDataV2(data)) return;

  if (!data.interpretation?.blocks?.length) {
    pushIssue(issues, 'INTERPRETATION_BLOCKS_MISSING', 'warning', 'interpretation.blocks', '해석 블록이 없습니다.');
    return;
  }

  for (const block of data.interpretation.blocks) {
    if (!block.claims.length) {
      pushIssue(issues, 'INTERPRETATION_CLAIMS_MISSING', 'warning', `interpretation.blocks.${block.id}.claims`, '검증 가능한 claim이 없습니다.');
    }

    for (const claim of block.claims) {
      if (!claim.evidence.length) {
        pushIssue(issues, 'CLAIM_EVIDENCE_MISSING', 'error', `interpretation.blocks.${block.id}.claims.${claim.id}.evidence`, '해석 claim에 근거 데이터가 없습니다.');
      }

      for (const pattern of PROHIBITED_INTERPRETATION_PATTERNS) {
        if (pattern.test(claim.text)) {
          pushIssue(issues, 'PROHIBITED_INTERPRETATION_PATTERN', 'warning', `interpretation.blocks.${block.id}.claims.${claim.id}.text`, '단정적·위험 문구이 포함되어 있습니다.', pattern.source, claim.text);
        }
      }
    }
  }
}

function buildModernInterpretation(
  data: SajuDataV1,
  report: SajuVerificationReport,
  options: { now: string; mode: SajuReadingMode; tone: SajuContentTone }
): SajuModernInterpretation {
  // 2026-05-14: 모든 카피를 요즘말로. 한자 술어는 제거하거나 일상어로 풀어 쓴다.
  const dominant = data.fiveElements.dominant;
  const weakest = data.fiveElements.weakest;
  // 2026-05-14: 경계 근접 표시 ("신강에 가까운 중화" 등)
  const strengthBucket = data.strength
    ? classifyStrengthBucket(data.strength.level, data.strength.score)
    : null;
  const strengthLabel = data.strength
    ? `${strengthBucket} (점수 ${data.strength.score})`
    : '컨디션 균형은 아직 확인 중';
  const yongsinLabel = data.yongsin
    ? `${FRIENDLY_ELEMENT_LABEL[data.yongsin.primary.value as Element] ?? data.yongsin.primary.label}${
        data.yongsin.confidence
          ? ` · 확신도 ${FRIENDLY_CONFIDENCE_LABEL[data.yongsin.confidence] ?? data.yongsin.confidence}`
          : ''
      }`
    : '도움 기운은 아직 확인 중';

  const executiveSummary = [
    `내 핵심 기질은 ${formatDayMaster(data)}입니다.`,
    `다섯 기운 중 ${FRIENDLY_ELEMENT_LABEL[dominant]}이 강하고 ${FRIENDLY_ELEMENT_LABEL[weakest]}이 약한 편이에요.`,
    `컨디션은 ${strengthLabel}, 도움이 되는 기운은 ${yongsinLabel}으로 읽힙니다.`,
    `풀이 점검 점수는 ${report.score}점 (${formatVerificationStatus(report.status)}).`,
  ].join(' ');

  // 2026-05-14: pattern 이 있으면 격국 블록을 추가. 정관격/편관격 같은 단정형
  // 표기 대신 "정관격 후보" + 월지 근거 + 동반 십신 구조 형태로 보수화.
  const blocks: SajuInterpretationBlock[] = [
    buildFoundationBlock(data, options.tone),
    buildBalanceBlock(data, options.tone),
  ];
  if (data.pattern) {
    blocks.push(buildPatternBlock(data, options.tone));
  }
  blocks.push(buildYongsinBlock(data, options.tone));
  blocks.push(buildLuckBlock(data, options.tone));

  return {
    profile: {
      mode: options.mode,
      tone: options.tone,
      locale: 'ko-KR',
      generatedAt: options.now,
    },
    executiveSummary,
    blocks,
    nextBestActions: buildNextBestActions(data),
    disclaimers: [
      '이 풀이는 자기이해 · 셀프 코칭을 위한 참고 콘텐츠예요. 건강·돈·법·의료에 대한 큰 결정은 전문가와 함께 정해주세요.',
      '태어난 시간을 모르거나, 출생지·시간대 보정이 달라지면 일부 풀이가 함께 달라질 수 있어요.',
      '모든 풀이는 정해진 미래가 아니라, 흐름·주의할 점·활용 방법으로만 적어두었습니다.',
    ],
  };
}

function buildFoundationBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const metaphor = data.dayMaster.metaphor ?? '내 핵심 기질';
  const elementLabel = FRIENDLY_ELEMENT_LABEL[data.dayMaster.element];
  return {
    id: 'foundation',
    title: FRIENDLY_BLOCK_LABEL.foundation,
    summary: `내 핵심 기질은 ${elementLabel}으로 ${metaphor}처럼 풀이됩니다. 다만 기질 하나만 보지 말고, 다섯 기운의 균형 · 컨디션 · 관계 역할까지 같이 봐야 더 정확해져요.`,
    claims: [
      {
        id: 'foundation.dayMaster',
        text: `내 핵심 기질은 ${elementLabel}의 ${withParticle(metaphor, '으로', '로')} 풀이돼요. 나를 말하는 첫 출발점으로 가볍게 참고하면 좋아요.`,
        confidence: 'high',
        evidence: [
          evidence('dayMaster.stem', '내 핵심 기질', data.dayMaster.stem),
          evidence('dayMaster.element', '내 기질의 오행', elementLabel),
          evidence('dayMaster.metaphor', '비유로 풀이하면', metaphor),
        ],
        caveat: '핵심 기질만 보고 모든 걸 단정하면 너무 좁게 보일 수 있어요.',
      },
    ],
    actions: ['첫 화면에는 핵심 기질만 요약하고, 상세 화면에서 다섯 기운·컨디션·도움 기운 근거를 함께 보여줘요.'],
    antiClaims: ['핵심 기질 하나만 보고 직업·결혼·건강을 단정 짓지 않아요.'],
    tags: ['dayMaster', 'summary'],
    tone,
  };
}

function buildBalanceBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const dominant = data.fiveElements.dominant;
  const weakest = data.fiveElements.weakest;
  const dominantValue = data.fiveElements.byElement[dominant];
  const weakestValue = data.fiveElements.byElement[weakest];
  const dominantLabel = FRIENDLY_ELEMENT_LABEL[dominant];
  const weakestLabel = FRIENDLY_ELEMENT_LABEL[weakest];

  return {
    id: 'five-elements-balance',
    title: FRIENDLY_BLOCK_LABEL.balance,
    summary: `다섯 기운 중에서 ${dominantLabel}이 가장 강하고 ${weakestLabel}이 가장 약하게 잡혀요. 약한 기운은 “부족함”이라기보다 “일상에서 작게 채워두면 좋은 부분”으로 봐주세요.`,
    claims: [
      {
        id: 'balance.dominant',
        text: `${dominantLabel}이 강한 편이라 ${FRIENDLY_ELEMENT_HINT[dominant]}이 잘 드러나요. 장점은 쓰되, 너무 한쪽으로 치우치지 않게 가끔 균형을 살펴주면 좋아요.`,
        confidence: 'high',
        evidence: [
          evidence('fiveElements.dominant', '가장 강한 기운', dominantLabel),
          evidence(`fiveElements.byElement.${dominant}.score`, '강한 기운 점수', dominantValue.score),
          evidence('fiveElements.totalScore', '다섯 기운 총점', data.fiveElements.totalScore),
        ],
      },
      {
        id: 'balance.weakest',
        text: `${weakestLabel}은 약한 편이에요. ${FRIENDLY_ELEMENT_HINT[weakest]}을 일상에서 작게 반복해두면 균형이 부드러워져요.`,
        confidence: 'medium',
        evidence: [
          evidence('fiveElements.weakest', '가장 약한 기운', weakestLabel),
          evidence(`fiveElements.byElement.${weakest}.score`, '약한 기운 점수', weakestValue.score),
        ],
        caveat: '점수가 같은 기운이 두 개 이상이면, “공동으로 약한 편”으로 봐주세요.',
      },
    ],
    actions: ELEMENT_ACTION_MAP[weakest],
    antiClaims: ['약한 기운이 곧 부족한 인생이나 병으로 이어진다고 단정하지 않아요.'],
    tags: ['fiveElements', 'balance', dominant, weakest],
    tone,
  };
}

function buildPatternBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  // 2026-05-14: 격국은 "정관격" 식으로 단정하지 않고 "정관격 후보 (관인 구조 동반)"
  // 같은 보수 표기로. 월지 주기운만으로 단정할 수 없는 한계를 본문에 명시.
  const pattern = data.pattern!;
  const monthBranch = data.pillars.month.branch;
  const monthHiddenStems = BRANCH_HIDDEN_STEMS[monthBranch] ?? [];
  const monthBranchKeyStem = monthHiddenStems[0] ?? null;

  // 2026-05-14: 동반 십신 구조 — 격국이 어떤 방향으로 더 풍부해지는지 (또는
  //   주의해야 하는지) 1~3개 구절로 표시. detectPatternCompanions 가 8가지
  //   고전 동반 패턴을 평가한다.
  const accompanyingPhrases = data.tenGods
    ? detectPatternCompanions(pattern, data.tenGods.byType)
    : [];

  const candidateLabel = `${pattern.name} 후보`;
  // 월지 주기운(지장간 1순위)의 오행을 한자로 보정해 "월지 {지지}의 {천간}{오행} 기준" 으로 표기.
  // 과거 base 문자열에 '土'·접미사를 박고 .replace 로 덧대던 방식은 접미사가 중복("기준 기준")되는
  // 버그가 있어, 천간+오행 한자를 직접 조립하는 방식으로 단순화한다.
  const monthRoot = monthBranchKeyStem
    ? `월지 ${monthBranch}의 ${monthBranchKeyStem}${getStemElementHanja(monthBranchKeyStem)} 기준`
    : `월지 ${monthBranch} 기준`;

  const summary =
    accompanyingPhrases.length > 0
      ? `${candidateLabel}로 보입니다. ${monthRoot}이고 ${withParticle(accompanyingPhrases.join(' · '), '으로', '로')} 읽혀요.`
      : `${candidateLabel}로 보입니다. ${monthRoot}으로 풀이됩니다.`;

  return {
    id: 'pattern',
    title: '반복되는 삶의 역할 후보',
    summary,
    claims: [
      {
        id: 'pattern.candidate',
        text: `${candidateLabel}: ${monthRoot}.${
          accompanyingPhrases.length > 0
            ? ` 동반 구조로 ${withParticle(accompanyingPhrases.join(', '), '이', '가')} 함께 보여 보수적으로 "${candidateLabel}"로 표기해요.`
            : ` 단정 짓기보다 "후보"로 두고 다른 풀이와 함께 읽는 편이 안전해요.`
        }`,
        confidence: accompanyingPhrases.length > 0 ? 'medium' : 'low',
        evidence: [
          evidence('pattern.name', '격국 후보명', pattern.name),
          evidence('pattern.category', '격국 분류', pattern.category ?? null),
          evidence('pattern.tenGod', '대표 십신', pattern.tenGod ?? null),
          evidence('pillars.month.branch', '월지', monthBranch),
          ...(monthBranchKeyStem
            ? [evidence('pillars.month.hiddenStem0', '월지 주기운(지장간 1순위)', monthBranchKeyStem)]
            : []),
        ],
        caveat: '월지 주기운 한 가지로만 격국을 확정하지 않아요. 다른 십신 구조·합충도 함께 봐야 더 정확해져요.',
      },
    ],
    actions: [
      '격국 표기는 "후보" 로 보고, 동반 구조(관인·식상생재·재관 등)도 함께 살펴주세요.',
    ],
    antiClaims: [
      '격국 후보 하나만으로 직업·결혼·재물을 단정하지 않아요.',
    ],
    tags: ['pattern', pattern.name, pattern.tenGod ?? 'unknown'],
    tone,
  };
}

function getStemElementHanja(stem: Stem): '木' | '火' | '土' | '金' | '水' {
  const elementHanjaByStem: Record<Stem, '木' | '火' | '土' | '金' | '水'> = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火',
    戊: '土', 己: '土', 庚: '金', 辛: '金',
    壬: '水', 癸: '水',
  };
  return elementHanjaByStem[stem];
}

/**
 * 2026-05-14: 격국 동반 구조 감지. 정관/편관 + 정인/편인 = 관인, 정재/편재 +
 *   식신/상관 = 식상생재, 정관 + 편관 둘 다 = 관살혼잡, 식신 + 상관 둘 다 =
 *   식상혼잡, 인성(정인+편인) ≥3 = 인성과다, 비견+겁재 ≥3 = 비겁과다,
 *   식신 + 정재/편재 (편재 우선) = 식신생재, 편관 + 정인 = 살인상생,
 *   정재/편재 + 정관 = 재생관.
 *
 *   값 자체는 SajuTenGodSummary.byType 의 십신 카운트(소수 가능)를 사용.
 */
function detectPatternCompanions(
  pattern: NonNullable<SajuDataV1['pattern']>,
  counts: Record<string, number>
): string[] {
  const get = (code: string) => counts[code] ?? 0;
  const phrases: string[] = [];

  const tenGod = pattern.tenGod;
  const officials = get('정관') + get('편관');
  const seals = get('정인') + get('편인'); // 인성
  const resources = get('정재') + get('편재'); // 재성
  const outputs = get('식신') + get('상관'); // 식상
  const peers = get('비견') + get('겁재'); // 비겁

  // 관인 — 관성격에 인성이 있을 때
  if (tenGod === '정관' || tenGod === '편관') {
    if (seals >= 1) phrases.push('관인 구조 동반');
  }
  // 식상생재 — 재성격에 식상이 있을 때
  if (tenGod === '정재' || tenGod === '편재') {
    if (outputs >= 1) phrases.push('식상생재 동반');
  }
  // 재관 — 재성격에 관성이 있거나 관성격에 재성이 있을 때 (재생관)
  if ((tenGod === '정재' || tenGod === '편재') && officials >= 1) {
    phrases.push('재생관 동반');
  }
  if ((tenGod === '정관' || tenGod === '편관') && resources >= 1) {
    phrases.push('재관 구조 동반');
  }
  // 식신생재 — 식신격에 재성이 있을 때 (편재 우선)
  if (tenGod === '식신' && resources >= 1) {
    phrases.push('식신생재 동반');
  }
  // 살인상생 — 편관격에 정인이 있을 때 (편관 + 정인 = 살인상생)
  if (tenGod === '편관' && get('정인') >= 1) {
    phrases.push('살인상생 동반');
  }
  // 관살혼잡 — 정관 + 편관이 동시에 (둘 다 1 이상)
  if (get('정관') >= 1 && get('편관') >= 1) {
    phrases.push('관살혼잡 주의');
  }
  // 식상혼잡 — 식신 + 상관 동시에
  if (get('식신') >= 1 && get('상관') >= 1) {
    phrases.push('식상혼잡 주의');
  }
  // 인성과다 — 인성 합 ≥ 3
  if (seals >= 3) {
    phrases.push('인성과다 주의');
  }
  // 비겁과다 — 비겁 합 ≥ 3
  if (peers >= 3) {
    phrases.push('비겁과다 주의');
  }
  // 재다신약 시그널은 strength 별도 영역이라 여기서는 건드리지 않음.

  // 중복 제거 + 최대 3개로 제한 (UI 가독성).
  return Array.from(new Set(phrases)).slice(0, 3);
}

function buildYongsinBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const yongsin = data.yongsin;
  if (!yongsin) {
    return {
      id: 'yongsin',
      title: FRIENDLY_BLOCK_LABEL.yongsin,
      summary: '도움이 되는 핵심 기운을 아직 계산 중이라 풀이를 잠시 미뤄두었어요.',
      claims: [],
      actions: ['도움 기운 후보가 정리된 뒤에 다시 풀이를 만들어 드릴게요.'],
      antiClaims: ['아직 계산이 끝나지 않은 상태에서 단정적인 조언을 만들지 않아요.'],
      tags: ['yongsin', 'pending'],
      tone,
    };
  }

  const primaryElement = yongsin.primary.value as Element;
  const primaryLabel = FRIENDLY_ELEMENT_LABEL[primaryElement] ?? yongsin.primary.label;
  const confidenceLabel = yongsin.confidence
    ? ` (확신도 ${FRIENDLY_CONFIDENCE_LABEL[yongsin.confidence] ?? yongsin.confidence})`
    : '';

  // 2026-05-14 (revised): secondary(희신) 에서 강세 오행을 마스킹.
  //   기존 룰 "score >= weakest + 1.0" 은 fixture(1982-01-29) 기반 경험값이라
  //   다른 명식에서 over/under-masking 위험이 있었다. 비율 기반으로 재설계:
  //
  //   1) dominant 오행 → 무조건 마스킹.
  //   2) 점수 ≥ 평균(총점/5) 인 오행 → 마스킹 (이미 평균 이상 가지고 있음).
  //   3) 상위 2위까지의 오행 → 마스킹 (sub-dominant 도 더 키우면 균형 깨짐).
  //   세 조건 중 하나라도 만족하면 secondary 에서 제외 + kiyshin(주의) 로 이동.
  const byElement = data.fiveElements.byElement;
  const dominantElement = data.fiveElements.dominant;
  const totalScore = data.fiveElements.totalScore;
  const averageScore = totalScore > 0 ? totalScore / ELEMENT_SEQUENCE.length : 0;
  // 점수 내림차순 정렬 → 상위 2위(0, 1번째 index) 식별
  const elementsByScoreDesc = ELEMENT_SEQUENCE
    .map((el) => ({ element: el, score: byElement[el]?.score ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const top2Elements = new Set(elementsByScoreDesc.slice(0, 2).map((entry) => entry.element));

  function isMaskingTarget(element: Element) {
    if (element === dominantElement) return true;
    const score = byElement[element]?.score ?? 0;
    if (averageScore > 0 && score >= averageScore - SCORE_EPSILON) return true;
    if (top2Elements.has(element)) return true;
    return false;
  }

  const safeSecondary = (yongsin.secondary ?? [])
    .filter((symbol) => symbol.value !== primaryElement)
    .filter((symbol) => !isMaskingTarget(symbol.value as Element));
  const maskedSecondary = (yongsin.secondary ?? []).filter((symbol) =>
    isMaskingTarget(symbol.value as Element)
  );

  // 2026-05-14: kiyshin(주의·조절할 기운)에 dominant 가 빠져 있으면 보강.
  // 또 마스킹된 secondary (강세인데 secondary 로 들어온 오행) 도 주의로 옮긴다.
  const kiyshinValues = new Set((yongsin.kiyshin ?? []).map((symbol) => symbol.value));
  const augmentedKiyshin: SajuSymbolRef[] = [...(yongsin.kiyshin ?? [])];
  if (!kiyshinValues.has(dominantElement) && dominantElement !== primaryElement) {
    augmentedKiyshin.push({
      type: 'element',
      value: dominantElement,
      label: `${getElementHanja(dominantElement)} (${dominantElement})`,
    });
    kiyshinValues.add(dominantElement);
  }
  for (const masked of maskedSecondary) {
    if (!kiyshinValues.has(masked.value) && masked.value !== primaryElement) {
      augmentedKiyshin.push(masked);
      kiyshinValues.add(masked.value);
    }
  }

  const secondaryText =
    safeSecondary.length > 0
      ? safeSecondary
          .map((symbol) => FRIENDLY_ELEMENT_LABEL[symbol.value as Element] ?? symbol.label)
          .join(' · ')
      : '뚜렷한 희신 후보 없음 (도움이 되는 핵심 기운만 의존)';
  const kiyshinText =
    augmentedKiyshin.length > 0
      ? augmentedKiyshin
          .map((symbol) => FRIENDLY_ELEMENT_LABEL[symbol.value as Element] ?? symbol.label)
          .join(' · ')
      : '특별히 조절할 기운 없음';

  const claims: SajuVerifiedClaim[] = [
    {
      id: 'yongsin.primary',
      text: `${primaryLabel}이 균형을 잘 맞춰주는 1순위 기운으로 잡혔어요. ${FRIENDLY_ELEMENT_HINT[primaryElement] ?? ''}`.trim(),
      confidence: toClaimConfidence(yongsin.confidence),
      evidence: [
        evidence('yongsin.primary', '도움이 되는 1순위 기운', primaryLabel),
        evidence('yongsin.method', '계산한 방식', yongsin.method),
        evidence('yongsin.confidence', '풀이 확신도', yongsin.confidence ?? null),
      ],
      caveat: '계절 균형·강약 균형 등 후보 계산법이 엇갈리면, 한 가지로 단정해 말하지 않아요.',
    },
    {
      id: 'yongsin.secondary',
      text: `희신(보조 도움 기운): ${secondaryText}. 1순위 도움 기운(${primaryLabel})을 든든하게 받쳐주는 기운이에요.`,
      confidence: safeSecondary.length > 0 ? 'medium' : 'low',
      evidence: [
        evidence('yongsin.secondary', '보조 도움 기운 후보', secondaryText),
        evidence('fiveElements.dominant', '가장 강한 기운 (희신에서 마스킹)', FRIENDLY_ELEMENT_LABEL[dominantElement]),
        ...(maskedSecondary.length > 0
          ? [
              evidence(
                'yongsin.secondary.masked',
                '희신에서 제외한 강세 오행',
                maskedSecondary.map((s) => s.label).join(', ')
              ),
            ]
          : []),
      ],
      caveat: '이미 강한 오행은 더 쓰면 균형이 더 기울 수 있어 희신 후보에서 제외했어요.',
    },
    {
      id: 'yongsin.kiyshin',
      text: `주의(조절할 기운): ${kiyshinText}. 너무 많이 쓰면 컨디션이 한쪽으로 쏠릴 수 있어요.`,
      confidence: 'medium',
      evidence: [
        evidence('yongsin.kiyshin', '조절할 기운', kiyshinText),
        evidence('fiveElements.dominant.score', '가장 강한 기운의 점수', byElement[dominantElement]?.score ?? null),
      ],
      caveat: '"피해야 한다" 가 아니라 "이미 많이 쓰고 있으니 더 쌓지 않게 조절" 의미예요.',
    },
  ];

  return {
    id: 'yongsin',
    title: FRIENDLY_BLOCK_LABEL.yongsin,
    summary: `지금 가장 도움이 되는 핵심 기운은 ${primaryLabel}${confidenceLabel}이에요. 희신은 ${secondaryText}, 조절할 기운은 ${kiyshinText} 으로 잡혀요.`,
    claims,
    actions: ELEMENT_ACTION_MAP[primaryElement] ?? [],
    antiClaims: [
      '도움 기운을 “행운의 부적”처럼 신비화하지 않아요.',
      '조절할 기운을 피해야 할 사람·직업·병처럼 단정하지 않아요.',
    ],
    tags: ['yongsin', yongsin.method, primaryElement],
    tone,
  };
}

function getElementHanja(element: Element): string {
  return ELEMENT_HANJA[element];
}

function buildLuckBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const currentMajor = data.currentLuck?.currentMajorLuck;
  const saewoon = data.currentLuck?.saewoon;
  const wolwoon = data.currentLuck?.wolwoon;

  return {
    id: 'luck-flow',
    title: FRIENDLY_BLOCK_LABEL.luck,
    summary: currentMajor
      ? `지금은 ${currentMajor.ganzi} 긴 흐름 위에 올라타 있어요. 올해 흐름은 ${saewoon?.ganzi ?? '확인 중'}, 이번 달은 ${wolwoon?.ganzi ?? '확인 중'}으로 잡혀요.`
      : `긴 흐름은 아직 확인 중이고, 올해 흐름은 ${saewoon?.ganzi ?? '확인 중'}, 이번 달은 ${wolwoon?.ganzi ?? '확인 중'}으로 잡혀요.`,
    claims: [
      {
        id: 'luck.current',
        text: '지금 흐르는 운은 화면을 열 때마다 다시 계산하는 편이 더 정확해요. 오래 저장해 두면 흐름이 어긋날 수 있거든요.',
        confidence: 'high',
        evidence: [
          evidence('metadata.calculatedAt', '풀이를 만든 시각', data.metadata.calculatedAt),
          evidence('currentLuck.saewoon.ganzi', '올해 흐름 코드', saewoon?.ganzi ?? null),
          evidence('currentLuck.wolwoon.ganzi', '이번 달 흐름 코드', wolwoon?.ganzi ?? null),
        ],
      },
    ],
    actions: ['올해/이번 달 흐름은 다른 풀이와 분리해 저장하고, 화면 진입 시 한 달 안쪽인지 확인해요.'],
    antiClaims: ['올해 흐름·이번 달 흐름을 “이 일이 꼭 일어난다”는 식으로 단정하지 않아요.'],
    tags: ['luck', 'currentLuck'],
    tone,
  };
}

function buildNextBestActions(data: SajuDataV1) {
  const primary = (data.yongsin?.primary.value ?? data.fiveElements.weakest) as Element;
  const baseActions = ELEMENT_ACTION_MAP[primary] ?? [];
  const verificationAction =
    '풀이 화면에서 "왜 그렇게 풀이됐는지 보기"를 펼치면 컨디션 점수·도움 기운 후보·다섯 기운 점수를 직접 확인할 수 있어요.';
  const freshnessAction =
    '올해/이번 달 흐름은 처음 본 지 한 달이 지나면 자동으로 새로 계산해 보여드려요.';

  return [...baseActions.slice(0, 3), verificationAction, freshnessAction];
}

function toClaimConfidence(confidence?: string): SajuClaimConfidence {
  if (confidence === '높음') return 'high';
  if (confidence === '중간') return 'medium';
  return 'low';
}

function isSajuDataV2(value: unknown): value is SajuDataV2 {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { schemaVersion?: unknown }).schemaVersion === SAJU_DATA_V2 &&
      (value as { interpretation?: unknown }).interpretation &&
      (value as { verification?: unknown }).verification
  );
}

function isLuckStale(calculatedAt: string | undefined, now: string) {
  if (!calculatedAt) return true;
  const start = new Date(calculatedAt).getTime();
  const end = new Date(now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  const days = Math.abs(end - start) / (1000 * 60 * 60 * 24);
  return days > VOLATILE_LUCK_TTL_DAYS;
}

function evidence(path: string, label: string, value?: SajuEvidenceRef['value']): SajuEvidenceRef {
  return { path, label, value };
}

function pushIssue(
  issues: SajuValidationIssue[],
  code: string,
  severity: SajuValidationSeverity,
  path: string,
  message: string,
  expected?: unknown,
  actual?: unknown,
  fixHint?: string
) {
  issues.push({ code, severity, path, message, expected, actual, fixHint });
}

function sameArray<T>(left: T[], right: T[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp100(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatElement(element: Element) {
  // 검증·로그 메시지 전용 (한자 + 일상어 병기).
  return `${ELEMENT_HANJA[element]}(${FRIENDLY_ELEMENT_LABEL[element]})`;
}

function formatDayMaster(data: SajuDataV1) {
  const elementLabel = FRIENDLY_ELEMENT_LABEL[data.dayMaster.element];
  const metaphor = data.dayMaster.metaphor;
  return metaphor ? `${elementLabel}의 ${metaphor}` : elementLabel;
}

function formatVerificationStatus(status: SajuVerificationStatus) {
  if (status === 'pass') return '문제 없음';
  if (status === 'pass-with-warnings') return '작은 경고 있음';
  return '문제 있음 — 다시 계산 권장';
}

function formatVerificationFailure(report: SajuVerificationReport) {
  const errors = report.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
    .join('\n');
  return `SajuData verification failed. score=${report.score}\n${errors}`;
}
