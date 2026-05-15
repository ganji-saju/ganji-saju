-- 2026-05-16 PR #141 — admin 화이트리스트 테이블.
-- /admin/* 페이지 + /api/admin/* API 가드용. 본 PR 까지는 로그인만 검증했으나
-- 학습 가중치 promote, 운영 통계 등 민감 기능이라 명시적 화이트리스트 도입.
--
-- 초기 부트스트랩: env ADMIN_USER_IDS (comma-separated UUID) 가 fallback —
-- DB 에 admin_users 한 행도 없을 때 첫 admin 이 자기 계정 ID 로 row 를 직접 추가할 수 있게.

CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users (role);

-- RLS — 본인만 자기 row 조회 가능 (관리 작업은 service_role 사용).
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_select_self
  ON admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- 다른 admin 의 row 도 조회는 super_admin 만 (향후 admin 관리 페이지용).
CREATE POLICY admin_users_select_super_admin
  ON admin_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.user_id = auth.uid() AND a.role = 'super_admin'
    )
  );
