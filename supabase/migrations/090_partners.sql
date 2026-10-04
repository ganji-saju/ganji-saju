-- 2026-10-04 인플루언서 전용 신년운세 랜딩(설계: docs/superpowers/specs/2026-10-04-influencer-landing-design.md)
create table if not exists public.partners (
  code text primary key check (code ~ '^[a-z0-9]{3,20}$'),
  name text not null,
  discount_percent int not null default 40 check (discount_percent between 1 and 90),
  commission_percent int not null default 30 check (commission_percent between 0 and 90),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;

create table if not exists public.partner_visits (
  partner_code text not null references public.partners(code) on delete cascade,
  visited_on date not null,
  count int not null default 0,
  primary key (partner_code, visited_on)
);
alter table public.partner_visits enable row level security;

create or replace function public.increment_partner_visit(p_code text, p_day date)
returns void language sql security definer set search_path = public as $$
  insert into public.partner_visits (partner_code, visited_on, count)
  select p_code, p_day, 1 where exists (select 1 from public.partners where code = p_code and active)
  on conflict (partner_code, visited_on) do update set count = public.partner_visits.count + 1;
$$;
revoke execute on function public.increment_partner_visit(text, date) from public, anon, authenticated;
