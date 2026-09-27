import assert from 'node:assert/strict';
import { DAILY_TOPIC_SCENES } from './daily-topic-scenes';

declare const test: (name: string, fn: () => void) => void;

test('관계×분야 장면 문장은 모두 서로 다르고 한자가 없다', () => {
  const all = Object.values(DAILY_TOPIC_SCENES).flatMap((byTopic) => Object.values(byTopic).flatMap((s) => [s.example, s.choice]));
  assert.equal(all.length, 120);
  assert.equal(new Set(all).size, all.length);
  assert.equal(all.filter((s) => /[一-鿿]/.test(s)).length, 0);
});
