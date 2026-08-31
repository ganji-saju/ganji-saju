import assert from 'node:assert/strict';
import { resolveTodayDisplayName } from './resolve-display-name';

declare const test: (name: string, fn: () => void) => void;

// 🔴 2026-08-31 — 이 순서를 되돌리면 "가족 오늘운세인데 내 이름이 뜬다"가 재발한다.
//   폼이 보낸 이름은 '이 사주의 대상자'를 지목한 값이라 계정 표시명보다 앞선다.
test('resolveTodayDisplayName: 폼이 보낸 이름(가족 칩 등)이 최우선', () => {
  assert.equal(
    resolveTodayDisplayName({
      profileDisplayName: '김영민',
      authMetadata: { name: '소셜이름' },
      clientName: '어머니',
    }),
    '어머니'
  );
});

test('resolveTodayDisplayName: 폼 이름이 없으면 profile.display_name 으로 폴백', () => {
  assert.equal(
    resolveTodayDisplayName({
      profileDisplayName: '김영민',
      authMetadata: { name: '소셜이름' },
      clientName: '   ',
    }),
    '김영민'
  );
  // 2026-06-05 회귀(달빛이) 가드 — 폼에 이름 필드가 없던 경로도 프로필로 폴백해야 한다.
  assert.equal(resolveTodayDisplayName({ profileDisplayName: '김영민' }), '김영민');
});

test('resolveTodayDisplayName: display_name 비면 소셜 로그인 메타데이터(name→full_name→nickname)', () => {
  assert.equal(
    resolveTodayDisplayName({ profileDisplayName: '   ', authMetadata: { name: '홍길동' } }),
    '홍길동'
  );
  assert.equal(
    resolveTodayDisplayName({ profileDisplayName: null, authMetadata: { full_name: '이순신' } }),
    '이순신'
  );
  assert.equal(resolveTodayDisplayName({ authMetadata: { nickname: '달님' } }), '달님');
});

test('resolveTodayDisplayName: 비로그인은 폼 이름만으로도 호명된다', () => {
  assert.equal(resolveTodayDisplayName({ clientName: '비로그인닉' }), '비로그인닉');
  // 문자열 아닌 입력은 무시하고 다음 후보로 — 프로필이 있으면 그쪽으로 폴백.
  assert.equal(resolveTodayDisplayName({ clientName: 123 as unknown }), undefined);
  assert.equal(
    resolveTodayDisplayName({ clientName: 123 as unknown, profileDisplayName: '김영민' }),
    '김영민'
  );
});

test('resolveTodayDisplayName: 모두 비면 undefined (hero 는 달빛이 fallback)', () => {
  assert.equal(
    resolveTodayDisplayName({ profileDisplayName: null, authMetadata: {}, clientName: '   ' }),
    undefined
  );
  assert.equal(resolveTodayDisplayName({}), undefined);
});
