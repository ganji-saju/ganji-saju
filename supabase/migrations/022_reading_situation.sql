-- 2026-05-15 PR 1 — readings 테이블에 사용자 현재 상황(연애/직업/고민) JSONB 컬럼 추가.
-- 사주아이 벤치마크 reference. personalizationContext.userSituation 로 풀이에 호명.
-- 기존 reading rows 는 NULL 유지 (회귀 없음).

ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS situation_json JSONB NULL;

COMMENT ON COLUMN readings.situation_json IS
  '사용자 입력 현재 상황: { relationshipStatus, occupation, currentConcern, concernNote }. NULL 허용 (기존 reading 호환).';
