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
  'src/components/today-fortune/birth-info-stepper.tsx',
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
    '간지사주는 사주, 오늘운세, 보관함과 유료 이용내역을 한 계정에서 이어 보는 서비스입니다.',
    '카카오 로그인',
    'Google 로그인',
    '/terms',
    '/privacy',
    'SUPPORT_EMAIL',
    '로그인 실패',
  ]) {
    assert.ok(source.includes(required), `missing login surface copy: ${required}`);
  }

  assert.ok(
    source.includes('next=${encodeURIComponent(afterLoginHref)}'),
    'OAuth callback must preserve the safe next parameter'
  );
  assert.ok(
    source.includes('router.replace(afterLoginHref)'),
    'password login must return to the safe next destination'
  );
});
