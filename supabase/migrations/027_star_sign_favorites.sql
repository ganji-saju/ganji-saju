-- 2026-05-16 PR #138 — 사용자 별자리 즐겨찾기.
-- 본인 별자리(생년월일 자동) 외에, 따로 follow 하는 별자리들을 저장.
-- /star-sign/[slug] 페이지의 하트 버튼 + MY 화면 카드 + 메인 페이지 chip 에 사용.

CREATE TABLE IF NOT EXISTS star_sign_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  slug TEXT NOT NULL CHECK (slug IN (
    'aries','taurus','gemini','cancer','leo','virgo',
    'libra','scorpio','sagittarius','capricorn','aquarius','pisces'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 한 사용자가 같은 슬러그를 중복 follow 못 함.
CREATE UNIQUE INDEX IF NOT EXISTS star_sign_favorites_user_slug_unique
  ON star_sign_favorites (user_id, slug);

-- 사용자별 최근 follow 정렬용.
CREATE INDEX IF NOT EXISTS star_sign_favorites_user_recent_idx
  ON star_sign_favorites (user_id, created_at DESC);

ALTER TABLE star_sign_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY star_sign_favorites_select_own
  ON star_sign_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY star_sign_favorites_insert_own
  ON star_sign_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY star_sign_favorites_delete_own
  ON star_sign_favorites FOR DELETE
  USING (auth.uid() = user_id);
