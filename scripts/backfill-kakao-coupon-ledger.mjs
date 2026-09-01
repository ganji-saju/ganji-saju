// 2026-09-01 — 075 원장 백필. 이미 발급된 user_coupons 의 카카오 회원번호를 해시해
//   kakao_coupon_issue_ledger 에 옮긴다. 이걸 안 하면 **기존 발급자**는 탈퇴/재가입으로
//   한 번 더 받을 수 있다(원장이 비어 있으므로).
//
// 실행: NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co node scripts/backfill-kakao-coupon-ledger.mjs [--apply]
//   --apply 없이 돌리면 무엇이 들어갈지만 출력한다(기본 dry-run).
import { createHash } from 'node:crypto';
import { loadLocalEnv, createSupabaseServiceClient } from './lib/classics/upsert-classic-corpus.mjs';

const APPLY = process.argv.includes('--apply');
const TYPE = 'kakao_friend_today_detail';

loadLocalEnv(process.cwd());
const db = createSupabaseServiceClient();

const { data, error } = await db
  .from('user_coupons')
  .select('verified_kakao_uid, type, issued_at')
  .eq('type', TYPE);
if (error) {
  console.error('user_coupons 조회 실패:', error.message);
  process.exit(1);
}

const rows = (data ?? [])
  .filter((r) => r.verified_kakao_uid)
  .map((r) => ({
    kakao_uid_hash: createHash('sha256').update(r.verified_kakao_uid).digest('hex'),
    type: r.type,
    issued_at: r.issued_at,
  }));

console.log(`발급 행 ${data?.length ?? 0}건 중 회원번호 있는 것 ${rows.length}건`);
for (const r of rows) console.log(`  ${r.kakao_uid_hash.slice(0, 12)}… / ${r.issued_at}`);

if (!APPLY) {
  console.log('\n(dry-run) 실제로 넣으려면 --apply 를 붙여 다시 실행하세요.');
  process.exit(0);
}

const { error: insErr } = await db
  .from('kakao_coupon_issue_ledger')
  .upsert(rows, { onConflict: 'kakao_uid_hash,type', ignoreDuplicates: true });
if (insErr) {
  console.error('원장 삽입 실패:', insErr.message);
  process.exit(1);
}
console.log(`\n원장에 ${rows.length}건 반영 완료.`);
