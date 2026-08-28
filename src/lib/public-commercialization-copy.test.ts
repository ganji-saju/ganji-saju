import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const PUBLIC_CORE_COPY_FILES = [
  'src/app/login/page.tsx',
  'src/app/credits/page.tsx',
  'src/app/credits/loading.tsx',
  'src/app/today-fortune/page.tsx',
  'src/app/today-fortune/loading.tsx',
  'src/features/today-fortune/today-fortune-experience.tsx',
  // 2026-07-10 — 죽은 birth-info-stepper.tsx 제거. 오늘운세 입력 표면은 UnifiedIntake 로
  //   옮겨갔으므로 정직성 가드 스캔 대상도 함께 이동한다(구멍 방지).
  'src/features/unified-intake/unified-intake.tsx',
  'src/app/membership/page.tsx',
  'src/content/moonlight.ts',
  'src/components/seo/paid-funnel-grid.tsx',
  'src/app/support/faq/page.tsx',
  'src/app/compatibility/page.tsx',
  'src/app/dialogue/appointment/page.tsx',
  'src/app/membership/checkout/page.tsx',
  'src/components/membership/toss-membership-checkout.tsx',
  'src/components/policies/payment-consent-checkboxes.tsx',
  'src/lib/bundled-policies.ts',
  // 2026-06-06 — 유료 리포트 keepsake CTA('준비 중' → '출시 예정') 회귀 잠금.
  'src/components/report/report-keepsake-section.tsx',
  // 2026-06-21 — 무료 타로 풀이 표면 카피도 정직성 가드 스캔에 포함(이전 미커버).
  'src/app/tarot/daily/page.tsx',
  'src/app/tarot/daily/pick/page.tsx',
  'src/app/tarot/daily/result/page.tsx',
  'src/app/tarot/daily/spread/page.tsx',
] as const;

const FORBIDDEN_PATTERNS = [
  /준비 중/g,
  /준비중/g,
  /로딩중/g,
  /불러오는 중/g,
  /결과가 없습니다/g,
  /\bTODO\b/gi,
  /\bFIXME\b/gi,
  /\bplaceholder\b/gi,
  /\bmock\b/gi,
  /\bdummy\b/gi,
] as const;

function stripCommentsAndImplementationOnlyText(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\bclassName=(?:"[^"]*"|'[^']*'|\{`[\s\S]*?`\}|\{[^{}]*\})/g, '')
    .replace(/\bplaceholder=(?:"[^"]*"|'[^']*'|\{[^}]*\})/g, '')
    .replace(/\bstyle=\{\{[\s\S]*?\}\}/g, '');
}

test('public commercialization pages do not expose forbidden copy', () => {
  const findings: string[] = [];

  for (const relativePath of PUBLIC_CORE_COPY_FILES) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const searchable = stripCommentsAndImplementationOnlyText(
      fs.readFileSync(absolutePath, 'utf8')
    );

    for (const pattern of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = searchable.match(pattern) ?? [];
      if (matches.length > 0) {
        findings.push(`${relativePath}: ${matches.join(', ')}`);
      }
    }
  }

  assert.deepEqual(findings, []);
});

test('login page exposes the minimum paid-service auth surface', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/login/page.tsx'), 'utf8');

  for (const required of [
    // 2026-08-26 — 도령식 로그인 단순화: 서비스 설명은 한 줄 카피로 대체(취지 유지).
    '사주 결과와 이용 내역을 저장하고 언제든 다시 볼 수 있어요.',
    '카카오로 시작하기',
    'Google로 시작하기',
    '/terms',
    '/privacy',
    '카카오톡 문의',
    '로그인 실패',
  ]) {
    assert.ok(source.includes(required), `missing login surface copy: ${required}`);
  }

  assert.ok(
    source.includes('next=${encodeURIComponent(afterLoginHref)}'),
    'OAuth callback must preserve the safe next parameter'
  );
  // 🔴 2026-08-27 — 이 가드는 원래 `router.replace(afterLoginHref)` 라는 **구현 문자열**을
  //   박아 두고 있었다. 그런데 바로 그 replace+refresh 조합이 "로그인은 됐는데 화면이
  //   그대로" 버그의 원인이었다(refresh 가 진행 중인 replace 를 취소). 가드가 버그를
  //   지키고 있었던 셈이라, 검사 대상을 **의도**로 바꾼다 — 어떤 방식으로 이동하든
  //   목적지가 afterLoginHref 이기만 하면 된다.
  assert.ok(
    /redirectAfterLogin\(\s*(data\.next \?\? )?afterLoginHref\s*\)/.test(source),
    'password login must return to the safe next destination'
  );
  // 하드 내비게이션이어야 서버 컴포넌트가 방금 발급된 세션 쿠키를 본다(결제는 서버 판정).
  assert.ok(
    source.includes('window.location.replace(href)'),
    'post-login navigation must be a hard navigation so the server sees the new session'
  );
});
