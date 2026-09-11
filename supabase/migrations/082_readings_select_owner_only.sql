-- 082_readings_select_owner_only.sql — 비로그인·탈퇴자 사주가 공개 anon 키로 누구에게나 조회되던 정책을 닫는다.
--
-- ⚠️ 프로덕션 적용은 수동(Supabase 대시보드 SQL Editor). 앱 코드 변경은 없다 — 순서 무관.
--
-- 🔴 001_initial.sql:54 의 SELECT 정책이 `auth.uid() = user_id OR user_id IS NULL` 이었다.
--   `user_id IS NULL` = 비로그인으로 만든 사주(+ 계정 삭제 뒤 남은 행)라, 브라우저 번들에 공개된 anon 키만 있으면
--   REST 로 전부 긁을 수 있었다 — 생년월일·출생시·성별·풀이 결과(result_json). 이후 마이그레이션에 정정이 없었다.
--   (2026-09-11 계정 탈취 조사 중 발견. 프로덕션에 그대로였는지는 확인하지 못했다 — 이 SQL 은 어느 쪽이든 멱등.)
--
-- 앱은 영향이 없다: 프로덕션의 readings 읽기·쓰기는 전부 service 클라이언트(src/lib/saju/readings.ts
--   getPrivilegedOrSessionClient)라 RLS 를 타지 않고, 브라우저에서 readings 를 조회하는 코드는 0건이다.
--   비로그인 사용자의 결과 화면도 서버가 service 로 읽는다.

drop policy if exists "본인 사주 조회" on public.readings;
create policy "본인 사주 조회" on public.readings
  for select using (auth.uid() = user_id);

notify pgrst, 'reload schema';
