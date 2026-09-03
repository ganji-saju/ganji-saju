-- 2026-09-03 — 자체 집계에 **경로별 방문**을 남긴다.
--
-- 왜: 지금까지 site_visits 는 그날 **첫 진입 경로(first_path)** 하나만 저장하고, 이후 이동은
--   page_views 카운트로만 뭉갰다. 그래서 "결과를 보고 어디로 갔나 / 어디서 나갔나"를
--   자체 데이터로는 답할 수 없었고, 그 질문을 GA4 에 물었다가 크게 틀렸다:
--   2026-09-03 실측에서 GA4 는 /guide 를 614세션 1위 유입으로 보고했는데, 자체 집계로는
--   첫 진입 0명이었고 GA4 쪽 체류시간이 **0.46초**(정상 페이지는 270~380초) — 전부 봇이었다.
--   GA4 는 봇 필터가 없고 동의(Consent Mode 기본 denied)로 실제의 1/45만 잡는다.
--
--   자체 집계는 이미 봇·내부·프리뷰 트래픽을 걸러낸다(visit-filters). 경로만 얹으면
--   같은 필터를 그대로 물려받은 정확한 경로 데이터가 생긴다.
--
-- 설계: (date_key, path, visitor_hash) 를 PK 로 두고 views 를 증가시킨다.
--   → 경로별 **순방문자**(distinct visitor_hash)와 **PV**(sum(views))를 둘 다 얻는다.
--   방문자 200명/일 × 경로 3~4개 ≈ 700행/일. 인덱스 하나면 충분하다.
--
-- ⚠️ path 는 이미 sanitizePath/sanitizeQuery 를 거친 값이다(생년월일·이름 제거 후 redacted).
--   원본 URL 을 저장하지 않는다 — 개인정보가 경로에 실리는 서비스라 이 전제가 중요하다.
create table if not exists public.site_visit_pages (
  date_key text not null,                       -- KST YYYY-MM-DD
  path text not null,                           -- sanitize 된 경로(+허용 쿼리)
  visitor_hash text not null,                   -- sha256(익명 vid) — PII 아님
  views integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (date_key, path, visitor_hash)
);

comment on table public.site_visit_pages is
  '자체 경로별 방문(봇·내부·프리뷰 제외). 경로별 순방문자=count(distinct visitor_hash), PV=sum(views).';

create index if not exists site_visit_pages_date_idx on public.site_visit_pages(date_key);

alter table public.site_visit_pages enable row level security;
-- RLS: 정책 없음 = deny all. admin 집계는 service-role 로만 읽는다(site_visits 와 동일).

-- 기록 — track_site_visit_pageview 와 같은 호출에서 함께 쓴다(핑 1회 = 왕복 1회 유지).
create or replace function public.track_site_visit_page(
  p_date_key text,
  p_path text,
  p_visitor_hash text
)
returns void
language plpgsql
volatile
as $$
begin
  if p_path is null or p_path = '' then
    return;
  end if;

  insert into public.site_visit_pages (date_key, path, visitor_hash, views)
  values (p_date_key, left(p_path, 200), p_visitor_hash, 1)
  on conflict (date_key, path, visitor_hash)
  do update set views = public.site_visit_pages.views + 1;
end;
$$;

-- 집계 — 기간 내 경로별 순방문자·PV 상위. 행 전송 없이 서버에서 집계한다.
create or replace function public.site_visit_page_counts(from_key text, to_key text)
returns table (path text, visitors bigint, views bigint)
language sql
stable
as $$
  select
    p.path,
    count(distinct p.visitor_hash)::bigint as visitors,
    sum(p.views)::bigint as views
  from public.site_visit_pages p
  where p.date_key >= from_key and p.date_key <= to_key
  group by p.path
  order by visitors desc, views desc
  limit 100;
$$;
