-- 2026-10-21 한 장짜리 랜딩 비회원 주문(설계: docs/superpowers/specs/2026-10-21-one-page-landing-design.md).
-- 운영 적용은 사용자 승인 후 supabase-ganji 로 수동. 앱 배포보다 먼저 적용한다(주문 API 가 이 테이블을 쓴다).
begin;

create table public.report_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  product text not null check (product in ('lifetime', 'new-year')),
  amount int not null check (amount >= 0),
  pay_method text not null check (pay_method in ('card', 'bank')),
  status text not null check (status in ('pending_payment', 'awaiting_deposit', 'paid', 'generated', 'sent', 'cancelled', 'refunded')),
  -- 개인정보: 발송 1년 뒤 삭제 크론이 null 로 비우고 purged_at 을 찍는다(거래 기록 칸은 남긴다).
  name text,
  phone text,
  email text,
  birth_input jsonb,
  memo text,
  cash_receipt boolean not null default false,
  payment_order_id text unique,
  external_report_id uuid references public.admin_external_reports(id) on delete set null,
  result_token text unique,
  deposit_due_at timestamptz,
  deposit_confirmed_at timestamptz,
  deposit_confirmed_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  send_result jsonb,
  refunded_at timestamptz,
  refund_note text,
  consented_at timestamptz not null,
  source text,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index report_orders_status_created_idx on public.report_orders (status, created_at desc);
alter table public.report_orders enable row level security;
-- 정책 없음 = 서버(service_role)만. 관리자 화면·주문 API 가 최고 관리자 가드/검증 뒤에서만 접근한다.
revoke all on public.report_orders from public, anon, authenticated;
grant select, insert, update on public.report_orders to service_role;

-- 비회원 카드 주문은 결제 원장에 user 없이 남는다(대시보드 매출·환불·정산 크론 재사용).
alter table public.payment_orders alter column user_id drop not null;
-- 다른 상품이 user 없이 결제 원장에 들어오지 못하게 DB 에서 막는다(회수·멤버십·집계 코드의 user 불변식 보호).
alter table public.payment_orders add constraint payment_orders_user_or_report_order
  check (user_id is not null or package_id in ('report_lifetime', 'report_new_year'));

-- 보관기간이 지난 랜딩 주문의 풀이 원본 삭제용.
grant delete on public.admin_external_reports to service_role;

comment on table public.report_orders is '한 장짜리 랜딩 비회원 주문: 입금 확인 → 풀이 생성(admin_external_reports) → 상담사 확인 → 결과 링크 발송.';

commit;
