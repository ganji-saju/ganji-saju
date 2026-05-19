// 2026-05-19 — /api/today-fortune entry points 가 동일 sajuData entry 사용하도록 통일.
//   직접 calculateSajuDataV1 호출 시 entrypoint 간 drift 위험 → helper 한 곳에서 fresh 생성.
//
//   2026-05-20 (V2-4 hot path): loadSajuDataV2 로 전환. PR #264 의 30 invariant
//   (V1↔V2 fresh, envelope V1 ↔ fresh, stored V1 옛 timestamp ↔ fresh, KST 경계)
//   가 회귀 차단. 반환 타입은 SajuDataV1 | SajuDataV2 union 유지 → 호출처 변경 0.
//
//   audit-reports/2026-05-19-v2-migration-audit.md §2-D hot path 의
//   today-fortune/route.ts + today-fortune/unlock/route.ts 가 본 helper 통과.
import type { BirthInput } from '@/lib/saju/types';
import {
  loadSajuDataV2,
  type SajuDataV1,
  type SajuDataV2,
} from '@/domain/saju/engine';

/**
 * /api/today-fortune entry point 의 fresh sajuData 생성 단일 entry.
 *
 * 모든 today-fortune 호출이 본 helper 를 통과해야 entrypoint 간 drift 방지.
 * 미래 변경 (V2.5 / V3 / 새 산식 등) 시 본 함수 한 곳만 수정.
 */
export function buildFreshTodaySajuData(input: BirthInput): SajuDataV1 | SajuDataV2 {
  return loadSajuDataV2(input, null);
}
