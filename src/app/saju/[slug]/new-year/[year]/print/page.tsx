// 2026-09-26 — 2027 신년운세 PDF. 이용권 확인 뒤 A4 문서(장마다 새 쪽)를 그리고 브라우저 "PDF로 저장"을 쓴다
//   (평생운세 PDF 와 같은 방식 — 서버에서 PDF 파일을 만들지 않는다). 풀이는 화면과 같은 캐시를 쓴다.
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ReportPrintActions } from '@/components/report/report-print-actions';
import { NEW_YEAR_TARGET_YEAR } from '@/lib/payments/catalog';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { generateYearlyInterpretation } from '@/server/ai/saju-yearly-service';
import type { NewYearHighlightCategory } from '@/server/ai/saju-yearly-interpretation';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const dynamic = 'force-dynamic';
// 캐시가 없으면 연간 3단계를 병렬 생성한다(/api/interpret/yearly 와 같은 상한).
export const maxDuration = 75;

interface Props {
  params: Promise<{ slug: string; year: string }>;
}

const CATEGORY_LABEL: Record<NewYearHighlightCategory, string> = {
  work: '일·직업운',
  wealth: '재물운',
  love: '연애·결혼운',
  relationship: '인간관계운',
  health: '건강운',
  move: '이동·변화운',
  family: '가족운',
  study: '학업·시험운',
};
const BASE_CATEGORIES = ['work', 'wealth', 'love', 'relationship', 'health', 'move'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${NEW_YEAR_TARGET_YEAR} 신년운세 PDF 저장`,
    robots: { index: false, follow: false },
  };
}

function Chapter({ no, total, title, children }: { no: number; total: number; title: string; children: ReactNode }) {
  return (
    <section className="report-page" data-page={no}>
      <div className="text-[11px] font-bold text-[var(--rp-ink-muted)]">{NEW_YEAR_TARGET_YEAR} 신년운세</div>
      <h2 className="mt-2 text-[20px] font-extrabold">{title}</h2>
      <div className="mt-4 space-y-3 text-[12.5px] leading-[1.75]" style={{ wordBreak: 'keep-all' }}>
        {children}
      </div>
      <footer className="mt-auto pt-4 text-right text-[10px] text-[var(--rp-ink-muted)]">
        {no} / {total}
      </footer>
    </section>
  );
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
  const extras = interpretation.newYear;
  const total = 7;

  return (
    <AppShell>
      <AppPage className="pdf-report-page-wrap mx-auto space-y-4 py-6">
        <ReportPrintActions slug={slug} backHref={previewHref} from="new_year_print_page" />
        <article className="report-doc" aria-label={`${NEW_YEAR_TARGET_YEAR} 신년운세 PDF 미리보기`}>
          <Chapter no={1} total={total} title={`${NEW_YEAR_TARGET_YEAR} 한눈에`}>
            <p className="text-[15px] font-extrabold">{interpretation.oneLineSummary}</p>
            <p>{report.annualContext.yearGanji}년의 흐름과 내 사주가 만나는 한 해입니다.</p>
            <ul className="list-disc pl-5">
              {interpretation.keywords.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </Chapter>

          <Chapter no={2} total={total} title="총론">
            <p>{interpretation.opening}</p>
            <h3 className="font-extrabold">상반기</h3>
            <p>{interpretation.firstHalf}</p>
            <h3 className="font-extrabold">하반기</h3>
            <p>{interpretation.secondHalf}</p>
          </Chapter>

          <Chapter no={3} total={total} title="분야별 운">
            {BASE_CATEGORIES.map((key) => (
              <div key={key}>
                <h3 className="font-extrabold">{CATEGORY_LABEL[key]}</h3>
                <p>{interpretation.categories[key]}</p>
              </div>
            ))}
            {extras ? (
              <>
                <div>
                  <h3 className="font-extrabold">{CATEGORY_LABEL.family}</h3>
                  <p>{extras.categories.family}</p>
                </div>
                <div>
                  <h3 className="font-extrabold">{CATEGORY_LABEL.study}</h3>
                  <p>{extras.categories.study}</p>
                </div>
              </>
            ) : null}
          </Chapter>

          <Chapter no={4} total={total} title="분기별 흐름">
            {extras?.quarterlyFlows.map((q) => (
              <div key={q.quarter}>
                <h3 className="font-extrabold">
                  {q.quarter}분기 · {q.months[0]}~{q.months[2]}월 — {CATEGORY_LABEL[q.focusCategory]}
                </h3>
                <p>{q.summary}</p>
              </div>
            ))}
          </Chapter>

          <Chapter no={5} total={total} title="월별 흐름">
            {interpretation.monthlyFlows.map((m) => (
              <div key={m.month}>
                <h3 className="font-extrabold">
                  {report.monthlyFlows.find((f) => f.month === m.month)?.label ?? `${m.month}월`}
                </h3>
                <p>{m.summary}</p>
                {m.caution ? <p>조심: {m.caution}</p> : null}
                {m.action ? <p>할 일: {m.action}</p> : null}
              </div>
            ))}
          </Chapter>

          <Chapter no={6} total={total} title="기대할 일과 조심할 일">
            <h3 className="font-extrabold">기대할 일</h3>
            <ul className="list-disc pl-5">
              {(extras?.expectations ?? []).map((h) => (
                <li key={`e-${h.month}-${h.text}`}>
                  <strong>
                    {h.month}월 · {CATEGORY_LABEL[h.category]}
                  </strong>{' '}
                  {h.text}
                </li>
              ))}
            </ul>
            <h3 className="font-extrabold">조심할 일</h3>
            <ul className="list-disc pl-5">
              {(extras?.cautions ?? []).map((h) => (
                <li key={`c-${h.month}-${h.text}`}>
                  <strong>
                    {h.month}월 · {CATEGORY_LABEL[h.category]}
                  </strong>{' '}
                  {h.text}
                </li>
              ))}
            </ul>
          </Chapter>

          <Chapter no={7} total={total} title="올해의 행동 지침">
            <ul className="list-disc pl-5">
              {interpretation.actionAdvice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="text-[11px] text-[var(--rp-ink-muted)]">
              이 풀이는 사주 명리에 따른 참고 해석이며 특정 사건을 예언하지 않습니다.
            </p>
          </Chapter>
        </article>
      </AppPage>
    </AppShell>
  );
}
