// 2026-05-14: saju engine 의 단일 import 진입점.
// v1 은 backward-compat 용으로 그대로 노출하고, v2 는 신규 소비자가 사용한다.
// 새 코드는 가급적 v2 (loadSajuDataV2 / upgradeSajuDataV1ToV2 / SajuDataV2) 를
// 사용하되, 기존 v1 API (normalizeToSajuDataV1, calculateSajuDataV1,
// deriveLegacySajuResult) 도 그대로 유지된다.

export {
  SAJU_DATA_V1,
  SAJU_RULE_SET_V1,
  calculateSajuDataV1,
  normalizeToSajuDataV1,
  seedSajuDataV1FromLegacy,
  deriveLegacySajuResult,
  type SajuDataV1,
  type SajuDataVersion,
  type SajuPillar,
  type SajuPillars,
  type SajuDayMaster,
  type SajuFiveElements,
  type SajuFiveElementValue,
  type SajuTenGodSummary,
  type SajuStrength,
  type SajuPattern,
  type SajuYongsin,
  type SajuYongsinCandidate,
  type SajuMajorLuckCycle,
  type SajuCurrentLuck,
  type SajuLuckDescriptor,
  type SajuSymbolRef,
  type TenGodCode,
  type StrengthLevel,
} from './saju-data-v1';

export {
  SAJU_DATA_V2,
  SAJU_RULE_SET_V2,
  loadSajuDataV2,
  upgradeSajuDataV1ToV2,
  verifySajuData,
  type SajuDataV2,
  type SajuDataVersionV2,
  type SajuLoadOptions,
  type SajuModernInterpretation,
  type SajuInterpretationBlock,
  type SajuVerifiedClaim,
  type SajuEvidenceRef,
  type SajuVerificationReport,
  type SajuValidationIssue,
  type SajuValidationSeverity,
  type SajuVerificationStatus,
  type SajuClaimConfidence,
  type SajuContentTone,
  type SajuReadingMode,
} from './saju-data-v2-upgrade';
