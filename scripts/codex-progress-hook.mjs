#!/usr/bin/env node
// Codex 작업 전후의 저장소 상태만 비교한다. 대화 기록과 다른 프로젝트는 읽지 않는다.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync,
  readlinkSync, realpathSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const MAX_OUTPUT = 16 * 1024 * 1024;

function git(root, args, encoding = 'utf8') {
  return execFileSync('git', args, {
    cwd: root, encoding, timeout: 15_000, maxBuffer: MAX_OUTPUT,
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
}

function head(root) {
  try {
    return git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).trim();
  } catch (error) {
    if (error.status === 1) return null; // 최초 커밋 전 저장소.
    throw error;
  }
}

// 파일 자체뿐 아니라 중간 디렉터리의 심링크도 따라가지 않는다.
function inspect(root, path) {
  const name = relative(root, path);
  if (!name || isAbsolute(name) || name === '..' || name.startsWith(`..${sep}`)) {
    throw new Error('저장소 밖 경로는 읽을 수 없습니다.');
  }
  let cursor = root;
  for (const component of name.split(sep)) {
    cursor = join(cursor, component);
    let stat;
    try { stat = lstatSync(cursor); } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { kind: 'missing' };
      throw error;
    }
    if (stat.isSymbolicLink()) {
      return { kind: 'symlink', path: relative(root, cursor), target: readlinkSync(cursor) };
    }
    if (cursor === path) return { kind: stat.isFile() ? 'file' : 'other', stat };
  }
}

function readLocalFile(root, path, optional = false) {
  const entry = inspect(root, path);
  if (optional && entry.kind === 'missing') return null;
  if (entry.kind !== 'file') throw new Error(`${relative(root, path)} 은 일반 파일이어야 합니다(심링크 불가).`);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(fd).isFile()) throw new Error('일반 파일만 읽을 수 있습니다.');
    return readFileSync(fd);
  } finally { closeSync(fd); }
}

