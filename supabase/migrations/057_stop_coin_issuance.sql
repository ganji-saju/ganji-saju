-- 057_stop_coin_issuance.sql
-- 날짜: 2026-06-30
-- 목적: 코인 sunset — 신규 가입 보너스 코인 지급 중단(handle_new_user 재정의).
--       무료 체험은 대화 무료 3턴(코드 상수, 코인 불필요)으로 대체.
--
-- 변경 내역:
--   - 제거: PERFORM add_credit_lot(NEW.id, 3, ...) — 가입 보너스 lot 적립
--   - 제거: INSERT INTO credit_transactions (..., 'signup_bonus', ...) — 보너스 감사 로그
--   - 보존: EXCEPTION 블록(017에서 도입한 non-blocking auth-resilience)
--   - 보존: RETURNS TRIGGER / SECURITY DEFINER / SET search_path
--   - 보존: 트리거 자체(on_auth_user_created) — 변경 불필요
--   - 추가: INSERT INTO user_credits (balance 0) — 보너스 코인/credit_transactions 제거하되
--           user_credits 행은 잔액 0으로 생성(불변식 유지). ON CONFLICT DO NOTHING으로 안전.
--
-- ⚠️ 프로덕션 적용: 배포 체크리스트에 따라 수동으로 `supabase db push` 실행.
--    이 파일만 커밋; 원격 DB 자동 적용 안 함.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 코인 보너스 제거(057). 단, user_credits 행 불변식은 유지(잔액 0으로 생성).
  INSERT INTO public.user_credits (user_id, balance, subscription_balance)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user skipped for user %, SQLSTATE %, error %', NEW.id, SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$;
