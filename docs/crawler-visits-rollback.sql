-- 크롤러 방문 행 되돌리기 (2026-07-19)
--
-- ## 왜
-- 방문 집계는 2026-07-19 커밋 `5a06e9c3` 이전까지 **실사용자를 한 명도 센 적이 없다**.
-- 호스트 판정이 `NEXT_PUBLIC_SITE_URL`(=퓨니코드 도메인)과 비교돼 canonical(ganjisaju.kr)
-- 사용자가 전부 폐기됐고, 남은 2,540행은 퓨니코드 도메인을 긁던 크롤러였다.
--
-- 실측 대비 (이 판정의 근거):
--   07-04 ~ 07-10 : 2,540행 / 페이지뷰 2,540 → **1인당 정확히 1.00** (크롤러)
--   07-19 (수정 후):    10행 / 페이지뷰   46 → 1인당 4.6         (실사람)
-- 07-11~07-18 은 아예 0행이다(집계가 죽어 있던 구간).
-- 따라서 `date_key <= '2026-07-10'` 은 크롤러 행과 정확히 일치하며, 실사용자 행을 건드리지 않는다.
--
-- ## 실행 방법
-- Supabase SQL Editor 에서 **STEP 순서대로** 실행. STEP 1 로 지울 대상을 먼저 눈으로 확인할 것.
-- STEP 2 가 백업이므로 되돌릴 수 있다(복원 쿼리는 맨 아래).
-- 마지막에 metrics_daily 재계산(STEP 5)까지 해야 /admin 차트가 실제로 바뀐다.

-- ─────────────────────────────────────────────────────────────
-- STEP 1. 지울 대상 확인 (읽기 전용 — 먼저 실행해서 눈으로 볼 것)
--   기대: 07-04~07-10 만 나오고, 모든 날짜에서 행수 == 페이지뷰 (1인당 1.00 = 크롤러 지문)
select date_key,
       count(*)          as 행수,
       sum(page_views)   as 페이지뷰,
       round(sum(page_views)::numeric / count(*), 2) as 인당페이지뷰
from site_visits
where date_key <= '2026-07-10'
group by date_key
order by date_key;

-- ─────────────────────────────────────────────────────────────
-- STEP 2. 백업 (되돌리기용). 이미 있으면 그대로 두고 넘어간다.
create table if not exists site_visits_crawler_archive_20260719
  (like site_visits including all);

insert into site_visits_crawler_archive_20260719
select * from site_visits where date_key <= '2026-07-10'
on conflict do nothing;

-- 백업이 제대로 됐는지 확인 — 아래 두 숫자가 같아야 STEP 3 로 간다.
select (select count(*) from site_visits_crawler_archive_20260719) as 백업행수,
       (select count(*) from site_visits where date_key <= '2026-07-10') as 원본행수;

-- ─────────────────────────────────────────────────────────────
-- STEP 3. 삭제 (백업행수 == 원본행수 를 확인한 뒤에만)
delete from site_visits where date_key <= '2026-07-10';

-- ─────────────────────────────────────────────────────────────
-- STEP 4. 확인 — 실사용자 행만 남았는지
--   기대: 2026-07-19 이후만 남고, 인당페이지뷰가 1.00 보다 크다
select date_key, count(*) as 행수, sum(page_views) as 페이지뷰,
       round(sum(page_views)::numeric / count(*), 2) as 인당페이지뷰
from site_visits group by date_key order by date_key;

-- ─────────────────────────────────────────────────────────────
-- STEP 5. metrics_daily 재계산 (이걸 해야 /admin 차트가 바뀐다)
--   site_visits 만 지우면 롤업 테이블에 굳은 숫자가 그대로 남는다.
--   super_admin 으로 로그인한 브라우저 콘솔에서:
--
--     await fetch('/api/admin/metrics/rollup?from=2026-07-04&to=2026-07-10', { method: 'POST' })
--       .then(r => r.json()).then(console.log)
--
--   (크론은 최근 3일만 재롤업하므로 과거 구간은 이 수동 백필이 필요하다)
--
--   그 뒤 확인 — 07-04~07-10 의 visitors/page_views 가 0 이 돼야 한다:
select date_key, visitors, page_views, new_signups, paid_orders
from metrics_daily
where date_key between '2026-07-04' and '2026-07-19'
order by date_key;

-- ─────────────────────────────────────────────────────────────
-- 되돌리기 (STEP 3 을 취소하고 싶을 때)
--   insert into site_visits select * from site_visits_crawler_archive_20260719
--     on conflict do nothing;
--   그 뒤 STEP 5 의 백필을 같은 구간으로 다시 실행.
--
-- 정리 (한동안 지켜본 뒤 백업이 필요 없어지면)
--   drop table site_visits_crawler_archive_20260719;
