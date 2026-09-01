import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';

export const KAKAO_FRIEND_COUPON_TYPE = 'kakao_friend_today_detail';
export const COUPON_EXPIRY_DAYS = 7;

export type CouponStatus = 'issued' | 'redeemed';

export interface UserCouponRow {
  id: string;
  user_id: string;
  type: string;
  status: CouponStatus;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redemption_reading_key: string | null;
  entitlement_id: string | null;
  verified_kakao_uid: string | null;
}

// 휴면 게이트. 미설정/'0' → OFF. '1' → ON. (isTodayFortuneLlmEnabled 컨벤션)
export function isKakaoFriendCouponEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.KAKAO_FRIEND_COUPON_ENABLED?.trim() === '1';
}

// 순수 판정 — row 상태 + 만료시각을 now 기준으로 4상태 중 하나로 분류.
//   null(미발급)=issuable, issued+미만료=redeemable, issued+만료=expired, redeemed=redeemed.
// redeem API(Task 3)가 이 판정으로 사용 가능 여부를 먼저 게이트한다.
export function couponAvailability(
  row: UserCouponRow | null,
  now: Date = new Date()
): 'issuable' | 'redeemable' | 'redeemed' | 'expired' {
  if (!row) return 'issuable';
  if (row.status === 'redeemed') return 'redeemed';
  if (now.getTime() >= new Date(row.expires_at).getTime()) return 'expired';
  return 'redeemable';
}

// 사용자의 카카오 친구추가 쿠폰 행 조회(없으면 null). type 은 고정(KAKAO_FRIEND_COUPON_TYPE).
export async function getUserCoupon(userId: string): Promise<UserCouponRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .from('user_coupons')
    .select('*')
    .eq('user_id', userId)
    .eq('type', KAKAO_FRIEND_COUPON_TYPE)
    .maybeSingle();
  return (data as UserCouponRow) ?? null;
}

/**
 * 재발급 차단 원장의 키 — 카카오 회원번호의 SHA-256.
 *
 * 원장(kakao_coupon_issue_ledger, 075)에는 탈퇴 후에도 남으므로 평문을 두지 않는다.
 * ⚠️ 카카오 회원번호는 짧은 숫자라 해시가 완전한 비가역성을 주지는 않는다 — 목적은
 *   "유출돼도 카카오 ID 가 평문으로 나가지 않는다" 까지다.
 */
export function kakaoUidHash(verifiedKakaoUid: string): string {
  return createHash('sha256').update(verifiedKakaoUid).digest('hex');
}

/**
 * 이 카카오 계정이 이미 쿠폰을 받았는지(계정 수명과 무관).
 *
 * 🔴 2026-09-01 — user_coupons 는 auth.users 를 `on delete cascade` 로 참조해서
 *   **회원탈퇴하면 쿠폰 기록이 사라진다**. 같은 카카오로 재가입하면 새 user_id 라
 *   UNIQUE(user_id,type) 가 아무것도 막지 못했고, 탈퇴/재가입만 반복하면 3,300원 상품을
 *   무한히 0원으로 받을 수 있었다. 그래서 계정과 분리된 원장으로 대조한다.
 *
 * uid 가 비면(카카오 /v2/user/me 실패) 대조할 키가 없으므로 false — 우리 쪽 조회 실패로
 *   정상 사용자를 막지 않는다. 대신 호출부가 그 사실을 로그로 남긴다.
 */
export async function hasKakaoAccountReceivedCoupon(verifiedKakaoUid: string): Promise<boolean> {
  if (!verifiedKakaoUid) return false;
  const svc = await createServiceClient();
  const { data, error } = await svc
    .from('kakao_coupon_issue_ledger')
    .select('kakao_uid_hash')
    .eq('kakao_uid_hash', kakaoUidHash(verifiedKakaoUid))
    .eq('type', KAKAO_FRIEND_COUPON_TYPE)
    .maybeSingle();
  // 조회 실패(테이블 미적용 등)는 차단하지 않는다 — 마이그레이션 적용 전에도 앱이 살아야 한다.
  if (error) return false;
  return Boolean(data);
}

/** 발급 사실을 계정과 분리해 기록. 중복 키는 정상(멱등) — 실패해도 발급을 되돌리지 않는다. */
async function recordKakaoCouponIssued(verifiedKakaoUid: string): Promise<void> {
  if (!verifiedKakaoUid) return;
  const svc = await createServiceClient();
  await svc
    .from('kakao_coupon_issue_ledger')
    .insert({ kakao_uid_hash: kakaoUidHash(verifiedKakaoUid), type: KAKAO_FRIEND_COUPON_TYPE })
    .then(undefined, () => undefined);
}

