// 생성 직후 미리보기와 저장된 기록 상세가 같은 문서를 그리도록 종류별 분기를 한 곳에 둔다.
import { ReportDocument } from '@/components/report/report-document';
import { NewYearReportDocument } from '@/components/report/new-year-report-document';
import type { ExternalReportSnapshot } from '@/lib/admin/external-report';

export function ExternalReportView({ report }: { report: ExternalReportSnapshot }) {
  if (report.kind === 'new-year') {
    return (
      <NewYearReportDocument data={report.data} report={report.report} interpretation={report.interpretation}
        issuedAt={report.issuedAt} year={report.year} />
    );
  }
  return <ReportDocument data={report.data} issuedAt={report.issuedAt} showRecommendations={false} />;
}

/** 인쇄 창의 기본 파일 이름. */
export function externalReportPrintTitle(kind: 'lifetime' | 'new-year', subjectName: string, year?: number): string {
  const name = subjectName.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  return kind === 'new-year' ? `간지사주_${year ?? ''}신년운세_${name}` : `간지사주_깊은사주풀이_${name}`;
}
