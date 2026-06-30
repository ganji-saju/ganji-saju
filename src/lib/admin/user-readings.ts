// src/lib/admin/user-readings.ts
// 어드민용 유저 사주 결과 목록 조회. super_admin 전용 — 서비스 키 필요.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { mapReadingRow, type ReadingRow } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import type { BirthInput } from '@/lib/saju/types';

// 한자 지지(地支) 시간 매핑. 인덱스 = 0~23시.
const HOUR_TO_BRANCH: string[] = [
  '子', // 0h
  '丑', // 1h
  '丑', // 2h
  '寅', // 3h
  '寅', // 4h
  '卯', // 5h
  '卯', // 6h
  '辰', // 7h
  '辰', // 8h
  '巳', // 9h
  '巳', // 10h
  '午', // 11h
  '午', // 12h
  '未', // 13h
  '未', // 14h
  '申', // 15h
  '申', // 16h
  '酉', // 17h
  '酉', // 18h
  '戌', // 19h
  '戌', // 20h
  '亥', // 21h
  '亥', // 22h
  '子', // 23h
];

/**
 * reading row → 어드민 레이블 변환 (순수 함수 — 단위 테스트 가능).
 * 예: "홍길동 · 2000-01-15 戌 · 06-20"
 */
export function buildReadingLabel(input: BirthInput, createdAt: string): string {
  const name = input.name?.trim();

  const mm = String(input.month).padStart(2, '0');
  const dd = String(input.day).padStart(2, '0');
  const birthDate = `${input.year}-${mm}-${dd}`;

  let birthPart = birthDate;
  if (!input.unknownTime && input.hour !== undefined) {
    const branch = HOUR_TO_BRANCH[input.hour];
    if (branch) birthPart = `${birthDate} ${branch}`;
  }

  const date = new Date(createdAt);
  const cMm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const cDd = String(date.getUTCDate()).padStart(2, '0');
  const createPart = `${cMm}-${cDd}`;

  const parts = name ? [name, birthPart, createPart] : [birthPart, createPart];
  return parts.join(' · ');
}

export interface AdminReadingEntry {
  id: string;
  readingKey: string;
  label: string;
  hasLifetime: boolean;
}

type AdminReadingListRow = ReadingRow & { created_at: string };

/**
 * 유저 사주 결과 목록(최근순, 상한 50) + 평생리포트 보유 여부.
 * 서비스 키 없으면 빈 배열 반환(graceful).
 */
export async function listUserReadingsForAdmin(userId: string): Promise<AdminReadingEntry[]> {
  if (!hasSupabaseServiceEnv || !userId) return [];

  const service = await createServiceClient();
  const { data, error } = await service
    .from('readings')
    .select(
      'id, user_id, birth_year, birth_month, birth_day, birth_hour, gender, result_json, situation_json, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const rows = data as AdminReadingListRow[];
  const results: AdminReadingEntry[] = [];

  for (const row of rows) {
    const record = mapReadingRow(row);
    const readingKey = toSlug(record.input);
    const label = buildReadingLabel(record.input, row.created_at);
    const ent = await getLifetimeReportEntitlement(userId, readingKey).catch(() => null);
    results.push({
      id: row.id,
      readingKey,
      label,
      hasLifetime: Boolean(ent),
    });
  }

  return results;
}
