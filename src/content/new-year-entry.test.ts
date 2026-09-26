import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GANGI_HOME_CARDS } from './gangi-market';
import { PRODUCT_REPORT_CATALOG } from './report-catalog';
import { MEGA_NAV } from '@/features/shared-navigation/mega-nav-data';

declare const test: (name: string, fn: () => void) => void;

// 2026-09-26 — 2027 신년운세 진입점. 모든 입구가 같은 딥링크(/saju/new?product=new-year → 미리보기)를 쓴다.
const HREF = '/saju/new?product=new-year';

test('홈 카드·메가메뉴·리포트 목록에 신년운세가 있고 같은 딥링크를 쓴다', () => {
  const card = GANGI_HOME_CARDS.find((c) => c.id === 'new-year');
  assert.ok(card, '홈 카드');
  assert.equal(card.href, HREF);
  assert.equal(card.priceKey, 'taste_new_year_2027');
  // 2026-09-26 사용자 지시 — 사주·궁합보다 위, 두 칸 대표 카드.
  assert.equal(GANGI_HOME_CARDS[0].id, 'new-year');
  assert.equal(card.featured, true);
  assert.equal(GANGI_HOME_CARDS.filter((c) => c.featured).length, 1, '대표 카드는 한 장');
  const navItems = MEGA_NAV.flatMap((g) => [...(g.c1?.items ?? []), ...(g.c2?.items ?? [])]);
  assert.ok(navItems.some((i) => i.href === HREF && i.tagPriceKey === 'taste_new_year_2027'), '메가메뉴');
  assert.ok(PRODUCT_REPORT_CATALOG.some((r) => r.href === HREF), '리포트 목록');
});

test('옛 2026 연간 딥링크(yearly-2026)가 src 에 남지 않는다', () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) ? [full] : [];
    });
  const hits = walk(path.join(process.cwd(), 'src')).filter((f) => fs.readFileSync(f, 'utf8').includes('yearly-2026'));
  assert.deepEqual(hits.map((f) => path.relative(process.cwd(), f)), []);
});
