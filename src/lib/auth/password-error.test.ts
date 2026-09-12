// 비밀번호 거부 안내가 한국어로 나오는지 + 사용자가 비밀번호를 정하는 세 곳이 모두 이 안내를 쓰는지.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { passwordRejectionMessage } from './password-error';

declare const test: (name: string, fn: () => void) => void;

test('유출·약한 비밀번호와 같은 비밀번호 거부는 한국어 안내, 다른 오류는 null', () => {
  const pwned = passwordRejectionMessage({ code: 'weak_password', message: 'Password is known to be weak and easy to guess, please choose a different one.' });
  assert.ok(pwned?.includes('유출된 적 있거나'));
  assert.ok(!/[a-z]{4,}/i.test(pwned ?? ''), '영어가 섞이면 안 된다');
  // code 가 빠진 응답(구버전 클라이언트)도 문장으로 잡는다.
  assert.equal(passwordRejectionMessage({ message: 'Password is known to be weak and easy to guess' }), pwned);
  assert.ok(passwordRejectionMessage({ code: 'same_password', message: 'New password should be different from the old password.' })?.includes('다른 비밀번호'));
  assert.equal(passwordRejectionMessage({ code: 'session_expired', message: 'Auth session missing!' }), null);
  assert.equal(passwordRejectionMessage(null), null);
});

test('비밀번호를 정하는 곳(가입·재설정 2곳)은 모두 passwordRejectionMessage 로 안내한다', () => {
  const root = path.resolve(__dirname, '../..');
  for (const file of ['app/api/auth/signup/route.ts', 'app/login/page.tsx', 'app/reset-password/page.tsx']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(/createUser\(|updateUser\(/.test(src), `${file}: 비밀번호 설정 호출을 못 찾았다 — 옮겼으면 목록을 고쳐라`);
    assert.ok(src.includes('passwordRejectionMessage('), `${file}: 비밀번호 거부가 영어 원문으로 나간다`);
  }
});
