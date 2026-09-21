import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { ReportDocument } from '@/components/report/report-document';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { getExternalReport } from '@/lib/admin/external-report-history';
import { createClient } from '@/lib/supabase/server';
import { HistoryPrintButton } from '../history-print-button';

export const metadata: Metadata = {
  title: '저장된 PDF 보고서 (admin)',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function SavedExternalReportPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');

  const { id } = await params;
  let saved;
  try {
    saved = await getExternalReport(id);
  } catch {
    return (
      <AdminPage title="저장된 PDF 보고서">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          저장된 보고서를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </p>
        <Link href="/admin/external-report/history" className="text-sm underline underline-offset-4">생성 기록으로</Link>
      </AdminPage>
    );
  }
  if (!saved) notFound();

  return (
    <AdminPage title="저장된 PDF 보고서" className="external-report-workspace">
      <div className="external-report-controls mx-auto flex max-w-[960px] flex-wrap items-start justify-between gap-4 rounded-lg border border-[var(--app-line)] p-5">
        <div className="space-y-2 text-sm text-[var(--app-copy-soft)]">
          <h2 className="font-bold text-[var(--app-ink)]">{saved.subjectName}님의 깊은 사주풀이</h2>
          <p>{saved.reportNo} · 생성일 {new Date(saved.createdAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16)} (한국시간)</p>
          <p>생성 당시 저장한 풀이입니다. 인쇄 창에서 ‘PDF로 저장’을 선택해 주세요.</p>
          {saved.report.generationWarning ? <p role="status" className="text-amber-800">{saved.report.generationWarning}</p> : null}
          <Link href="/admin/external-report/history" className="inline-block underline underline-offset-4">생성 기록으로</Link>
        </div>
        <HistoryPrintButton subjectName={saved.subjectName} />
      </div>
      <div className="external-report-preview">
        <ReportDocument data={saved.report.data} issuedAt={saved.report.issuedAt} showRecommendations={false} />
      </div>
    </AdminPage>
  );
}
