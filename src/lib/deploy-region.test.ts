// 2026-09-01 — 함수 실행 리전 회귀 가드.
//
// 왜: "관리자 페이지가 느리다"의 원인은 코드가 아니라 **배치**였다. 실측(2026-09-01):
//   사용자(한국) → Vercel 엣지 icn1(서울) → **함수 iad1(미국 버지니아)** → **DB
//   ap-southeast-1(싱가포르)**. 함수↔DB 가 매 쿼리 태평양을 왕복해 **1회 ~230ms**,
//   /admin 은 왕복이 20회 남짓이라 **4.5초가 순수 네트워크 대기**였다.
//   함수를 DB 옆(sin1)으로 옮기면 왕복이 ~2~5ms 로 떨어진다.
//
//   ⚠️ 이 값을 지우거나 바꾸면 그 4.5초가 조용히 돌아온다(테스트는 초록인 채로).
//   DB 리전을 옮기는 날에만 같이 바꾼다 — 근거: supabase/.temp/pooler-url 의
//   aws-1-**ap-southeast-1**.pooler.supabase.com.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

declare const test: (name: string, fn: () => void) => void;

test('배포 리전: 함수는 DB(ap-southeast-1) 와 같은 곳(sin1)에서 돈다', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { regions?: string[] };
  assert.deepEqual(config.regions, ['sin1'], 'vercel.json 의 regions 가 sin1 이어야 한다');
});

test('배포 리전: DB 리전 근거(pooler 호스트)가 sin1 과 짝이 맞는다', () => {
  let pooler = '';
  try {
    pooler = readFileSync('supabase/.temp/pooler-url', 'utf8');
  } catch {
    return; // 로컬 링크 파일이 없는 CI 는 건너뛴다(위 테스트가 리전 자체는 고정한다).
  }
  assert.ok(
    pooler.includes('ap-southeast-1'),
    `DB 가 ap-southeast-1 이 아니면 함수 리전(sin1)도 다시 판단해야 한다: ${pooler.slice(0, 80)}`
  );
});
