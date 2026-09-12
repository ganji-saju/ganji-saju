-- 084_security_advisor_cleanup.sql — 083 뒤 남은 Supabase 보안 권고(get_advisors, 2026-09-12) 정리.
--
-- ⚠️ 프로덕션 적용은 사용자 확인 후(SQL Editor). 동작 변화 없음 — 아래 근거.

-- 1) function_search_path_mutable(22개): search_path 를 고정한다.
--    SECURITY DEFINER 함수는 호출자의 search_path 를 따르면 같은 이름의 객체(임시 테이블 등)로 가로채일 수 있다.
--    22개 모두 확장(extensions) 함수를 쓰지 않아(pg_proc 확인) public 만으로 기존 해석과 같다 — 056·081 과 같은 값.
--    pg_temp 를 맨 끝에 명시해 임시 스키마가 먼저 검색되는 것도 막는다.
--    finalize_payment 은 마이그레이션 밖에서 만들어졌고, 이름으로 찾아 있는 것만 바꾼다(새 DB 에서도 실패하지 않게).
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'add_credit_lot', 'add_credits', 'claim_payment_order_fulfillment', 'consume_credit_lots', 'deduct_credits',
        'finalize_payment', 'mark_payment_order_reconciliation_attempt', 'sync_credit_balance_from_lots',
        'unlock_credit_feature_once', 'metrics_daily_source', 'payment_order_totals', 'set_payment_orders_updated_at',
        'set_reviews_updated_at', 'set_tarot_result_snapshots_updated_at', 'set_today_fortune_result_snapshots_updated_at',
        'site_visit_daily_counts', 'site_visit_page_counts', 'site_visit_unique_counts', 'touch_user_contact_updated_at',
        'track_site_visit_page', 'track_site_visit_pageview', 'update_chapter_feedback_updated_at'
      ])
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn);
  end loop;
end
$$;

-- 2) security_definer_view: v_classic_evidence_flat 를 호출자 권한으로.
--    앱은 이 뷰를 직접 읽지 않는다 — search_classic_evidence(SECURITY DEFINER, 소유자 postgres = BYPASSRLS)가 안에서 읽으므로
--    호출자 권한 뷰여도 검색은 그대로 된다. 직접 조회는 막는다(원본 classic_* 는 RLS 정책 없음 = service 전용).
alter view if exists public.v_classic_evidence_flat set (security_invoker = true);
do $$
begin
  if to_regclass('public.v_classic_evidence_flat') is not null then
    revoke select on public.v_classic_evidence_flat from anon, authenticated;
  end if;
end
$$;

notify pgrst, 'reload schema';
