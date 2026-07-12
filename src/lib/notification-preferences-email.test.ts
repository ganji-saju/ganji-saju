import assert from 'node:assert/strict';
import test from 'node:test';
import { getKstDayStartIso } from './notification-preferences';

test('email duplicate window starts at midnight in Korea, not UTC', () => {
  assert.equal(
    getKstDayStartIso(new Date('2026-07-12T16:00:00.000Z')),
    '2026-07-12T15:00:00.000Z'
  );
});
