import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportPrintActions } from '@/components/report/report-print-actions';
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
import { ELEMENT_INFO } from '@/lib/saju/elements';
import type { SajuDataV1, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

// Redesign 2026-05-13 (Claude Design / screens-d.jsx ScreenPdfPrint + screens-f.jsx ScreenPdfPage2):
// PDF 인쇄 페이지 시각 통일 — 干 로고 + REPORT NO + 사주팔자 4 pillars + 십성 chart.

const TEN_GOD_DESCRIPTIONS: Record<TenGodCode, string> = {
  비견: '자존·독립·동등한 동료',
  겁재: '협업·경쟁자·재물 분담',
  식신: '표현·먹을복·여유',
  상관: '재능 표현·기교',
  편재: '큰 재물·기회·유동성',
  정재: '안정적인 재물·근면',
  편관: '도전·경쟁·외부 압력',
  정관: '책임·명예·체계',
  편인: '독창적 학습·직관',
  정인: '배움·도움받음·어머니적 보호',
};

const TEN_GOD_COLORS: Record<TenGodCode, string> = {
  비견: '#5b58d6',
  겁재: '#d99020',
  식신: '#ff4f9a',
  상관: '#d81b72',
  편재: '#d99020',
  정재: '#0f9f7a',
  편관: '#ff6b6b',
  정관: '#0f9f7a',
  편인: '#c04de0',
  정인: '#0f9f7a',
};

const TEN_GOD_HANJA: Record<TenGodCode, string> = {
  비견: '比肩',
  겁재: '劫財',
  식신: '食神',
  상관: '傷官',
  편재: '偏財',
  정재: '正財',
  편관: '偏官',
  정관: '正官',
  편인: '偏印',
  정인: '正印',
};

function getTenGodPercentages(data: SajuDataV1) {
  const byType = data.tenGods?.byType;
  if (!byType) return [];
  const total = Object.values(byType).reduce((sum, v) => sum + v, 0);
  if (total === 0) return [];
  return Object.entries(byType)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({
      name: name as TenGodCode,
      value: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function buildReportNumber(input: SajuDataV1['input']) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');
  const dd = String(new Date().getDate()).padStart(2, '0');
  const seed = `${input.birth.year}${input.birth.month}${input.birth.day}`.slice(-4);
  return `GS-${yy}${mm}${dd}-${seed}`;
}

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
        <AppPage className="gangi-subpage saju-result-page space-y-5 py-6">
          <section
            className="relative overflow-hidden rounded-[20px] border p-6"
            style={{
              background: 'linear-gradient(180deg, var(--app-pink-soft) 0%, #fff 100%)',
              borderColor: 'var(--app-pink-line)',
              boxShadow: '0 22px 50px -28px rgba(216,27,114,0.22)',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,79,154,0.18), transparent 70%)' }}
            />

            <div className="relative flex items-start gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[22px] font-extrabold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                  boxShadow: '0 10px 22px rgba(216,27,114,0.32)',
                  fontFamily: 'var(--font-han)',
                }}
                aria-hidden="true"
              >
                干
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className="rounded-full border bg-white px-2.5 py-0.5 text-[10.5px] font-extrabold text-[var(--app-pink-strong)]"
                  style={{ borderColor: 'var(--app-pink-line)' }}
                >
                  🔒 PDF 저장 권한 필요
                </span>
                <h1
                  className="mt-2 text-[22px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  깊은 사주풀이 PDF는
                  <br />
                  소장권에서 열립니다
                </h1>
                <p
                  className="mt-2.5 text-[13.5px] leading-[1.78] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  PDF 저장본은 평생 소장 풀이 본문과 함께 제공됩니다. 풀이를 열면 같은 사주로 다시 들어와도
                  이 화면에서 PDF 저장을 이어갈 수 있어요.
                </p>
              </div>
            </div>

            {!isOwner ? (
              <div
                className="relative mt-4 rounded-[12px] border px-3.5 py-2.5 text-[12.5px] leading-[1.7]"
                style={{
                  background: '#fdecec',
                  borderColor: 'rgba(198,69,69,0.22)',
                  color: 'var(--app-ink)',
                }}
              >
                본인의 사주 결과가 아니면 PDF 저장 화면을 열 수 없습니다.
              </div>
            ) : null}

            <div className="relative mt-5 grid gap-2">
              <Link
                href={`/membership/checkout?plan=lifetime&slug=${encodeURIComponent(slug)}&from=pdf-print`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                깊은 사주풀이 열기 →
              </Link>
              <Link
                href={backHref}
                className="inline-flex h-12 items-center justify-center rounded-full border bg-white px-5 text-[13px] font-extrabold text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                ← 풀이 화면으로 돌아가기
              </Link>
            </div>
          </section>
        </AppPage>
      </AppShell>
    );
  }

  const targetYear = new Date().getFullYear();
  // 2026-05-15 PR 2: userSituation 을 grounding 에서 추출해 대운 cycle 8단 sub-section 에 흘림.
  const userSituation = reading.grounding.personalizationContext.userSituation ?? null;
  const report = buildLifetimeReport(reading.input, reading.sajuData, targetYear, userSituation);
  const interpretation = buildFallbackLifetimeInterpretation(report, 'female');
  const reportNo = buildReportNumber(reading.sajuData.input);
  const pillars: Array<{ label: string; stem: string; branch: string; element: string }> = [
    {
      label: '시주',
      stem: reading.sajuData.pillars.hour?.stem ?? '-',
      branch: reading.sajuData.pillars.hour?.branch ?? '-',
      element: reading.sajuData.pillars.hour?.stemElement ?? '목',
    },
    {
      label: '일주',
      stem: reading.sajuData.pillars.day.stem,
      branch: reading.sajuData.pillars.day.branch,
      element: reading.sajuData.pillars.day.stemElement,
    },
    {
      label: '월주',
      stem: reading.sajuData.pillars.month.stem,
      branch: reading.sajuData.pillars.month.branch,
      element: reading.sajuData.pillars.month.stemElement,
    },
    {
      label: '연주',
      stem: reading.sajuData.pillars.year.stem,
      branch: reading.sajuData.pillars.year.branch,
      element: reading.sajuData.pillars.year.stemElement,
    },
  ];
  const tenGodList = getTenGodPercentages(reading.sajuData);

  return (
    <AppShell>
      <AppPage className="pdf-print-page space-y-6 py-6">
        <ReportPrintActions slug={slug} backHref={backHref} />

        <article className="pdf-print-document">
          {/* Redesign 2026-05-13: mockup ScreenPdfPrint 헤더 — 干 로고 + REPORT NO + 발행일 */}
          <header
            className="pdf-print-cover"
            style={{
              borderBottom: '2px solid var(--app-ink)',
              paddingBottom: 16,
              marginBottom: 22,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 10,
                  background:
                    'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                  color: '#fff',
                  fontFamily: 'var(--font-han)',
                  fontSize: 20,
                  fontWeight: 700,
                }}
                aria-hidden="true"
              >
                干
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.025em' }}>
                  간지사주
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--app-pink-strong)',
                  }}
                >
                  달빛인생 · 사주 리포트
                </div>
              </div>
            </div>
            <div
              style={{
                textAlign: 'right',
                fontSize: 10,
                color: 'var(--app-copy-muted)',
                lineHeight: 1.6,
              }}
            >
              REPORT NO. <strong style={{ color: 'var(--app-ink)' }}>{reportNo}</strong>
              <br />
              발행일 <CurrentDateLabel /> · v1.0
            </div>
          </header>

          {/* Subject — cover info */}
          <section style={{ marginTop: 4, marginBottom: 22 }}>
            <div className="pdf-print-section-kicker" style={{ fontSize: 10 }}>
              SUBJECT
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                margin: '4px 0 0',
                lineHeight: 1.2,
              }}
            >
              {report.cover.headline}
            </h1>
            <p
              className="pdf-print-lead"
              style={{ fontSize: 13, color: 'var(--app-copy)', marginTop: 8 }}
            >
              {interpretation.oneLineSummary}
            </p>
            <div
              style={{
                fontSize: 11,
                color: 'var(--app-copy-muted)',
                marginTop: 10,
              }}
            >
              {formatBirthLine(reading.input)}
            </div>
          </section>

          {/* §1 사주팔자(四柱八字) grid — mockup ScreenPdfPrint */}
          <section style={{ marginBottom: 22 }}>
            <div className="pdf-print-section-kicker" style={{ fontSize: 10 }}>
              四柱八字
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 800, marginTop: 2, marginBottom: 10 }}>
              네 기둥과 여덟 글자
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                border: '1px solid var(--app-line)',
                borderRadius: 12,
                padding: 12,
                background: '#fff',
              }}
            >
              {pillars.map((p) => (
                <div key={p.label} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: 'var(--app-copy-muted)',
                      fontWeight: 700,
                    }}
                  >
                    {p.label}
                  </div>
                  <div
                    style={{
                      margin: '6px 0 2px',
                      fontFamily: 'var(--font-han)',
                      fontSize: 32,
                      fontWeight: 700,
                      color: ELEMENT_INFO[p.element as keyof typeof ELEMENT_INFO].color,
                      lineHeight: 1,
                    }}
                  >
                    {p.stem}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-han)',
                      fontSize: 32,
                      fontWeight: 700,
                      color: ELEMENT_INFO[p.element as keyof typeof ELEMENT_INFO].color,
                      lineHeight: 1,
                    }}
                  >
                    {p.branch}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* §2 한 줄 요약 pink-soft */}
          <section
            className="pdf-print-summary"
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'var(--app-pink-soft)',
              border: '1px solid var(--app-pink-line)',
              marginBottom: 22,
            }}
          >
            <div
              className="pdf-print-section-kicker"
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--app-pink-strong)',
                letterSpacing: '0.04em',
              }}
            >
              한 줄 요약
            </div>
            <h2 style={{ fontSize: 0, height: 0, margin: 0, padding: 0 }} aria-hidden="true">
              한 줄 요약
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 13.5,
                lineHeight: 1.65,
                color: 'var(--app-ink)',
              }}
            >
              {interpretation.opening}
            </p>
            <div className="pdf-print-keywords" style={{ marginTop: 10 }}>
              {interpretation.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
            <div className="pdf-print-rule" style={{ marginTop: 10 }}>
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

          {/* 십성 (十星) chart — mockup ScreenPdfPage2 */}
          {tenGodList.length > 0 ? (
            <section
              className="pdf-print-section"
              style={{
                marginTop: 18,
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
              }}
            >
              <div className="pdf-print-section-kicker">十星</div>
              <h2>나를 둘러싼 열 가지 기운 (상위 5)</h2>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--app-copy-muted)',
                  lineHeight: 1.55,
                  marginTop: 6,
                  maxWidth: 460,
                }}
              >
                십성은 일간(나)을 기준으로 다른 글자들과의 관계를 10가지로 분류한 것입니다.
                나를 둘러싼 기운을 보는 가장 직관적인 방법이에요.
              </p>
              <div
                style={{
                  marginTop: 14,
                  border: '1px solid var(--app-line)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                {tenGodList.map((item, index) => {
                  const color = TEN_GOD_COLORS[item.name];
                  const width = Math.max(2, Math.min(100, item.value * 2.5));
                  return (
                    <div
                      key={item.name}
                      style={{
                        padding: '12px 0',
                        borderBottom:
                          index < tenGodList.length - 1 ? '1px solid var(--app-line)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: color,
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            fontFamily: 'var(--font-han)',
                            fontSize: 18,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        >
                          {TEN_GOD_HANJA[item.name]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 800 }}>
                              {item.name}{' '}
                              <span
                                style={{
                                  color: 'var(--app-copy-muted)',
                                  fontWeight: 600,
                                  fontSize: 11,
                                }}
                              >
                                ({TEN_GOD_HANJA[item.name]})
                              </span>
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 800, color }}>
                              {item.value}%
                            </span>
                          </div>
                          <div
                            style={{
                              height: 4,
                              background: 'var(--app-line)',
                              borderRadius: 999,
                              marginTop: 6,
                              overflow: 'hidden',
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                height: '100%',
                                width: `${width}%`,
                                background: color,
                              }}
                            />
                          </div>
                          <p
                            style={{
                              margin: '6px 0 0',
                              fontSize: 10.5,
                              color: 'var(--app-copy-muted)',
                              lineHeight: 1.5,
                            }}
                          >
                            {TEN_GOD_DESCRIPTIONS[item.name]}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

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
