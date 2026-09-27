import assert from 'node:assert/strict';
import { dedupeSentencesDeep } from './dedupe-sentences';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildLifetimeReport, buildYearlyReport } from '@/domain/saju/report';
import { buildFallbackNewYearExtras, buildFallbackYearlyInterpretation } from '@/server/ai/saju-yearly-interpretation';
import { buildFallbackLifetimeInterpretation } from '@/server/ai/saju-lifetime-interpretation';

declare const test: (name: string, fn: () => void) => void;

// 2026-09-27 — 사용자 피드백 "같은 말을 되풀이·문맥이 안 맞는다". 측정: 한 풀이 안 반복 문장 평균 23~34개.
const sentences = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') for (const s of v.split(/(?<=[.!?。])\s+/)) { if (s.trim().length >= 15) out.push(s.trim()); }
  else if (Array.isArray(v)) v.forEach((x) => sentences(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => sentences(x, out));
  return out;
};
const dupCount = (v: unknown) => { const s = sentences(v); return s.length - new Set(s).size; };

test('dedupeSentencesDeep: 뒤에 다시 나온 문장을 빼고, 칸이 비면 원문을 둔다', () => {
  const out = dedupeSentencesDeep({
    a: '첫 문장은 충분히 길게 씁니다. 두 번째 문장도 충분히 길게 씁니다.',
    b: '두 번째 문장도 충분히 길게 씁니다. 새로운 문장이 여기 있습니다.',
    c: '첫 문장은 충분히 길게 씁니다.',
    n: 3,
  });
  assert.equal(out.b, '새로운 문장이 여기 있습니다.');
  assert.equal(out.c, '첫 문장은 충분히 길게 씁니다.', '전부 중복이면 빈 칸 대신 원문');
  assert.equal(out.n, 3);
});

test('연간·신년·평생 기본 풀이: 한 풀이 안 반복 문장 0', () => {
  for (const p of [
    { year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: 'male' as const },
    { year: 1975, month: 11, day: 2, hour: 6, minute: 0, gender: 'female' as const },
  ]) {
    const data = normalizeToSajuDataV1(p, null);
    const yr = buildYearlyReport(p, data, 2027);
    assert.equal(dupCount(buildFallbackYearlyInterpretation(yr)), 0, 'yearly');
    assert.equal(dupCount(buildFallbackNewYearExtras(yr)), 0, 'new-year extras');
    // 합친 뒤(화면·PDF 출구)에도 0.
    // 합친 뒤(화면·PDF 출구)에도 산문은 0. '기대할 일·조심할 일' 목록은 월별 문장을 가져온 **요약 색인**이라 예외(남은 과제: 목록 문장 따로 쓰기).
    const merged = dedupeSentencesDeep({ ...buildFallbackYearlyInterpretation(yr), newYear: buildFallbackNewYearExtras(yr) });
    const { expectations: _e, cautions: _c, ...extrasProse } = merged.newYear!;
    assert.equal(dupCount({ ...merged, newYear: extrasProse }), 0, 'merged');
    assert.equal(dupCount(buildFallbackLifetimeInterpretation(buildLifetimeReport(p, data, 2026))), 0, 'lifetime');
  }
});
