import assert from 'node:assert/strict';
import {
  buildTarotResultSnapshotHref,
  buildTarotResultSnapshotScopeKey,
} from './result-snapshots';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-06-05 — 타로 결과 보관함 저장. 결과는 (question, cardId, orientation)으로 완전 결정되므로
//   scope_key 는 날짜 무관 identity(같은 입력 재방문 = 멱등 upsert), href 는 결과 재현 링크.

test('scopeKey: tarot: 접두 + 같은 입력은 같은 키(멱등, 날짜 무관)', () => {
  const a = buildTarotResultSnapshotScopeKey({
    question: '오늘 어때?',
    cardId: 'the-sun',
    orientation: 'upright',
  });
  const b = buildTarotResultSnapshotScopeKey({
    question: '오늘 어때?',
    cardId: 'the-sun',
    orientation: 'upright',
  });
  assert.ok(a.startsWith('tarot:'));
  assert.equal(a, b);
});

test('scopeKey: 질문/카드/방향이 다르면 키도 다름', () => {
  const base = buildTarotResultSnapshotScopeKey({ question: 'Q', cardId: 'c1', orientation: 'upright' });
  assert.notEqual(
    base,
    buildTarotResultSnapshotScopeKey({ question: 'Q2', cardId: 'c1', orientation: 'upright' })
  );
  assert.notEqual(
    base,
    buildTarotResultSnapshotScopeKey({ question: 'Q', cardId: 'c2', orientation: 'upright' })
  );
  assert.notEqual(
    base,
    buildTarotResultSnapshotScopeKey({ question: 'Q', cardId: 'c1', orientation: 'reversed' })
  );
});

test('scopeKey: 질문 앞뒤 공백은 무시(trim)', () => {
  assert.equal(
    buildTarotResultSnapshotScopeKey({ question: '  Q  ', cardId: 'c', orientation: 'upright' }),
    buildTarotResultSnapshotScopeKey({ question: 'Q', cardId: 'c', orientation: 'upright' })
  );
});

test('href: 저장된 파라미터로 결과를 재현하는 /tarot/daily/result 링크', () => {
  const href = buildTarotResultSnapshotHref({
    question: '오늘 운세',
    cardId: 'the-sun',
    orientation: 'upright',
  });
  assert.ok(href.startsWith('/tarot/daily/result?'));
  const params = new URLSearchParams(href.split('?')[1]);
  assert.equal(params.get('question'), '오늘 운세');
  assert.equal(params.get('cardId'), 'the-sun');
  assert.equal(params.get('orientation'), 'upright');
});
