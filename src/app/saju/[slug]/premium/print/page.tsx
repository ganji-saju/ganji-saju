import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportPrintActions } from '@/components/report/report-print-actions';
import { Badge } from '@/components/ui/badge';
import { buildLifetimeReport } from '@/domain/saju/report';
import type { SajuLifetimeAiSectionKey } from '@/server/ai/saju-lifetime-interpretation';
import { buildFallbackLifetimeInterpretation } from '@/server/ai/saju-lifetime-interpretation';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

const PRINT_SECTION_ORDER: Array<{ key: SajuLifetimeAiSectionKey; label: string }> = [
  { key: 'coreIdentity', label: '타고난 성향' },
  { key: 'strengthBalance', label: '기운의 균형' },
  { key: 'patternAndYongsin', label: '역할과 보완 힌트' },
  { key: 'relationshipPattern', label: '관계 패턴' },
  { key: 'wealthStyle', label: '재물 감각' },
  { key: 'careerDirection', label: '직업 방향' },
  { key: 'healthRhythm', label: '생활 리듬' },
  { key: 'majorLuckTimeline', label: '10년 단위 큰 흐름' },
  { key: 'lifetimeStrategy', label: '평생 활용 전략' },
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '깊은 사주풀이 PDF 저장',
    description: '평생 소장용 깊은 사주풀이를 PDF로 저장하기 위한 인쇄 화면입니다.',
    robots: {
      index: false,
      follow: false,
    },
  };
}

function splitSentences(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatBirthLine(input: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  gender?: 'male' | 'female';
  birthLocation?: { label: string } | null;
  solarTimeMode?: string;
}) {
  const genderLabel = input.gender === 'male' ? '남성' : input.gender === 'female' ? '여성' : '성별 미입력';
  const minuteLabel = input.minute !== undefined ? `${String(input.minute).padStart(2, '0')}분` : '';
  const timeLabel = input.hour !== undefined ? `${input.hour}시 ${minuteLabel}`.trim() : '시간 미입력';
  const locationLabel = input.birthLocation?.label ?? '출생지 미입력';
  const timeModeLabel = input.solarTimeMode === 'longitude' ? '진태양시 반영' : '표준시 반영';

  return `${input.year}년 ${input.month}월 ${input.day}일 · ${timeLabel} · ${genderLabel} · ${locationLabel} · ${timeModeLabel}`;
}

function CurrentDateLabel() {
  const now = new Date();
  const label = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeZone: 'Asia/Seoul',
  }).format(now);

  return <>{label}</>;
}

