import assert from 'node:assert/strict';
import { dedupeSentencesDeep, thinRepeatedTodayDeep } from './dedupe-sentences';
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
    const merged = dedupeSentencesDeep({ ...buildFallbackYearlyInterpretation(yr), newYear: buildFallbackNewYearExtras(yr) });
    // 2026-09-27 — 기대/조심 목록도 자기 문장을 쓰게 바꿔 예외 없이 0.
    assert.equal(dupCount(merged), 0, 'merged');
    assert.equal(dupCount(buildFallbackLifetimeInterpretation(buildLifetimeReport(p, data, 2026))), 0, 'lifetime');
  }
});

test('thinRepeatedTodayDeep: 문단·문자열 목록에서 첫 오늘만 남긴다', () => {
  assert.equal(thinRepeatedTodayDeep('오늘은 쉬세요. 오늘은 걷고 오늘 하나만 하세요. 오늘의 방향.'), '오늘은 쉬세요. 걷고 하나만 하세요. 오늘의 방향.');
  assert.deepEqual(thinRepeatedTodayDeep({ a: ['쉬세요.', '오늘은 걷기.', '오늘은 읽기.'], b: '오늘은 쉼.' }), { a: ['쉬세요.', '오늘은 걷기.', '읽기.'], b: '오늘은 쉼.' });
});

test('thinRepeatedTodayDeep(whole): 객체 전체에서 첫 오늘만 남긴다', () => {
  assert.deepEqual(
    thinRepeatedTodayDeep({ a: '오늘은 쉼.', b: { c: '오늘은 걷기.', d: ['오늘 읽기.'] } }, { seen: false }, true),
    { a: '오늘은 쉼.', b: { c: '걷기.', d: ['읽기.'] } },
  );
});
