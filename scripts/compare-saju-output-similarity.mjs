import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
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

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const slugA = readArg('--slug-a', '1982-1-29-8-male');
const slugB = readArg('--slug-b', '1982-1-29-22-male');
const topic = readArg('--topic', 'today');
const json = process.argv.includes('--json');

const { buildSajuOutputSimilarityAudit } = require(
  path.join(sourceRoot, 'server/verification/saju-output-similarity.ts')
);

const audit = await buildSajuOutputSimilarityAudit({ slugA, slugB, topic });

if (!audit) {
  console.error(`not ok - 비교 결과를 만들지 못했습니다: ${slugA} ↔ ${slugB}`);
  process.exit(1);
}

if (json) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  console.log(`사주 출력 유사도 비교: ${slugA} ↔ ${slugB}`);
  console.log(`topic: ${audit.topic}`);
  console.log(`promptInputSimilarity: ${audit.metrics.promptInputSimilarity}`);
  console.log(`personalizationSimilarity: ${audit.metrics.personalizationSimilarity}`);
  console.log(`reportTextSimilarity: ${audit.metrics.reportTextSimilarity}`);
  console.log(`differences: ${audit.differences.join(', ') || '없음'}`);
  console.log(`promptDiverges: ${audit.checks.promptDiverges ? 'ok' : 'not ok'}`);
  console.log(`personalizationDiverges: ${audit.checks.personalizationDiverges ? 'ok' : 'not ok'}`);
  console.log(`reportDiverges: ${audit.checks.reportDiverges ? 'ok' : 'not ok'}`);
}

if (!audit.checks.promptDiverges || !audit.checks.personalizationDiverges) {
  process.exit(1);
}
