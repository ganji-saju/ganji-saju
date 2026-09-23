// 2026-09-23 — 보관함 카드는 (user, product, scope_key) 로 dedup 한다. 이용권 scope 에 KST 날짜가 들어가면서(#841)
//   당일권이 구매일마다 카드로 쌓이게 됐다 — 보관함은 그 변경의 목적이 아니고 지난 날 카드는 열리지도 않으므로
//   보관함 키에서는 날짜를 뗀다(사주 1장 유지 = 이전과 같은 화면).
import assert from 'node:assert/strict';
import { snapshotScopeKey } from './paid-reading-snapshots';
import { buildTodayDetailScopeKey } from './product-scope';

declare const test: (name: string, fn: () => void) => void;

const RK = '1975-6-11-14-male-locbusan-solarlongitude-keybbbb2';

test('보관함 키: 당일권은 날짜를 떼 사주 1장으로 — 다른 날 구매도 같은 카드', () => {
  assert.equal(
    snapshotScopeKey('today-detail', buildTodayDetailScopeKey(RK, '2026-09-23')),
    buildTodayDetailScopeKey(RK)
  );
  assert.equal(
    snapshotScopeKey('today-detail', buildTodayDetailScopeKey(RK, '2026-09-24')),
    snapshotScopeKey('today-detail', buildTodayDetailScopeKey(RK, '2026-09-23')),
    '구매일이 달라도 보관함 카드는 하나여야 한다'
  );
  assert.equal(snapshotScopeKey('today-detail', buildTodayDetailScopeKey(RK)), buildTodayDetailScopeKey(RK), '옛 형식 그대로');
});

test('보관함 키: 다른 상품·빈 scope 는 손대지 않는다', () => {
  assert.equal(snapshotScopeKey('monthly-calendar', 'calendar:rk:2026-09'), 'calendar:rk:2026-09');
  assert.equal(snapshotScopeKey('lifetime-report', 'lifetime:rk'), 'lifetime:rk');
  assert.equal(snapshotScopeKey('today-detail', null), null);
  assert.equal(snapshotScopeKey('today-detail', 'global'), 'global', 'today: 접두 아니면 그대로');
});
