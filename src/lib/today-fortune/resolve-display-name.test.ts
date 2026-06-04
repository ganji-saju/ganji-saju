import assert from 'node:assert/strict';
import { resolveTodayDisplayName } from './resolve-display-name';

declare const test: (name: string, fn: () => void) => void;

test('resolveTodayDisplayName: profile.display_name 이 최우선', () => {
  assert.equal(
    resolveTodayDisplayName({
      profileDisplayName: '김영민',
      authMetadata: { name: '소셜이름' },
      clientName: '클라이언트',
    }),
    '김영민'
  );
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

test('resolveTodayDisplayName: 클라이언트 입력은 최후순위(비로그인 닉네임 대비)', () => {
  assert.equal(resolveTodayDisplayName({ clientName: '비로그인닉' }), '비로그인닉');
  // 문자열 아닌 입력은 무시.
  assert.equal(resolveTodayDisplayName({ clientName: 123 as unknown }), undefined);
});

test('resolveTodayDisplayName: 모두 비면 undefined (hero 는 달빛이 fallback)', () => {
  assert.equal(
    resolveTodayDisplayName({ profileDisplayName: null, authMetadata: {}, clientName: '   ' }),
    undefined
  );
  assert.equal(resolveTodayDisplayName({}), undefined);
});
