// 선점 가입 탈취 차단 가드. 이 파일이 지키는 것: 소셜이 붙은 비밀번호 계정의 비밀번호는 1회 무력화되고,
// 공격자 세션은 끊기며, 무력화가 실제로 남았는지 확인하고, 판정을 못 하면 로그인이 끝나지 않는다(실패-닫힘).
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
  ({ id: 'victim', email: 'v@x.com', identities: ids(...providers), app_metadata: appMeta }) as unknown as User;

/** 관리자 API. `current` = DB 에 실제로 있는 계정(getUserById 가 돌려주는 것). */
function fakeAdmin(current: User | null, opts: { updateError?: boolean; signOutError?: boolean } = {}) {
  const calls = { updates: [] as Record<string, unknown>[], signOuts: [] as string[] };
  const client = {
    auth: {
      admin: {
        getUserById: async () => (current ? { data: { user: current }, error: null } : { data: { user: null }, error: { message: 'x' } }),
        updateUserById: async (_id: string, attrs: Record<string, unknown>) => {
          calls.updates.push(attrs);
          return opts.updateError ? { data: null, error: { message: 'x' } } : { data: {}, error: null };
        },
        signOut: async (token: string, scope: string) => {
          calls.signOuts.push(`${token}:${scope}`);
          return { error: opts.signOutError && scope === 'others' ? { message: 'x' } : null };
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

/** 확인용 로그인. `acceptPassword` 가 아니면 invalid credentials(= 경합으로 다른 비밀번호가 써짐). */
function fakeProbe(accept: 'any' | 'none') {
  const tried: { email: string; password: string }[] = [];
  const client = {
    auth: {
      signInWithPassword: async (creds: { email: string; password: string }) => {
        tried.push(creds);
        return accept === 'any'
          ? { data: { session: { access_token: 'PROBE' } }, error: null }
          : { data: { session: null }, error: { message: 'Invalid login credentials' } };
      },
    },
  } as unknown as SupabaseClient;
  return { client, tried };
}

const linked = () => user(['email', 'google']);
const freshSession = () => fakeSsr({ user: user(['email', 'google']), session: { access_token: 'NEW' } });
const creds = { provider: 'google' as const, token: 't', nonce: 'n' };

test('needsPasswordInvalidation — 비밀번호(email)+소셜이 한 계정에 있고 아직 안 했을 때만', () => {
  assert.equal(needsPasswordInvalidation(user(['email', 'google'])), true);
  assert.equal(needsPasswordInvalidation(user(['email', 'kakao'])), true);
  assert.equal(needsPasswordInvalidation(user(['google'])), false, '소셜 전용 신규 가입은 대상 아님');
  assert.equal(needsPasswordInvalidation(user(['email'])), false, '이메일 전용 계정은 대상 아님');
  assert.equal(needsPasswordInvalidation(user(['email', 'google'], { [SOCIAL_LINK_GUARD_FLAG]: 'x' })), false, '1회만');
  // user_metadata 가 아니라 identities 로만 판정한다(user_metadata 는 사용자가 덮어쓴다).
  assert.equal(needsPasswordInvalidation({ identities: ids('email'), app_metadata: {}, user_metadata: { provider: 'google' } } as unknown as User), false);
});

// 🔴 2026-09-11 리뷰 Critical — GoTrue 는 자동 연결 때 연결 **전** 계정을 응답한다(identities 에 방금 붙은 소셜 없음).
//   응답만 믿으면 탈취가 일어나는 바로 그 로그인에서 가드가 'ok' 였다. 옛 가짜는 연결 후 모양을 넣어 이걸 못 잡았다.
test('enforceSocialLinkGuard — 연결 직후 응답(identities=[email])이어도 DB 의 실제 계정으로 판정해 무력화한다', async () => {
  const goTrueLinkResponse = { id: 'victim', identities: ids('email'), app_metadata: { providers: ['email', 'google'] } } as unknown as User;
  const { client } = fakeAdmin(linked());
  const result = await enforceSocialLinkGuard(client, goTrueLinkResponse);
  assert.equal(result.status, 'invalidated');
});

test('enforceSocialLinkGuard — 응답이 아니라 다시 읽은 계정을 돌려준다(카카오 해시가 최신 identities 를 봐야 한다)', async () => {
  const { client } = fakeAdmin(user(['kakao']));
  const result = await enforceSocialLinkGuard(client, user(['email', 'kakao']));
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.status === 'ok' && result.user.identities?.map((i) => i.provider), ['kakao']);
});

test('enforceSocialLinkGuard — 무력화: 추측 불가 비밀번호 + app_metadata 엔 표식만(GoTrue 가 병합한다)', async () => {
  const { client, calls } = fakeAdmin(user(['email', 'google'], { provider: 'email', providers: ['email', 'google'] }));
  const result = await enforceSocialLinkGuard(client, { id: 'victim' });
  assert.equal(result.status, 'invalidated');
  const update = calls.updates[0] as { password: string; app_metadata: Record<string, unknown> };
  assert.ok(update.password.length >= 40, '추측 불가한 비밀번호');
  assert.equal(result.status === 'invalidated' && result.password, update.password, '확인용으로 같은 값을 돌려준다');
  assert.deepEqual(Object.keys(update.app_metadata), [SOCIAL_LINK_GUARD_FLAG], '낡은 사본을 통째로 쓰지 않는다');
});

test('enforceSocialLinkGuard — 판정 불가·쓰기 실패는 error(호출부가 로그인을 막는다)', async () => {
  assert.equal((await enforceSocialLinkGuard(fakeAdmin(null).client, { id: 'victim' })).status, 'error');
  const noIdentities = { id: 'victim', app_metadata: {} } as unknown as User;
  assert.equal((await enforceSocialLinkGuard(fakeAdmin(noIdentities).client, { id: 'victim' })).status, 'error');
  assert.equal((await enforceSocialLinkGuard(fakeAdmin(linked(), { updateError: true }).client, { id: 'victim' })).status, 'error');
});

test('guardSocialSignIn — 무력화 → 같은 id_token 재로그인 → 나머지 세션 끊기 → 우리 비밀번호로 확인 → 확인 세션도 지움', async () => {
  const admin = fakeAdmin(linked());
  const ssr = freshSession();
  const probe = fakeProbe('any');
  const result = await guardSocialSignIn(ssr.client, admin.client, probe.client, { user: user(['email']) }, creds);
  assert.equal(result.ok, true);
  assert.equal(ssr.calls(), 1, '재로그인 1회');
  assert.deepEqual(admin.calls.signOuts, ['NEW:others', 'PROBE:local'], '공격자 세션을 끊고, 확인용 세션도 남기지 않는다');
  const { password } = admin.calls.updates[0] as { password: string };
  assert.deepEqual(probe.tried, [{ email: 'v@x.com', password }], '방금 넣은 비밀번호로 확인');
  assert.equal(admin.calls.updates.length, 1, '성공하면 표식을 지우지 않는다');
});

test('guardSocialSignIn — 🔴 경합으로 다른 비밀번호가 써졌으면(확인 실패) 표식을 지우고 로그인을 막는다', async () => {
  const admin = fakeAdmin(linked());
  const result = await guardSocialSignIn(freshSession().client, admin.client, fakeProbe('none').client, { user: linked() }, creds);
  assert.deepEqual(result, { ok: false, reason: 'link_guard' });
  assert.deepEqual(admin.calls.updates[1], { app_metadata: { [SOCIAL_LINK_GUARD_FLAG]: null } }, '다음 로그인에 가드 전체가 다시 돈다');
});

test('guardSocialSignIn — 재로그인만 실패하면 표식을 남긴다(id_token 재사용 거부 GoTrue 에서 무한 실패 방지)', async () => {
  const admin = fakeAdmin(linked());
  const relogFail = fakeSsr({ user: null, session: null, error: true });
  const probe = fakeProbe('any');
  const result = await guardSocialSignIn(relogFail.client, admin.client, probe.client, { user: linked() }, creds);
  assert.deepEqual(result, { ok: false, reason: 'relogin_required' });
  assert.equal(probe.tried.length, 1, '재로그인이 실패해도 무력화는 확인한다');
  assert.equal(admin.calls.updates.length, 1, '표식을 지우지 않는다 — 다시 로그인하면 바로 통과');
});

test('guardSocialSignIn — 정상 소셜 로그인은 추가 호출 없이 통과, 나머지 실패는 전부 로그인 중단', async () => {
  const pass = fakeAdmin(user(['google']));
  const ssr = fakeSsr({ user: null, session: null });
  const probe = fakeProbe('any');
  assert.equal((await guardSocialSignIn(ssr.client, pass.client, probe.client, { user: user(['google']) }, creds)).ok, true);
  assert.equal(ssr.calls() + pass.calls.updates.length + pass.calls.signOuts.length + probe.tried.length, 0);

  const revokeFail = fakeAdmin(linked(), { signOutError: true });
  const r2 = await guardSocialSignIn(freshSession().client, revokeFail.client, fakeProbe('any').client, { user: linked() }, creds);
  assert.deepEqual(r2, { ok: false, reason: 'link_guard' }, '공격자 세션을 못 끊으면 통과시키지 않는다');

  assert.deepEqual(await guardSocialSignIn(ssr.client, pass.client, probe.client, { user: null }, creds), { ok: false, reason: 'no_user' });
});

test('guardSocialSignIn — 무력화에 실패하면 재로그인·확인 없이 로그인을 중단한다(실패-닫힘)', async () => {
  const ssr = freshSession();
  const probe = fakeProbe('any');
  const result = await guardSocialSignIn(ssr.client, fakeAdmin(linked(), { updateError: true }).client, probe.client, { user: linked() }, creds);
  assert.deepEqual(result, { ok: false, reason: 'link_guard' });
  assert.equal(ssr.calls() + probe.tried.length, 0);
});
