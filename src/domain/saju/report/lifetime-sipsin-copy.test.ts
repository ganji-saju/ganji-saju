import assert from 'node:assert/strict';
import * as later from './lifetime-sipsin-later-copy';
import * as youth from './lifetime-sipsin-youth-copy';

declare const test: (name: string, fn: () => void) => void;

test('대운 나이대별 십성 문구는 모두 서로 다르고 한자가 없다', () => {
  const texts = [...Object.values(later), ...Object.values(youth)].flatMap((table) =>
    Object.values(table as Record<string, unknown>).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>)))
  );
  assert.ok(texts.length >= 160);
  assert.equal(texts.filter((t) => /[一-鿿]/.test(t)).length, 0);
  const long = texts.filter((t) => t.length >= 15);
  assert.equal(new Set(long).size, long.length);
});
