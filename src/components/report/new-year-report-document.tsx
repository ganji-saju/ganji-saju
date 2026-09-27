// 2026-09-27 — 2027 신년운세 PDF 문서. 사용자 피드백: "여백이 많고 2027 흐름만 텍스트로 주욱 — 사주팔자 명식·오행이 빠졌다,
//   평생운세 PDF 처럼 디자인 요소를 넣어 달라". 평생운세 ReportDocument 의 A4 조각(rp-* 클래스·RunningHeader·ChapterHead·
//   DeepSection·PageFooter)과 PDF 모델(사주팔자·오행 도넛·십성·신살)을 그대로 재사용하고, 본문은 같은 쪽 나눔(paginatePdfNarrative)으로
//   A4 를 넘치지 않게 흘린다. 새 CSS 파일은 만들지 않는다(배포 번들 누락 함정) — 레이아웃은 기존 rp-* + 인라인 grid.
import type { ReactNode } from 'react';
import { ChapterHead, DeepSection, PageFooter, RunningHeader } from '@/components/report/report-document';
import { PDF_ELEMENT_COLORS } from '@/lib/saju/pdf-report-maps';
import type { PdfNarrativeSection } from '@/lib/saju/pdf-report-pages';
import type { PdfReportModel } from '@/lib/saju/pdf-report-model';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import type { SajuYearlyReport } from '@/domain/saju/report';
import type {
  NewYearHighlight,
  NewYearHighlightCategory,
  SajuYearlyAiInterpretation,
} from '@/server/ai/saju-yearly-interpretation';

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
// 총론과 분야별 운을 한 장으로 흘린다 — 장이 바뀌면 쪽이 강제로 나뉘어 총론 쪽이 반만 찼다(실측 450/1123px).
const NARRATIVE_CHAPTER = '총론과 분야별 운';
const BASE_CATEGORIES = ['work', 'wealth', 'love', 'relationship', 'health', 'move'] as const;

const MOMENTUM = {
  rise: { label: '상승', color: '#2f7d5b', soft: '#e6f3ec' },
  steady: { label: '유지', color: '#8a6a1f', soft: '#f7f0de' },
  caution: { label: '주의', color: '#b3372a', soft: '#f9e6e2' },
} as const;

