// src/lib/admin/masking.test.ts
import assert from 'node:assert/strict';
import { maskEmail, maskBirthDate } from './masking';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('maskEmail: admin 은 local/domain 가림', () => {
  assert.equal(maskEmail('hong@example.com', 'admin'), 'h***@e***.com');
  assert.equal(maskEmail('a@b.co', 'admin'), 'a***@b***.co');
});

test('maskEmail: super_admin 은 원본', () => {
  assert.equal(maskEmail('hong@example.com', 'super_admin'), 'hong@example.com');
});

test('maskEmail: null/빈값 안전', () => {
  assert.equal(maskEmail(null, 'admin'), null);
  assert.equal(maskEmail('', 'admin'), null);
});

test('maskEmail: @ 없는 비정상값은 통째 가림', () => {
  assert.equal(maskEmail('weird', 'admin'), '***');
});

test('maskBirthDate: admin 은 연도만', () => {
  assert.equal(maskBirthDate(1999, 4, 1, 'admin'), '1999-**-**');
  assert.equal(maskBirthDate(null, null, null, 'admin'), null);
});

test('maskBirthDate: super_admin 은 전체', () => {
  assert.equal(maskBirthDate(1999, 4, 1, 'super_admin'), '1999-04-01');
  assert.equal(maskBirthDate(1999, null, null, 'super_admin'), '1999-??-??');
});
