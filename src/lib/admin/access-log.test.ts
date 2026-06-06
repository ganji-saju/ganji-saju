// src/lib/admin/access-log.test.ts
import assert from 'node:assert/strict';
import { buildAccessLogInsert } from './access-log';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('buildAccessLogInsert: 필수 필드 매핑', () => {
  const ins = buildAccessLogInsert({
    actorId: 'a-1',
    actorRole: 'super_admin',
    action: 'export_csv',
    targetUser: null,
    reason: null,
    meta: { rowCount: 120, pii: true },
  });
  assert.equal(ins.actor_id, 'a-1');
  assert.equal(ins.actor_role, 'super_admin');
  assert.equal(ins.action, 'export_csv');
  assert.equal(ins.target_user, null);
  assert.deepEqual(ins.meta, { rowCount: 120, pii: true });
});

test('buildAccessLogInsert: meta 미지정 시 빈 객체', () => {
  const ins = buildAccessLogInsert({ actorId: 'a', actorRole: 'admin', action: 'view_detail', targetUser: 'u' });
  assert.deepEqual(ins.meta, {});
  assert.equal(ins.reason ?? null, null);
});
