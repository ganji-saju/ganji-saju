-- 2026-05-14: 1:1 상담 예약 테이블.
-- /dialogue/appointment 에서 사용자가 선택한 선생님/날짜/시간/주제/메모를 저장한다.
-- 결제는 별도 흐름이므로 status 로 라이프사이클 관리.

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  teacher_key TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN ('love', 'career', 'money', 'family', 'life')),
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (
    status IN ('requested', 'confirmed', 'completed', 'cancelled')
  ),
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_user_status
  ON appointments (user_id, status, appointment_date DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_teacher_slot
  ON appointments (teacher_key, appointment_date, appointment_time)
  WHERE status IN ('requested', 'confirmed');

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 예약 조회" ON appointments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 예약 추가" ON appointments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 예약 취소" ON appointments
  FOR UPDATE USING (auth.uid() = user_id);
