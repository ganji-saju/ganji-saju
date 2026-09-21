import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleHook } from './codex-progress-hook.mjs';

const ORIGINAL = '# 작업 기록\n\n## 이전 작업\n\n- 기존 기록을 보존한다.\n';
const RENDERER = `import { readFileSync, writeFileSync } from 'node:fs';
writeFileSync('PROGRESS.html', readFileSync('PROGRESS.md'));
console.log('렌더러 stdout은 훅 JSON에 섞이지 않는다.');
`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ganji-progress-hook-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  }).trim();
  git('init', '--quiet');
  git('config', 'user.email', 'hook-test@example.test');
  git('config', 'user.name', 'Hook Test');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  mkdirSync(join(root, 'scripts'));
  const write = (name, data) => writeFileSync(join(root, name), data);
  write('.gitignore', '.codex-run/\nPROGRESS.html\nignored.txt\n');
  write('PROGRESS.md', ORIGINAL);
  write('code.js', 'export const value = 1;\n');
  write('scripts/render-progress.mjs', RENDERER);
  const commit = (...paths) => { git('add', '--', ...paths); git('commit', '--quiet', '-m', 'fixture change'); };
  commit('.gitignore', 'PROGRESS.md', 'code.js', 'scripts/render-progress.mjs');
  const event = (name, extra = {}) => handleHook({ cwd: root, session_id: 'session/with unsafe:path', hook_event_name: name, ...extra });
  const prepend = () => write('PROGRESS.md', ORIGINAL.replace('# 작업 기록\n', '# 작업 기록\n\n## 이번 작업\n\n- 결과: 코드 수정. 검사: 단위 검사 통과. 남은 작업: 없음.\n'));
  const stateFiles = () => readdirSync(join(root, '.codex-run/progress-hooks'));
  return { root, git, write, commit, event, prepend, stateFiles };
}

test('dirty tracked code demands a truthful report, without staging or committing', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.event('UserPromptSubmit'), {});
  f.write('code.js', 'export const value = 2;\n');
  const before = f.git('status', '--porcelain');
  const result = f.event('Stop');
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /실제 작업 결과/);
  assert.match(result.reason, /소유 파일과 PROGRESS.md만/);
  assert.equal(f.git('status', '--porcelain'), before);
  assert.match(f.stateFiles()[0], /^[a-f0-9]{64}\.json$/);
});

test('committed code without a new report still blocks', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  f.write('code.js', 'export const value = 2;\n');
  f.commit('code.js');
  assert.equal(f.git('status', '--porcelain'), '');
  assert.equal(f.event('Stop').decision, 'block');
});

test('same-size untracked edits are detected by file content', (t) => {
  const f = fixture(t);
  f.write('new.js', 'one');
  f.event('UserPromptSubmit');
  f.write('new.js', 'two');
  assert.equal(f.event('Stop').decision, 'block');
});

test('a prepended and committed report succeeds, renders, and clears baseline', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  f.write('code.js', 'export const value = 2;\n');
  f.prepend();
  f.commit('code.js', 'PROGRESS.md');
  assert.deepEqual(f.event('Stop'), {});
  assert.equal(readFileSync(join(f.root, 'PROGRESS.html'), 'utf8'), readFileSync(join(f.root, 'PROGRESS.md'), 'utf8'));
  assert.deepEqual(f.stateFiles(), []);
});

test('both staged and unstaged new reports must be committed', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  f.prepend();
  const unstaged = f.event('Stop');
  assert.equal(unstaged.decision, 'block');
  assert.match(unstaged.reason, /커밋되지/);
  f.git('add', 'PROGRESS.md');
  const staged = f.event('Stop');
  assert.equal(staged.decision, undefined);
  assert.match(staged.systemMessage, /커밋되지/);
  f.commit('PROGRESS.md');
  assert.deepEqual(f.event('Stop', { stop_hook_active: true }), {});
});

test('assume-unchanged cannot hide an uncommitted report', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  f.git('update-index', '--assume-unchanged', 'PROGRESS.md');
  f.prepend();
  assert.equal(f.git('diff', 'HEAD', '--', 'PROGRESS.md'), '');
  const result = f.event('Stop');
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /커밋되지/);
});

test('read-only turns preserve pre-existing tracked, untracked and PROGRESS dirtiness', (t) => {
  const f = fixture(t);
  f.write('code.js', 'pre-existing edit\n');
  f.write('new.js', 'pre-existing file');
  f.prepend();
  f.event('UserPromptSubmit');
  f.write('ignored.txt', 'does not count');
  const before = f.git('status', '--porcelain');
  assert.deepEqual(f.event('Stop'), {});
  assert.equal(f.git('status', '--porcelain'), before);
});

test('rewriting historical text is rejected even with a new committed section', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  f.prepend();
  f.write('PROGRESS.md', readFileSync(join(f.root, 'PROGRESS.md'), 'utf8').replace('기존 기록을 보존한다.', '과거 기록을 바꿨다.'));
  f.commit('PROGRESS.md');
  const result = f.event('Stop');
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /기존 제목·과거 본문/);
});

