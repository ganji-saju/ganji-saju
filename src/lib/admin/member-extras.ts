// src/lib/admin/member-extras.ts
// 상세 누락 카테고리 요약(가족·피드백·후기·예약·알림·동의). service_role, 카운트 위주.
//
// 검증된 테이블·컬럼 (마이그레이션 기준):
//   003_profiles.sql           → family_profiles.user_id ✓
//   013_fortune_feedback.sql   → fortune_feedback.user_id ✓ (nullable ON DELETE SET NULL)
//   023_today_fortune_feedback → today_fortune_feedback.user_id ✓
//   035_chapter_feedback.sql   → chapter_feedback.user_id ✓, .rating ✓
//   033_reviews.sql            → reviews.user_id ✓, .rating ✓, .is_verified_purchase ✓
//   021_appointments.sql       → appointments.user_id ✓, .status ✓
//   004_notifications.sql      → push_subscriptions.user_id ✓, .is_active ✓
//                              → notification_preferences.user_id ✓, .last_seen_at ✓
//                              → notification_delivery_logs.user_id ✓ (nullable ON DELETE SET NULL)
//   026_notification_log_variant → notification_delivery_logs.clicked_at ✓
//   027_star_sign_favorites.sql → star_sign_favorites.user_id ✓
//   031_policy_versions.sql    → user_policy_consents.user_id ✓, .consent_method ✓, .consented_at ✓
//                              → policy_versions.requires_reconsent ✓
//
// needsReconsent: JOIN to policy_versions.requires_reconsent 은 1차 미구현.
//   현재는 false 고정. 2차(M4)에서 JOIN 추가 예정.

import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export interface MemberExtras {
  familyCount: number;
  feedback: {
    todayCount: number;
    accuracyCount: number;
    chapterCount: number;
    avgChapterRating: number | null;
  };
  reviews: {
    count: number;
    avgRating: number | null;
    verifiedCount: number;
  };
  appointments: {
    total: number;
    byStatus: Record<string, number>;
  };
  notifications: {
    activeDevices: number;
    lastSeenAt: string | null;
    deliveries: number;
    clicks: number;
    follows: number;
  };
  consent: {
    latestMethod: string | null;
    latestAt: string | null;
    needsReconsent: boolean;
  };
}

export const EMPTY_MEMBER_EXTRAS: MemberExtras = {
  familyCount: 0,
  feedback: { todayCount: 0, accuracyCount: 0, chapterCount: 0, avgChapterRating: null },
  reviews: { count: 0, avgRating: null, verifiedCount: 0 },
  appointments: { total: 0, byStatus: {} },
  notifications: { activeDevices: 0, lastSeenAt: null, deliveries: 0, clicks: 0, follows: 0 },
  consent: { latestMethod: null, latestAt: null, needsReconsent: false },
};

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

