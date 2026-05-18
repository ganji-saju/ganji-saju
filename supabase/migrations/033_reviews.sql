-- 2026-05-18 PR Phase 7b — 구매 인증 후기(reviews) 테이블.
-- /sample-report, /saju/[slug]/premium 등 상품 페이지에서 노출하는 사용자 후기.
--
-- 핵심 원칙 (사용자 스펙):
--   1) 실제 후기가 없으면 가짜 후기를 만들지 않는다.
--   2) 별점/상담건수/경력 같은 신뢰 지표는 실제 데이터 없으면 노출하지 않는다.
--   3) is_verified_purchase 는 INSERT 시점 API 에서 entitlement 검증 결과로 set.
--   4) moderation_status 가 'approved' 인 후기만 공개 노출.

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- catalog.ts 의 productId (taste_product 또는 'lifetime-report' 등) 와 정합.
  product_id TEXT NOT NULL,
  -- entitlement scope 와 동일 패턴. NULL 대신 'global' 기본값으로 UNIQUE 동작 보장.
  scope_key TEXT NOT NULL DEFAULT 'global',

  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 10 AND 2000),
  -- 표시명. NULL 이면 client 가 '익명' 등으로 fallback.
  display_name TEXT
    CHECK (display_name IS NULL OR length(btrim(display_name)) BETWEEN 1 AND 24),

  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,

  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_note TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 user + 동일 (product_id, scope_key) 1건만.
  UNIQUE (user_id, product_id, scope_key)
);

-- 자주 쓰는 조회 — 상품별 승인된 후기 최신순 / 사용자 본인 후기 / moderation queue.
CREATE INDEX IF NOT EXISTS reviews_product_approved_idx
  ON reviews (product_id, scope_key, created_at DESC)
  WHERE moderation_status = 'approved';

CREATE INDEX IF NOT EXISTS reviews_user_idx
  ON reviews (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_pending_idx
  ON reviews (created_at DESC)
  WHERE moderation_status = 'pending';

-- updated_at 자동 갱신.
CREATE OR REPLACE FUNCTION set_reviews_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_updated_at_trigger ON reviews;
CREATE TRIGGER reviews_updated_at_trigger
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_reviews_updated_at();

-- RLS — 승인된 후기는 anon 포함 모두 조회 가능, 본인은 자기 후기 무조건 조회.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_select_approved_or_own
  ON reviews FOR SELECT
  USING (
    moderation_status = 'approved'
    OR auth.uid() = user_id
  );

CREATE POLICY reviews_insert_own
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 후기 수정 가능. API 에서 moderation_status='pending' 으로 reset 처리.
CREATE POLICY reviews_update_own
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY reviews_delete_own
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- admin moderation 은 service_role 키를 쓰는 /api/admin/reviews/moderate 경로로만.
