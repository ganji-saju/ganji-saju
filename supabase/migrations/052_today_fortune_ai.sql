-- 오늘운세 무료 LLM 풀이 캐시. 유저·날짜·관심사·프롬프트버전당 1행.
create table if not exists public.today_fortune_ai (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  concern_id text not null,
  prompt_version text not null,
  headline text not null,
  body text not null,
  source text not null default 'openai',
  model text,
  fallback_reason text,
  iljin_ganzi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date_key, concern_id, prompt_version)
);

alter table public.today_fortune_ai enable row level security;

create policy "today_fortune_ai_select_own" on public.today_fortune_ai
  for select using (auth.uid() = user_id);

-- insert/update 는 service_role(RLS 우회)로만. anon/authed 직접 쓰기 정책 없음.

create index if not exists today_fortune_ai_user_date_idx
  on public.today_fortune_ai (user_id, date_key);
