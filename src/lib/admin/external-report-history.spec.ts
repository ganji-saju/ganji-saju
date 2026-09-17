import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }));

import { createServiceClient } from '@/lib/supabase/server';
import type { ExternalReportRequest, ExternalReportResult } from './external-report';
import { getExternalReport, listExternalReports, saveExternalReport } from './external-report-history';

const id = 'aa809a61-df81-4cac-9c96-e4cd1a5db76c';
const birth: ExternalReportRequest = {
  name: '구매자', calendarType: 'lunar', timeRule: 'standard', year: '1982', month: '1', day: '5',
  hour: '', minute: '', unknownBirthTime: true, gender: 'female',
  birthLocationCode: 'custom', birthLocationLabel: '성남', birthLatitude: '37.4201', birthLongitude: '127.1265',
};
const report = {
  data: { reportNo: 'GS-EXT-SAVED', subjectName: '구매자' }, issuedAt: '2026.09.18',
  generationSource: 'fallback', generationWarning: '저장 당시 안내',
} as ExternalReportResult;
const row = {
  id, created_at: '2026-09-17T15:30:00.000Z', report_no: report.data.reportNo,
  subject_name: birth.name, birth_input: birth, generation_source: report.generationSource, snapshot: report,
};
const query = {
  insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
  single: vi.fn(), range: vi.fn(), maybeSingle: vi.fn(),
};
const service = { from: vi.fn(() => query) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceClient).mockResolvedValue(service as never);
  query.single.mockResolvedValue({ data: row, error: null });
  query.range.mockResolvedValue({ data: [row], error: null });
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
});

describe('external report history persistence', () => {
  it('stores the original birth input and complete report snapshot before returning stable record metadata', async () => {
    await expect(saveExternalReport({ actorId: 'admin', birth, report })).resolves.toEqual({
      id, createdAt: row.created_at,
    });
    expect(service.from).toHaveBeenCalledWith('admin_external_reports');
    expect(query.insert).toHaveBeenCalledWith({
      created_by: 'admin', report_no: report.data.reportNo, subject_name: '구매자',
      birth_input: birth, generation_source: 'fallback', snapshot: report,
    });
    expect(query.insert.mock.calls[0][0].snapshot).toBe(report);
    expect(query.select).toHaveBeenCalledWith('id,created_at');
  });

  it('lists 20 rows without snapshots and uses the extra row only to determine the next page', async () => {
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 21 }, (_, index) => ({ ...row, id: `record-${index}` })), error: null });
    const result = await listExternalReports(2);
    expect(result.page).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(20);
    expect(result.items[0]).toEqual({
      id: 'record-0', createdAt: row.created_at, reportNo: row.report_no,
      subjectName: '구매자', birth, generationSource: 'fallback',
    });
    expect(query.select).toHaveBeenCalledWith('id,created_at,report_no,subject_name,birth_input,generation_source');
    expect(query.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]]);
    expect(query.range).toHaveBeenCalledWith(20, 40);
    expect(result.items.some((item) => 'snapshot' in item || 'report' in item)).toBe(false);
  });

  it.each([0, 20])('has no next page when only %i rows are available', async (count) => {
    query.range.mockResolvedValueOnce({ data: Array.from({ length: count }, () => row), error: null });
    const result = await listExternalReports();
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(count);
  });

  it('normalizes an invalid page before querying', async () => {
    const result = await listExternalReports(-1);
    expect(result.page).toBe(1);
    expect(query.range).toHaveBeenCalledWith(0, 20);
  });

  it('rejects an invalid record ID without querying the database', async () => {
    await expect(getExternalReport('not-a-uuid')).resolves.toBeNull();
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it('returns the saved body, issue date and warning unchanged for re-download', async () => {
    const result = await getExternalReport(id);
    expect(result?.report).toBe(report);
    expect(result?.birth).toBe(birth);
    expect(result?.createdAt).toBe(row.created_at);
    expect(query.eq).toHaveBeenCalledWith('id', id);
    expect(query.select).toHaveBeenCalledWith('id,created_at,report_no,subject_name,birth_input,generation_source,snapshot');
    expect(query.insert).not.toHaveBeenCalled();
  });

  it('distinguishes a missing record from an invalid saved snapshot', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(getExternalReport(id)).resolves.toBeNull();
    query.maybeSingle.mockResolvedValueOnce({ data: { ...row, snapshot: null }, error: null });
    await expect(getExternalReport(id)).rejects.toThrow('external_report_snapshot_invalid');
  });

  it('reports sanitized save, list and detail errors instead of treating database failures as empty results', async () => {
    const failure = { data: null, error: { message: 'private buyer DOB and database details' } };
    query.single.mockResolvedValueOnce(failure);
    query.range.mockResolvedValueOnce(failure);
    query.maybeSingle.mockResolvedValueOnce(failure);
    await expect(saveExternalReport({ actorId: 'admin', birth, report })).rejects.toThrow(/^external_report_save_failed$/);
    await expect(listExternalReports()).rejects.toThrow(/^external_report_list_failed$/);
    await expect(getExternalReport(id)).rejects.toThrow(/^external_report_load_failed$/);
  });
});
