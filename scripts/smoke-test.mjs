#!/usr/bin/env node
/**
 * smoke-test.mjs
 * 개발 서버가 실행 중인 상태에서 핵심 라우트의 HTTP 응답 확인
 *
 * 사용법:
 *   node scripts/smoke-test.mjs                    # localhost:3000
 *   node scripts/smoke-test.mjs http://localhost:3001
 *   node scripts/smoke-test.mjs https://dalbitlife.vercel.app
 *
 * 주의: npm run dev 또는 npm run start 가 실행 중이어야 합니다.
 */

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const TIMEOUT_MS = 10_000;

/**
 * [경로, 허용 상태코드[], 설명]
 *
 * 허용 코드 해석:
 *   200       — 정상 응답
 *   301/308   — next.config redirects (영구)
 *   302/307   — 서버 컴포넌트 redirect() (임시)
 *   400       — 잘못된 요청 (API에서 정상 거절)
 *   401/403   — 인증 필요 (로그인 없이 접근 시 정상)
 */
const ROUTES = [
  // 핵심 페이지
  ['/',                               [200],             '홈'],
  ['/today-fortune',                  [200, 307, 308],   '오늘운세'],
  ['/saju/new',                       [200],             '사주 시작'],
  ['/compatibility',                  [200],             '궁합'],
  ['/compatibility/input',            [200],             '궁합 입력'],
  ['/tarot/daily',                    [200],             '타로'],
  ['/membership',                     [200],             '멤버십'],
  ['/pricing',                        [200],             '가격'],
  ['/login',                          [200],             '로그인'],
  ['/privacy',                        [200],             '개인정보처리방침'],
  ['/terms',                          [200],             '이용약관'],
  ['/notifications',                  [200],             '알림 설정'],
  ['/my',                             [200, 307],        'My 페이지 (미로그인 시 redirect 허용)'],

  // 리다이렉트 확인 (STEP 5 이후)
  ['/about-engine',                   [200, 301, 307, 308], 'about-engine'],
  ['/gunghap',                        [200, 301, 307, 308], 'gunghap'],
  ['/today',                          [200, 301, 307, 308], 'today alias'],
  ['/vault',                          [200, 301, 307, 308], 'vault alias'],

  // API 라우트 (OPTIONS or 405 — Next.js Route Handlers)
  ['/api/geo/birth-location?q=서울',  [200, 400],        'Geo API'],
  ['/api/today-fortune',              [200, 400, 405],   'Today Fortune API'],
  ['/api/interpret',                  [200, 400, 405],   'Interpret API'],
];

let passed = 0;
let failed = 0;
const failures = [];

async function check(path, expectedCodes, label) {
  const url = `${BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ganji-smoke-test/1.0' },
    });
    clearTimeout(timer);

    if (expectedCodes.includes(res.status)) {
      console.log(`  \x1b[32m✓\x1b[0m [${res.status}] ${label}`);
      passed++;
    } else {
      const msg = `[${res.status}] ${label} — 예상: ${expectedCodes.join('/')}`;
      console.error(`  \x1b[31m✗\x1b[0m ${msg}`);
      failures.push({ path, msg });
      failed++;
    }
  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e.name === 'AbortError';
    const msg = isTimeout
      ? `${label} — ${TIMEOUT_MS}ms 타임아웃`
      : `${label} — 연결 실패: ${e.message}`;
    console.error(`  \x1b[31m✗\x1b[0m ${msg}`);
    failures.push({ path, msg });
    failed++;
  }
}

// ─── 실행 ───────────────────────────────
console.log(`\nSmoke test → \x1b[36m${BASE}\x1b[0m`);
console.log('개발 서버(npm run dev)가 실행 중이어야 합니다.\n');

// 서버 실행 여부 사전 확인
try {
  const pingCtrl = new AbortController();
  setTimeout(() => pingCtrl.abort(), 3000);
  await fetch(`${BASE}/`, { redirect: 'manual', signal: pingCtrl.signal });
} catch {
  console.error(`\x1b[31m서버에 연결할 수 없습니다: ${BASE}\x1b[0m`);
  console.error('npm run dev 를 먼저 실행하세요.');
  process.exit(2);
}

for (const [path, codes, label] of ROUTES) {
  await check(path, codes, label);
}

// ─── 결과 요약 ───────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`결과: ${passed}/${passed + failed} 통과`);

if (failures.length > 0) {
  console.error('\n실패 항목:');
  failures.forEach(({ path, msg }) => {
    console.error(`  ${path}: ${msg}`);
  });
  process.exit(1);
} else {
  console.log('\x1b[32m모든 라우트 정상 응답 ✓\x1b[0m');
  process.exit(0);
}
