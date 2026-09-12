-- 083_revoke_public_execute_money_rpcs.sql — 돈에 닿는 SECURITY DEFINER 함수를 공개 anon 키로 아무나 부르던 구멍을 닫는다.
--
-- ⚠️ 프로덕션 적용은 사용자 확인 후. 앱 코드 변경 없음 — 앱은 이 함수들을 전부 service 클라이언트로 부른다
--   (src/lib/credits/deduct.ts · refunds.ts · src/lib/payments/order-ledger.ts, 2026-09-12 확인). 순서 무관.
--
-- 🔴 2026-09-12 get_advisors(anon_security_definer_function_executable) + pg_proc 확인:
--   아래 함수는 SECURITY DEFINER(소유자 postgres 권한으로 실행)인데 EXECUTE 가 PUBLIC·anon·authenticated 에 열려 있고
--   본문에 호출자 확인이 없다. 브라우저 번들의 anon 키만 있으면 POST /rest/v1/rpc/<함수> 로
--     add_credits(아무 user_id, 아무 금액) = 전 무한 지급 · unlock_credit_feature_once(p_cost 0) = 유료 기능 무료 개방 ·
--     deduct_credits / revoke_credit_purchase_lots = 남의 잔액 차감 · claim_payment_order_fulfillment / finalize_payment = 결제 상태 조작
--   이 가능했다. 040~047 에서 만들며 권한을 닫지 않았다(056·081 은 닫았다 — 같은 패턴으로 맞춘다).
--   함수끼리의 내부 호출은 소유자(postgres) 권한으로 돌아 영향 없다.
--
-- 그대로 두는 것: search_classic_evidence(공개 고전 원문 검색 — 서비스 키 없는 환경의 anon 폴백이 의도),
--   handle_new_user(auth.users 가입 트리거 — RPC 로 직접 부르면 오류라 악용 불가, 가입 경로를 건드리지 않는다).

revoke execute on function public.add_credit_lot(uuid, integer, timestamp with time zone, text, jsonb) from public, anon, authenticated;
revoke execute on function public.add_credits(uuid, integer, text, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_payment_order_fulfillment(text) from public, anon, authenticated;
revoke execute on function public.consume_credit_lots(uuid, integer) from public, anon, authenticated;
revoke execute on function public.deduct_credits(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.mark_payment_order_reconciliation_attempt(text) from public, anon, authenticated;
revoke execute on function public.revoke_credit_purchase_lots(uuid, text, uuid, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.sync_credit_balance_from_lots(uuid) from public, anon, authenticated;
revoke execute on function public.unlock_credit_feature_once(uuid, text, integer, jsonb) from public, anon, authenticated;

grant execute on function public.add_credit_lot(uuid, integer, timestamp with time zone, text, jsonb) to service_role;
grant execute on function public.add_credits(uuid, integer, text, jsonb) to service_role;
grant execute on function public.claim_payment_order_fulfillment(text) to service_role;
grant execute on function public.consume_credit_lots(uuid, integer) to service_role;
grant execute on function public.deduct_credits(uuid, integer, text) to service_role;
grant execute on function public.mark_payment_order_reconciliation_attempt(text) to service_role;
grant execute on function public.revoke_credit_purchase_lots(uuid, text, uuid, integer, text, uuid) to service_role;
grant execute on function public.sync_credit_balance_from_lots(uuid) to service_role;
grant execute on function public.unlock_credit_feature_once(uuid, text, integer, jsonb) to service_role;

-- finalize_payment 은 마이그레이션 밖(SQL Editor)에서 만들어져 프로덕션에만 있다 — 있을 때만 닫는다(새 DB 에서도 실패하지 않게).
do $$
begin
  if to_regprocedure('public.finalize_payment(jsonb)') is not null then
    execute 'revoke execute on function public.finalize_payment(jsonb) from public, anon, authenticated';
    execute 'grant execute on function public.finalize_payment(jsonb) to service_role';
  end if;
end
$$;

-- 🔴 같은 점검(rls_disabled_in_public): 크롤러 방문 보관 테이블(#635 정리 때 만든 것)이 RLS 없이 anon 에게 읽기·삭제로 열려 있었다
--   (user_id·visitor_hash 포함 ≈2,540행). 정책 없이 RLS 만 켜서 service 전용으로 — 앱은 이 테이블을 읽지 않는다.
alter table if exists public.site_visits_crawler_archive_20260719 enable row level security;

notify pgrst, 'reload schema';
