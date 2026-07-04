-- 064_restore_dialogue_messages.sql
-- 날짜: 2026-07-04
-- 목적: 프로덕션 drift 복구 — dialogue_messages 테이블이 원격 DB 에 존재하지 않음
--       (migration 024 는 히스토리에 적용 기록만 있고 실테이블 부재 — inspect 로 확정).
--       증상: ①AI 대화 기록 저장이 프로덕션에서 조용히 실패(히스토리 미보존)
--             ②운영지표 스냅샷이 dialogue 조회 실패로 500(#599 에서 부분집계 침묵 반환
--               → throw 로 바꾸며 drift 가 드러남 — 의도된 관측).
--
-- 내용: 024_dialogue_history.sql 과 동일 DDL 의 멱등 재실행판(로컬/이미 적용 환경 무해).
--       024 이후 이 테이블을 변경한 마이그레이션 없음(전수 grep 확인).
--
-- ⚠️ 프로덕션 적용: 057~063 과 동일하게 수동 적용(supabase db push).

CREATE TABLE IF NOT EXISTS dialogue_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- 같은 대화 세션 묶음. 클라이언트가 생성 (uuid v4) 후 같은 expert 와 대화하는 동안 유지.
  session_id UUID NOT NULL,
  expert_id TEXT NOT NULL, -- 'rat'/'ox'/'tiger'/... 12 expert ids
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  -- AI 응답일 때만 채워지는 메타.
  source TEXT, -- 'openai' | 'fallback' | 'safe_redirect' 등
  model TEXT,
  -- 사용자가 메시지 보낸 진입 정보 (선택).
  source_session_id TEXT, -- 사주 reading slug (있을 때)
  concern_id TEXT,
  entry_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dialogue_messages_user_session_idx
  ON dialogue_messages (user_id, session_id, created_at);

CREATE INDEX IF NOT EXISTS dialogue_messages_user_recent_idx
  ON dialogue_messages (user_id, created_at DESC);

ALTER TABLE dialogue_messages ENABLE ROW LEVEL SECURITY;

-- 정책은 drop-if-exists 후 재생성(멱등 — create policy 는 IF NOT EXISTS 미지원).
DROP POLICY IF EXISTS dialogue_messages_select_own ON dialogue_messages;
CREATE POLICY dialogue_messages_select_own
  ON dialogue_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dialogue_messages_insert_own ON dialogue_messages;
CREATE POLICY dialogue_messages_insert_own
  ON dialogue_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dialogue_messages_delete_own ON dialogue_messages;
CREATE POLICY dialogue_messages_delete_own
  ON dialogue_messages FOR DELETE
  USING (auth.uid() = user_id);
