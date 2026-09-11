// 🔴 2026-09-11 — 무인증 강제 확인 라우트(/api/auth/confirm-email) 재도입 금지.
//   이메일 주소만으로 아무 계정이나 '확인됨'으로 바꿔 GoTrue 의 미확인 계정 선점 방어를 끄고(선점 가입 탈취),
//   가입 여부 오라클·listUsers 증폭까지 됐다. 확인은 메일함 소유를 증명하는 흐름(비밀번호 찾기 링크)으로만.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const SRC = path.resolve(__dirname, '../..');

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('어떤 코드도 기존 계정을 updateUserById 로 email_confirm 처리하지 않는다', () => {
  assert.ok(!fs.existsSync(path.join(SRC, 'app/api/auth/confirm-email')), 'confirm-email 라우트가 되살아났다');
  const hits = files(SRC).filter((f) => /updateUserById\([^)]*[\s\S]{0,200}email_confirm\s*:\s*true/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(hits.map((f) => path.relative(SRC, f)), []);
});

// 🔴 선점 가입 탈취 차단의 호출 순서. 가드보다 먼저 사주를 귀속하면 탈취 계정에 방금 본 사주가 넘어간다.
test('소셜 콜백은 사주 귀속 전에 연결 가드를 돌리고, 카카오는 로그인 전에 이메일 인증을 확인한다', () => {
  for (const provider of ['google', 'kakao']) {
    const src = fs.readFileSync(path.join(SRC, `app/api/auth/${provider}/callback/route.ts`), 'utf8');
    const guardAt = src.indexOf('guardSocialSignIn(');
    const claimAt = src.indexOf('claimAnonymousReadings(req');
    assert.ok(guardAt > 0 && claimAt > guardAt, `${provider}: 가드가 사주 귀속보다 앞서야 한다`);
    assert.ok(!/user_metadata\)/.test(src.slice(guardAt)) || provider === 'google', `${provider}: 가드 뒤에 user_metadata 기반 해시 금지`);
  }
  const kakao = fs.readFileSync(path.join(SRC, 'app/api/auth/kakao/callback/route.ts'), 'utf8');
  assert.ok(kakao.indexOf('await kakaoEmailClaimIsSafe(idToken') > 0 && kakao.indexOf('await kakaoEmailClaimIsSafe(idToken') < kakao.indexOf('await supabase.auth.signInWithIdToken'), '미인증 이메일로 연결되기 전에 막아야 한다');
  assert.ok(!kakao.includes('kakaoUidHashFromUserMetadata'), '위조 가능한 user_metadata 해시 금지');
});
