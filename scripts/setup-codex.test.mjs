import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scripts = dirname(fileURLToPath(import.meta.url));

function nodeStub(major) {
  return `#!/bin/sh
case "$1" in
  -p) echo '${major}' ;;
  --version) echo 'v${major}.0.0' ;;
  *) exit 91 ;;
esac
`;
}

function fixture(t, { runtimeMajor = null, dependencies = false, failCi = false } = {}) {
  // 공백 경로도 검증한다. git/node/npm은 전부 로컬 스텁이므로 설치·네트워크 호출은 없다.
  const root = mkdtempSync(join(tmpdir(), 'ganji setup fixture '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const scriptDir = join(root, 'scripts');
  mkdirSync(bin);
  mkdirSync(scriptDir);
  const writeExecutable = (path, content) => writeFileSync(path, content, { mode: 0o755 });
  copyFileSync(join(scripts, 'setup-codex.sh'), join(scriptDir, 'setup-codex.sh'));
  writeExecutable(join(scriptDir, 'setup-worktree.sh'), '#!/bin/sh\nprintf "worktree\\n" >> "$SETUP_FIXTURE_LOG"\n');
  writeExecutable(join(bin, 'git'), '#!/bin/sh\nprintf "%s\\n" "$SETUP_FIXTURE_ROOT"\n');
  writeExecutable(join(bin, 'node'), nodeStub(24));
  const node22 = join(root, 'node22-fixture');
  writeExecutable(node22, nodeStub(22));
  writeExecutable(join(bin, 'npm'), `#!/bin/sh
printf 'npm' >> "$SETUP_FIXTURE_LOG"
for arg in "$@"; do printf '\\t%s' "$arg" >> "$SETUP_FIXTURE_LOG"; done
printf '\\n' >> "$SETUP_FIXTURE_LOG"
case "$1" in
  install)
    test "$2" = --prefix || exit 92
    mkdir -p "$3/node_modules/node/bin"
    cp "$SETUP_FIXTURE_NODE22" "$3/node_modules/node/bin/node"
    chmod +x "$3/node_modules/node/bin/node"
    ;;
  ci)
    printf 'ci-node\\t%s\\n' "$(node --version)" >> "$SETUP_FIXTURE_LOG"
    test "$SETUP_FIXTURE_FAIL_CI" = 0 || exit 9
    mkdir -p "$SETUP_FIXTURE_ROOT/node_modules"
    ;;
  --version) echo '10.9.0' ;;
  *) exit 93 ;;
esac
`);
  const runtime = join(root, '.codex-run/node22');
  if (runtimeMajor !== null) {
    mkdirSync(join(runtime, 'node_modules/node/bin'), { recursive: true });
    writeExecutable(join(runtime, 'node_modules/node/bin/node'), nodeStub(runtimeMajor));
  }
  if (dependencies) {
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'node_modules/preserved'), 'existing dependencies');
  }
  const log = join(root, 'calls');
  const env = {
    ...process.env, PATH: `${bin}:${process.env.PATH}`,
    SETUP_FIXTURE_ROOT: root, SETUP_FIXTURE_LOG: log, SETUP_FIXTURE_NODE22: node22,
    SETUP_FIXTURE_FAIL_CI: failCi ? '1' : '0',
  };
  const run = () => spawnSync('sh', [join(scriptDir, 'setup-codex.sh')], { cwd: root, env, encoding: 'utf8' });
  const calls = () => readFileSync(log, 'utf8').trim().split('\n').map((line) => line.split('\t'));
  return { root, runtime, log, run, calls };
}

test('fresh setup installs project Node and uses CI dependency flags under Node 22', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const calls = f.calls();
  assert.deepEqual(calls[0], ['worktree']);
  assert.deepEqual(calls.find((call) => call[1] === 'install'), [
    'npm', 'install', '--prefix', f.runtime, '--no-save', '--package-lock=false', '--no-audit', '--no-fund', 'node@22',
  ]);
  const ci = calls.find((call) => call[1] === 'ci');
  assert.deepEqual(ci, ['npm', 'ci', '--legacy-peer-deps', '--engine-strict', '--no-audit', '--no-fund']);
  const workflow = readFileSync(join(scripts, '../.github/workflows/ci.yml'), 'utf8');
  const workflowFlags = workflow.match(/run: npm ci([^\n]*)/)[1].trim().split(/\s+/);
  for (const flag of workflowFlags) assert.ok(ci.includes(flag), `setup must keep CI flag ${flag}`);
  assert.ok(calls.some((call) => call[0] === 'ci-node' && call[1] === 'v22.0.0'));
  assert.match(result.stdout, /프로젝트 준비 완료: Node v22\.0\.0/);
  writeFileSync(f.log, '');
  assert.equal(f.run().status, 0);
  assert.deepEqual(f.calls(), [['worktree'], ['npm', '--version']]);
});

test('existing runtime and root dependencies are preserved without reinstalling', (t) => {
  const f = fixture(t, { runtimeMajor: 22, dependencies: true });
  assert.equal(f.run().status, 0);
  assert.deepEqual(f.calls(), [['worktree'], ['npm', '--version']]);
  assert.equal(readFileSync(join(f.root, 'node_modules/preserved'), 'utf8'), 'existing dependencies');
});

test('wrong local Node major is replaced without reinstalling existing root dependencies', (t) => {
  const f = fixture(t, { runtimeMajor: 24, dependencies: true });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.calls().filter((call) => call[1] === 'install').length, 1);
  assert.equal(f.calls().filter((call) => call[1] === 'ci').length, 0);
  assert.match(result.stdout, /Node v22\.0\.0/);
  assert.equal(readFileSync(join(f.root, 'node_modules/preserved'), 'utf8'), 'existing dependencies');
});

test('a dependency installation failure exits without claiming setup succeeded', (t) => {
  const f = fixture(t, { runtimeMajor: 22, failCi: true });
  const result = f.run();
  assert.equal(result.status, 9);
  assert.doesNotMatch(result.stdout, /프로젝트 준비 완료/);
  assert.ok(f.calls().some((call) => call[1] === 'ci' && call.includes('--engine-strict')));
});
