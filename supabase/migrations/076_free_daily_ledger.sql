-- 076_free_daily_ledger.sql — 무료 하루 1회 제한이 탈퇴/재가입으로 리셋되던 구멍 차단.
--
-- 075(쿠폰 원장)와 같은 뿌리다: `membership_benefit_usage.user_id` 가 auth.users 를
--   `on delete cascade` 로 참조(056)해서 **탈퇴하면 오늘 쓴 기록이 사라진다**. 카카오 로그인은
--   가입 절차가 없어 탈퇴→재로그인이 10초라, 무료 1회를 하루에 몇 번이든 다시 받을 수 있었다.
--
-- 접근이 075 와 다른 점: 쿠폰은 "평생 1회" 라 발급 사실만 남기면 됐지만, 이건 **기간별 사용량**
--   이라 탈퇴 시점의 사용 기록을 그대로 떠 놓고 재가입 때 되돌려 놓는다. 그래서 소비 경로
--   (consumeFreeDaily 호출부 7곳)는 **한 줄도 건드리지 않는다** — 새 무료 메뉴가 생겨도
--   자동으로 보호된다.
create table if not exists public.free_daily_ledger (
  kakao_uid_hash text not null,
  benefit text not null,
  period_key text not null,          -- 'YYYY-MM-DD'(일) / 'YYYY-MM'(월), KST 기준. 056 과 같은 규칙.
  used_count int not null default 1,
  recorded_at timestamptz not null default now(),
  primary key (kakao_uid_hash, benefit, period_key)
);

-- RLS 켜고 정책 없음 = service role 전용. 사용자에게 보여줄 값이 아니다(075 와 동일).
alter table public.free_daily_ledger enable row level security;
