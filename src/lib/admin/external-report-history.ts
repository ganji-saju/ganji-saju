import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { ExternalReportRequest, ExternalReportResult } from './external-report';

export interface ExternalReportHistoryItem {
  id: string;
  createdAt: string;
  reportNo: string;
  subjectName: string;
  birth: ExternalReportRequest;
  generationSource: 'openai' | 'fallback';
}

export interface SavedExternalReport extends ExternalReportHistoryItem {
  report: ExternalReportResult;
}

interface HistoryRow {
  id: string;
  created_at: string;
  report_no: string;
  subject_name: string;
  birth_input: ExternalReportRequest;
  generation_source: 'openai' | 'fallback';
  snapshot?: ExternalReportResult;
}

const TABLE = 'admin_external_reports';
const LIST_COLUMNS = 'id,created_at,report_no,subject_name,birth_input,generation_source';
const PAGE_SIZE = 20;

function historyItem(row: HistoryRow): ExternalReportHistoryItem {
  return {
    id: row.id, createdAt: row.created_at, reportNo: row.report_no,
    subjectName: row.subject_name, birth: row.birth_input, generationSource: row.generation_source,
  };
}

/** 호출하는 페이지/API에서 최고 관리자 확인 후 사용한다. 일반 클라이언트는 RLS로 차단한다. */
export async function saveExternalReport({ actorId, birth, report }: {
  actorId: string; birth: ExternalReportRequest; report: ExternalReportResult;
}): Promise<{ id: string; createdAt: string }> {
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE).insert({
    created_by: actorId,
    report_no: report.data.reportNo,
    subject_name: report.data.subjectName,
    birth_input: birth,
    generation_source: report.generationSource,
    snapshot: report,
  }).select('id,created_at').single();
  if (error || !data) throw new Error('external_report_save_failed');
  return { id: data.id as string, createdAt: data.created_at as string };
}

/** 큰 풀이 snapshot은 목록에 싣지 않고 21번째 행으로 다음 페이지 유무만 확인한다. */
export async function listExternalReports(page = 1): Promise<{
  items: ExternalReportHistoryItem[]; hasMore: boolean; page: number;
}> {
  const current = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100_000) : 1;
  const offset = (current - 1) * PAGE_SIZE;
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE).select(LIST_COLUMNS)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE);
  if (error || !data) throw new Error('external_report_list_failed');
  const rows = data as HistoryRow[];
  return { items: rows.slice(0, PAGE_SIZE).map(historyItem), hasMore: rows.length > PAGE_SIZE, page: current };
}

/** 저장 당시 본문·발행일을 그대로 반환한다. AI 생성기나 현재 연도로 다시 계산하지 않는다. */
export async function getExternalReport(id: string): Promise<SavedExternalReport | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const service = await createServiceClient();
  const { data, error } = await service.from(TABLE).select(`${LIST_COLUMNS},snapshot`).eq('id', id).maybeSingle();
  if (error) throw new Error('external_report_load_failed');
  if (!data) return null;
  const row = data as HistoryRow;
  if (!row.snapshot?.data || !row.snapshot.issuedAt) throw new Error('external_report_snapshot_invalid');
  return { ...historyItem(row), report: row.snapshot };
}
