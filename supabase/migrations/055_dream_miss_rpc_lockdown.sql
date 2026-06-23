-- 2026-06-22 — record_dream_search_miss RPC 권한 잠금.
--   배경: 054 가 REVOKE ... FROM PUBLIC + GRANT TO service_role 만 했으나, Supabase 기본
--   권한이 public 스키마 함수를 anon/authenticated 에 자동 부여 → 익명 사용자가 PostgREST
--   /rpc/record_dream_search_miss 로 직접 호출해 수요 테이블(hit_count)을 오염시킬 수 있었다.
--   (SECURITY DEFINER + 쓰기 전용. SELECT 권한 없어 데이터 노출 0 — 무결성 리스크만.)
--   수요 Top-N 이 Phase 1 키워드 생성 입력이므로 신뢰도를 위해 잠근다.
--   정상 경로(서버 service_role)는 EXECUTE 유지 → 기능 무영향, 익명 직접 호출만 차단.

REVOKE EXECUTE ON FUNCTION public.record_dream_search_miss(TEXT, TEXT) FROM anon, authenticated;
