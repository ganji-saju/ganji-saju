#!/usr/bin/env node
/**
 * verify-imports.mjs
 * 삭제되었거나 이동된 파일을 여전히 import하는 곳이 있는지 전수 검사
 *
 * STEP 작업 완료 후 실행하여 "끊어진 import" 잔존 여부 확인
 * 사용법: node scripts/verify-imports.mjs [--all] [--step=N]
 *
 * 예: node scripts/verify-imports.mjs --step=4
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const stepArg = args.find(a => a.startsWith('--step='))?.split('=')[1];
const showAll = args.includes('--all');

function grep(pattern, dir) {
  try {
    return execSync(
      `grep -rn "${pattern}" "${dir}" --include="*.tsx" --include="*.ts" 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf8' }
    ).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 각 STEP에서 삭제/이동되는 import 경로와 검사 조건
 *
 * when: 해당 STEP 완료 후부터 참조가 0이어야 함
 * fileDeleted: 해당 파일이 실제로 삭제된 경우에만 오류로 처리
 */
const CHECKS = [
  // STEP 2: 데드 파일 삭제
  {
    step: 2,
    importPath: "@/components/site-header",
    physicalFile: 'src/components/site-header.tsx',
    description: '구형 site-header (데드 파일)',
  },
  {
    step: 2,
    importPath: "@/lib/site-navigation",
    physicalFile: 'src/lib/site-navigation.ts',
    description: '구형 site-navigation (데드 파일)',
  },
  {
    step: 2,
    importPath: "@/lib/home-content",
    physicalFile: 'src/lib/home-content.ts',
    description: 'home-content (미사용 파일)',
  },

  // STEP 4: import 경로 단일화
  {
    step: 4,
    importPath: "@/lib/saju/report'",
    physicalFile: 'src/lib/saju/report.ts',
    description: '@/lib/saju/report passthrough (→ @/domain/saju/report 로 통일)',
    // 단, report-metadata, report-contract는 별개 파일이므로 제외 패턴 필요
    excludePattern: 'report-metadata|report-contract',
  },

  // STEP 1: api-utils 추출 후 중복 함수 잔존 여부
  {
    step: 1,
    pattern: 'function readString(',
    description: 'readString 중복 정의 잔존',
    excludePattern: 'api-utils\\.ts|\\.test\\.',
    physicalFile: null,
    isPatternCheck: true,
    allowedCount: 1, // api-utils.ts 자체만 허용
  },
  {
    step: 1,
    pattern: 'function getCurrentKoreaYear(',
    description: 'getCurrentKoreaYear 중복 정의 잔존',
    excludePattern: 'api-utils\\.ts|\\.test\\.',
    physicalFile: null,
    isPatternCheck: true,
    allowedCount: 0,
  },
];

let errorCount = 0;
let passCount = 0;

function shouldCheck(check) {
  if (showAll) return true;
  if (!stepArg) return true;
  return String(check.step) === stepArg;
}

console.log(`\nimport 경로 검증${stepArg ? ` (STEP ${stepArg})` : ' (전체)'}\n`);

for (const check of CHECKS) {
  if (!shouldCheck(check)) continue;

  const label = `[STEP ${check.step}] ${check.description}`;

  if (check.isPatternCheck) {
    // 함수 중복 정의 검사
    let hits = grep(check.pattern, resolve(ROOT, 'src'));
    if (check.excludePattern) {
      const re = new RegExp(check.excludePattern);
      hits = hits.filter(l => !re.test(l));
    }
    const allowed = check.allowedCount ?? 0;
    if (hits.length > allowed) {
      console.error(`  \x1b[31m✗\x1b[0m ${label}`);
      hits.forEach(l => console.error(`    ${l}`));
      errorCount++;
    } else {
      console.log(`  \x1b[32m✓\x1b[0m ${label}`);
      passCount++;
    }
    continue;
  }

  // import 경로 검사
  const fileExists = check.physicalFile
    ? existsSync(resolve(ROOT, check.physicalFile))
    : false;

  let hits = grep(`from '${check.importPath}`, resolve(ROOT, 'src'));
  if (check.excludePattern) {
    const re = new RegExp(check.excludePattern);
    hits = hits.filter(l => !re.test(l));
  }
  // 자기 자신 파일은 제외
  if (check.physicalFile) {
    hits = hits.filter(l => !l.includes(check.physicalFile));
  }

  if (hits.length > 0) {
    if (!fileExists) {
      // 파일이 삭제됐는데 import가 남아있으면 빌드 에러
      console.error(`  \x1b[31m✗ (빌드 에러)\x1b[0m ${label}`);
      hits.forEach(l => console.error(`    ${l}`));
      errorCount++;
    } else {
      // 파일이 아직 있으면 경고만
      console.warn(`  \x1b[33m⚠ (미정리)\x1b[0m ${label}: ${hits.length}곳 참조 중`);
      hits.forEach(l => console.warn(`    ${l}`));
    }
  } else {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passCount++;
  }
}

console.log('\n' + '─'.repeat(50));
console.log(`통과: ${passCount} / 전체: ${passCount + errorCount}`);

if (errorCount > 0) {
  console.error(`\n\x1b[31m끊어진 import ${errorCount}개 발견 — 수정 후 재실행하세요\x1b[0m`);
  process.exit(1);
} else {
  console.log('\x1b[32mimport 경로 이상 없음 ✓\x1b[0m');
  process.exit(0);
}
