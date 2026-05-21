// 2026-05-21 — 오행 가이드 naming-policy 검증(Phase 5).
//   total-review-validator 의 hardTextReasons/countGyeol 재사용(naming-policy 단일 소스):
//   한자 0 · 명리 술어 0 · 일일 톤 0 · 자극/단정 0 · "X의 기운" 금지 · "결" ≤1.
import { hardTextReasons, countGyeol } from '@/lib/saju/total-review-validator';

export interface OhaengGuidanceValidationResult {
  ok: boolean;
  reasons: string[];
}

export function validateOhaengGuidance(text: string): OhaengGuidanceValidationResult {
  const reasons = hardTextReasons(text, '오행 가이드');
  const gyeol = countGyeol(text);
  if (gyeol > 1) reasons.push(`'결' 과다: ${gyeol}회 (최대 1회)`);
  return { ok: reasons.length === 0, reasons };
}

/** 한자/금지어/일일톤/자극어 — deterministic fallback 으로 교체해야 하는 치명 위반. */
export function hasHardOhaengGuidanceViolation(text: string): boolean {
  return hardTextReasons(text, '').length > 0;
}
