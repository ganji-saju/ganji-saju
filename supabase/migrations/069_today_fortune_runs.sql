-- 2026-07-10 — 보관함 오늘운세 '다시보기' 재현용 경량 실행기록.
--
-- 배경: 무료 오늘운세 실행은 readings 행만 남기는데, 이 행은 (a) 사주 풀이와 공유되고
--   (b) 날짜 정보가 없어 "그날의 오늘운세"를 특정할 수 없었다. 그 결과 보관함의 다시보기가
--   /saju/{id} 로 가서 사주 화면 + 총평 LLM 재실행을 유발했다.
--
-- 설계: 결과 본문(free_result_json)은 저장하지 않는다. buildTodayFortuneFreeResult 는
--   (input, sajuData, options) 고정 시 100% 결정론적(LLM·Math.random 없음)이므로,
--   재현에 필요한 '입력'만 남기고 조회 시점에 다시 계산한다.
--   유일한 비결정 입력은 build 시 사용된 `now`(dateKey·일진 산출 기준) → generated_at 에 고정 저장.
--   ※ 로그인 사용자에게만 적용되는 LLM 내러티브 오버레이(route.ts)는 재현 대상이 아니다.

create table if not exists public.today_fortune_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- readings 행이 있으면 grounding/kasiComparison 을 그 행에서 재조회(불변 데이터).
  -- 게스트 slug fallback 이었던 경우 null → input 만으로 순수 재계산.
  reading_id uuid references public.readings(id) on delete set null,
  source_session_id text not null,
  -- KST 기준 dateKey (YYYY-MM-DD). 목록 표시·중복 방지용.
  occurred_on date not null,
  -- build 시 사용한 `now`. 재현 시 buildFreshTodaySajuData / buildTodayFortuneFreeResult 양쪽에 주입.
  generated_at timestamptz not null,
  concern_id text not null default 'general',
  counselor_id text,
  calendar_type text not null default 'solar',
  time_rule text not null default 'standard',
  -- 생성 당시 resolve 된 표시 이름 스냅샷(이후 프로필 변경과 무관하게 원본 재현).
  display_name text,
  -- BirthInput 스냅샷(이름 제외). 재현 시 display_name 을 name 에 주입해 사용.
  input_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.today_fortune_runs enable row level security;

-- 048 패턴: 본인 SELECT 만 허용. INSERT/UPDATE/DELETE 는 service role 경유.
drop policy if exists "본인 오늘운세 실행기록 조회" on public.today_fortune_runs;
create policy "본인 오늘운세 실행기록 조회" on public.today_fortune_runs
  for select to authenticated
  using (auth.uid() = user_id);

-- 같은 날·같은 고민·같은 세션의 재실행은 최초 기록을 유지(on conflict do nothing) →
-- 원본 generated_at 이 보존돼 재현 결과가 흔들리지 않는다.
create unique index if not exists today_fortune_runs_identity_uidx
  on public.today_fortune_runs (user_id, source_session_id, occurred_on, concern_id);

create index if not exists today_fortune_runs_user_day_idx
  on public.today_fortune_runs (user_id, occurred_on desc, created_at desc);

comment on table public.today_fortune_runs is
  '무료 오늘운세 실행기록(결과 본문 미저장). 보관함 다시보기에서 generated_at 을 앵커로 결정론적 재계산.';
comment on column public.today_fortune_runs.generated_at is
  '생성 시 사용한 now. 재현 시 동일 값을 주입해야 dateKey·일진·사주 메타가 원본과 일치.';
comment on column public.today_fortune_runs.input_json is
  'BirthInput 스냅샷(name 제외). display_name 과 합쳐 enrichedInput 재구성.';
