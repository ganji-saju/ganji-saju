import assert from 'node:assert/strict';
import { isValidKakaoChannelId } from './channel';

declare const test: (name: string, fn: () => void) => void;

// 2026-07-20 — 사용자 제보: "카카오 채널 추가하고 소식 받기를 누르면 찾을 수 없는 페이지".
//   원인은 코드가 아니라 **env 값**이었다. NEXT_PUBLIC_KAKAO_CHANNEL_ID 에 공개 ID 대신
//   채널 **이름**('간지사주')이 들어가 `https://pf.kakao.com/간지사주/friend` 로 보냈다.
//   형식을 검증해 틀리면 미설정 취급(버튼 미노출) — 깨진 버튼보다 없는 버튼이 낫다.

test('채널 ID: 공개 ID(_ 로 시작하는 영숫자)만 통과', () => {
  for (const ok of ['_ZeUTn', '_abc123', '_A1']) {
    assert.equal(isValidKakaoChannelId(ok), true, ok);
  }
});

test('채널 ID: 채널 이름을 넣은 실제 오설정을 거른다', () => {
  assert.equal(
    isValidKakaoChannelId('간지사주'),
    false,
    '이 값이 통과하면 사용자가 404 페이지로 간다(2026-07-20 실제 사고)'
  );
});

test('채널 ID: 그 밖의 잘못된 형태도 거른다', () => {
  for (const bad of [
    '',
    '   ',
    null,
    undefined,
    'ZeUTn', // _ 없음
    '_한글',
    '_with-dash',
    '_with space',
    'https://pf.kakao.com/_ZeUTn', // URL 통째로 붙여넣은 경우
    '@간지사주',
  ]) {
    assert.equal(isValidKakaoChannelId(bad), false, JSON.stringify(bad));
  }
});

test('채널 ID: 앞뒤 공백은 허용(복사 붙여넣기 방어)', () => {
  // env 값 끝에 공백·탭이 붙는 복사 사고가 이 저장소에서 이미 있었다(나이스페이 clientKey).
  assert.equal(isValidKakaoChannelId('  _ZeUTn  '), true);
});