function PrintSection({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  const paragraphs = splitSentences(body);

  return (
    <section className="pdf-print-section">
      <div className="pdf-print-section-kicker">{String(index).padStart(2, '0')}</div>
      <h2>{title}</h2>
      <div className="pdf-print-paragraphs">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <p key={`${title}-${paragraphIndex}`}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

async function resolvePdfAccess(slug: string) {
  const reading = await resolveReading(slug);
  if (!reading) return { reading: null, hasAccess: false, isOwner: false };

  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return { reading, hasAccess: false, isOwner: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { reading, hasAccess: false, isOwner: false };

  const isOwner = !reading.userId || reading.userId === user.id;
  if (!isOwner) return { reading, hasAccess: false, isOwner };

  const readingKey = toSlug(reading.input);
  const entitlement = await getLifetimeReportEntitlement(user.id, readingKey, [slug]);

  return {
    reading,
    hasAccess: Boolean(entitlement),
    isOwner,
  };
}

export default async function LifetimeReportPrintPage({ params }: Props) {
  const { slug } = await params;
  const { reading, hasAccess, isOwner } = await resolvePdfAccess(slug);

  if (!reading) notFound();

  const backHref = `/saju/${encodeURIComponent(slug)}/premium`;

  if (!hasAccess) {
    return (
      <AppShell>
        <AppPage className="space-y-6 py-8">
          <section className="gangi-report-panel p-7 sm:p-8">
            <Badge className="border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
              PDF 저장 권한 필요
            </Badge>
            <h1 className="mt-5 text-4xl text-[var(--app-ivory)] sm:text-5xl">
              깊은 사주풀이 PDF는 소장권에서 열립니다
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--app-copy)]">
              PDF 저장본은 평생 소장 풀이 본문과 함께 제공됩니다. 풀이를 열면 같은 사주로 다시 들어와도
              이 화면에서 PDF 저장을 이어갈 수 있습니다.
            </p>
            {!isOwner ? (
              <p className="mt-3 text-sm leading-7 text-rose-100">
                본인의 사주 결과가 아니면 PDF 저장 화면을 열 수 없습니다.
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/membership/checkout?plan=lifetime&slug=${encodeURIComponent(slug)}&from=pdf-print`}
                className="gangi-primary-button"
              >
                깊은 사주풀이 열기
              </Link>
              <Link
                href={backHref}
                className="gangi-secondary-button"
              >
                풀이 화면으로 돌아가기
              </Link>
            </div>
          </section>
        </AppPage>
      </AppShell>
    );
  }

  const targetYear = new Date().getFullYear();
  const report = buildLifetimeReport(reading.input, reading.sajuData, targetYear);
  const interpretation = buildFallbackLifetimeInterpretation(report, 'female');

  return (
    <AppShell>
      <AppPage className="pdf-print-page space-y-6 py-6">
        <ReportPrintActions slug={slug} backHref={backHref} />

        <article className="pdf-print-document">
          <header className="pdf-print-cover">
            <div className="pdf-print-brand">달빛인생</div>
            <p className="pdf-print-kicker">평생 소장 깊은 사주풀이</p>
            <h1>{report.cover.headline}</h1>
            <p className="pdf-print-lead">{interpretation.oneLineSummary}</p>
            <div className="pdf-print-meta">
              <span>{formatBirthLine(reading.input)}</span>
              <span>생성일 <CurrentDateLabel /></span>
            </div>
          </header>

          <section className="pdf-print-summary">
            <h2>한 장 요약</h2>
            <p>{interpretation.opening}</p>
            <div className="pdf-print-keywords">
              {interpretation.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
            <div className="pdf-print-rule">
              <strong>평생 힌트</strong>
              <p>{interpretation.lifetimeRule}</p>
            </div>
          </section>

          {PRINT_SECTION_ORDER.map((section, index) => (
            <PrintSection
              key={section.key}
              index={index + 1}
              title={section.label}
              body={interpretation.sections[section.key]}
            />
          ))}

          <section className="pdf-print-section">
            <div className="pdf-print-section-kicker">10</div>
            <h2>10년 단위 큰 흐름표</h2>
            <div className="pdf-print-cycle-list">
              {report.majorLuckTimeline.cycles.map((cycle) => (
                <div key={`${cycle.ageLabel}-${cycle.ganzi}`} className="pdf-print-cycle">
                  <strong>
                    {cycle.ageLabel} · {cycle.ganzi} · {cycle.phase}
                  </strong>
                  <p>{cycle.summary}</p>
                  <p>{cycle.task}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pdf-print-section">
            <div className="pdf-print-section-kicker">11</div>
            <h2>{report.yearlyAppendix.yearLabel} 부록</h2>
            <p>{report.yearlyAppendix.oneLineSummary}</p>
            <div className="pdf-print-two-column">
              <div>
                <strong>상반기</strong>
                <p>{report.yearlyAppendix.firstHalf}</p>
              </div>
              <div>
                <strong>하반기</strong>
                <p>{report.yearlyAppendix.secondHalf}</p>
              </div>
            </div>
          </section>

          <section className="pdf-print-section">
            <div className="pdf-print-section-kicker">12</div>
            <h2>반복해서 기억할 것</h2>
            <ul className="pdf-print-list">
              {interpretation.rememberRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <footer className="pdf-print-footer">
            달빛인생의 해석은 삶의 흐름을 참고하기 위한 구조 해석입니다. 의료·법률·투자·위기상황 판단은
            전문가의 도움을 우선해 주세요.
          </footer>
        </article>
      </AppPage>
    </AppShell>
  );
}