/** user_id 컬럼이 있는 테이블의 행 수를 HEAD 쿼리로 반환. */
async function headCount(service: Svc, table: string, userId: string): Promise<number> {
  const { count } = await service
    .from(table)
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

export async function getMemberExtras(userId: string): Promise<MemberExtras> {
  if (!hasSupabaseServiceEnv) return EMPTY_MEMBER_EXTRAS;
  const service = await createServiceClient();

  // ── 가족 프로필 ───────────────────────────────────────────────────────────────
  // 003_profiles.sql: family_profiles(user_id) ✓
  const familyCount = await headCount(service, 'family_profiles', userId);

  // ── 피드백 ───────────────────────────────────────────────────────────────────
  // 023_today_fortune_feedback.sql: today_fortune_feedback(user_id) ✓
  const todayCount = await headCount(service, 'today_fortune_feedback', userId);
  // 013_fortune_feedback.sql: fortune_feedback(user_id) ✓ (nullable — SET NULL 이지만 eq 필터는 동작)
  const accuracyCount = await headCount(service, 'fortune_feedback', userId);
  // 035_chapter_feedback.sql: chapter_feedback(user_id, rating) ✓
  const { data: chapterRows } = await service
    .from('chapter_feedback')
    .select('rating')
    .eq('user_id', userId);
  const chapterRatings = (chapterRows ?? [])
    .map((r) => (r as { rating: number | null }).rating)
    .filter((n): n is number => typeof n === 'number');
  const avgChapterRating =
    chapterRatings.length
      ? Math.round(
          (chapterRatings.reduce((sum, n) => sum + n, 0) / chapterRatings.length) * 10
        ) / 10
      : null;

  // ── 후기 ─────────────────────────────────────────────────────────────────────
  // 033_reviews.sql: reviews(user_id, rating, is_verified_purchase) ✓
  const { data: reviewRows } = await service
    .from('reviews')
    .select('rating, is_verified_purchase')
    .eq('user_id', userId);
  const rv = (reviewRows ?? []) as Array<{
    rating: number | null;
    is_verified_purchase: boolean | null;
  }>;
  const reviewRatings = rv
    .map((r) => r.rating)
    .filter((n): n is number => typeof n === 'number');
  const reviews = {
    count: rv.length,
    avgRating:
      reviewRatings.length
        ? Math.round(
            (reviewRatings.reduce((sum, n) => sum + n, 0) / reviewRatings.length) * 10
          ) / 10
        : null,
    verifiedCount: rv.filter((r) => r.is_verified_purchase === true).length,
  };

  // ── 예약 ─────────────────────────────────────────────────────────────────────
  // 021_appointments.sql: appointments(user_id, status) ✓
  const { data: apptRows } = await service
    .from('appointments')
    .select('status')
    .eq('user_id', userId);
  const byStatus: Record<string, number> = {};
  for (const a of (apptRows ?? []) as Array<{ status: string }>) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  }
  const appointments = { total: (apptRows ?? []).length, byStatus };

  // ── 알림 ─────────────────────────────────────────────────────────────────────
  // 004_notifications.sql: push_subscriptions(user_id, is_active) ✓
  const { count: activeDevices } = await service
    .from('push_subscriptions')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  // 004_notifications.sql: notification_preferences(user_id, last_seen_at) ✓
  const { data: prefRow } = await service
    .from('notification_preferences')
    .select('last_seen_at')
    .eq('user_id', userId)
    .maybeSingle();

  // 004_notifications.sql + 026_notification_log_variant.sql:
  //   notification_delivery_logs(user_id, clicked_at) — user_id nullable ON DELETE SET NULL.
  //   eq('user_id', userId) 는 nullable 컬럼에서도 정상 동작 (IS NOT DISTINCT FROM 처리).
  const deliveries = await headCount(service, 'notification_delivery_logs', userId);
  const { count: clicks } = await service
    .from('notification_delivery_logs')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('clicked_at', 'is', null);

  // 027_star_sign_favorites.sql: star_sign_favorites(user_id) ✓
  const follows = await headCount(service, 'star_sign_favorites', userId);

  const notifications = {
    activeDevices: activeDevices ?? 0,
    lastSeenAt: (prefRow as { last_seen_at?: string | null } | null)?.last_seen_at ?? null,
    deliveries,
    clicks: clicks ?? 0,
    follows,
  };

  // ── 동의 ─────────────────────────────────────────────────────────────────────
  // 031_policy_versions.sql: user_policy_consents(user_id, consent_method, consented_at) ✓
  // needsReconsent: policy_versions.requires_reconsent JOIN 은 M4(2차)에서 구현.
  //   현재는 false 고정.
  const { data: consentRows } = await service
    .from('user_policy_consents')
    .select('consent_method, consented_at')
    .eq('user_id', userId)
    .order('consented_at', { ascending: false })
    .limit(1);
  const latest = (consentRows ?? [])[0] as
    | { consent_method?: string; consented_at?: string }
    | undefined;
  const consent = {
    latestMethod: latest?.consent_method ?? null,
    latestAt: latest?.consented_at ?? null,
    needsReconsent: false, // M4: JOIN policy_versions WHERE requires_reconsent=true 예정
  };

  return {
    familyCount,
    feedback: {
      todayCount,
      accuracyCount,
      chapterCount: chapterRatings.length,
      avgChapterRating,
    },
    reviews,
    appointments,
    notifications,
    consent,
  };
}
