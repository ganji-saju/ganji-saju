-- Allow logged-in users to save and delete their own reading rows without
-- depending on a service-role key at runtime. Anonymous users continue to use
-- the deterministic slug preview path.

CREATE POLICY "본인 사주 저장" ON readings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 사주 삭제" ON readings
  FOR DELETE
  USING (auth.uid() = user_id);
