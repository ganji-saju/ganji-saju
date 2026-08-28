// 🔴 2026-08-29 — staging 접근 차단(Basic 인증) 계약 가드.
//
//   Vercel Deployment Protection 이 Pro 전용($150/월)이라 미들웨어로 대신한다.
//   여기서 지켜야 할 것은 딱 셋이고, 셋 다 틀리면 사고 방향이 정반대다:
//     ① 프로덕션은 **절대** 잠그지 않는다 (잠그면 전 사용자가 401)
//     ② env 미설정이면 잠그지 않는다 (빈 비밀번호로 잠그면 아무도 못 들어간다)
//     ③ /api 는 통과 (PG 웹훅·크론은 브라우저 프롬프트를 이해하지 못한다)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const source = fs.readFileSync(path.join(process.cwd(), 'src/proxy.ts'), 'utf8');

test('staging 게이트: 대상 호스트가 staging 하나뿐이다', () => {
  const block = source.slice(source.indexOf('const STAGING_HOSTS'));
  const hosts = block.slice(0, block.indexOf(']')).match(/'([^']+)'/g) ?? [];
  assert.deepEqual(hosts, ["'staging.ganjisaju.kr'"], '프로덕션 호스트가 섞이면 전 사용자가 401 이 된다');
});

test('staging 게이트: env 미설정·api 는 통과한다', () => {
  const fn = source.slice(source.indexOf('function stagingGateResponse'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /if \(!password\) return null/, 'env 미설정 시 잠그면 아무도 못 들어간다');
  assert.match(body, /startsWith\('\/api\/'\) *\) *return null/, '/api 를 막으면 웹훅·크론이 죽는다');
});

test('staging 게이트: 잠금·canonical 보다 먼저 판정한다', () => {
  const proxy = source.slice(source.indexOf('export async function proxy'));
  const gateAt = proxy.indexOf('stagingGateResponse(req)');
  const lockAt = proxy.indexOf('isLockedPath(pathname)');
  assert.ok(gateAt > 0 && lockAt > 0);
  assert.ok(gateAt < lockAt, '게이트가 뒤에 있으면 비인증 요청이 내부 경로를 밟는다');
});
