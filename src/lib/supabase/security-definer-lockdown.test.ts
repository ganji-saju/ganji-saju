// SECURITY DEFINER 함수는 소유자(postgres) 권한으로 돈다. Supabase 는 새 함수에 anon·authenticated EXECUTE 를 기본으로 주므로
// 닫지 않으면 공개 anon 키로 POST /rest/v1/rpc/<함수> 를 누구나 부른다.
// 2026-09-12 get_advisors: 전 지급(add_credits)·결제 확정·잔액 차감 함수가 열려 있었다 → 083 에서 닫음. 이 가드가 재발을 막는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations');

/** 의도적으로 공개하는 것만. 새로 넣으려면 왜 anon 이 불러도 안전한지 한 줄을 같이 적어라. */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  search_classic_evidence: '공개 고전 원문 검색(읽기 전용) — 서비스 키 없는 환경의 anon 폴백',
  handle_new_user: 'auth.users 가입 트리거 — RPC 로 직접 부르면 오류(악용 불가)',
};

function readMigrations() {
  return fs
    .readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => fs.readFileSync(path.join(MIGRATIONS, name), 'utf8'));
}

test('SECURITY DEFINER 함수는 전부 anon 실행 권한을 닫는다(의도적 공개 목록 제외)', () => {
  const sql = readMigrations().join('\n');
  const definers = new Set<string>();
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?\s*\([\s\S]*?\)\s*returns([\s\S]*?)(?:\$\$|\$function\$)/gi)) {
    if (/security\s+definer/i.test(m[2])) definers.add(m[1]);
  }
  const closed = new Set<string>();
  for (const m of sql.matchAll(/revoke\s+(?:all|execute)[^;]*?on\s+function\s+(?:public\.)?(\w+)[^;]*?from\s+([^;]+);/gi)) {
    if (/\banon\b/i.test(m[2])) closed.add(m[1]);
  }
  assert.ok(definers.size >= 10, `SECURITY DEFINER 함수를 못 찾았다(${definers.size}) — 정규식이 낡았으면 이 가드를 다시 써라`);
  const open = [...definers].filter((name) => !closed.has(name) && !(name in PUBLIC_BY_DESIGN)).sort();
  assert.deepEqual(open, [], `anon 이 부를 수 있는 SECURITY DEFINER 함수: ${open.join(', ')} — revoke execute ... from public, anon, authenticated`);
});
