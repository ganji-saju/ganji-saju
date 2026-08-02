// 카카오 GET /v1/api/talk/channels 응답 파싱 — isChannelFriend 순수함수 테스트.
// mockFetch 불필요(JSON 직접 주입). 절대 throw 하지 않아야 한다(방어적 파싱).
import assert from 'node:assert/strict';
import { isChannelFriend } from './channel-friendship';

declare const test: (name: string, fn: () => void) => void;

const TARGET = '_QVQxbX';

test('isChannelFriend — 대상 채널이 added 면 true', () => {
  const json = {
    channels: [
      { channel_public_id: '_other', relation: 'none' },
      { channel_public_id: TARGET, relation: 'added' },
    ],
  };
  assert.equal(isChannelFriend(json, TARGET), true);
});

test('isChannelFriend — 실 API 대문자 relation "ADDED" 도 true(문서≠실응답, 대소문자 무시)', () => {
  // 2026-08-03 프로덕션 실측: 카카오는 relation 을 대문자("ADDED")로 반환.
  const json = {
    channels: [{ channel_public_id: TARGET, channel_uuid: '@간지사주', relation: 'ADDED' }],
  };
  assert.equal(isChannelFriend(json, TARGET), true);
  assert.equal(
    isChannelFriend({ channels: [{ channel_public_id: TARGET, relation: 'NONE' }] }, TARGET),
    false
  );
});

test('isChannelFriend — 대상 채널은 있지만 relation 이 none 이면 false', () => {
  const json = { channels: [{ channel_public_id: TARGET, relation: 'none' }] };
  assert.equal(isChannelFriend(json, TARGET), false);
});

test('isChannelFriend — 다른 채널만 added 여도 false(채널 불일치)', () => {
  const json = { channels: [{ channel_public_id: '_other', relation: 'added' }] };
  assert.equal(isChannelFriend(json, TARGET), false);
});

test('isChannelFriend — malformed/empty 입력은 절대 throw 없이 false', () => {
  assert.equal(isChannelFriend(null, TARGET), false);
  assert.equal(isChannelFriend(undefined, TARGET), false);
  assert.equal(isChannelFriend({}, TARGET), false);
  assert.equal(isChannelFriend({ channels: null }, TARGET), false);
  assert.equal(isChannelFriend({ channels: 'not-an-array' }, TARGET), false);
  assert.equal(isChannelFriend({ channels: [] }, TARGET), false);
  assert.equal(isChannelFriend({ channels: [null, 42, { relation: 'added' }] }, TARGET), false);
  assert.equal(isChannelFriend('not-an-object', TARGET), false);
  assert.equal(isChannelFriend({ channels: [{ channel_public_id: TARGET }] }, TARGET), false);
  assert.equal(isChannelFriend(json_missing_target(), ''), false);
});

function json_missing_target() {
  return { channels: [{ channel_public_id: TARGET, relation: 'added' }] };
}
