import assert from 'node:assert/strict';
import { COMPREHENSIVE_FREE_ITEMS, COMPREHENSIVE_LOCKED_ITEMS } from './comprehensive-toc-items';
import { getPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-08-24 Phase 1 — 17항목 목차의 정직성 가드.
// 2026-09-26 — 올해 핵심(year-core)을 구성에서 뺐다(2027 신년운세와 중복, 사용자 결정) → 16항목.
//   배너·PPT 카피가 "17가지 항목 분석"을 약속하므로 목차 개수는 카피와 계약이다.
//   항목을 넣고 뺄 때는 카피(홈 trust-creds 배너·checkout BUNDLE_GUIDE)와 함께 움직일 것.

test('목차는 정확히 16항목(무료 4 + 잠김 12)', () => {
  assert.equal(COMPREHENSIVE_FREE_ITEMS.length, 4, '무료 항목은 4개(overview/nature/elements/deep)');
  assert.equal(COMPREHENSIVE_LOCKED_ITEMS.length, 12, '잠긴 항목은 12개');
  assert.equal(COMPREHENSIVE_FREE_ITEMS.length + COMPREHENSIVE_LOCKED_ITEMS.length, 16);
});

test('항목 제목은 중복이 없다', () => {
  const titles = [...COMPREHENSIVE_FREE_ITEMS, ...COMPREHENSIVE_LOCKED_ITEMS].map(
    (item) => item.title
  );
  assert.equal(new Set(titles).size, titles.length);
});

test('잠긴 항목이 파는 것은 전부 번들 구성품이 실제로 연다', () => {
  // 잠김 12 = score-total 6 + today-detail 4 + money-pattern/work-flow 각 1.
  // 번들 구성이 바뀌면 이 배분도 같이 바뀌어야 한다(없는 콘텐츠 약속 금지).
  const pkg = getPackage('bundle_comprehensive');
  assert.ok(pkg?.kind === 'bundle' && pkg.components, 'bundle_comprehensive 는 bundle');
  const ids = new Set(pkg.components.map((component) => component.tasteProductId));
  for (const required of ['score-total', 'today-detail', 'money-pattern', 'work-flow']) {
    assert.ok(ids.has(required as never), `번들 구성품에 ${required} 가 빠졌다 — 목차가 거짓이 된다`);
  }
  assert.ok(!ids.has('year-core'), '판매 중단한 올해 핵심을 묶음으로 새로 발급하지 않는다');
  assert.ok(!COMPREHENSIVE_LOCKED_ITEMS.some((i) => i.title.includes('올해')), '목차에서도 뺀다');
});

test('사용자에게 보이는 "17항목·17가지" 문구가 남지 않는다(목차 수와 카피는 계약)', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  for (const file of [
    'src/content/gangi-market.ts',
    'src/components/saju/comprehensive-toc.tsx',
    'src/components/saju-score/score-lock-gate.tsx',
    'src/components/trust/why-gangi-story.tsx',
    'src/app/membership/checkout/page.tsx',
  ]) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/17\s*(항목|가지)/.test(code), file);
  }
});
