-- =============================================================================
-- 테스트 결제 초기화 스크립트 (토스 test → live 전환 전)
-- 작성: 2026-06-08 / 대상 프로젝트: bgtzkjxihlbmxehmhtwg (ganji-saju prod)
-- 실행: Supabase 대시보드 SQL Editor 에서 트랜잭션째 실행 (service role)
--
-- 목표: 모든 테스트 결제/구매/코인/구독 데이터를 깨끗이 비우되,
--       LLM 캐시·사주결과는 보존하여 정식 전환 후 같은 입력은 캐시 그대로 재사용
--       (= OpenAI 재호출/재과금 0).
--
-- ── LLM 비용 전수 감사 결과 (왜 이 목록이 안전한가) ───────────────────────────
--   [Type A · content-addressed 캐시] 생년월일·시·지역·성별 등 입력 해시 키.
--     사용자/사주결과/결제와 FK 연결 전혀 없음 → 무엇을 지워도 보존(테이블만 안 비우면).
--       ai_compatibility_interpretations  (궁합 깊은 풀이)
--       ai_lifetime_interpretations       (평생 리포트)
--       ai_total_review_interpretations   (총평)
--       ai_ohaeng_guidance_interpretations(오행 가이드)
--   [Type B · reading_id 결합 캐시] readings(id) 에 ON DELETE CASCADE.
--       ai_interpretations                (사주 본풀이)
--       ai_yearly_interpretations         (연간)
--     → readings 를 보존하면 그대로 유지. (이 스크립트는 readings 를 건드리지 않음)
--   [오늘 프리미엄] 별도 캐시 없음. LLM narrative 가 today_fortune_result_snapshots
--       .premium_result_json 에 저장. 결제 삭제 시 SET NULL 로 스냅샷 보존(=재호출 없음).
--   [타로·꿈] LLM 호출 자체가 없음(결정론) → 비용 무관.
--   [paid_reading_snapshots] product_entitlements 삭제 시 CASCADE 로 함께 삭제되나,
--       내용은 위 Type A 캐시에서 재조립되므로 재구매 시에도 OpenAI 재호출 없음.
--
-- ── 절대 건드리지 않는 보존 대상 (LLM 비용/콘텐츠) ───────────────────────────
--   readings, ai_interpretations, ai_yearly_interpretations,
--   ai_compatibility_interpretations, ai_lifetime_interpretations,
--   ai_total_review_interpretations, ai_ohaeng_guidance_interpretations,
--   today_fortune_result_snapshots, personality/saju_personality_reports,
--   profiles, family_profiles, classic_* (참조 코퍼스)
--
-- ⚠️ 주의: prompt_version 을 바꿔 배포하면 Type A 캐시도 cache_key 가 달라져 미스됩니다.
--          데이터만 정리하고 프롬프트 버전을 유지하면 캐시 유효.
-- ⚠️ 토스 test→live 전환은 이 SQL 과 별개: 환경변수 NEXT_PUBLIC_TOSS_CLIENT_KEY /
--    TOSS_SECRET_KEY 를 live_ 키로 교체 후 재배포해야 합니다.
-- =============================================================================


-- ── STEP 0. 사전 미리보기 (먼저 단독 실행해 삭제 규모 확인) ────────────────────
SELECT 'payment_orders'            AS tbl, count(*) FROM payment_orders
UNION ALL SELECT 'product_entitlements',     count(*) FROM product_entitlements
UNION ALL SELECT 'paid_reading_snapshots',   count(*) FROM paid_reading_snapshots
UNION ALL SELECT 'credit_transactions',      count(*) FROM credit_transactions
UNION ALL SELECT 'credit_lots',              count(*) FROM credit_lots
UNION ALL SELECT 'user_credits',             count(*) FROM user_credits
UNION ALL SELECT 'subscriptions',            count(*) FROM subscriptions
UNION ALL SELECT 'refund_requests',          count(*) FROM refund_requests
UNION ALL SELECT 'payment_webhook_events',   count(*) FROM payment_webhook_events
UNION ALL SELECT 'processed_credit_payments',count(*) FROM processed_credit_payments
UNION ALL SELECT 'payment_funnel_events',    count(*) FROM payment_funnel_events
-- 보존 확인용(0 이 아니어야 정상, 삭제 대상 아님):
UNION ALL SELECT '[keep] readings',          count(*) FROM readings
UNION ALL SELECT '[keep] ai_compatibility',  count(*) FROM ai_compatibility_interpretations
UNION ALL SELECT '[keep] ai_lifetime',       count(*) FROM ai_lifetime_interpretations
UNION ALL SELECT '[keep] ai_total_review',   count(*) FROM ai_total_review_interpretations
UNION ALL SELECT '[keep] ai_interpretations',count(*) FROM ai_interpretations
UNION ALL SELECT '[keep] ai_yearly',         count(*) FROM ai_yearly_interpretations
UNION ALL SELECT '[keep] today_fortune_snap',count(*) FROM today_fortune_result_snapshots;


