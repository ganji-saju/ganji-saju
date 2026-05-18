-- 2026-05-19 — migration 033 부분 적용 복구.
-- 033 push 시 table+indexes+function+trigger+RLS+select policy 까지는 적용됐으나
-- CREATE POLICY 가 IF NOT EXISTS 미지원이라 첫 정책 충돌 시점에 중단됨 (insert/update/delete 누락).
-- 본 migration 은 4개 policy 를 DROP IF EXISTS 후 재생성해 idempotent 하게 정리한다.

DROP POLICY IF EXISTS reviews_select_approved_or_own ON reviews;
CREATE POLICY reviews_select_approved_or_own
  ON reviews FOR SELECT
  USING (
    moderation_status = 'approved'
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS reviews_insert_own ON reviews;
CREATE POLICY reviews_insert_own
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS reviews_update_own ON reviews;
CREATE POLICY reviews_update_own
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS reviews_delete_own ON reviews;
CREATE POLICY reviews_delete_own
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);