// 카카오 친구추가 검증 후 쿠폰 발급. UNIQUE(user_id,type) 위반 시 멱등하게 기존행을 반환한다
// (동시 요청/재클릭 대비 — 신규 발급처럼 실패시키지 않음).
export async function issueKakaoFriendCoupon(
  userId: string,
  verifiedKakaoUid: string
): Promise<{ ok: true; row: UserCouponRow } | { ok: false; reason: string }> {
  const svc = await createServiceClient();

  // 이 계정에 이미 쿠폰이 있으면 그대로 반환(멱등) — 원장 대조보다 먼저 본다.
  //   원장에 걸리는 건 "탈퇴 후 재가입" 이지 "같은 계정 재클릭" 이 아니다.
  const own = await getUserCoupon(userId);
  if (own) return { ok: true as const, row: own };

  if (await hasKakaoAccountReceivedCoupon(verifiedKakaoUid)) {
    return { ok: false as const, reason: 'already_issued_for_kakao_account' };
  }

  const expiresAt = new Date(Date.now() + COUPON_EXPIRY_DAYS * 864e5).toISOString();
  const { data, error } = await svc
    .from('user_coupons')
    .insert({
      user_id: userId,
      type: KAKAO_FRIEND_COUPON_TYPE,
      status: 'issued',
      expires_at: expiresAt,
      verified_kakao_uid: verifiedKakaoUid,
    })
    .select('*')
    .single();

  if (error) {
    // UNIQUE 위반(23505) = 이미 발급 → 멱등하게 기존행 반환
    const existing = await getUserCoupon(userId);
    if (existing) return { ok: true as const, row: existing };
    return { ok: false as const, reason: 'insert_failed' };
  }

  // 발급이 확정된 뒤에만 원장에 남긴다(먼저 남기면 발급 실패 시 영구 차단된다).
  await recordKakaoCouponIssued(verifiedKakaoUid);
  return { ok: true as const, row: data as UserCouponRow };
}

// redeem API(Task 3)의 순수 가드 — env/인증/가용성 3가지를 우선순위대로 판정한다.
// (env off → 404, 미인증 → 401, availability≠redeemable → 409, 통과 → ok:true).
// 라우트는 이 판정을 마킹(markCouponRedeemed) 이전에 반드시 통과해야 한다.
export function redeemPreconditions(
  enabled: boolean,
  authed: boolean,
  availability: 'issuable' | 'redeemable' | 'redeemed' | 'expired'
): { ok: true } | { ok: false; status: number; error: string } {
  if (!enabled) return { ok: false, status: 404, error: 'disabled' };
  if (!authed) return { ok: false, status: 401, error: 'unauthorized' };
  if (availability !== 'redeemable') return { ok: false, status: 409, error: 'not_redeemable' };
  return { ok: true };
}

// 원자적 사용 마킹: status='issued' 인 행만 redeemed 로 전이(동시성/중복사용 방어).
// 0행 update = 이미 사용됨/만료행이 아님(조건 불일치) = 중복 → false.
// 만료 자체는 redeem API(Task 3)가 couponAvailability 로 사전 차단한다.
export async function markCouponRedeemed(
  userId: string,
  meta: { readingKey: string; entitlementId: string | null }
): Promise<boolean> {
  const svc = await createServiceClient();
  const { data } = await svc
    .from('user_coupons')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      redemption_reading_key: meta.readingKey,
      entitlement_id: meta.entitlementId,
    })
    .eq('user_id', userId)
    .eq('type', KAKAO_FRIEND_COUPON_TYPE)
    .eq('status', 'issued')
    .select('id');
  return Array.isArray(data) && data.length > 0;
}

// 지급 실패 시 되돌림: 방금 redeemed 로 마킹한 쿠폰을 issued 로 복원(재시도 가능).
// readingKey 로 스코프되어 이번 요청의 claim 만 되돌린다(CAS 가드).
export async function rollbackCouponRedeemed(userId: string, readingKey: string): Promise<void> {
  const svc = await createServiceClient();
  await svc.from('user_coupons')
    .update({ status: 'issued', redeemed_at: null, redemption_reading_key: null, entitlement_id: null })
    .eq('user_id', userId).eq('type', KAKAO_FRIEND_COUPON_TYPE).eq('status', 'redeemed')
    .eq('redemption_reading_key', readingKey);
}
