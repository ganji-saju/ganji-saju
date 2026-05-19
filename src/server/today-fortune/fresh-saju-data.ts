// 2026-05-19 — /api/today-fortune entry points 가 동일 sajuData entry 사용하도록 통일.
//   직접 calculateSajuDataV1 호출 시 entrypoint 간 drift 위험 → helper 한 곳에서 fresh 생성.
//
//   현재 구현: V1 (변경 0 — 회귀 위험 0).
//   V2 전환은 후속 PR 에서 saju-data-entry-invariant.test.ts 가 회귀 차단.
//
//   audit-reports/2026-05-19-v2-migration-audit.md §2-D hot path 의
//   today-fortune/route.ts + today-fortune/unlock/route.ts 가 본 helper 통과.
import type { BirthInput } from '@/lib/saju/types';
import {
  calculateSajuDataV1,
  type SajuDataV1,
} from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';

/**
 * /api/today-fortune entry point 의 fresh sajuData 생성 단일 entry.
 *
 * 모든 today-fortune 호출이 본 helper 를 통과해야 entrypoint 간 drift 방지.
 * 미래 변경 (V2.5 / V3 / 새 산식 등) 시 본 함수 한 곳만 수정.
 */
export function buildFreshTodaySajuData(input: BirthInput): SajuDataV1 | SajuDataV2 {
  return calculateSajuDataV1(input);
}
