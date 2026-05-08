import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchesEntitlementReadingKey,
  normalizeEntitlementReadingKeys,
} from './report-entitlements';

test('normalizeEntitlementReadingKeys keeps canonical first and de-duplicates legacy aliases', () => {
  assert.deepEqual(
    normalizeEntitlementReadingKeys('1982-1-29-8-male-key12wkkzj', [
      'bc9963e5-eb00-4d97-8393-c5930273e7d4',
      '1982-1-29-8-male',
      '  ',
      null,
      undefined,
      'bc9963e5-eb00-4d97-8393-c5930273e7d4',
    ]),
    [
      '1982-1-29-8-male-key12wkkzj',
      '1982-1-29-8-male',
      'bc9963e5-eb00-4d97-8393-c5930273e7d4',
    ]
  );
});

test('matchesEntitlementReadingKey accepts both canonical and legacy aliases', () => {
  const acceptedKeys = normalizeEntitlementReadingKeys('1982-1-29-8-male', [
    'bc9963e5-eb00-4d97-8393-c5930273e7d4',
  ]);

  assert.equal(matchesEntitlementReadingKey('1982-1-29-8-male', acceptedKeys), true);
  assert.equal(
    matchesEntitlementReadingKey('bc9963e5-eb00-4d97-8393-c5930273e7d4', acceptedKeys),
    true
  );
  assert.equal(matchesEntitlementReadingKey('different-reading-key', acceptedKeys), false);
});
