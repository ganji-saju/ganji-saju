// 랜딩 비회원 주문 손님 결과 화면. 상담사가 발송한(sent) 주문만 보인다 — 없는 토큰·발송 전·환불·보관 기간 지남은 모두 같은 404.
//   저장된 풀이 snapshot 을 그대로 그린다(AI 재호출 없음). 이름·생년월일은 공유 미리보기·검색에 내보내지 않는다.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReportOrderByToken } from '@/lib/report-orders/report-order-store';
import { getExternalReport } from '@/lib/admin/external-report-history';
import { ExternalReportView } from '@/app/admin/external-report/report-view';
import { HistoryPrintButton } from '@/app/admin/external-report/history/history-print-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: '간지사주 풀이' },
    robots: { index: false, follow: false },
    // 링크를 눌러 다른 사이트·페이지로 갈 때 주소(= 열람 열쇠)를 리퍼러로 넘기지 않는다.
    referrer: 'no-referrer',
    openGraph: { title: '간지사주 풀이' },
  };
}

export default async function ReportResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getReportOrderByToken(token).catch(() => null);
  if (!order || order.status !== 'sent' || order.purgedAt || !order.externalReportId) notFound();
  const saved = await getExternalReport(order.externalReportId).catch(() => null);
  if (!saved) notFound();
  const report = saved.report;

  return (
    <main className="min-h-screen bg-[#fbf8f3]">
      <div className="mx-auto max-w-3xl px-4 py-6 print:hidden">
        <p className="mb-3 text-lg font-bold">간지사주 풀이가 도착했어요</p>
        <p className="mb-4 text-base text-[#5c514a]">아래 버튼을 누르면 PDF로 저장하거나 인쇄할 수 있어요. 이 링크는 1년간 열 수 있어요.</p>
        <HistoryPrintButton subjectName={report.data.subjectName} kind={report.kind ?? 'lifetime'} year={report.kind === 'new-year' ? report.year : undefined} />
      </div>
      <ExternalReportView report={report} />
      <p className="mx-auto max-w-3xl px-4 py-6 text-sm text-[#5c514a] print:hidden">
        풀이 본문은 사주 계산과 AI로 작성하고 상담사가 확인했습니다. 참고용이며 의학·법률·투자 판단을 대신하지 않습니다.{' '}
        <a className="underline" href="/ai-disclaimer">AI 이용 안내</a>
      </p>
    </main>
  );
}
