import Link from 'next/link';
import { Children, isValidElement, type ReactNode } from 'react';
import { Price } from '@/components/payments/price-provider';
import { PDF_ELEMENT_COLORS, ELEMENT_HANJA } from '@/lib/saju/pdf-report-maps';
import { ganziToKorean } from '@/lib/saju/terminology';
import { InkIcon } from '@/components/gangi/ink-icons';
import { chunkPdfYears, paginatePdfNarrative } from '@/lib/saju/pdf-report-pages';
import type { PdfReportModel } from '@/lib/saju/pdf-report-model';
export type { PdfReportModel } from '@/lib/saju/pdf-report-model';

/** 문장 경계로 끊어 2문장씩 묶는다. 문장부호가 없으면 통째로 한 덩어리(안전). */
function splitIntoParagraphs(text: string, perParagraph = 2): string[] {
  const sentences = text
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return text.trim() ? [text.trim()] : [];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) {
    out.push(sentences.slice(i, i + perParagraph).join(' '));
  }
  return out;
}

export function DeepSection({ no, label, text }: { no: number; label: string; text: string }) {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length === 0) return null;
  // 첫 문단은 리드 — 눈이 들어올 자리를 만든다. 나머지는 본문 리듬.
  const [lead, ...rest] = paragraphs;
  return (
    <section className="rp-deep-sec">
      <div className="rp-deep-head">
        <span className="rp-deep-no">{String(no).padStart(2, '0')}</span>
        <span className="rp-deep-label">{label}</span>
      </div>
      <p className="rp-deep-lead">{lead}</p>
      {rest.map((paragraph, i) => (
        <p key={i} className="rp-deep-body">
          {paragraph}
        </p>
      ))}
    </section>
  );
}

// ── 공통 페이지 조각 ─────────────────────────────────────────────────────────

const FOOTER_COPY = '© 2026 푸꼬컴퍼니 · 간지사주';

/** P2~P8 상단 running header (REPORT NO · 이름 + 干支). */
export function RunningHeader({ reportNo, subjectName }: { reportNo: string; subjectName: string }) {
  return (
    <div className="rp-runhead">
      <span>
        {reportNo} · {subjectName} 사주 리포트
      </span>
      <span className="rp-runhead-mark">干支</span>
    </div>
  );
}

/** 모든 페이지 하단 footer (© + PAGE n / 8). */
export function PageFooter({ page, total = 8 }: { page: number; total?: number }) {
  return (
    <div className="rp-foot">
      <span>{FOOTER_COPY}</span>
      <span className="rp-foot-page">
        PAGE {page} / {total}
      </span>
    </div>
  );
}

/** 챕터 헤더 (CHAPTER 0n + 2줄 제목 + 리드). */
export function ChapterHead({
  no,
  titleLines,
  lead,
}: {
  no: string;
  titleLines: [string, string];
  lead: string;
}) {
  return (
    <div className="rp-chaphead">
      <div className="rp-eyebrow">CHAPTER {no}</div>
      <h2 className="rp-chaptitle">
        {titleLines[0]}
        <br />
        {titleLines[1]}
      </h2>
      <p className="rp-chaplead">{lead}</p>
    </div>
  );
}

/** 새 목차와 이전 저장본 모두 실제 인쇄 순서가 표시 쪽수와 같도록 한다. */
function OrderedPages({ children }: { children: ReactNode }) {
  const pageNumber = (node: ReactNode) => isValidElement<{ 'data-page': number | string }>(node) ? Number(node.props['data-page']) : 0;
  return <>{Children.toArray(children).sort((a, b) => pageNumber(a) - pageNumber(b))}</>;
}

