// 2026-09-27 — 2027 신년운세 PDF 문서. 사용자 피드백: "여백이 많고 2027 흐름만 텍스트로 주욱 — 사주팔자 명식·오행이 빠졌다,
//   평생운세 PDF 처럼 디자인 요소를 넣어 달라". 평생운세 ReportDocument 의 A4 조각(rp-* 클래스·RunningHeader·ChapterHead·
//   DeepSection·PageFooter)과 PDF 모델(사주팔자·오행 도넛·십성·신살)을 그대로 재사용하고, 본문은 같은 쪽 나눔(paginatePdfNarrative)으로
//   A4 를 넘치지 않게 흘린다. 새 CSS 파일은 만들지 않는다(배포 번들 누락 함정) — 레이아웃은 기존 rp-* + 인라인 grid.
import type { ReactNode } from 'react';
import { ChapterHead, DeepSection, PageFooter, RunningHeader } from '@/components/report/report-document';
import { PDF_ELEMENT_COLORS } from '@/lib/saju/pdf-report-maps';
import { paginatePdfNarrative, type PdfNarrativeSection } from '@/lib/saju/pdf-report-pages';
import type { PdfReportModel } from '@/lib/saju/pdf-report-model';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import { buildMonthView, buildYearPoints, monthSectionText } from '@/lib/saju/yearly-month-view';
import type { SajuYearlyReport } from '@/domain/saju/report';
import type {
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
// 총론과 관련 분야를 묶어 읽고, 긴 본문은 추가 쪽에 보존한다.
const NARRATIVE_CHAPTER = '총론과 분야별 운';
const BASE_CATEGORIES = ['work', 'wealth', 'love', 'relationship', 'health', 'move'] as const;

const MOMENTUM = {
  rise: { label: '상승', color: '#2f7d5b', soft: '#e6f3ec' },
  steady: { label: '유지', color: '#8a6a1f', soft: '#f7f0de' },
  caution: { label: '주의', color: '#b3372a', soft: '#f9e6e2' },
} as const;

// 2026-09-27 사용자 지시 — 단락을 쪽 경계에서 잘라 "· 계속"으로 넘기지 않는다. 단락은 통째로 다음 쪽으로 간다.
// 큰 글씨로 한 쪽에 담기 어려운 단락만 공통 쪽 나눔으로 이어 쓴다.
const PAGE_WEIGHT = 1050;
function paginateWholeSections(sections: PdfNarrativeSection[], maxWeight = PAGE_WEIGHT): PdfNarrativeSection[][] {
  const pages: PdfNarrativeSection[][] = [];
  let page: PdfNarrativeSection[] = [];
  let weight = 0;
  for (const whole of sections) {
    if (!whole.text.trim()) continue;
    for (const section of splitOversized(whole)) {
    const w = section.text.length + 160;
    if (page.length && weight + w > maxWeight) {
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

// Keep normal paragraphs together; the shared splitter also handles punctuation-free output.
function splitOversized(section: PdfNarrativeSection): PdfNarrativeSection[] {
  return section.text.length <= 850 ? [section] : paginatePdfNarrative([section], { maxItems: 1 }).flat();
}

/** 앞 쪽들에 실린 섹션 수 — 장 안에서 번호를 이어 매긴다. */
const sectionOffset = (pages: unknown[][], index: number) => pages.slice(0, index).reduce((sum, page) => sum + page.length, 0);

// 한자 전면 금지(2026-09-27 사용자 결정 — 명식 포함). 명식 한 글자(甲·子)도 한글로.
const toHangul = (text: string) => koreanizeGanzi(text);

function Page({
  no,
  total,
  data,
  children,
  narrative = false,
  flow,
}: {
  no: number;
  total: number;
  data: PdfReportModel;
  children: ReactNode;
  /** 평생 PDF 와 같은 클래스 — 인쇄 CSS 가 .rp-deep-sec 를 쪽 가운데서 자르지 않는다(break-inside: avoid). */
  narrative?: boolean;
  /**
   * 2026-10-10 사용자 피드백 "운마다 한 쪽씩이라 공백이 너무 많다" — 인쇄에서는 본문을 이어 흘린다.
   * start = 큰 장 시작(새 장에서), next = 이어서(제목 유지 — 다음 달), more = 같은 내용이 이어지는 쪽(제목 숨김).
   */
  flow?: 'start' | 'next' | 'more';
}) {
  const classes = ['report-page', narrative && 'rp-narrative-page', flow && `rp-flow-${flow}`].filter(Boolean).join(' ');
  return (
    <section className={classes} data-page={no}>
      <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} mark="간지" />
      {children}
      <PageFooter page={no} total={total} />
    </section>
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
  // 2026-10-10 — 올해의 사주 포인트(계산 근거 — 화면과 같은 항목)를 총론 앞에 둔다.
  const yearPoints = buildYearPoints(report.yearSignals);
  const narrativeSections: PdfNarrativeSection[] = [
    ...(yearPoints.length ? [{ label: '올해의 사주 포인트', text: yearPoints.map((point) => `${point.label} — ${point.value}`).join('\n\n'), chapter: NARRATIVE_CHAPTER }] : []),
    { label: `${year}년 총론`, text: k(interpretation.opening), chapter: NARRATIVE_CHAPTER },
    ...BASE_CATEGORIES.map((key) => ({ label: CATEGORY_LABEL[key], text: k(interpretation.categories[key]), chapter: NARRATIVE_CHAPTER })),
    ...(extras
      ? [
          { label: CATEGORY_LABEL.family, text: k(extras.categories.family), chapter: NARRATIVE_CHAPTER },
          { label: CATEGORY_LABEL.study, text: k(extras.categories.study), chapter: NARRATIVE_CHAPTER },
        ]
      : []),
  ];
  // 2026-10-10 — 인쇄는 이어 흘리므로 강제 묶음(1·2·2·2…) 대신 분량으로만 나눈다.
  const narrativePages = paginateWholeSections(narrativeSections);
  const halves = [
    { label: '상반기 먼저 볼 것', text: k(interpretation.firstHalf) },
    { label: '하반기 먼저 볼 것', text: k(interpretation.secondHalf) },
  ];

  const flowOf = (month: number) => report.monthlyFlows.find((f) => f.month === month);
  // A month starts on its own sheet; unusually long content continues without truncation.
  const monthPages = interpretation.monthlyFlows.flatMap((month, index) => {
    const quarter = index % 3 === 0 ? extras?.quarterlyFlows[Math.floor(index / 3)] : null;
    const half = index === 0 ? halves[0] : index === 6 ? halves[1] : null;
    const sections = [
      ...(half ? [half] : []),
      ...(quarter ? [{ label: `${quarter.quarter}분기 · 먼저 볼 분야 ${CATEGORY_LABEL[quarter.focusCategory]}`, text: k(quarter.summary) }] : []),
      // 2026-10-10 — 6항목(총운·분야별·먼저 볼 것·조심·실천 3·보완 포인트). 화면과 같은 구성(yearly-month-view).
      ...buildMonthView(flowOf(month.month), month, month.month).sections.map((section) => ({ label: section.label, text: monthSectionText(section) })),
    ];
    // offset — 같은 달이 여러 쪽에 걸쳐도 섹션 번호를 이어 매긴다(인쇄에서는 한 흐름으로 읽힌다).
    let offset = 0;
    return paginateWholeSections(sections, 1600).map((sections, continuation) => {
      const page = { month: month.month, sections, continuation, offset };
      offset += sections.length;
      return page;
    });
  });

  const firstNarrative = 3;
  const monthStart = firstNarrative + narrativePages.length;
  const closingPage = monthStart + monthPages.length;
  const closingPages = paginateWholeSections([
    ...(extras ? [
      { label: '기대할 일', text: extras.expectations.map((item) => `${item.month}월 · ${CATEGORY_LABEL[item.category]}: ${k(item.text)}`).join('\n\n') },
      { label: '조심할 일', text: extras.cautions.map((item) => `${item.month}월 · ${CATEGORY_LABEL[item.category]}: ${k(item.text)}`).join('\n\n') },
    ] : []),
    { label: '올해 이렇게 해보세요', text: interpretation.actionAdvice.map(k).join('\n\n') },
  ], 1600);
  const total = closingPage + closingPages.length - 1;

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
                  <li key={keyword} style={{ fontSize: 16, lineHeight: 1.5, wordBreak: 'keep-all' }}>
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
                  <div style={{ height: 34, borderRadius: 6, background: tone.color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800 }}>
                    {f.month}월
                  </div>
                  <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700, color: tone.color }}>{tone.label}</div>
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
          lead={`${year}년 흐름은 타고난 구조 위에서 움직입니다. 십성은 나와 다른 글자들의 관계를, 신살은 특정 글자 조합의 보조 의미를 살펴보는 방법입니다. 어느 하나만으로 성격이나 미래를 정하지 않습니다.`}
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
        <Page key={`n-${index}`} no={firstNarrative + index} total={total} data={data} narrative flow={index === 0 ? 'start' : 'more'}>
          {/* 이어지는 쪽은 그 쪽에 실린 분야 이름을 제목으로 — "· 계속"과 같은 설명을 반복하지 않는다. */}
          <ChapterHead
            no="02"
            titleLines={[`${year} ${yearGanji}년`, index === 0 ? NARRATIVE_CHAPTER : [...new Set(sections.map((section) => section.label))].join(' · ')]}
            lead={index === 0 ? '한 해의 큰 흐름과 분야 8가지(일·재물·연애·인간관계·건강·이동·가족·학업)의 핵심 장면·조심할 점·행동을 봅니다.' : undefined}
          />
          {sections.map((section, i) => (
            <DeepSection key={`${section.label}-${i}`} no={sectionOffset(narrativePages, index) + i + 1} label={section.label} text={section.text} />
          ))}
        </Page>
      ))}

      {/* ── 한 달씩 읽는 월별 풀이 ── */}
      {monthPages.map(({ month, sections, continuation, offset }, index) => {
        // 제목 = 그 달에 중요한 분야 + 그 달의 성격(달마다 다름). 나에게 주는 의미는 설명 줄로 — 화면과 같은 구성.
        const view = buildMonthView(flowOf(month), interpretation.monthlyFlows.find((m) => m.month === month), month);
        const lead = continuation ? undefined : [
          view.lead,
          index === 0 ? '상승은 성공 보장이 아니며, 주의는 나쁜 일이 생긴다는 뜻이 아닙니다.' : '',
        ].filter(Boolean).join(' ');
        return (
          <Page key={`m-${month}-${continuation}`} no={monthStart + index} total={total} data={data} narrative
            flow={index === 0 ? 'start' : continuation ? 'more' : 'next'}>
            <ChapterHead no="03" titleLines={[view.titleTop, view.titleBottom]} lead={lead} />
            {sections.map((section, i) => <DeepSection key={`${section.label}-${i}`} no={offset + i + 1} label={section.label} text={section.text} />)}
          </Page>
        );
      })}

      {/* ── 기대할 일 · 조심할 일 · 행동 지침 ── */}
      {closingPages.map((sections, index) => (
        <Page key={`closing-${index}`} no={closingPage + index} total={total} data={data} narrative flow={index === 0 ? 'start' : 'more'}>
          <ChapterHead no="04" titleLines={[`${year}년에`, index ? [...new Set(sections.map((section) => section.label))].join(' · ') : '기대할 일과 조심할 일']}
            lead={index ? undefined : '언제, 어느 분야에서, 무엇을 살펴보면 좋을지 모았습니다. 필요한 내용을 달력에 적고 다시 읽어보세요.'} />
          {sections.map((section, i) => <DeepSection key={`${section.label}-${i}`} no={sectionOffset(closingPages, index) + i + 1} label={section.label} text={section.text} />)}
        </Page>
      ))}
    </article>
  );
}
