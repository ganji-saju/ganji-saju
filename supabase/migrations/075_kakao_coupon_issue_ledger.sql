-- 075_kakao_coupon_issue_ledger.sql — 카카오 친구추가 무료쿠폰 재발급 차단 원장.
--
-- 왜 별도 테이블인가: user_coupons.user_id 는 auth.users 를 `on delete cascade` 로 참조한다
--   (072). 그래서 회원탈퇴하면 쿠폰 기록이 **통째로 사라지고**, 같은 카카오 계정으로 다시
--   가입하면 새 user_id 라 UNIQUE(user_id,type) 가 아무것도 막지 못한다 —
--   탈퇴/재가입만 반복하면 3,300원짜리 '오늘 자세히보기' 를 무한히 0원으로 받을 수 있었다.
--   따라서 차단 기록은 **계정 수명과 분리**되어야 한다. 이 표에는 auth.users FK 가 없다.
--
-- 개인정보: 카카오 회원번호를 그대로 두지 않고 SHA-256 해시만 남긴다. 탈퇴 후에도 남는
--   기록이므로 부정이용 방지에 필요한 최소치(누가 이미 받았는지 대조)만 보관한다.
--   ⚠️ 카카오 회원번호는 짧은 숫자라 해시만으로 완전한 비가역성은 아니다 — 이 표는
--   "역추적 불가" 가 아니라 "유출돼도 카카오 ID 가 평문으로 나가지 않는다" 수준의 방어다.
create table if not exists public.kakao_coupon_issue_ledger (
  kakao_uid_hash text not null,
  type text not null,
  issued_at timestamptz not null default now(),
  primary key (kakao_uid_hash, type)
);

-- RLS 켜고 정책은 두지 않는다 = service role 만 접근. 본인 조회 대상이 아니다
-- (사용자에게 보여줄 값이 없고, 남에게 보이면 안 되는 대조표다).
alter table public.kakao_coupon_issue_ledger enable row level security;
