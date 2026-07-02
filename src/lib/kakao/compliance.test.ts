import assert from 'node:assert/strict';
import { isKakaoAdNightTime, formatFriendtalkAd } from './compliance';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// KST = UTC+9. 아래 UTC 시각들의 KST 시(hour)로 판정.
test('isKakaoAdNightTime — KST 22시(=UTC 13시)는 야간', () => {
  assert.equal(isKakaoAdNightTime(new Date('2026-07-02T13:00:00Z')), true);
});

test('isKakaoAdNightTime — KST 07시(=UTC 22시 전일)는 야간', () => {
  assert.equal(isKakaoAdNightTime(new Date('2026-07-01T22:00:00Z')), true);
});

test('isKakaoAdNightTime — KST 08시(=UTC 23시 전일)는 발송 가능', () => {
  assert.equal(isKakaoAdNightTime(new Date('2026-07-01T23:00:00Z')), false);
});

test('isKakaoAdNightTime — KST 14시(=UTC 05시)는 발송 가능', () => {
  assert.equal(isKakaoAdNightTime(new Date('2026-07-02T05:00:00Z')), false);
});

test('isKakaoAdNightTime — KST 20시59분(=UTC 11시59분)는 발송 가능, 21시는 야간', () => {
  assert.equal(isKakaoAdNightTime(new Date('2026-07-02T11:59:00Z')), false);
  assert.equal(isKakaoAdNightTime(new Date('2026-07-02T12:00:00Z')), true); // KST 21:00
});

test('formatFriendtalkAd — (광고) 표기 + 무료수신거부 부착', () => {
  const out = formatFriendtalkAd('오늘의 운세가 도착했어요');
  assert.ok(out.startsWith('(광고) 오늘의 운세가 도착했어요'));
  assert.ok(out.includes('무료수신거부'));
});

test('formatFriendtalkAd — 이미 (광고)면 중복 안 붙임', () => {
  const out = formatFriendtalkAd('(광고) 이벤트 안내');
  assert.equal(out.indexOf('(광고)'), out.lastIndexOf('(광고)'));
});
