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

const ELEMENT_ACTION_MAP: Record<Element, string[]> = {
  목: ['새 프로젝트를 1개만 작게 시작한다', '학습/리서치 시간을 캘린더에 고정한다', '산책·스트레칭으로 루틴의 시작 저항을 낮춘다'],
  화: ['표현해야 할 메시지를 3문장으로 정리한다', '아침 햇빛·가벼운 유산소로 에너지를 끌어올린다', '작은 성취를 빠르게 공유한다'],
  토: ['일정·현금흐름·책임 범위를 한 화면에서 관리한다', '반복 업무를 체크리스트화한다', '관계/업무의 경계를 명확히 문서화한다'],
  금: ['우선순위 기준을 3개 이하로 줄인다', '불필요한 일·관계를 정리하는 시간을 둔다', '검토·편집·품질관리 루틴을 만든다'],
  수: ['수면과 회복 시간을 선점한다', '결정 전 자료를 모아 리스크를 분리한다', '혼자 사고하는 조용한 블록을 확보한다'],
};

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

  const v1 = normalizeToSajuDataV1(input, storedValue, {
    timezone: options.timezone,
    location: options.location,
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
      pushIssue(issues, 'HIDDEN_STEMS_MISMATCH', 'warning', `${path}.hiddenStems`, '지장간 배열이 기준표와 다릅니다.', expectedHidden, actualHidden, '지장간 기준표를 단일 소스로 분리하고 테스트 케이스를 고정하세요.');
    }

    if (key === 'day' && pillar.stemTenGod !== null) {
      pushIssue(issues, 'DAY_STEM_TENGOD_SHOULD_BE_NULL', 'error', `${path}.stemTenGod`, '일간의 천간 십신은 null이어야 합니다.', null, pillar.stemTenGod);
    }

    if (key !== 'day' && pillar.stemTenGod === null) {
      pushIssue(issues, 'NON_DAY_STEM_TENGOD_MISSING', 'warning', `${path}.stemTenGod`, '년·월·시 천간 십신이 비어 있습니다.');
    }
  }

  if (dayMaster.stem !== pillars.day?.stem) {
    pushIssue(issues, 'DAY_MASTER_STEM_MISMATCH', 'error', 'dayMaster.stem', '일간이 일주 천간과 일치하지 않습니다.', pillars.day?.stem, dayMaster.stem);
  }

  if (dayMaster.element !== pillars.day?.stemElement) {
    pushIssue(issues, 'DAY_MASTER_ELEMENT_MISMATCH', 'error', 'dayMaster.element', '일간 오행이 일주 천간 오행과 일치하지 않습니다.', pillars.day?.stemElement, dayMaster.element);
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
    pushIssue(issues, 'MISSING_YONGSIN', 'warning', 'yongsin', '용신 판정이 없습니다.');
    return;
  }

  if (!yongsin.candidates?.length) {
    pushIssue(issues, 'YONGSIN_CANDIDATES_MISSING', 'warning', 'yongsin.candidates', '용신 후보군이 없어 결과 검증이 어렵습니다.');
  } else {
    const [first] = yongsin.candidates;
    if (first && yongsin.primary.value !== first.primary.value) {
      pushIssue(issues, 'YONGSIN_PRIMARY_NOT_TOP_CANDIDATE', 'error', 'yongsin.primary', 'primary 용신이 후보 1순위와 다릅니다.', first.primary.value, yongsin.primary.value);
    }

    for (let i = 1; i < yongsin.candidates.length; i += 1) {
      if (yongsin.candidates[i - 1].score < yongsin.candidates[i].score) {
        pushIssue(issues, 'YONGSIN_CANDIDATES_NOT_SORTED', 'warning', 'yongsin.candidates', '용신 후보가 점수 내림차순으로 정렬되어 있지 않습니다.');
        break;
      }
    }
  }

  if (!yongsin.confidence) {
    pushIssue(issues, 'YONGSIN_CONFIDENCE_MISSING', 'warning', 'yongsin.confidence', '용신 신뢰도 표시가 없습니다.');
  }

  const cautionValues = new Set((yongsin.kiyshin ?? []).map((symbol) => symbol.value));
  if (cautionValues.has(yongsin.primary.value)) {
    pushIssue(issues, 'YONGSIN_PRIMARY_OVERLAPS_KIYSHIN', 'error', 'yongsin.kiyshin', '용신과 기신이 같은 값으로 겹칩니다.', yongsin.primary.value, [...cautionValues]);
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
      `${VOLATILE_LUCK_TTL_DAYS}일 이상 지난 currentLuck입니다. 세운/월운은 재계산 대상입니다.`,
      `within ${VOLATILE_LUCK_TTL_DAYS} days`,
      data.metadata.calculatedAt,
      '월운/세운은 조회 시점 기준으로 재계산하거나 validUntil을 저장하세요.'
    );
  }

  if (data.input.gender && !data.majorLuck?.length) {
    pushIssue(issues, 'MAJOR_LUCK_MISSING_WITH_GENDER', 'warning', 'majorLuck', '성별 입력이 있는데 대운 데이터가 없습니다.');
  }

  if (!data.input.gender && data.majorLuck?.length) {
    pushIssue(issues, 'MAJOR_LUCK_EXISTS_WITHOUT_GENDER', 'info', 'majorLuck', '성별 미입력 상태에서 대운이 계산되어 있습니다. 입력 정책을 확인하세요.');
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
          pushIssue(issues, 'PROHIBITED_INTERPRETATION_PATTERN', 'warning', `interpretation.blocks.${block.id}.claims.${claim.id}.text`, '단정적·위험 표현이 포함되어 있습니다.', pattern.source, claim.text);
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
  const dayMasterLabel = `${data.dayMaster.stem} ${formatElement(data.dayMaster.element)}`;
  const dominant = data.fiveElements.dominant;
  const weakest = data.fiveElements.weakest;
  const strengthLabel = data.strength ? `${data.strength.level} ${data.strength.score}점` : '강약 미확정';
  const yongsinLabel = data.yongsin ? `${data.yongsin.primary.label}${data.yongsin.confidence ? ` · 신뢰도 ${data.yongsin.confidence}` : ''}` : '용신 미확정';

  const executiveSummary = [
    `일간은 ${dayMasterLabel}입니다.`,
    `오행은 ${formatElement(dominant)} 우세, ${formatElement(weakest)} 약세로 읽힙니다.`,
    `강약 판정은 ${strengthLabel}, 용신 후보는 ${yongsinLabel}입니다.`,
    `검증 점수는 ${report.score}점/${report.status}입니다.`,
  ].join(' ');

  const blocks: SajuInterpretationBlock[] = [
    buildFoundationBlock(data, options.tone),
    buildBalanceBlock(data, options.tone),
    buildYongsinBlock(data, options.tone),
    buildLuckBlock(data, options.tone),
  ];

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
      '이 해석은 사주 데이터 기반의 자기이해/코칭 콘텐츠입니다. 건강·투자·법률·의료 판단의 근거로 사용하지 마세요.',
      '생시 미상, 위치 보정, 자시 적용 방식이 달라지면 시주·대운·일부 해석이 달라질 수 있습니다.',
      '모든 해석은 확정 예언이 아니라 경향성·리스크·활용 전략으로 표현합니다.',
    ],
  };
}

function buildFoundationBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const metaphor = data.dayMaster.metaphor ?? '일간';
  return {
    id: 'foundation',
    title: '기본 성향',
    summary: `${data.dayMaster.stem} 일간은 ${metaphor}의 이미지로 설명할 수 있습니다. 다만 성향은 일간만이 아니라 월령·오행 분포·십신 구조를 함께 봐야 합니다.`,
    claims: [
      {
        id: 'foundation.dayMaster',
        text: `${data.dayMaster.stem} 일간의 기본 이미지는 ${metaphor}이며, 자기표현 방식의 출발점으로 참고할 수 있습니다.`,
        confidence: 'high',
        evidence: [
          evidence('dayMaster.stem', '일간 천간', data.dayMaster.stem),
          evidence('dayMaster.element', '일간 오행', data.dayMaster.element),
          evidence('dayMaster.metaphor', '일간 메타포', metaphor),
        ],
        caveat: '일간 단독 해석은 과잉 단순화 위험이 있습니다.',
      },
    ],
    actions: ['일간 설명은 첫 화면 요약으로만 쓰고, 상세 화면에서는 월령·강약·용신 근거를 같이 보여줍니다.'],
    antiClaims: ['일간 하나만으로 직업·결혼·건강 결과를 단정하지 않습니다.'],
    tags: ['dayMaster', 'summary'],
    tone,
  };
}

function buildBalanceBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const dominant = data.fiveElements.dominant;
  const weakest = data.fiveElements.weakest;
  const dominantValue = data.fiveElements.byElement[dominant];
  const weakestValue = data.fiveElements.byElement[weakest];

  return {
    id: 'five-elements-balance',
    title: '오행 밸런스',
    summary: `${formatElement(dominant)} 점수가 가장 높고 ${formatElement(weakest)} 점수가 가장 낮습니다. UI에서는 count보다 score를 우선 노출하는 편이 더 안전합니다.`,
    claims: [
      {
        id: 'balance.dominant',
        text: `${formatElement(dominant)} 기운이 상대적으로 강하게 계산되어, 해당 기운의 장점은 쓰되 과잉 사용은 조절하는 방향이 좋습니다.`,
        confidence: 'high',
        evidence: [
          evidence('fiveElements.dominant', '우세 오행', dominant),
          evidence(`fiveElements.byElement.${dominant}.score`, '우세 오행 점수', dominantValue.score),
          evidence('fiveElements.totalScore', '오행 총점', data.fiveElements.totalScore),
        ],
      },
      {
        id: 'balance.weakest',
        text: `${formatElement(weakest)} 기운은 보완 축으로 읽히며, 생활 루틴에서는 이 기운을 작게 반복하는 방식이 적합합니다.`,
        confidence: 'medium',
        evidence: [
          evidence('fiveElements.weakest', '약세 오행', weakest),
          evidence(`fiveElements.byElement.${weakest}.score`, '약세 오행 점수', weakestValue.score),
        ],
        caveat: '동점 후보가 있으면 공동 약세로 표시해야 합니다.',
      },
    ],
    actions: ELEMENT_ACTION_MAP[weakest],
    antiClaims: ['부족한 오행이 곧 결핍된 인생이나 질병을 의미한다고 단정하지 않습니다.'],
    tags: ['fiveElements', 'balance', dominant, weakest],
    tone,
  };
}

function buildYongsinBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const yongsin = data.yongsin;
  if (!yongsin) {
    return {
      id: 'yongsin',
      title: '용신',
      summary: '용신 데이터가 없어 해석을 보류합니다.',
      claims: [],
      actions: ['용신 후보군 계산을 먼저 수행합니다.'],
      antiClaims: ['용신 미계산 상태에서 용신 기반 조언을 생성하지 않습니다.'],
      tags: ['yongsin', 'pending'],
      tone,
    };
  }

  const primaryElement = yongsin.primary.value as Element;
  return {
    id: 'yongsin',
    title: '용신과 활용 전략',
    summary: `현재 1순위 용신은 ${yongsin.primary.label}이며, 판정 방식은 ${yongsin.method}입니다. 후보 점수와 신뢰도를 함께 보여주는 방식이 사용자 신뢰에 유리합니다.`,
    claims: [
      {
        id: 'yongsin.primary',
        text: `${yongsin.primary.label}은 현재 명식의 균형을 맞추는 1순위 후보로 계산되었습니다.`,
        confidence: toClaimConfidence(yongsin.confidence),
        evidence: [
          evidence('yongsin.primary', '1순위 용신', yongsin.primary.label),
          evidence('yongsin.method', '판정 방식', yongsin.method),
          evidence('yongsin.confidence', '판정 신뢰도', yongsin.confidence ?? null),
        ],
        caveat: '조후·억부·오행 보정 후보가 충돌하면 단정형 문장을 피해야 합니다.',
      },
    ],
    actions: ELEMENT_ACTION_MAP[primaryElement] ?? [],
    antiClaims: ['용신을 행운의 절대 요소로 표현하지 않습니다.', '기신을 피해야 할 사람·직업·질병으로 단정하지 않습니다.'],
    tags: ['yongsin', yongsin.method, primaryElement],
    tone,
  };
}

function buildLuckBlock(data: SajuDataV1, tone: SajuContentTone): SajuInterpretationBlock {
  const currentMajor = data.currentLuck?.currentMajorLuck;
  const saewoon = data.currentLuck?.saewoon;
  const wolwoon = data.currentLuck?.wolwoon;

  return {
    id: 'luck-flow',
    title: '현재 흐름',
    summary: currentMajor
      ? `현재 대운은 ${currentMajor.ganzi}, 세운은 ${saewoon?.ganzi ?? '미확정'}, 월운은 ${wolwoon?.ganzi ?? '미확정'}입니다.`
      : `대운은 미확정이며, 세운은 ${saewoon?.ganzi ?? '미확정'}, 월운은 ${wolwoon?.ganzi ?? '미확정'}입니다.`,
    claims: [
      {
        id: 'luck.current',
        text: '현재운은 조회 시점에 따라 바뀌므로 캐시 데이터보다 실시간 재계산 정책이 중요합니다.',
        confidence: 'high',
        evidence: [
          evidence('metadata.calculatedAt', '계산 시각', data.metadata.calculatedAt),
          evidence('currentLuck.saewoon.ganzi', '세운 간지', saewoon?.ganzi ?? null),
          evidence('currentLuck.wolwoon.ganzi', '월운 간지', wolwoon?.ganzi ?? null),
        ],
      },
    ],
    actions: ['월운/세운은 결과 캐시와 분리하고, 화면 진입 시 월 단위 TTL을 확인합니다.'],
    antiClaims: ['세운·월운을 특정 사건 발생 보장으로 표현하지 않습니다.'],
    tags: ['luck', 'currentLuck'],
    tone,
  };
}

function buildNextBestActions(data: SajuDataV1) {
  const primary = (data.yongsin?.primary.value ?? data.fiveElements.weakest) as Element;
  const baseActions = ELEMENT_ACTION_MAP[primary] ?? [];
  const verificationAction = '해석 화면에 “근거 보기”를 추가해 strength.score, yongsin.candidates, fiveElements.score를 펼쳐 보여줍니다.';
  const freshnessAction = 'currentLuck은 calculatedAt 기준 32일 TTL을 넘으면 재계산합니다.';

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
  return `${ELEMENT_HANJA[element]}(${element})`;
}

function formatVerificationFailure(report: SajuVerificationReport) {
  const errors = report.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
    .join('\n');
  return `SajuData verification failed. score=${report.score}\n${errors}`;
}
