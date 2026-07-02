import assert from 'node:assert/strict';
import { mapVendorStatus } from './webhook-status';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('mapVendorStatus — 실패가 substituted/sent 보다 먼저(실패-SMS 오분류 방지)', () => {
  assert.equal(mapVendorStatus('SMS_FAIL'), 'failed');
  assert.equal(mapVendorStatus('SEND_FAIL_COMPLETE'), 'failed');
  assert.equal(mapVendorStatus('REJECT'), 'failed');
});

test('mapVendorStatus — 대체발송', () => {
  assert.equal(mapVendorStatus('REPLACED_BY_SMS'), 'substituted');
  assert.equal(mapVendorStatus('SUBSTITUTED'), 'substituted');
});

test('mapVendorStatus — 성공', () => {
  assert.equal(mapVendorStatus('COMPLETE'), 'sent');
  assert.equal(mapVendorStatus('DELIVERED'), 'sent');
  assert.equal(mapVendorStatus('SENT'), 'sent');
});

test('mapVendorStatus — 미상/빈값은 null(업데이트 안 함)', () => {
  assert.equal(mapVendorStatus(''), null);
  assert.equal(mapVendorStatus(null), null);
  assert.equal(mapVendorStatus(undefined), null);
  assert.equal(mapVendorStatus('PENDING'), null);
});
