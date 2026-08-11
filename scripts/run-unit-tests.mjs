import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// 2026-08-11 — 전면 유료화 잠금(src/lib/paywall-lockdown.ts)은 프로덕션 기본 ON 이지만,
//   여기 테스트들은 **잠금 이전 제품**의 카피·메뉴를 고정한다. 복원 시 안전망으로 남겨두려면
//   기본은 OFF 로 돌려야 한다. 잠금 동작은 src/lib/paywall-lockdown.spec.ts(vitest)와
//   daily-limit.test.ts 의 withLockdown(true) 블록이 따로 검증한다.
//   (호출자가 명시하면 그 값을 존중한다.)
process.env.NEXT_PUBLIC_PAYWALL_LOCKDOWN ??= 'false';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const tests = [];

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveWithProjectAliases(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(
      this,
      path.join(sourceRoot, request.slice(2)),
      parent,
      isMain,
      options
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function loadTypeScriptModule(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(output.outputText, filename);
};

globalThis.test = function registerTest(name, fn) {
  tests.push({ name, fn });
};

function findTestFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findTestFiles(absolutePath);
      return entry.isFile() && entry.name.endsWith('.test.ts') ? [absolutePath] : [];
    });
}

for (const testFile of findTestFiles(sourceRoot).sort()) {
  require(testFile);
}

let failed = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (tests.length === 0) {
  console.error('not ok - no tests found');
  process.exit(1);
}

if (failed > 0) {
  process.exit(1);
}

console.log(`\n${tests.length} tests passed`);
