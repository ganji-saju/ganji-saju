-- 2026-05-16 PR #151 (B2) — profiles 에 user_situation JSONB 컬럼 추가.
-- 사용자 default 상황 (관계/직업/고민) — /my/situation 에서 수정.
-- 새 reading 시 reading_situation 이 비어있으면 이 default 가 사용됨.
-- 기존 reading_situation 컬럼은 reading 별 override 로 유지.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_situation JSONB;

COMMENT ON COLUMN profiles.user_situation IS
  '사용자 default 상황 — { relationshipStatus, occupation, currentConcern, concernNote }. '
  '/my/situation 에서 수정. 새 reading 의 situation_json fallback.';