// 2026-09-27 사용자 지시 — 단락을 쪽 경계에서 잘라 "· 계속"으로 넘기지 않는다. 단락은 통째로 다음 쪽으로 간다.
//   (평생 PDF 의 paginatePdfNarrative 는 1,100자에서 자른다.) 한 단락이 한 쪽을 넘을 만큼 길 때만 그 단락 혼자 한 쪽을 쓴다.
const PAGE_WEIGHT = 1500;
function paginateWholeSections(sections: PdfNarrativeSection[]): PdfNarrativeSection[][] {
  const pages: PdfNarrativeSection[][] = [];
  let page: PdfNarrativeSection[] = [];
  let weight = 0;
  for (const whole of sections) {
    if (!whole.text.trim()) continue;
    for (const section of splitOversized(whole)) {
    const w = section.text.length + 160;
    if (page.length && weight + w > PAGE_WEIGHT) {
      pages.push(page);
      page = [];
      weight = 0;
    }
    page.push(section);
    weight += w;
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

// 한 단락이 혼자서도 한 쪽을 넘을 때만 문장 경계에서 나눈다(글자를 버리지 않는다). 보통 단락은 통째로 넘긴다.
const MAX_SECTION_CHARS = PAGE_WEIGHT - 300;
function splitOversized(section: PdfNarrativeSection): PdfNarrativeSection[] {
  if (section.text.length <= MAX_SECTION_CHARS) return [section];
  const sentences = section.text.split(/(?<=[.!?。])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > MAX_SECTION_CHARS) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) chunks.push(current);
  return chunks.map((text, i) => ({ ...section, label: i === 0 ? section.label : `${section.label} · 계속`, text }));
}

// 인쇄 중 한 카드·단락이 쪽 가운데서 갈라지지 않게.
const KEEP_TOGETHER = { breakInside: 'avoid', pageBreakInside: 'avoid' } as const;

// 한자 전면 금지(2026-09-27 사용자 결정 — 명식 포함). 명식 한 글자(甲·子)도 한글로.
const toHangul = (text: string) => koreanizeGanzi(text);

function Page({
  no,
  total,
  data,
  children,
  narrative = false,
}: {
  no: number;
  total: number;
  data: PdfReportModel;
  children: ReactNode;
  /** 평생 PDF 와 같은 클래스 — 인쇄 CSS 가 .rp-deep-sec 를 쪽 가운데서 자르지 않는다(break-inside: avoid). */
  narrative?: boolean;
}) {
  return (
    <section className={narrative ? 'report-page rp-narrative-page' : 'report-page'} data-page={no}>
      <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} mark="간지" />
      {children}
      <PageFooter page={no} total={total} />
    </section>
  );
}

function HighlightColumn({ title, items, tone }: { title: string; items: NewYearHighlight[]; tone: 'rise' | 'caution' }) {
  const m = MOMENTUM[tone];
  return (
    <div className="rp-card" style={{ ...KEEP_TOGETHER, borderColor: m.color, background: m.soft }}>
      <div className="rp-eyebrow" style={{ color: m.color }}>{title}</div>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {items.map((h) => (
          <li key={`${h.month}-${h.text}`} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 8, alignItems: 'start' }}>
            <span
              style={{ background: m.color, color: '#fff', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 800, padding: '4px 0' }}
            >
              {h.month}월
            </span>
            <span style={{ fontSize: 11, lineHeight: 1.55, wordBreak: 'keep-all' }}>
              <strong style={{ color: m.color }}>{CATEGORY_LABEL[h.category]}</strong> · {koreanizeGanzi(h.text)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NewYearReportDocument({
  data,
  report,
  interpretation,
  issuedAt,
  year,
}: {
  data: PdfReportModel;
  report: SajuYearlyReport;
  interpretation: SajuYearlyAiInterpretation;
  issuedAt: string;
  year: number;
}) {
  const extras = interpretation.newYear;
  // AI 폴백 문장엔 간지 한자(丁未 등)가 남는다 — 본문은 한글로(명식 한자는 표기 의도라 제외).
  const k = (text: string) => koreanizeGanzi(text);
  const yearGanji = koreanizeGanzi(report.annualContext.yearGanji);

  // 총론·분야별 풀이는 길이가 모델마다 달라 고정 쪽에 담으면 넘친다 → 평생 PDF 와 같은 쪽 나눔.
  const narrativePages = paginateWholeSections([
    { label: `${year}년 총론`, text: k(interpretation.opening), chapter: NARRATIVE_CHAPTER },
    ...BASE_CATEGORIES.map((key) => ({ label: CATEGORY_LABEL[key], text: k(interpretation.categories[key]), chapter: NARRATIVE_CHAPTER })),
    ...(extras
      ? [
          { label: CATEGORY_LABEL.family, text: k(extras.categories.family), chapter: NARRATIVE_CHAPTER },
          { label: CATEGORY_LABEL.study, text: k(extras.categories.study), chapter: NARRATIVE_CHAPTER },
        ]
      : []),
  ]);
  const halves = [
    { label: '상반기 먼저 볼 것', text: k(interpretation.firstHalf) },
    { label: '하반기 먼저 볼 것', text: k(interpretation.secondHalf) },
  ];

  const flowOf = (month: number) => report.monthlyFlows.find((f) => f.month === month);
  // 분기마다 한 쪽 — 한 단(1열) 카드라 6달을 한 쪽에 담으면 넘친다.
  const monthQuarters = [0, 1, 2, 3].map((q) => interpretation.monthlyFlows.filter((m) => Math.ceil(m.month / 3) === q + 1));

  const firstNarrative = 3;
  const monthStart = firstNarrative + narrativePages.length;
  const closingPage = monthStart + monthQuarters.length;
  const total = closingPage;

  return (
    <article className="report-doc rp-question-edition" aria-label={`${year} 신년운세 PDF 미리보기`}>
      {/* ── PAGE 1 · 표지: 사주팔자 명식 + 오행 + 2027 한 줄 ── */}
      <section className="report-page" data-page="1">
        <header className="rp-cover-head">
          <div className="rp-brand">
            <span className="rp-logo" aria-hidden="true">간</span>
            <span className="rp-brand-text">
              <span className="rp-brand-title">간지사주</span>
              <span className="rp-brand-sub">간지사주 · {year} 신년운세</span>
            </span>
          </div>
          <div className="rp-cover-meta">
            <span>
              REPORT NO. <strong>{data.reportNo}</strong>
            </span>
            <br />
            <span>발행일 {issuedAt}</span>
          </div>
        </header>

        <div className="rp-subject">
          <div className="rp-eyebrow">{year} {yearGanji}년 신년운세</div>
          <h1 className="rp-subject-title">{data.subjectName}님의 {year} 신년운세</h1>
          <div className="rp-subject-info">
            <span><strong>생년월일</strong> {data.birth.dateLabel}</span>
            <span><strong>시각</strong> {data.birth.timeLabel}</span>
            <span><strong>성별</strong> {data.birth.genderLabel}</span>
          </div>
        </div>

        <div className="rp-block">
          <div className="rp-eyebrow">사주팔자</div>
          <h3 className="rp-block-title">네 기둥과 여덟 글자</h3>
          <div className="rp-pillars">
            {data.pillars.map((p) => (
              <div key={p.label} className="rp-pillar">
                <div className="rp-pillar-label">{p.label}</div>
                <div className="rp-pillar-stem" style={{ color: p.color }}>{toHangul(p.stem)}</div>
                <div className="rp-pillar-branch" style={{ color: p.branchColor }}>{toHangul(p.branch)}</div>
                <div className="rp-pillar-god">{p.god}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rp-summary">
          <div className="rp-eyebrow">{year}년 한 줄</div>
          <p>{k(interpretation.oneLineSummary)}</p>
        </div>

        <div className="rp-twocol">
          <div className="rp-card">
            <div className="rp-eyebrow">오행 균형</div>
            <div className="rp-donut-row">
              <div className="rp-donut" style={{ background: data.donutGradient }}>
                <span className="rp-donut-hole" style={{ color: PDF_ELEMENT_COLORS[data.dominantElement] }}>
                  {data.dominantElement}
                </span>
              </div>
              <ul className="rp-elem-legend">
                {data.elements.map((e) => (
                  <li key={e.element}>
                    <span className="rp-elem-dot" style={{ background: e.color }} />
                    <span className="rp-elem-name">{e.element}</span>
                    <strong className="rp-elem-pct">{e.pct}<span>%</span></strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-eyebrow">{year}년 키워드</div>
            <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 7 }}>
              {interpretation.keywords.slice(0, 4).map((keyword) => {
                const [label, ...rest] = keyword.split(':');
                return (
                  <li key={keyword} style={{ fontSize: 11, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                    <strong style={{ color: 'var(--rp-pink)' }}>{koreanizeGanzi(label.trim())}</strong>
                    {rest.length ? ` — ${k(rest.join(':').trim())}` : ''}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 한눈에 보는 한 해 — 12달 흐름을 색 띠로. 텍스트만 이어지던 문서에 눈이 머무는 지도. */}
        <div className="rp-card" style={{ marginTop: 14 }}>
          <div className="rp-eyebrow">한눈에 보는 {year}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, marginTop: 10 }}>
            {report.monthlyFlows.map((f) => {
              const tone = MOMENTUM[f.momentum];
              return (
                <div key={f.month} style={{ textAlign: 'center' }}>
                  <div style={{ height: 34, borderRadius: 6, background: tone.color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
                    {f.month}월
                  </div>
                  <div style={{ marginTop: 3, fontSize: 9.5, fontWeight: 700, color: tone.color }}>{tone.label}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rp-cover-foot">
          <p>
            본 리포트는 운세 콘텐츠로 참고용이며 특정 사건을 예언하지 않습니다. 의료·법률·투자 판단은 전문가와 상의하세요.
          </p>
          <span className="rp-foot-page">PAGE 1 / {total}</span>
        </div>
      </section>

      {/* ── PAGE 2 · 사주 구조: 십성 + 신살 ── */}
      <Page no={2} total={total} data={data}>
        <ChapterHead
          no="01"
          titleLines={['내 사주의 구조', '십성과 신살']}
          lead={`${year}년 흐름은 타고난 구조 위에서 움직입니다. 나를 둘러싼 기운의 분포와 사주에 자리한 작은 별을 먼저 봅니다.`}
        />
        <div className="rp-tengod-list">
          {data.tenGods.map((t) => (
            <div key={t.name} className="rp-tengod-row">
              <span className="rp-tengod-chip" style={{ background: t.color }}>{t.name.slice(0, 1)}</span>
              <div className="rp-tengod-body">
                <div className="rp-tengod-head">
                  <span className="rp-tengod-name">{t.name}</span>
                  <strong style={{ color: t.color }}>{t.pct}<span>%</span></strong>
                </div>
                <p>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rp-block">
          <div className="rp-eyebrow">신살</div>
          <div className="rp-sinsal-grid">
            {data.sinsal.map((s) => (
              <div key={s.label} className={`rp-sinsal-cell${s.have ? '' : ' is-absent'}`}>
                <div className="rp-sinsal-name">{s.label}</div>
                <div className="rp-sinsal-meaning">{s.have ? s.meaning : '없음'}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rp-interp">
          <div className="rp-eyebrow">종합 해석</div>
          <p>{data.tenGodSummary}</p>
        </div>
      </Page>

      {/* ── 총론·분야별 운 (자동 쪽 나눔) ── */}
      {narrativePages.map((sections, index) => (
        <Page key={`n-${index}`} no={firstNarrative + index} total={total} data={data} narrative>
          <ChapterHead
            no="02"
            titleLines={[`${year} ${yearGanji}년`, index === 0 ? NARRATIVE_CHAPTER : `${NARRATIVE_CHAPTER} · 계속`]}
            lead="한 해의 큰 흐름과 분야 8가지(일·재물·연애·인간관계·건강·이동·가족·학업)의 핵심 장면·조심할 점·행동을 봅니다."

          />
          {sections.map((section, i) => (
            <DeepSection key={`${section.label}-${i}`} no={i + 1} label={section.label} text={section.text} />
          ))}
        </Page>
      ))}

      {/* ── 분기·월별 흐름 ── */}
      {monthQuarters.map((months, qi) => {
        const quarter = extras?.quarterlyFlows[qi];
        const half = qi === 0 ? halves[0] : qi === 2 ? halves[1] : null;
        return (
          <Page key={`m-${qi}`} no={monthStart + qi} total={total} data={data}>
            <ChapterHead
              no="03"
              titleLines={['분기·월별 흐름', `${qi + 1}분기 · ${qi * 3 + 1}~${qi * 3 + 3}월`]}
              lead="달마다 흐름(상승·유지·주의)과 월 간지, 먼저 볼 것과 조심할 것을 봅니다."
            />
            {half ? (
              <div className="rp-card" style={{ ...KEEP_TOGETHER, marginTop: 14, borderColor: 'var(--rp-pink)', borderWidth: 1.5 }}>
                <div className="rp-eyebrow">{half.label}</div>
                <p style={{ margin: '6px 0 0', fontSize: 11.5, lineHeight: 1.65, wordBreak: 'keep-all' }}>{half.text}</p>
              </div>
            ) : null}
            {quarter ? (
              <div className="rp-summary" style={{ ...KEEP_TOGETHER, marginTop: 10 }}>
                <div className="rp-eyebrow">
                  {quarter.quarter}분기 · {quarter.months[0]}~{quarter.months[2]}월 · 먼저 볼 분야 {CATEGORY_LABEL[quarter.focusCategory]}
                </div>
                <p style={{ fontSize: 11.5 }}>{k(quarter.summary)}</p>
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 12 }}>
              {months.map((m) => {
                const flow = flowOf(m.month);
                const tone = MOMENTUM[flow?.momentum ?? 'steady'];
                return (
                  <div key={m.month} className="rp-card" style={{ ...KEEP_TOGETHER, padding: '10px 12px', borderLeft: `4px solid ${tone.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <strong style={{ fontSize: 14 }}>
                        {m.month}월
                        {flow?.monthlyGanji ? (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--rp-ink-muted)' }}>
                            {' '}· {toHangul(flow.monthlyGanji)}월
                          </span>
                        ) : null}
                      </strong>
                      <span style={{ background: tone.soft, color: tone.color, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>
                        {tone.label}
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 11.5, lineHeight: 1.6, wordBreak: 'keep-all' }}>{k(m.summary)}</p>
                    {m.caution ? (
                      <p style={{ margin: '4px 0 0', fontSize: 11, lineHeight: 1.55, color: MOMENTUM.caution.color, wordBreak: 'keep-all' }}>
                        조심 · {k(m.caution)}
                      </p>
                    ) : null}
                    {m.action ? (
                      <p style={{ margin: '3px 0 0', fontSize: 11, lineHeight: 1.55, color: MOMENTUM.rise.color, wordBreak: 'keep-all' }}>
                        할 일 · {k(m.action)}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Page>
        );
      })}

      {/* ── 기대할 일 · 조심할 일 · 행동 지침 ── */}
      <Page no={closingPage} total={total} data={data}>
        <ChapterHead
          no="05"
          titleLines={[`${year}년에`, '기대할 일과 조심할 일']}
          lead="언제, 어느 분야에서, 무엇을 — 달력에 표시해 두고 한 해 동안 다시 펼쳐 보세요."
        />
        {extras ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <HighlightColumn title="기대할 일" items={extras.expectations} tone="rise" />
            <HighlightColumn title="조심할 일" items={extras.cautions} tone="caution" />
          </div>
        ) : null}
        <div className="rp-summary">
          <div className="rp-eyebrow">올해의 행동 지침</div>
          <ol style={{ margin: '8px 0 0', paddingLeft: 18, display: 'grid', gap: 5, fontSize: 11.5, lineHeight: 1.55 }}>
            {interpretation.actionAdvice.map((a) => (
              <li key={a} style={{ wordBreak: 'keep-all' }}>{k(a)}</li>
            ))}
          </ol>
        </div>
      </Page>
    </article>
  );
}
