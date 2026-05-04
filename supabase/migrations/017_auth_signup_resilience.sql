-- 신규 가입 보너스 지급 트리거가 실패해도 auth.users 생성 자체는 막지 않습니다.
-- 소셜 로그인은 auth.users INSERT 중 트리거 예외가 나면
-- "Database error saving new user"로 중단되므로, 보너스 지급은 best-effort로 처리합니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, subscription_balance, updated_at)
  VALUES (NEW.id, 3, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount, type, feature, metadata)
  VALUES (
    NEW.id,
    3,
    'signup_bonus',
    'signup_bonus',
    jsonb_build_object('kind', 'signup_bonus', 'source', 'auth_user_created')
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user skipped for user %, SQLSTATE %, error %', NEW.id, SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