test('changing the root title or deleting the report is rejected', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  f.prepend();
  f.write('PROGRESS.md', readFileSync(join(f.root, 'PROGRESS.md'), 'utf8').replace('# 작업 기록', '# 바뀐 제목'));
  assert.match(f.event('Stop').reason, /기존 제목·과거 본문/);
  rmSync(join(f.root, 'PROGRESS.md'));
  assert.match(f.event('Stop').systemMessage, /기존 제목·과거 본문/);
});

test('steering and automatic continuation preserve baseline and bound recovery', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  const statePath = join(f.root, '.codex-run/progress-hooks', f.stateFiles()[0]);
  const baseline = JSON.parse(readFileSync(statePath)).baseline;
  f.write('code.js', 'export const value = 2;\n');
  f.event('UserPromptSubmit');
  assert.deepEqual(JSON.parse(readFileSync(statePath)).baseline, baseline);
  assert.equal(f.event('Stop').decision, 'block');
  f.event('UserPromptSubmit');
  assert.deepEqual(JSON.parse(readFileSync(statePath)).baseline, baseline);
  const continuation = f.event('Stop', { stop_hook_active: true });
  assert.equal(continuation.decision, undefined);
  assert.match(continuation.systemMessage, /기준점.*보존/);
  assert.equal(f.event('Stop').decision, undefined);
  f.prepend();
  f.commit('code.js', 'PROGRESS.md');
  assert.deepEqual(f.event('Stop'), {});
  assert.deepEqual(f.stateFiles(), []);
});

test('repair is bounded across different unresolved issues even without stop_hook_active', (t) => {
  const f = fixture(t);
  f.event('UserPromptSubmit');
  f.write('code.js', 'export const value = 2;\n');
  const reportMissing = f.event('Stop');
  assert.equal(reportMissing.decision, 'block');
  assert.match(reportMissing.reason, /다른 작업자가 동시에 만든 변경/);
  f.prepend();
  const notCommitted = f.event('Stop');
  assert.equal(notCommitted.decision, undefined);
  assert.match(notCommitted.systemMessage, /커밋되지/);
  f.commit('code.js', 'PROGRESS.md');
  assert.deepEqual(f.event('Stop'), {});
});

test('render failure blocks once, stays pending, then recovers', (t) => {
  const f = fixture(t);
  f.write('scripts/render-progress.mjs', 'console.error("render fixture failed"); process.exit(7);\n');
  f.commit('scripts/render-progress.mjs');
  f.event('UserPromptSubmit');
  const first = f.event('Stop');
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /PROGRESS.html 생성.*종료 코드 7/);
  assert.match(f.event('Stop').systemMessage, /반복 차단은 중지/);
  // 렌더러를 고치는 작업 자체도 새 작업이므로 실제 변경과 기록을 커밋한다.
  f.write('scripts/render-progress.mjs', RENDERER);
  f.prepend();
  f.commit('scripts/render-progress.mjs', 'PROGRESS.md');
  assert.deepEqual(f.event('Stop'), {});
});

test('missing initial baseline renders without demanding a historical report; repeat Stop is idempotent', (t) => {
  const f = fixture(t);
  f.write('code.js', 'untracked earlier task changes\n');
  assert.deepEqual(f.event('Stop'), {});
  assert.deepEqual(f.event('Stop'), {});
  assert.deepEqual(f.stateFiles(), []);
});

test('SubagentStop and other events are ignored without filesystem access', () => {
  assert.deepEqual(handleHook({ hook_event_name: 'SubagentStop', cwd: '/does/not/exist' }), {});
  assert.deepEqual(handleHook({ hook_event_name: 'SessionStart' }), {});
});

test('untracked symlinks are fingerprinted without reading external targets', (t) => {
  const f = fixture(t);
  const outside = mkdtempSync(join(tmpdir(), 'ganji-hook-external-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const target = join(outside, 'private');
  writeFileSync(target, 'first external content');
  symlinkSync(target, join(f.root, 'external-link'));
  f.event('UserPromptSubmit');
  writeFileSync(target, 'different external content');
  assert.deepEqual(f.event('Stop'), {});
  assert.equal(readFileSync(target, 'utf8'), 'different external content');
});

test('a symlinked HTML destination is never overwritten', (t) => {
  const f = fixture(t);
  const target = join(f.root, 'ignored.txt');
  f.write('ignored.txt', 'keep this');
  symlinkSync(target, join(f.root, 'PROGRESS.html'));
  f.event('UserPromptSubmit');
  assert.equal(f.event('Stop').decision, 'block');
  assert.equal(readFileSync(target, 'utf8'), 'keep this');
});

test('CLI emits exactly one valid JSON value, including malformed input', (t) => {
  const f = fixture(t);
  const script = fileURLToPath(new URL('./codex-progress-hook.mjs', import.meta.url));
  const run = (input) => JSON.parse(execFileSync(process.execPath, [script], { input, encoding: 'utf8' }));
  assert.deepEqual(run(JSON.stringify({ hook_event_name: 'Stop', cwd: f.root, session_id: 'cli' })), {});
  assert.match(run('{broken').systemMessage, /입력을 읽지 못했습니다/);
});
