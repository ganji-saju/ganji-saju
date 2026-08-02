// 2026-08-03 — 카카오 친구추가 무료쿠폰(오늘 자세히보기 0원) 발급/사용 현황 집계.
//   기능은 라이브(PR #659·660·661·663). user_coupons 는 RLS 로 본인행만 select 가능하므로
//   집계는 반드시 service_role(RLS 우회)로 한다 — llm-cost-stats / dashboard-summary 패턴 미러.
//   카드는 super_admin 게이트로만 노출한다(page.tsx).
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { KAKAO_FRIEND_COUPON_TYPE } from '@/lib/coupons/kakao-friend-coupon';

/** 최근 발급/사용 목록 1건(super_admin 표시용). user_id 는 상세로 링크. */
export interface CouponRecentEntry {
  id: string;
  userId: string;
  statusKey: 'redeemed' | 'active' | 'expired';
  statusLabel: string;
  issuedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
}

export interface KakaoFriendCouponStats {
  /** 발급수(발급된 전체 행 = 계정당 1행). */
  total: number;
  /** 사용수(status='redeemed'). */
  redeemed: number;
  /** 미사용·유효(status='issued' AND now<=expires_at). */
  active: number;
  /** 만료수(status='issued' AND now>expires_at). */
  expired: number;
  /** 사용률(redeemed/total). 발급 0건이면 null(분모 없음 → '—'). */
  redeemRate: number | null;
  /** 최근 발급 순 목록(super_admin 표시용). */
  recent: CouponRecentEntry[];
}

// 순수 판정 — 표시용 상태 라벨. couponAvailability 와 같은 semantics(redeemed/유효/만료)를
//   '사용/유효/만료' 3분류로 압축한다(미발급 issuable 은 행이 없으므로 여기서 다루지 않음).
export function couponRecentStatus(
  status: 'issued' | 'redeemed',
  expiresAt: string,
  now: Date = new Date()
): { key: 'redeemed' | 'active' | 'expired'; label: string } {
  if (status === 'redeemed') return { key: 'redeemed', label: '사용' };
  if (now.getTime() >= new Date(expiresAt).getTime()) return { key: 'expired', label: '만료' };
  return { key: 'active', label: '유효' };
}

// 순수 — 사용률. 분모(발급) 0 이면 null(0%로 오표시 방지, dashboard-summary fmtPct 규칙과 정합).
export function couponRedeemRate(redeemed: number, total: number): number | null {
  if (total <= 0) return null;
  return redeemed / total;
}

/**
 * 카카오 친구추가 무료쿠폰 현황 집계(service_role). env 부재 시 null(카드 폴백).
 * 발급/사용/만료 카운트 + 최근 목록. total = redeemed + active + expired 불변식.
 */
export async function getKakaoFriendCouponStats(
  now: Date = new Date()
): Promise<KakaoFriendCouponStats | null> {
  if (!hasSupabaseServiceEnv) return null;

  try {
    const supabase = await createServiceClient();
    const nowIso = now.toISOString();
    // count 쿼리 공통(head:true = 행 미전송, count 만). type 은 항상 고정 필터.
    const countByType = () =>
      supabase
        .from('user_coupons')
        .select('id', { count: 'exact', head: true })
        .eq('type', KAKAO_FRIEND_COUPON_TYPE);

    const [totalRes, redeemedRes, activeRes, expiredRes, recentRes] = await Promise.all([
      countByType(),
      countByType().eq('status', 'redeemed'),
      countByType().eq('status', 'issued').gte('expires_at', nowIso),
      countByType().eq('status', 'issued').lt('expires_at', nowIso),
      supabase
        .from('user_coupons')
        .select('id, user_id, status, issued_at, redeemed_at, expires_at')
        .eq('type', KAKAO_FRIEND_COUPON_TYPE)
        .order('issued_at', { ascending: false })
        .limit(8),
    ]);

    const total = totalRes.count ?? 0;
    const redeemed = redeemedRes.count ?? 0;

    const recent: CouponRecentEntry[] = (recentRes.data ?? []).map((row) => {
      const r = row as {
        id: string;
        user_id: string;
        status: 'issued' | 'redeemed';
        issued_at: string;
        redeemed_at: string | null;
        expires_at: string;
      };
      const s = couponRecentStatus(r.status, r.expires_at, now);
      return {
        id: r.id,
        userId: r.user_id,
        statusKey: s.key,
        statusLabel: s.label,
        issuedAt: r.issued_at,
        redeemedAt: r.redeemed_at,
        expiresAt: r.expires_at,
      };
    });

    return {
      total,
      redeemed,
      active: activeRes.count ?? 0,
      expired: expiredRes.count ?? 0,
      redeemRate: couponRedeemRate(redeemed, total),
      recent,
    };
  } catch (e) {
    console.error('[admin-coupon-stats] kakao friend coupon stats failed:', e);
    return null;
  }
}
