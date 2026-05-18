// 2026-05-18 Phase 7b — userId 공개 노출용 hash.
// 같은 user 의 후기를 client 에서 그룹핑할 수 있게 stable hash 를 만들되 raw user_id 는 노출하지 않는다.
//
// 단방향 hash (SHA-256 truncated) + salt. salt 는 env 미설정 시 호스트네임 기반 default.
import { createHash } from 'crypto';

const SALT = process.env.REVIEW_USER_HASH_SALT?.trim() || 'ganji-saju-review-hash-v1';

export function hashUserIdForReview(userId: string): string {
  const hash = createHash('sha256');
  hash.update(`${SALT}:${userId}`);
  return hash.digest('hex').slice(0, 12);
}
