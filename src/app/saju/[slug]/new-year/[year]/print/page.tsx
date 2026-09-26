// 2026-09-26 — 2027 신년운세 PDF. 이용권 확인 뒤 A4 문서(장마다 새 쪽)를 그리고 브라우저 "PDF로 저장"을 쓴다
//   (평생운세 PDF 와 같은 방식 — 서버에서 PDF 파일을 만들지 않는다). 풀이는 화면과 같은 캐시를 쓴다.
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportPrintActions } from '@/components/report/report-print-actions';
import { NEW_YEAR_TARGET_YEAR } from '@/lib/payments/catalog';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';
import { NewYearReportDocument } from '@/components/report/new-year-report-document';
import { buildLifetimeReport } from '@/domain/saju/report';
import { buildPdfModel } from '@/lib/saju/pdf-report-model';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const dynamic = 'force-dynamic';
// 캐시가 없으면 연간 3단계를 병렬 생성한다(/api/interpret/yearly 와 같은 상한).
export const maxDuration = 75;

interface Props {
  params: Promise<{ slug: string; year: string }>;
}

function buildReportNumber(input: { year: number; month: number; day: number }) {
  const seed = `${input.year}${input.month}${input.day}`.slice(-4);
  return `GS-NY${NEW_YEAR_TARGET_YEAR % 100}-${seed}`;
}

/** 발행일 — "2026.09.27" (KST). */
function issuedDateLabel() {
  const parts = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}.${pick('month')}.${pick('day')}`;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${NEW_YEAR_TARGET_YEAR} 신년운세 PDF 저장`,
    robots: { index: false, follow: false },
  };
}

export default async function NewYearPrintPage({ params }: Props) {
  const { slug, year } = await params;
  if (Number(year) !== NEW_YEAR_TARGET_YEAR) notFound();

  const previewHref = `/saju/${encodeURIComponent(slug)}/new-year/${NEW_YEAR_TARGET_YEAR}`;
  const { reading, hasAccess } = await resolveNewYearAccess(slug, NEW_YEAR_TARGET_YEAR);
  if (!reading) notFound();
  if (!hasAccess) redirect(previewHref);

  const response = await generateYearlyInterpretation({
    readingIdentifier: slug,
    targetYear: NEW_YEAR_TARGET_YEAR,
    includeNewYear: true,
  });
  if (!response) notFound();

  const { report, interpretation } = response;
  // 사주팔자 명식·오행·십성·신살은 평생 PDF 와 같은 모델에서 뽑는다(결정론 — LLM 비용 없음).
  const data = buildPdfModel(
    reading,
    buildLifetimeReport(reading.input, reading.sajuData, NEW_YEAR_TARGET_YEAR),
    buildReportNumber(reading.input),
    NEW_YEAR_TARGET_YEAR
  );

  return (
    <AppShell>
      <AppPage className="pdf-report-page-wrap mx-auto space-y-4 py-6">
        <ReportPrintActions slug={slug} backHref={previewHref} from="new_year_print_page" />
        <NewYearReportDocument
          data={data}
          report={report}
          interpretation={interpretation}
          issuedAt={issuedDateLabel()}
          year={NEW_YEAR_TARGET_YEAR}
        />
      </AppPage>
    </AppShell>
  );
}
