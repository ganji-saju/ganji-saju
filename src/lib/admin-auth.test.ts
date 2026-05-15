// 2026-05-16 PR #141 — admin auth env fallback 검증.
// (DB 호출은 supabase service client 필요해서 통합 테스트 영역. 여기서는 env 만 검증.)
import assert from 'node:assert/strict';
import { __clearAdminCache, isAdminUser } from './admin-auth';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('isAdminUser - env ADMIN_USER_IDS 에 있으면 true (DB 조회 X)', async () => {
  const prev = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee,11111111-2222-3333-4444-555555555555';
  __clearAdminCache();
  const allowed = await isAdminUser('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(allowed, true);
  const allowed2 = await isAdminUser('11111111-2222-3333-4444-555555555555');
  assert.equal(allowed2, true);
  process.env.ADMIN_USER_IDS = prev;
});

test('isAdminUser - env 비어있고 DB 도 없으면 false', async () => {
  const prev = process.env.ADMIN_USER_IDS;
  delete process.env.ADMIN_USER_IDS;
  __clearAdminCache();
  // DB 조회는 catch 로 false 반환.
  const allowed = await isAdminUser('99999999-aaaa-bbbb-cccc-dddddddddddd');
  assert.equal(allowed, false);
  process.env.ADMIN_USER_IDS = prev;
});

test('isAdminUser - 빈 userId false', async () => {
  const allowed = await isAdminUser('');
  assert.equal(allowed, false);
});

test('isAdminUser - env 공백 무시', async () => {
  const prev = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = ' aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee , , 22222222-3333-4444-5555-666666666666 ';
  __clearAdminCache();
  assert.equal(await isAdminUser('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), true);
  assert.equal(await isAdminUser('22222222-3333-4444-5555-666666666666'), true);
  assert.equal(await isAdminUser('not-in-list'), false);
  process.env.ADMIN_USER_IDS = prev;
});
