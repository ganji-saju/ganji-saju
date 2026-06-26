-- ============================================================================
-- 간지사주 데이터 초기화 (실운영 전) — 2026-06-26
-- ============================================================================
-- 유지: 가입/로그인(auth.users·profiles), 관리자(admin_*), 콘텐츠(classic_*),
--       약관(policy_versions)·동의기록(user_policy_consents), 알림설정
--       (notification_preferences·push_subscriptions), 가중치(sinsal_weight_versions).
-- 초기화: 결제·코인·구독·권한·풀이·AI·결과스냅샷·피드백·예약·리뷰 등 이용 데이터 일체.
--
-- ⚠️ 복구 불가. 실행 전 반드시 백업:
--    Supabase 대시보드 → Database → Backups (수동 백업) 또는 `pg_dump`.
-- ⚠️ 외부 PG(나이스페이/토스) 실제 결제는 DB와 별개다. 이 SQL은 DB 기록만 지운다.
--    테스트 결제 환불이 필요하면 PG 콘솔에서 별도로 취소할 것.
-- ⚠️ 실행 위치: Supabase 대시보드 SQL Editor (service_role 권한). 트랜잭션으로 감쌌다.
--
-- CASCADE 안전성: 유지 대상(profiles·notification_*·push_subscriptions·
--   user_policy_consents)은 auth.users/policy_versions/classic_* 만 참조하므로
--   아래 초기화 대상 TRUNCATE CASCADE 에 걸리지 않는다(검증 쿼리로 재확인).
-- ============================================================================

-- (선택) 초기화 전 현황 — 실행해서 숫자 메모해두면 사후 대조에 좋다.
-- SELECT 'profiles' t, count(*) n FROM profiles
-- UNION ALL SELECT 'payment_orders', count(*) FROM payment_orders
-- UNION ALL SELECT 'user_credits', count(*) FROM user_credits
-- UNION ALL SELECT 'readings', count(*) FROM readings
-- UNION ALL SELECT 'subscriptions', count(*) FROM subscriptions;

BEGIN;

TRUNCATE TABLE
  -- 결제
  payment_webhook_events,
  payment_funnel_events,
  processed_credit_payments,
  refund_requests,
  payment_orders,
  -- 코인 (잔액·적립·거래)
  credit_transactions,
  credit_lots,
  user_credits,
  -- 구독·구매권한
  subscriptions,
  product_entitlements,
  -- AI 풀이
  ai_compatibility_interpretations,
  ai_interpretations,
  ai_lifetime_interpretations,
  ai_llm_runs,
  ai_ohaeng_guidance_interpretations,
  ai_total_review_interpretations,
  ai_yearly_interpretations,
  -- 풀이·대화·결과 스냅샷
  readings,
  dialogue_messages,
  today_fortune_ai,
  today_fortune_result_snapshots,
  today_fortune_feedback,
  tarot_result_snapshots,
  paid_reading_snapshots,
  -- 기타 이용 데이터
  appointments,
  reviews,
  fortune_feedback,
  chapter_feedback,
  dream_search_misses,
  star_sign_favorites,
  family_profiles
RESTART IDENTITY CASCADE;

COMMIT;

-- ============================================================================
-- 사후 검증 — 유지 대상은 그대로(>0), 초기화 대상은 0 이어야 한다.
-- ============================================================================
-- SELECT 'profiles(유지)' t, count(*) n FROM profiles
-- UNION ALL SELECT 'admin_users(유지)', count(*) FROM admin_users
-- UNION ALL SELECT 'classic_works(유지)', count(*) FROM classic_works
-- UNION ALL SELECT 'policy_versions(유지)', count(*) FROM policy_versions
-- UNION ALL SELECT 'payment_orders(0)', count(*) FROM payment_orders
-- UNION ALL SELECT 'user_credits(0)', count(*) FROM user_credits
-- UNION ALL SELECT 'subscriptions(0)', count(*) FROM subscriptions
-- UNION ALL SELECT 'product_entitlements(0)', count(*) FROM product_entitlements
-- UNION ALL SELECT 'readings(0)', count(*) FROM readings;