/** 공통 생애 보고서: 성향, 대운 심층 분석, 출생~100세 연도별 풀이. */
export function ReportDocument({
  data,
  issuedAt,
  showRecommendations = true,
}: {
  data: PdfReportModel;
  issuedAt: string;
  showRecommendations?: boolean;
}) {
  const questionEdition = data.readingEdition === 'questions-v1';
  const narrativePages = paginatePdfNarrative(data.deepReading ? [
    { label: '풀이를 시작하며', text: data.deepReading.opening, chapter: questionEdition ? '타고난 성향' : undefined },
    ...data.deepReading.sections,
    { label: '기억할 규칙', text: data.deepReading.rememberRules.join('\n\n'), chapter: questionEdition ? '평생 활용 전략' : undefined },
  ] : []);
  const annualPages = chunkPdfYears(data.timeline.years);
  const narrativeStartPage = questionEdition ? 5 : 8;
  const cycleIndexPage = questionEdition ? narrativeStartPage + narrativePages.length : 4;
  const cycleStartPage = questionEdition ? cycleIndexPage + 1 : 8 + narrativePages.length;
  const annualStartPage = cycleStartPage + data.timeline.cycles.length;
  const annualEndPage = annualStartPage + annualPages.length - 1;
  const tenGodPage = questionEdition ? annualEndPage + 1 : 2;
  const patternPage = questionEdition ? annualEndPage + 2 : 6;
  const guidePage = questionEdition ? 2 : 7;
  const areaPage = questionEdition ? 3 : 5;
  const identityPage = questionEdition ? 4 : 3;
  const totalPages = annualEndPage + (questionEdition ? 3 : 1);
  const chapterRanges = narrativePages.reduce<Array<{ title: string; start: number; end: number }>>((ranges, sections, index) => {
    const title = sections[0].chapter ?? sections[0].label;
    if (ranges.at(-1)?.title === title) ranges[ranges.length - 1].end = narrativeStartPage + index;
    else ranges.push({ title, start: narrativeStartPage + index, end: narrativeStartPage + index });
    return ranges;
  }, []);
  const birthYear = data.timeline.years[0].year;
  return (
            <article className={`report-doc${questionEdition ? ' rp-question-edition' : ''}`} aria-label="사주 리포트 PDF 미리보기">
              <OrderedPages>
              {/* ─────────────── PAGE 1 · 표지 / 요약 ─────────────── */}
              <section className="report-page" data-page="1">
                <header className="rp-cover-head">
                  <div className="rp-brand">
                    <span className="rp-logo" aria-hidden="true">干</span>
                    <span className="rp-brand-text">
                      <span className="rp-brand-title">간지사주</span>
                      <span className="rp-brand-sub">간지사주 · 사주 리포트</span>
                    </span>
                  </div>
                  <div className="rp-cover-meta">
                    <span>
                      REPORT NO. <strong>{data.reportNo}</strong>
                    </span>
                    <br />
                    <span>발행일 {issuedAt} · {questionEdition ? 'v3.0' : 'v2.0'}</span>
                  </div>
                </header>

                {/* SUBJECT */}
                <div className="rp-subject">
                  <div className="rp-eyebrow">SUBJECT</div>
                  <h1 className="rp-subject-title">{data.subjectTitle}</h1>
                  <div className="rp-subject-info">
                    <span>
                      <strong>생년월일</strong> {data.birth.dateLabel}
                    </span>
                    <span>
                      <strong>시각</strong> {data.birth.timeLabel}
                    </span>
                    <span>
                      <strong>성별</strong> {data.birth.genderLabel}
                    </span>
                  </div>
                </div>

                {/* 四柱八字 */}
                <div className="rp-block">
                  <div className="rp-eyebrow">사주팔자</div>
                  <h3 className="rp-block-title">네 기둥과 여덟 글자</h3>
                  <div className="rp-pillars">
                    {data.pillars.map((p) => (
                      <div key={p.label} className="rp-pillar">
                        <div className="rp-pillar-label">{p.label}</div>
                        <div className="rp-pillar-stem" style={{ color: p.color }}>
                          {p.stem}
                        </div>
                        <div className="rp-pillar-branch" style={{ color: p.branchColor }}>
                          {p.branch}
                        </div>
                        <div className="rp-pillar-god">{p.god}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 한 줄 요약 */}
                <div className="rp-summary">
                  <div className="rp-eyebrow">한 줄 요약</div>
                  <p>{data.oneLine}</p>
                </div>

                {/* 2-col: 五行 균형 | 분야별 흐름 */}
                <div className="rp-twocol">
                  <div className="rp-card">
                    <div className="rp-eyebrow">오행 균형</div>
                    <div className="rp-donut-row">
                      <div className="rp-donut" style={{ background: data.donutGradient }}>
                        <span
                          className="rp-donut-hole"
                          style={{ color: PDF_ELEMENT_COLORS[data.dominantElement] }}
                        >
                          {ELEMENT_HANJA[data.dominantElement]}
                        </span>
                      </div>
                      <ul className="rp-elem-legend">
                        {data.elements.map((e) => (
                          <li key={e.element}>
                            <span className="rp-elem-dot" style={{ background: e.color }} />
                            <span className="rp-elem-name">
                              {e.element}({ELEMENT_HANJA[e.element]})
                            </span>
                            <strong className="rp-elem-pct">
                              {e.pct}
                              <span>%</span>
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rp-card">
                    <div className="rp-eyebrow">{questionEdition ? '나를 이해하는 세 가지 질문' : '분야별 흐름'}</div>
                    {questionEdition ? <div className="rp-cover-questions">{data.fieldNotes.map((note) => <p key={note.label}><strong>{note.label}</strong>{note.text}</p>)}</div> : <div className="rp-bars">
                      {data.areaBars.map((bar) => (
                        <div key={bar.label} className="rp-bar-row">
                          <div className="rp-bar-head">
                            <span>{bar.label}</span>
                            <span>{bar.score}</span>
                          </div>
                          <div className="rp-bar-track">
                            <span className="rp-bar-fill" style={{ width: `${bar.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>}
                  </div>
                </div>

                {/* 2026-07-23 — 표지를 A4 1장에 맞추기 위해 '분야별 풀이'(전문은 CHAPTER 05)와
                    '대운 10년 단위'(동일 칩+차트는 CHAPTER 04) 프리뷰 블록을 표지에서 제거.
                    두 블록 모두 바로 뒤 챕터에 전체가 실리므로 정보 손실은 없다. */}

                <div className="rp-cover-foot">
                  <p>
                    본 리포트는 운세 콘텐츠로 참고용입니다. 의료·법률·투자·위기 판단은 전문
                    원칙을 우선하세요.
                    <br />
                    {FOOTER_COPY} · ganjisaju.kr
                  </p>
                  <span className="rp-foot-page">PAGE 1 / {totalPages}</span>
                </div>
              </section>

              {/* ─────────────── PAGE 2 · 십성 ─────────────── */}
              <section className="report-page" data-page={tenGodPage}>
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no={questionEdition ? '참고 01' : '02'}
                  titleLines={['십성(十星)으로 보는', '기운의 분포']}
                  lead="십성은 일간(나)을 바탕으로 다른 글자들과의 관계를 10가지로 분류한 것입니다. 나를 둘러싼 기운을 보는 가장 직관적인 방법이에요."
                />

                <div className="rp-tengod-list">
                  {data.tenGods.map((t) => (
                    <div key={t.name} className="rp-tengod-row">
                      <span className="rp-tengod-chip" style={{ background: t.color }}>
                        {t.hanja}
                      </span>
                      <div className="rp-tengod-body">
                        <div className="rp-tengod-head">
                          <span className="rp-tengod-name">
                            {t.name} <em>({t.hanja})</em>
                          </span>
                          <strong style={{ color: t.color }}>
                            {t.pct}
                            <span>%</span>
                          </strong>
                        </div>
                        <p>{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 신살 */}
                <div className="rp-block">
                  <div className="rp-eyebrow">신살</div>
                  <h3 className="rp-block-title">내 사주에 자리잡은 작은 별</h3>
                  <div className="rp-sinsal-grid">
                    {data.sinsal.map((s) => (
                      <div
                        key={s.label}
                        className={`rp-sinsal-cell${s.have ? '' : ' is-absent'}`}
                      >
                        <div className="rp-sinsal-name">{s.label}</div>
                        <div className="rp-sinsal-meaning">{s.have ? s.meaning : '없음'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 종합 해석 */}
                <div className="rp-interp">
                  <div className="rp-eyebrow">종합 해석</div>
                  <p>{data.tenGodSummary}</p>
                </div>

                <PageFooter page={tenGodPage} total={totalPages} />
              </section>

              {/* ─────────────── PAGE 3 · 일주 ─────────────── */}
              <section className="report-page" data-page={identityPage}>
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no={questionEdition ? '02' : '03'}
                  titleLines={['일주(日柱)', '당신을 보여주는 두 글자']}
                  lead="일주는 사주에서 ‘나’를 의미합니다. 일간(나의 본질)과 일지(나의 환경)가 만나 만들어진 캐릭터예요."
                />

                <div className="rp-ilju-hero">
                  <span className="rp-ilju-hero-glyph">{data.ilju.ganzi}</span>
                  <div className="rp-ilju-hero-text">
                    <div className="rp-eyebrow rp-on-pink">ILJU · 일주</div>
                    <div className="rp-ilju-hero-name">{data.ilju.name}</div>
                    <p>{data.ilju.headline}</p>
                  </div>
                </div>

                <div className="rp-twocol">
                  <div className="rp-card rp-ilju-card">
                    <div className="rp-eyebrow rp-faint">일간 · 나의 본질</div>
                    <div className="rp-ilju-card-head">
                      <span
                        className="rp-ilju-chip"
                        style={{ background: data.ilju.stem.color }}
                      >
                        {data.ilju.stem.hanja}
                      </span>
                      <div>
                        <div className="rp-ilju-card-name">
                          {data.ilju.stem.korean}({data.ilju.stem.hanja})
                        </div>
                        <div className="rp-ilju-card-nature">{data.ilju.stem.natureLine}</div>
                      </div>
                    </div>
                    <p>{data.ilju.stem.description}</p>
                  </div>

                  <div className="rp-card rp-ilju-card">
                    <div className="rp-eyebrow rp-faint">일지 · 나의 환경</div>
                    <div className="rp-ilju-card-head">
                      <span
                        className="rp-ilju-chip"
                        style={{ background: data.ilju.branch.color }}
                      >
                        {data.ilju.branch.hanja}
                      </span>
                      <div>
                        <div className="rp-ilju-card-name">
                          {data.ilju.branch.korean}({data.ilju.branch.hanja})
                        </div>
                        <div className="rp-ilju-card-nature">{data.ilju.branch.natureLine}</div>
                      </div>
                    </div>
                    <p>{data.ilju.branch.description}</p>
                  </div>
                </div>

                <div className="rp-block">
                  <div className="rp-eyebrow">PERSONALITY · 성격 키워드</div>
                  <div className="rp-trait-grid">
                    {data.traits.map((t) => (
                      <div key={t.label} className="rp-trait-card">
                        <span className="rp-trait-score" style={{ background: t.color }}>
                          {t.score}
                        </span>
                        <div>
                          <div className="rp-trait-label">{t.label}</div>
                          <div className="rp-trait-sub">{t.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rp-summary">
                  <div className="rp-eyebrow">같은 {data.ilju.name}의 사람들</div>
                  <p>{data.ilju.peers}</p>
                </div>

                <PageFooter page={identityPage} total={totalPages} />
              </section>

              <section className="report-page" data-page={cycleIndexPage}>
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead no={questionEdition ? '07' : '04'} titleLines={['대운', '10년 단위의 생애 지도']}
                  lead="대운은 약 10년 단위로 살펴보는 환경의 흐름입니다. 연도별 변화와 함께 읽고, 바뀌는 시기에는 정리·진입·적응의 순서로 준비해보세요." />
                <div className="rp-lifetime-index">
                  {data.timeline.cycles.map((cycle, index) => (
                    <div className={`rp-lifetime-index-row${cycle.isCurrent ? ' is-current' : ''}`} key={cycle.index}>
                      <div><strong>{cycle.startYear}–{cycle.endYear}</strong><span>{cycle.startAge}–{cycle.endAge}세 · {ganziToKorean(cycle.ganzi)} 대운</span></div>
                      <p>{cycle.title}</p><span>{cycleStartPage + index}쪽</span>
                    </div>
                  ))}
                </div>
                {data.timeline.cycles.length === 0 && <p className="rp-guide-copy">성별 정보가 없어 대운을 산정하지 않았습니다. 연도별 세운 풀이는 이어지는 생애 연표에서 확인할 수 있습니다.</p>}
                <div className="rp-guide-note">출생 직후부터 첫 대운이 시작되기 전까지는 ‘대운 시작 전’으로 구분합니다. 나이는 모두 해당 연도에서 출생연도를 뺀 연도 나이이며, 생일 기준 만 나이와 다를 수 있습니다.</div>
                <PageFooter page={cycleIndexPage} total={totalPages} />
              </section>

              {/* ─────────────── PAGE 5 · 분야별 종합 ─────────────── */}
              <section className="report-page" data-page={areaPage}>
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no={questionEdition ? '01' : '05'}
                  titleLines={['분야별 종합', '네 영역의 깊은 흐름']}
                  lead={`${data.ilju.name}의 강점은 분야마다 다르게 드러납니다. 어느 영역에서 더 무게를 두면 좋을지 짚어봤어요.`}
                />

                <div className="rp-area-grid">
                  {data.areaCards.map((a) => (
                    <div key={a.label} className="rp-area-card">
                      <div className="rp-area-head">
                        <span className="rp-area-icon" style={{ background: a.color }}>
                          {a.hanja}
                        </span>
                        <div className="rp-area-title">
                          <div className="rp-area-name">{a.label}</div>
                          <div className="rp-area-sub">{a.sub}</div>
                        </div>
                        {a.score !== null && <div className="rp-area-score">
                          <strong style={{ color: a.color }}>{a.score}</strong>
                          <span>/ 100</span>
                        </div>}
                      </div>
                      <div className="rp-area-sw">
                        <div>
                          <div className="rp-area-sw-label" style={{ color: '#0f9f7a' }}>
                            {questionEdition ? '나의 방식' : '강점'}
                          </div>
                          <div className="rp-area-sw-text">{a.strength}</div>
                        </div>
                        <div>
                          <div className="rp-area-sw-label" style={{ color: a.color }}>
                            {questionEdition ? '살펴볼 조건' : '약점'}
                          </div>
                          <div className="rp-area-sw-text">{a.weakness}</div>
                        </div>
                      </div>
                      <div className="rp-area-tip">
                        <div className="rp-area-tip-label" style={{ color: a.color }}>
                          <InkIcon name="lantern" size={15} /> {questionEdition ? '선택 기준' : '조언'}
                        </div>
                        <p>{a.advice}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <PageFooter page={areaPage} total={totalPages} />
              </section>

              {/* ─────────────── PAGE 6 · 신살·격국 ─────────────── */}
              <section className="report-page" data-page={patternPage}>
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no={questionEdition ? '참고 02' : '06'}
                  titleLines={['신살과 격국', '사주에 자리잡은 별']}
                  lead="신살은 사주의 특수한 별들이고, 격국은 전체 구조의 기본 골격입니다. 두 개를 함께 보면 타고난 성향을 더 또렷이 알 수 있어요."
                />

                <div className="rp-gyeokguk-hero">
                  <div className="rp-eyebrow rp-on-pink">GYEOKGUK · 격국</div>
                  <div className="rp-gyeokguk-name">{data.gyeokguk.name}</div>
                  <p>{data.gyeokguk.desc}</p>
                </div>

                <div className="rp-block">
                  <div className="rp-eyebrow">SINSAL · 신살 (사주에 자리한 별)</div>
                  <div className="rp-sinsal-grid rp-sinsal-grid-lg">
                    {data.sinsal.map((s) => (
                      <div
                        key={s.label}
                        className={`rp-sinsal-lg${s.have ? '' : ' is-absent'}`}
                      >
                        <span className="rp-sinsal-hanja" style={{ color: s.color }}>
                          {s.hanja}
                        </span>
                        <div className="rp-sinsal-lg-text">
                          <div className="rp-sinsal-lg-name">
                            {s.label}
                            {s.have ? <em className="rp-have">HAVE</em> : null}
                          </div>
                          <div className="rp-sinsal-lg-meaning">{s.meaning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rp-interp">
                  <div className="rp-eyebrow">종합 해석</div>
                  <p>{data.gyeokguk.summary}</p>
                </div>
                <div className="rp-tip">
                  <span aria-hidden="true"><InkIcon name="lantern" size={22} /></span>
                  <p>{data.gyeokguk.tip}</p>
                </div>

                <PageFooter page={patternPage} total={totalPages} />
              </section>

              <section className="report-page rp-contents-page" data-page={guidePage}>
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead no={questionEdition ? '목차' : '07'} titleLines={['생애 보고서 안내', '필요한 질문부터 찾아 읽기']}
                  lead={`${birthYear}년부터 ${birthYear + 100}년까지 101개 연도를 한 해씩 살펴봅니다. 100세까지라는 범위는 보고서의 분석 기간이며 수명을 뜻하지 않습니다.`} />
                <div className="rp-guide-contents">
                  <div><strong>{questionEdition ? '핵심 요약과 나의 성향' : '타고난 성향과 사주의 구조'}</strong><span>{questionEdition ? '3–4쪽' : '1–6쪽'}</span></div>
                  {questionEdition ? chapterRanges.map((chapter) => <div key={chapter.title}><strong>{chapter.title}</strong><span>{chapter.start === chapter.end ? chapter.start : `${chapter.start}–${chapter.end}`}쪽</span></div>) : narrativePages.length > 0 && <div><strong>깊은 사주풀이 전문</strong><span>8–{cycleStartPage - 1}쪽</span></div>}
                  {data.timeline.cycles.length > 0 && <div><strong>대운별 심층 풀이와 전환기</strong><span>{questionEdition ? cycleIndexPage : cycleStartPage}–{annualStartPage - 1}쪽</span></div>}
                  <div><strong>출생부터 100세까지 연도별 풀이</strong><span>{annualStartPage}–{annualEndPage}쪽</span></div>
                  {questionEdition && <div><strong>참고 · 사주의 구조와 용어</strong><span>{tenGodPage}–{patternPage}쪽</span></div>}
                  <div><strong>마무리와 활용 방법</strong><span>{totalPages}쪽</span></div>
                </div>
                <div className="rp-year-finder">
                  {Array.from({ length: 11 }, (_, i) => i * 10).map((age) => (
                    <div key={age}><strong>{age === 0 ? '출생~9세' : age === 100 ? '100세' : `${age}~${age + 9}세`}</strong><span>{birthYear + age}년부터 · {annualStartPage + annualPages.findIndex((page) => page.some((year) => year.age === age))}쪽</span></div>
                  ))}
                </div>
                <div className="rp-guide-note">{data.timeline.notes.map((note) => <p key={note}>{note}</p>)}</div>
                <div className="rp-guide-copy"><h3>이렇게 활용해보세요</h3><p>먼저 올해의 풀이를 읽고, 해당 대운의 전환기 조언을 확인하세요. 과거 연도는 실제 경험을 돌아보는 질문으로, 미래 연도는 선택을 준비하는 참고로 활용할 수 있습니다. 같은 세운이 돌아와도 생애 단계와 대운이 달라 풀이의 초점은 달라집니다.</p></div>
                <PageFooter page={guidePage} total={totalPages} />
              </section>

              {narrativePages.map((sections, index) => (
                <section className="report-page rp-narrative-page" data-page={narrativeStartPage + index} key={`deep-${index}`}>
                  <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                  <ChapterHead no={questionEdition ? '풀이' : '08'} titleLines={['깊은 사주풀이', sections[0].chapter ?? sections[0].label]} lead="타고난 성향과 삶의 선택을 연결하는 상세 풀이입니다. 생활 예시는 실제 이력을 뜻하지 않으며, 자신의 상황에 맞는 선택 기준을 찾아보세요." />
                  {sections.map((section, sectionIndex) => <DeepSection key={`${section.label}-${sectionIndex}`} no={sectionIndex + 1} label={section.label} text={section.text} />)}
                  <PageFooter page={narrativeStartPage + index} total={totalPages} />
                </section>
              ))}

              {data.timeline.cycles.map((cycle, index) => (
                <section className="report-page rp-cycle-page" data-page={cycleStartPage + index} key={`cycle-${cycle.index}`}>
                  <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                  <ChapterHead no="09" titleLines={[cycle.title, `${cycle.startYear}–${cycle.endYear}년 · ${cycle.startAge}–${cycle.endAge}세`]}
                    lead={`${cycle.startYear}–${cycle.endYear}년${cycle.isCurrent ? ' · 발행연도가 포함된 대운' : ''} · 대운의 큰 흐름과 진입 전후의 준비를 함께 살펴봅니다.`} />
                  <p className="rp-cycle-overview">{cycle.overview}</p>
                  <div className="rp-cycle-fields">
                    <div><h3>마음과 생활의 방향</h3><p>{cycle.mental}</p></div>
                    <div><h3>관계에서 살펴볼 점</h3><p>{cycle.relationships}</p></div>
                    <div><h3>활동과 생활 기반</h3><p>{cycle.resources}</p></div>
                  </div>
                  <div className="rp-transition"><h3>대운 전환기, 세 단계로 준비하기</h3>
                    <div><strong>{cycle.startYear - 1}년 · 정리</strong><p>{cycle.transition.before}</p></div>
                    <div><strong>{cycle.startYear}년 · 진입</strong><p>{cycle.transition.entry}</p></div>
                    <div><strong>{cycle.startYear + 1}년 · 적응</strong><p>{cycle.transition.after}</p></div>
                  </div>
                  <div className="rp-cycle-actions"><h3>실천으로 옮길 세 가지</h3><ol>{cycle.actions.map((action, i) => <li key={i}>{action}</li>)}</ol></div>
                  <PageFooter page={cycleStartPage + index} total={totalPages} />
                </section>
              ))}

              {annualPages.map((years, index) => (
                <section className="report-page rp-annual-page" data-page={annualStartPage + index} key={`years-${index}`}>
                  <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                  <ChapterHead no="10" titleLines={['연도별 상세 풀이', `${years[0].year}${years.length > 1 ? `–${years[years.length - 1].year}` : ''}년`]} lead={`${data.subjectName}님의 세운과 대운을 생애 단계에 맞추어 읽습니다. 표기 나이는 출생연도를 0세로 계산합니다.`} />
                  <div className="rp-annual-entries">{years.map((year) => (
                    <section className={`rp-annual-entry${year.isCurrent ? ' is-current' : ''}`} key={year.year} data-year={year.year}>
                      <header><div><h3>{year.year}년 <span>{year.age === 0 ? '출생' : `${year.age}세`}</span></h3><p>{ganziToKorean(year.ganzi)}년 · {year.majorLuckLabel}</p></div><span className="rp-annual-phase">{year.phase}</span></header>
                      <h4>{year.theme}</h4><p className="rp-annual-overview">{year.overview}</p>
                      <dl>
                        <div><dt>배움·활동</dt><dd>{year.learningCareer}</dd></div>
                        <div><dt>가족·관계</dt><dd>{year.relationships}</dd></div>
                        <div><dt>생활·재물</dt><dd>{year.resources}</dd></div>
                        <div><dt>생활 리듬</dt><dd>{year.wellbeing}</dd></div>
                      </dl>
                      <p className="rp-annual-action"><strong>이 해의 실천</strong>{year.action}</p>
                    </section>
                  ))}</div>
                  <PageFooter page={annualStartPage + index} total={totalPages} />
                </section>
              ))}

              {/* ─────────────── PAGE 8 · 마무리 ─────────────── */}
              <section className="report-page" data-page={totalPages}>
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="11"
                  titleLines={['마무리', '그리고 다음 한 걸음']}
                  lead="여기까지 함께해 주셔서 감사합니다. 사주는 절대적 예언이 아니라 흐름의 참고예요. 한 줄만 기억해도 충분합니다."
                />

                <div className="rp-closing">
                  <p>{data.closing.intro}</p>
                  <p>{data.closing.year}</p>
                  <p>
                    마지막으로 한 가지만 더 기억해주세요.{' '}
                    <strong>{data.closing.highlight}</strong>, 그 작은 결정이 큰 흐름을 바꿉니다.
                  </p>
                  <div className="rp-sign">
                    <span className="rp-sign-han">干支四柱</span>
                    <span className="rp-sign-name">간지사주 드림</span>
                  </div>
                </div>

                {showRecommendations && <div className="rp-block">
                  <div className="rp-eyebrow">NEXT · 이어볼 풀이</div>
                  <div className="rp-next-grid">
                    {data.nextProducts.map((p) => (
                      <Link key={p.title} href={p.href} className="rp-next-card">
                        <span className="rp-next-arrow" aria-hidden="true">
                          →
                        </span>
                        <div className="rp-next-body">
                          <div className="rp-next-title">{p.title}</div>
                          <div className="rp-next-sub">{p.sub}</div>
                        </div>
                        <span className="rp-next-price">
                          {p.priceKey ? <Price priceKey={p.priceKey} /> : p.price}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>}

                <div className="rp-notice">
                  <div className="rp-notice-label">⚠ 안내 사항</div>
                  <p>
                    본 리포트는 운세 콘텐츠로, 삶의 흐름을 참고하기 위한 자료입니다.
                    의료·법률·투자·위기 상황의 판단은 반드시 해당 분야 전문가의 도움을 우선해
                    주세요.
                  </p>
                </div>

                <div className="rp-final-foot">
                  <div className="rp-final-brand">
                    <span className="rp-logo rp-logo-sm" aria-hidden="true">
                      干
                    </span>
                    <span className="rp-final-brand-text">
                      <span className="rp-final-brand-title">간지사주</span>
                      <span className="rp-final-brand-sub">간지사주 · ganjisaju.kr</span>
                    </span>
                  </div>
                  <div className="rp-final-meta">
                    <span>REPORT NO. {data.reportNo}</span>
                    <br />
                    <span>ISSUED {issuedAt} · {questionEdition ? 'v3.0' : 'v2.0'}</span>
                  </div>
                </div>

                <PageFooter page={totalPages} total={totalPages} />
              </section>

              </OrderedPages>
            </article>
  );
}
