import assert from 'node:assert/strict';
import { resolveBackfillUserName } from './backfill-snapshot-name';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-06-05 #1 후속 — 코인 결제 fix(#398) 이전에 저장된 today_fortune_result_snapshots 의
//   free_result_json.userName 이 null('달빛이' 렌더)인 과거분을 현재 프로필/소셜 이름으로 교정한다.
//   순수 결정 규칙: 이미 실명이 있으면 보존, 없을 때만 새 실명으로 패치(없으면 그대로).

test('backfill: userName=null 이고 실명 해석되면 그 이름으로 교정', () => {
  assert.equal(resolveBackfillUserName(null, '김영민'), '김영민');
});

test('backfill: userName=빈문자열도 교정 대상', () => {
  assert.equal(resolveBackfillUserName('', '이순신'), '이순신');
  assert.equal(resolveBackfillUserName('   ', '이순신'), '이순신');
});

test("backfill: 저장값이 '달빛이' fallback 이면 실명으로 교정", () => {
  assert.equal(resolveBackfillUserName('달빛이', '김영민'), '김영민');
});

test('backfill: 이미 실명이 있으면 덮어쓰지 않음(null 반환=변경없음)', () => {
  assert.equal(resolveBackfillUserName('홍길동', '김영민'), null);
});

test('backfill: 해석된 실명이 없으면 변경없음(달빛이 fallback 유지)', () => {
  assert.equal(resolveBackfillUserName(null, ''), null);
  assert.equal(resolveBackfillUserName(null, null), null);
  assert.equal(resolveBackfillUserName('달빛이', '   '), null);
});

test('backfill: 해석 결과가 기존값과 같으면 변경없음', () => {
  assert.equal(resolveBackfillUserName('김영민', '김영민'), null);
});

test('backfill: 새 이름은 trim 되어 반환', () => {
  assert.equal(resolveBackfillUserName(null, '  김영민  '), '김영민');
});