function sourceFingerprint(root) {
  const names = [...new Set(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0').filter(Boolean))].sort();
  const hash = createHash('sha256');
  for (const name of names) {
    if (name === 'PROGRESS.md' || name === 'PROGRESS.html' || name.startsWith('.codex-run/')) continue;
    const path = resolve(root, name);
    const entry = inspect(root, path);
    hash.update(JSON.stringify([name, entry.kind]));
    if (entry.kind === 'file') {
      hash.update(String(entry.stat.mode & 0o777));
      hash.update(digest(readLocalFile(root, path)));
    } else if (entry.kind === 'symlink') {
      hash.update(JSON.stringify([entry.path, entry.target]));
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

function progress(root) {
  const data = readLocalFile(root, join(root, 'PROGRESS.md'), true);
  if (data === null) return { exists: false, hash: null, bodyLength: 0, bodyHash: digest(''), title: '' };
  const newline = data.indexOf(10);
  const firstLine = data.subarray(0, newline < 0 ? data.length : newline + 1).toString('utf8');
  const title = /^#\s/.test(firstLine) ? firstLine : '';
  const body = data.subarray(Buffer.byteLength(title));
  return { exists: true, hash: digest(data), bodyLength: body.length, bodyHash: digest(body), title, body };
}

function snapshot(root) {
  const { body: _body, ...report } = progress(root);
  return { head: head(root), source: sourceFingerprint(root), progress: report };
}

function statePath(root, sessionId) {
  for (const name of ['.codex-run', '.codex-run/progress-hooks']) {
    const path = join(root, name);
    const entry = inspect(root, path);
    if (entry.kind === 'missing') mkdirSync(path, { mode: 0o700 });
    else if (entry.kind !== 'other' || !entry.stat.isDirectory()) {
      throw new Error(`${name} 은 저장소 내부의 실제 디렉터리여야 합니다.`);
    }
  }
  return join(root, '.codex-run/progress-hooks', `${digest(sessionId)}.json`);
}

function saveState(root, path, state) {
  const entry = inspect(root, path);
  if (entry.kind !== 'missing' && entry.kind !== 'file') throw new Error('훅 상태 파일에 심링크를 사용할 수 없습니다.');
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function reportIssue(before, after) {
  if (before.exists) {
    if (!after.exists || after.title !== before.title || after.bodyLength < before.bodyLength ||
        digest(after.body.subarray(after.bodyLength - before.bodyLength)) !== before.bodyHash) {
      return ['history', 'PROGRESS.md의 기존 제목·과거 본문이 변경 또는 삭제되었습니다. 작업 시작 전 본문을 그대로 복구하고 제목 아래 맨 위에 새 섹션만 추가하세요.'];
    }
  }
  const addition = after.exists ? after.body.subarray(0, after.bodyLength - before.bodyLength).toString('utf8') : '';
  if (!after.exists || after.hash === before.hash || !/^##[ \t]+\S/m.test(addition)) {
    return ['report', '이번 작업의 변경은 확인되지만 PROGRESS.md 맨 위에 새 작업 섹션이 없습니다.'];
  }
  return null;
}

function reportCommitted(root, current) {
  if (current.head === null) return false;
  try {
    // diff의 assume-unchanged/skip-worktree 플래그와 무관하게 커밋 본문을 대조한다.
    return digest(git(root, ['show', 'HEAD:PROGRESS.md'], null)) === current.progress.hash;
  } catch (error) {
    if (error.status === 128) return false; // HEAD에 아직 보고서가 없다.
    throw error;
  }
}

function render(root) {
  for (const name of ['scripts/render-progress.mjs', 'PROGRESS.md', 'PROGRESS.html']) {
    const entry = inspect(root, join(root, name));
    if (entry.kind !== 'file' && !(name === 'PROGRESS.html' && entry.kind === 'missing')) {
      throw new Error(`${name} 파일을 안전하게 사용할 수 없습니다.`);
    }
  }
  execFileSync(process.execPath, [join(root, 'scripts/render-progress.mjs')], {
    cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: MAX_OUTPUT, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function failure(root, path, state, input, code, reason) {
  const repeated = input.stop_hook_active === true || state.repairs.length > 0;
  if (!state.repairs.includes(code)) state.repairs.push(code);
  state.pending = true;
  saveState(root, path, state);
  const instruction = code === 'render'
    ? `${reason} scripts/render-progress.mjs의 오류 원인을 확인하고 해결한 뒤 다시 실행하세요. 확인되지 않은 성공은 기록하지 마세요.`
    : `${reason} 실제 작업 결과·실행한 검사와 결과·남은 작업을 사실대로 기록하고, 기존 섹션을 보존하세요. 검토만 한 내용이나 다른 작업자가 동시에 만든 변경을 자신의 구현·검증 성과로 기록하지 마세요. 이번 작업 소유 파일과 PROGRESS.md만 선별하여 함께 커밋하세요. 다른 작업의 변경은 포함하지 마세요. 훅은 직접 커밋하지 않습니다.`;
  return repeated
    ? { systemMessage: `작업 기록 자동 점검 미완료: ${instruction} 반복 차단은 중지했으며 원래 기준점은 다음 복구를 위해 보존했습니다.` }
    : { decision: 'block', reason: instruction };
}

export function handleHook(input) {
  const event = input?.hook_event_name;
  if (event !== 'UserPromptSubmit' && event !== 'Stop') return {};
  let root;
  let path;
  let state;
  try {
    if (typeof input.cwd !== 'string' || typeof input.session_id !== 'string' || !input.session_id) {
      throw new Error('cwd와 session_id가 필요합니다.');
    }
    root = realpathSync(git(input.cwd, ['rev-parse', '--show-toplevel']).trim());
    path = statePath(root, input.session_id);
    const saved = readLocalFile(root, path, true);
    state = saved ? JSON.parse(saved.toString('utf8')) : { baseline: null, pending: false, repairs: [] };
    if (event === 'UserPromptSubmit') {
      // steering/자동 재개는 미해결 작업의 시작점을 덮어쓰지 않는다.
      if (!saved) {
        state.baseline = snapshot(root);
        saveState(root, path, state);
      }
      return {};
    }
    if (state.baseline) {
      const current = snapshot(root);
      const changed = current.head !== state.baseline.head || current.source !== state.baseline.source ||
        current.progress.hash !== state.baseline.progress.hash;
      if (changed) {
        const issue = reportIssue(state.baseline.progress, progress(root));
        if (issue) return failure(root, path, state, input, ...issue);
        if (!reportCommitted(root, current)) {
          return failure(root, path, state, input, 'commit', 'PROGRESS.md의 새 기록이 아직 커밋되지 않았습니다.');
        }
      }
    }
    try { render(root); } catch (error) {
      const detail = error.code === 'ETIMEDOUT' ? '30초 제한을 초과했습니다.' :
        typeof error.status === 'number' ? `종료 코드 ${error.status}입니다.` : error.message;
      return failure(root, path, state, input, 'render', `PROGRESS.html 생성에 실패했습니다(${detail}).`);
    }
    if (readLocalFile(root, path, true)) unlinkSync(path);
    return {};
  } catch (error) {
    // 잘못된 입력·파일 권한 오류도 stdout을 JSON 하나로 유지한다.
    return { systemMessage: `작업 기록 훅을 완료하지 못했습니다: ${error.message}. 기존 작업 기록을 보존하고 훅 설정을 확인하세요.` };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try { result = handleHook(JSON.parse(readFileSync(0, 'utf8'))); }
  catch (error) { result = { systemMessage: `작업 기록 훅 입력을 읽지 못했습니다: ${error.message}` }; }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
