/**
 * 2026-09-27 — "풀이가 매번 똑같고 문맥이 안 맞는다" 측정(사용자 피드백). 가짜 인물 N명으로 AI 없이 만들어지는
 * 결정론·폴백 풀이를 뽑아 ① 사람 사이 공통 문장 비율 ② 한 풀이 안 반복 문장 수를 센다. DB·AI 호출 없음.
 * 실행: ./scripts/with-node22.sh npx tsx scripts/measure-reading-repetition.ts
 */
import { normalizeToSajuDataV1 } from '../src/domain/saju/engine/saju-data-v1';
import { buildLifetimeReport, buildSajuReport, buildYearlyReport } from '../src/domain/saju/report';
import { buildTodayFortuneFreeResult, buildTodayFortunePremiumResult } from '../src/server/today-fortune/build-today-fortune';
import { buildFallbackNewYearExtras, buildFallbackYearlyInterpretation } from '../src/server/ai/saju-yearly-interpretation';
import { buildFallbackLifetimeInterpretation } from '../src/server/ai/saju-lifetime-interpretation';

const now = new Date('2026-09-27T03:00:00Z');
const people = Array.from({ length: 30 }, (_, i) => ({
  year: 1960 + ((i * 7) % 45), month: 1 + ((i * 5) % 12), day: 1 + ((i * 11) % 28),
  hour: (i * 3) % 24, minute: 0, gender: (i % 2 ? 'male' : 'female') as 'male' | 'female',
}));

function sentences(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    for (const s of value.split(/(?<=[.!?。])\s+/)) if (s.trim().length >= 15 && /[가-힣]/.test(s)) out.push(s.trim());
  } else if (Array.isArray(value)) value.forEach((v) => sentences(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => sentences(v, out));
  return out;
}

const products: Record<string, (p: (typeof people)[number]) => unknown> = {
  '오늘운세 무료': (p) => buildTodayFortuneFreeResult(p, normalizeToSajuDataV1(p, null), { concernId: 'general', sourceSessionId: 'm', calendarType: 'solar', timeRule: 'standard', now } as never),
  '오늘운세 상세': (p) => buildTodayFortunePremiumResult(p, normalizeToSajuDataV1(p, null), 'general' as never, null, null, { now }),
  '사주 기본 리포트': (p) => buildSajuReport(p, normalizeToSajuDataV1(p, null), 'today'),
  '연간·신년 폴백': (p) => { const r = buildYearlyReport(p, normalizeToSajuDataV1(p, null), 2027); return { a: buildFallbackYearlyInterpretation(r), b: buildFallbackNewYearExtras(r) }; },
  '평생 폴백': (p) => buildFallbackLifetimeInterpretation(buildLifetimeReport(p, normalizeToSajuDataV1(p, null), 2026)),
};

// 2026-09-27 — 화면(렌더)에 그리지 않는 칸은 뺀다. 데이터 객체 전체를 세면 AI 입력·공유 문구·검증 페이지 전용 칸의
//   겹침까지 '반복'으로 잡혀 실제 화면보다 크게 나왔다(근거: 각 칸을 그리는 컴포넌트 grep).
const HIDDEN_FIELDS: Record<string, string[]> = {
  '오늘운세 무료': ['answer', 'headline'], // 카드는 같은 문장인 summary 로 한 번만 그림 · oneLine.headline 은 공유 문구·메모 전용
  '오늘운세 상세': ['groundingSummary'], // 무료 화면(SajuReasonSnippet) 전용 — 상세 패널은 evidenceLines 만 그림
  '사주 기본 리포트': ['insights', 'summaryHighlights', 'technicalSummary', 'dayMasterSummary', 'scores'], // AI 입력·검증 페이지 전용 · 점수 문장은 화면에서 짧은 표어로 바뀜
};
function omitFields(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => omitFields(v, keys));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)).map(([k, v]) => [k, omitFields(v, keys)]));
  return value;
}

const rows: string[] = ['| 풀이 | 한 풀이 문장 수(평균) | 절반 이상에게 똑같이 나오는 문장 비율 | 한 풀이 안 반복 문장(평균) |', '|---|---|---|---|'];
const tops: string[] = [];
for (const [name, build] of Object.entries(products)) {
  const readings = people.map((p) => sentences(omitFields(build(p), HIDDEN_FIELDS[name] ?? [])));
  const freq = new Map<string, number>();
  for (const r of readings) for (const s of new Set(r)) freq.set(s, (freq.get(s) ?? 0) + 1);
  const half = people.length / 2;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const common = avg(readings.map((r) => r.filter((s) => (freq.get(s) ?? 0) >= half).length / Math.max(1, r.length)));
  const dup = avg(readings.map((r) => r.length - new Set(r).size));
  rows.push(`| ${name} | ${avg(readings.map((r) => r.length)).toFixed(0)} | ${(common * 100).toFixed(0)}% | ${dup.toFixed(1)} |`);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  tops.push(`**${name}** — 가장 많이 겹치는 문장:\n${top.map(([s, n]) => `- (${n}/${people.length}명) ${s.slice(0, 80)}`).join('\n')}`);
}
console.log(rows.join('\n') + '\n\n' + tops.join('\n\n'));
