// 오늘 발동된 명리 케이스 전체를 중립 의미 라벨 목록으로 반환.
// LLM grounding 용도 — 조언/예측 아님, 사실(fact) 전달.

import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { Stem, Branch } from '@/lib/today-fortune/iljin-rules';
import { detectTriggeredCases, PRIORITY } from '@/lib/today-fortune/iljin-case-picker';
import { getIljinCaseMeaning } from '@/lib/today-fortune/iljin-case-meanings';
import {
  getTodayPillarSnapshot,
  deriveLuckyElements,
  buildSajuOriginForIljin,
} from '@/server/today-fortune/build-today-fortune';

const MAX_TODAY_CASE_SUMMARIES = 10;

export function buildTodayCaseSummaries(args: {
  sajuData: SajuDataV1 | SajuDataV2;
  options?: { now?: Date };
}): string[] {
  const { sajuData, options } = args;
  const todayPillar = getTodayPillarSnapshot(sajuData, { now: options?.now });
  if (!todayPillar.stem || !todayPillar.branch) return [];
  const { lucky, unlucky } = deriveLuckyElements(sajuData);
  const sajuOrigin = buildSajuOriginForIljin(sajuData, lucky, unlucky);
  const triggered = detectTriggeredCases(
    sajuOrigin,
    todayPillar.stem as Stem,
    todayPillar.branch as Branch
  );
  const sorted = triggered
    .slice()
    .sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  return sorted
    .map((id) => getIljinCaseMeaning(id))
    .filter((s) => s.length > 0)
    .slice(0, MAX_TODAY_CASE_SUMMARIES);
}
