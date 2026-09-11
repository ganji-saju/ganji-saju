// readings SELECT 정책이 비로그인 행(user_id IS NULL)을 공개하지 않는지 고정한다.
// 001 이 `auth.uid() = user_id OR user_id IS NULL` 로 비로그인·탈퇴자 사주를 anon 키에 열어 두었다(082 에서 닫음).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations');

test('readings 의 마지막 SELECT 정책은 본인 행만 연다(user_id IS NULL 공개 금지)', () => {
  const defs = fs
    .readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .flatMap((name) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS, name), 'utf8');
      return [...sql.matchAll(/create\s+policy\s+"[^"]+"\s+on\s+(?:public\.)?readings\s+for\s+select\s+using\s*\(([^;]*)\)\s*;/gi)].map(
        (m) => ({ name, using: m[1] })
      );
    });
  const last = defs.at(-1);
  assert.ok(last, 'readings SELECT 정책을 찾지 못했다 — 정규식이 낡았으면 이 가드를 다시 써라');
  assert.ok(!/user_id\s+is\s+null/i.test(last.using), `${last.name}: ${last.using}`);
});