-- ── STEP 1. 초기화 트랜잭션 (위 미리보기 확인 후 통째로 실행) ──────────────────
BEGIN;

-- 자식(참조) 테이블 먼저 → 부모 순. 재무/구매 데이터만.
DELETE FROM refund_requests;            -- credit_transactions(SET NULL) 자식
DELETE FROM paid_reading_snapshots;     -- product_entitlements(CASCADE)/readings(SET NULL) 자식
DELETE FROM payment_webhook_events;     -- 토스 웹훅 로그
DELETE FROM processed_credit_payments;  -- 멱등 처리 기록
DELETE FROM payment_funnel_events;      -- 퍼널 이벤트

DELETE FROM product_entitlements;       -- 이용권 (today_fortune_snap.entitlement_id → SET NULL 자동)
DELETE FROM credit_transactions;        -- 코인 원장
DELETE FROM credit_lots;                -- 코인 로트
DELETE FROM user_credits;               -- 코인 잔액
DELETE FROM subscriptions;              -- 멤버십 구독
DELETE FROM payment_orders;             -- 주문 (today_fortune_snap.payment_order_id → SET NULL 자동)

-- ── STEP 1b. (선택) 정식 런칭용 텔레메트리 리셋 ──
--   ai_llm_runs 는 비용집계 로그일 뿐 캐시 아님. live 비용을 0부터 보려면 주석 해제.
-- DELETE FROM ai_llm_runs;

COMMIT;


-- ── STEP 2. 사후 검증 (모두 0 이면 결제 데이터 초기화 완료, keep 은 그대로) ──────
SELECT 'payment_orders'            AS tbl, count(*) FROM payment_orders
UNION ALL SELECT 'product_entitlements',     count(*) FROM product_entitlements
UNION ALL SELECT 'paid_reading_snapshots',   count(*) FROM paid_reading_snapshots
UNION ALL SELECT 'credit_transactions',      count(*) FROM credit_transactions
UNION ALL SELECT 'user_credits',             count(*) FROM user_credits
UNION ALL SELECT 'subscriptions',            count(*) FROM subscriptions
UNION ALL SELECT '[keep] ai_compatibility',  count(*) FROM ai_compatibility_interpretations
UNION ALL SELECT '[keep] ai_lifetime',       count(*) FROM ai_lifetime_interpretations
UNION ALL SELECT '[keep] ai_total_review',   count(*) FROM ai_total_review_interpretations
UNION ALL SELECT '[keep] today_fortune_snap',count(*) FROM today_fortune_result_snapshots
UNION ALL SELECT '[keep] readings',          count(*) FROM readings;


-- =============================================================================
-- (선택) TIER 2 — 사용자 생성물까지 완전 클린 슬레이트로 지우려는 경우만.
--   ⚠️ readings 를 지우면 ai_interpretations(본풀이)·ai_yearly(연간) 가 CASCADE 로
--      함께 삭제됩니다. 같은 생년월일로 사주를 다시 만들면 새 reading_id 라 캐시 미스
--      → 본풀이·연간만 LLM 재호출(소량). Type A 캐시(궁합/평생/총평/오행)는 여전히 보존.
--   ⚠️ 정말 필요할 때만. 기본 권장은 위 STEP 1 까지(readings 보존).
-- BEGIN;
--   DELETE FROM today_fortune_result_snapshots;  -- 오늘 프리미엄 LLM 콘텐츠도 버림(재호출 가능)
--   DELETE FROM fortune_feedback;
--   DELETE FROM report_feedback;
--   DELETE FROM chapter_feedback;
--   DELETE FROM today_fortune_feedback;
--   DELETE FROM reviews;
--   DELETE FROM star_sign_favorites;
--   DELETE FROM compatibility_personality_reports;
--   DELETE FROM saju_personality_reports;
--   DELETE FROM personality_profiles;
--   DELETE FROM family_profiles;
--   DELETE FROM readings;   -- ← ai_interpretations · ai_yearly CASCADE 삭제 지점
-- COMMIT;
-- =============================================================================
