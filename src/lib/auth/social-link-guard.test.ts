// 선점 가입 탈취 차단 가드. 이 파일이 지키는 것: 소셜이 붙은 비밀번호 계정의 비밀번호는 1회 무력화되고,
// 공격자 세션은 끊기며, 판정을 못 하면 로그인이 끝나지 않는다(실패-닫힘).
import assert from 'node:assert/strict';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  SOCIAL_LINK_GUARD_FLAG,
  enforceSocialLinkGuard,
  guardSocialSignIn,
  needsPasswordInvalidation,
} from './social-link-guard';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const ids = (...providers: string[]) => providers.map((provider, i) => ({ provider, id: `${provider}-${i}` }));
const user = (providers: string[], appMeta: Record<string, unknown> = {}) =>
  ({ id: 'victim', identities: ids(...providers), app_metadata: appMeta }) as unknown as User;

function fakeAdmin(opts: { updateError?: boolean; getUser?: User | null; signOutError?: boolean } = {}) {
  const calls = { updates: [] as Record<string, unknown>[], signOuts: [] as string[] };
  const client = {
    auth: {
      admin: {
        getUserById: async () => (opts.getUser ? { data: { user: opts.getUser }, error: null } : { data: { user: null }, error: { message: 'x' } }),
        updateUserById: async (_id: string, attrs: Record<string, unknown>) => {
          calls.updates.push(attrs);
          return opts.updateError ? { data: null, error: { message: 'x' } } : { data: {}, error: null };
        },
        signOut: async (token: string, scope: string) => {
          calls.signOuts.push(`${token}:${scope}`);
          return { error: opts.signOutError ? { message: 'x' } : null };
        },
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function fakeSsr(result: { user: User | null; session: { access_token: string } | null; error?: boolean }) {
  let calls = 0;
  const client = {
    auth: {
      signInWithIdToken: async () => {
        calls += 1;
        return result.error ? { data: { user: null, session: null }, error: { message: 'nonce' } } : { data: result, error: null };
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls: () => calls };
}

test('needsPasswordInvalidation — 비밀번호(email)+소셜이 한 계정에 있고 아직 안 했을 때만', () => {
  assert.equal(needsPasswordInvalidation(user(['email', 'google'])), true);
  assert.equal(needsPasswordInvalidation(user(['email', 'kakao'])), true);
  assert.equal(needsPasswordInvalidation(user(['google'])), false, '소셜 전용 신규 가입은 대상 아님');
  assert.equal(needsPasswordInvalidation(user(['email'])), false, '이메일 전용 계정은 대상 아님');
  assert.equal(needsPasswordInvalidation(user(['email', 'google'], { [SOCIAL_LINK_GUARD_FLAG]: 'x' })), false, '1회만');
  // user_metadata 가 아니라 identities 로만 판정한다(user_metadata 는 사용자가 덮어쓴다).
  assert.equal(needsPasswordInvalidation({ identities: ids('email'), app_metadata: {}, user_metadata: { provider: 'google' } } as unknown as User), false);
});

test('enforceSocialLinkGuard — 무력화: 비밀번호를 무작위로 바꾸고 표식을 남긴다(기존 app_metadata 보존)', async () => {
  const { client, calls } = fakeAdmin();
  const result = await enforceSocialLinkGuard(client, user(['email', 'google'], { provider: 'email', providers: ['email', 'google'] }));
  assert.equal(result, 'invalidated');
  const update = calls.updates[0] as { password: string; app_metadata: Record<string, unknown> };
  assert.ok(update.password.length >= 40, '추측 불가한 비밀번호');
  assert.ok(update.app_metadata[SOCIAL_LINK_GUARD_FLAG]);
  assert.deepEqual(update.app_metadata.providers, ['email', 'google'], 'providers 를 지우지 않는다');
});

test('enforceSocialLinkGuard — 판정 불가·쓰기 실패는 error(호출부가 로그인을 막는다)', async () => {
  const noIdentities = { id: 'victim', app_metadata: {} } as unknown as User;
  assert.equal(await enforceSocialLinkGuard(fakeAdmin({ getUser: null }).client, noIdentities), 'error');
  assert.equal(await enforceSocialLinkGuard(fakeAdmin({ updateError: true }).client, user(['email', 'google'])), 'error');
  // identities 가 빠진 응답은 관리자 API 로 다시 읽어 판정한다.
  assert.equal(await enforceSocialLinkGuard(fakeAdmin({ getUser: user(['google']) }).client, noIdentities), 'ok');
});

test('guardSocialSignIn — 무력화 뒤 같은 id_token 으로 새 세션을 받고, 그 세션만 남기고 나머지를 끊는다', async () => {
  const admin = fakeAdmin();
  const fresh = user(['email', 'google'], { [SOCIAL_LINK_GUARD_FLAG]: 'now' });
  const ssr = fakeSsr({ user: fresh, session: { access_token: 'NEW' } });
  const result = await guardSocialSignIn(ssr.client, admin.client, { user: user(['email', 'google']) }, { provider: 'google', token: 't', nonce: 'n' });
  assert.equal(result.ok, true);
  assert.equal(ssr.calls(), 1, '재로그인 1회');
  assert.deepEqual(admin.calls.signOuts, ['NEW:others'], '공격자 세션(나머지 전부)을 끊는다');
});

test('guardSocialSignIn — 정상 소셜 로그인은 추가 호출 없이 통과, 실패는 전부 로그인 중단', async () => {
  const pass = fakeAdmin();
  const ssr = fakeSsr({ user: null, session: null });
  assert.equal((await guardSocialSignIn(ssr.client, pass.client, { user: user(['google']) }, { provider: 'google', token: 't' })).ok, true);
  assert.equal(ssr.calls() + pass.calls.updates.length + pass.calls.signOuts.length, 0);

  const relogFail = fakeSsr({ user: null, session: null, error: true });
  const r1 = await guardSocialSignIn(relogFail.client, fakeAdmin().client, { user: user(['email', 'kakao']) }, { provider: 'kakao', token: 't' });
  assert.deepEqual(r1, { ok: false, reason: 'relogin_required' });

  const revokeFail = fakeAdmin({ signOutError: true });
  const r2 = await guardSocialSignIn(fakeSsr({ user: user(['email', 'google']), session: { access_token: 'NEW' } }).client, revokeFail.client, { user: user(['email', 'google']) }, { provider: 'google', token: 't' });
  assert.deepEqual(r2, { ok: false, reason: 'link_guard' }, '공격자 세션을 못 끊으면 통과시키지 않는다');

  assert.deepEqual(await guardSocialSignIn(ssr.client, pass.client, { user: null }, { provider: 'google', token: 't' }), { ok: false, reason: 'no_user' });
});

test('guardSocialSignIn — 무력화에 실패하면 재로그인하지 않고 로그인을 중단한다(실패-닫힘)', async () => {
  const ssr = fakeSsr({ user: user(['email', 'google']), session: { access_token: 'NEW' } });
  const result = await guardSocialSignIn(ssr.client, fakeAdmin({ updateError: true }).client, { user: user(['email', 'google']) }, { provider: 'google', token: 't' });
  assert.deepEqual(result, { ok: false, reason: 'link_guard' });
  assert.equal(ssr.calls(), 0);
});
