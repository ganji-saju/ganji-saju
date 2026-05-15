-- 2026-05-15 — 대화방 채팅 기록 테이블.
-- 사용자 피드백: "07-0 대화방 내 채팅기록이 남는 화면도 없어."
-- 기존 dialogue-chat-panel 은 client 로컬 state 만 사용 → 페이지 이탈 시 메시지 손실.
-- 이 테이블은 사용자별 대화 히스토리 (질문 + AI 응답) 를 영구 보관해 /dialogue/history
-- 페이지에서 다시 열람 가능하게 한다.

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

-- 자주 쓰는 조회: 사용자별 최근 세션 / 세션별 메시지 순서.
CREATE INDEX IF NOT EXISTS dialogue_messages_user_session_idx
  ON dialogue_messages (user_id, session_id, created_at);

CREATE INDEX IF NOT EXISTS dialogue_messages_user_recent_idx
  ON dialogue_messages (user_id, created_at DESC);

-- RLS — 본인 데이터만 조회/입력.
ALTER TABLE dialogue_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dialogue_messages_select_own
  ON dialogue_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY dialogue_messages_insert_own
  ON dialogue_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY dialogue_messages_delete_own
  ON dialogue_messages FOR DELETE
  USING (auth.uid() = user_id);
