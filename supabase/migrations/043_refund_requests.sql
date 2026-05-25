-- 2026-05-25 Phase 2 — 환불 요청/승인 워크플로우 + 상태머신 + Toss 멱등키.
--   2단계: admin 요청(status 'requested') → super_admin 승인·실행.
--   상태머신: requested → processing → completed | failed(재시도) | revoke_pending(경보) | rejected.
--   idempotency_key = Toss Idempotency-Key (재시도 시 이중취소 방지).
--   서버(service role) 전용 — RLS 활성 + 공개 정책 없음(admin API 가 service client 로 접근).
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,   -- 환불 대상 사용자
  entitlement_id UUID,                          -- 스냅샷 출처(product_entitlements.id, 참고용)
  product_id TEXT NOT NULL,
  scope_key TEXT,
  payment_key TEXT,                             -- 요청 시점 snapshot (Toss cancel 대상)
  amount INTEGER,                               -- WON
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users,   -- admin
  approved_by UUID REFERENCES auth.users ON DELETE SET NULL,  -- super_admin
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processing', 'completed', 'failed', 'revoke_pending', 'rejected')),
  idempotency_key UUID NOT NULL DEFAULT gen_random_uuid(),
  toss_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON public.refund_requests (status, created_at);
CREATE INDEX IF NOT EXISTS refund_requests_user_idx ON public.refund_requests (user_id, created_at DESC);

-- 민감 운영 데이터 → 클라이언트 비노출. RLS 활성 + 공개 정책 미부여 = service role 서버 접근만.
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
