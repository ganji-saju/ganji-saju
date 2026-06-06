-- 2026-06-05 — 타로 결과 보관함 저장. 무료 한장타로 결과를 로그인 사용자의 보관함(/my/results)
-- '타로' 탭에 남긴다. 결과는 (question, cardId, orientation) 으로 완전 결정되므로 vault 링크는
-- /tarot/daily/result?... 로 그대로 재현하고, 이 표는 보관 목록(타이틀/요약/날짜)의 출처가 된다.
-- scope_key 는 날짜 무관 identity → 같은 (질문·카드·방향) 재방문은 멱등 upsert.

CREATE TABLE IF NOT EXISTS public.tarot_result_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  question TEXT NOT NULL,
  question_tone TEXT NOT NULL DEFAULT 'daily',
  card_id TEXT NOT NULL,
  card_name TEXT NOT NULL,
  orientation TEXT NOT NULL,
  reading_json JSONB NOT NULL DEFAULT '{}',
  snapshot_version TEXT NOT NULL DEFAULT 'tarot-result-snapshot/v1',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarot_result_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "본인 타로 결과 스냅샷 조회" ON public.tarot_result_snapshots;
CREATE POLICY "본인 타로 결과 스냅샷 조회" ON public.tarot_result_snapshots
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS tarot_result_snapshots_user_scope_uidx
  ON public.tarot_result_snapshots (user_id, scope_key);

CREATE INDEX IF NOT EXISTS tarot_result_snapshots_user_created_idx
  ON public.tarot_result_snapshots (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_tarot_result_snapshots_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarot_result_snapshots_set_updated_at
  ON public.tarot_result_snapshots;
CREATE TRIGGER tarot_result_snapshots_set_updated_at
  BEFORE UPDATE ON public.tarot_result_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tarot_result_snapshots_updated_at();

COMMENT ON TABLE public.tarot_result_snapshots IS
  '보관함용 타로 결과 스냅샷(무료 한장타로). vault 재현은 /tarot/daily/result 파라미터로 결정.';
COMMENT ON COLUMN public.tarot_result_snapshots.scope_key IS
  '날짜 무관 identity: tarot:{hash(question|cardId|orientation)}. (user_id, scope_key) 멱등.';
