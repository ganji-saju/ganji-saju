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
    // 호출만 하고 결과를 버리면 가드가 없는 것과 같다.
    assert.ok(src.includes('if (!guarded.ok) return fail(guarded.reason);'), `${provider}: 가드 실패를 로그인 실패로 강제해야 한다`);
  }
  const kakao = fs.readFileSync(path.join(SRC, 'app/api/auth/kakao/callback/route.ts'), 'utf8');
  const verdictAt = kakao.indexOf('kakaoEmailClaimVerdict(idToken');
  assert.ok(verdictAt > 0 && verdictAt < kakao.indexOf('await supabase.auth.signInWithIdToken'), '미인증 이메일로 연결되기 전에 막아야 한다');
  assert.ok(kakao.includes("if (emailVerdict !== 'ok')"), '판정 결과를 로그인 차단에 써야 한다');
});

// 사용자가 updateUser({data}) 로 덮어쓰는 user_metadata 로 카카오 해시를 만들면 076 원장을 우회한다(탈퇴 라우트 포함 전역).
test('카카오 대조 해시는 어디서도 user_metadata 로 만들지 않는다', () => {
  const hits = files(SRC).filter((f) => /kakaoUidHashFromUserMetadata|kakaoUidHash\([^)]*user_metadata/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(hits.map((f) => path.relative(SRC, f)), []);
});
