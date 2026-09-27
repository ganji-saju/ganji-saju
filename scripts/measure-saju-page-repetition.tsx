/**
 * 2026-09-27 — 사주 결과 화면(/saju/[slug])의 결정론 섹션을 실제 컴포넌트로 렌더해 **화면 텍스트** 기준으로 잰다.
 * DB·AI 없음(총평 AI 는 제외, 그 폴백인 사주 이야기 카드는 포함). 가짜 인물 30명.
 * 실행: ./scripts/with-node22.sh npx tsx scripts/measure-saju-page-repetition.tsx
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSajuDataV2 } from '../src/domain/saju/engine/saju-data-v2-upgrade';
import { buildSajuNarrative, buildLifetimeReport, buildSajuReport } from '../src/domain/saju/report';
import { buildSajuInterpretationGrounding } from '../src/domain/saju/report/build-grounding';
import { buildSajuPersonalizationContext } from '../src/domain/saju/report/personalization-context';
import { SajuNarrativeCard } from '../src/components/saju/saju-narrative-card';
import { NatureSection } from '../src/features/saju-detail/sections/nature-section';
import { ElementsSection } from '../src/features/saju-detail/sections/elements-section';
import { MyeongsikSection } from '../src/features/saju-detail/sections/myeongsik-section';
import { DaewoonSection } from '../src/features/saju-detail/sections/daewoon-section';

const now = new Date('2026-09-27T03:00:00Z');
const people = Array.from({ length: 30 }, (_, i) => ({
  year: 1960 + ((i * 7) % 45), month: 1 + ((i * 5) % 12), day: 1 + ((i * 11) % 28),
  hour: (i * 3) % 24, minute: 0, gender: (i % 2 ? 'male' : 'female') as 'male' | 'female',
}));

const text = (html: string) => html.replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/g, ' ');
function sentences(t: string) {
  // 카드마다 붙는 UI 제목('실천 4단 · 왜 / 무엇을 / 어떻게')은 문장이 아니라 뺀다.
  return t.split(/\n+|(?<=[.!?。])\s+/).map((s) => s.trim()).filter((s) => s.length >= 15 && /[가-힣]/.test(s) && !s.startsWith('실천 4단'));
}

const sections: Record<string, (p: (typeof people)[number]) => string> = {};
function page(p: (typeof people)[number]) {
  const data = loadSajuDataV2(p as never, null, { now } as never);
  const grounding = buildSajuInterpretationGrounding(p as never, data as never, buildSajuReport(p as never, data as never, 'today'));
  const ctx = grounding.personalizationContext ?? buildSajuPersonalizationContext(data as never);
  const cycles = buildLifetimeReport(p as never, data as never).majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');
  return {
    '사주 이야기': renderToStaticMarkup(<SajuNarrativeCard narrative={buildSajuNarrative(data as never, ctx, {})} />),
    '성향': renderToStaticMarkup(<NatureSection sajuData={data as never} grounding={grounding as never} />),
    '오행': renderToStaticMarkup(<ElementsSection sajuData={data as never} />),
    '명식': renderToStaticMarkup(<MyeongsikSection sajuData={data as never} grounding={grounding as never} />),
    '대운': renderToStaticMarkup(<DaewoonSection cycles={cycles} />),
  };
}
void sections;

const rendered = people.map(page);
const names = Object.keys(rendered[0]);
const rows = ['| 화면 구역 | 문장 수(평균) | 절반 이상에게 같은 문장 | 한 화면 안 반복 |', '|---|---|---|---|'];
const tops: string[] = [];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const name of [...names, '전체']) {
  const readings = rendered.map((r) => sentences(text(name === '전체' ? Object.values(r).join('\n') : r[name as keyof typeof r])));
  const freq = new Map<string, number>();
  for (const r of readings) for (const s of new Set(r)) freq.set(s, (freq.get(s) ?? 0) + 1);
  const common = avg(readings.map((r) => r.filter((s) => (freq.get(s) ?? 0) >= 15).length / Math.max(1, r.length)));
  rows.push(`| ${name} | ${avg(readings.map((r) => r.length)).toFixed(0)} | ${(common * 100).toFixed(0)}% | ${avg(readings.map((r) => r.length - new Set(r).size)).toFixed(1)} |`);
  if (process.argv.includes('--top') && name !== '전체') tops.push(`## ${name}\n` + [...freq].filter(([, n]) => n >= 15).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${n} ${s.slice(0, 110)}`).join('\n'));
}
console.log(rows.join('\n') + (tops.length ? '\n\n' + tops.join('\n\n') : ''));
