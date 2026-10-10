// 2026-10-10 — 월별 풀이 6항목(사용자 결정). 화면(yearly-report-panel)과 PDF(new-year-report-document)가
//   같은 구성·같은 문장을 쓰도록 한 곳에서 만든다(화면 = PDF 원칙). 계산 모듈(lunar)을 끌어오지 않는다 — 클라이언트 번들용.
import type { YearlyCategoryKey, YearlyMonthFlow } from '@/domain/saju/report/yearly-types';
import type { SajuYearlyAiMonthlyFlow } from '@/server/ai/saju-yearly-interpretation';
import { koreanizeGanzi } from '@/lib/saju/terminology';

const AREA_LABEL: Record<string, string> = { wealth: '재물', work: '일·직업', love: '애정·관계', health: '건강' };
const AREA_ORDER = ['wealth', 'work', 'love', 'health'] as const;
const CATEGORY_LABEL: Record<YearlyCategoryKey, string> = {
  work: '일·직업운', wealth: '재물운', love: '연애·결혼운', relationship: '인간관계운', health: '건강운', move: '이동·변화운',
};
const MOMENTUM_LABEL = { rise: '상승', steady: '유지', caution: '주의' } as const;

export interface MonthViewSection {
  key: 'overview' | 'areas' | 'focus' | 'caution' | 'actions' | 'supplement';
  label: string;
  /** 문단 하나 또는 "라벨 — 본문" 줄들. */
  paragraphs: string[];
  /** 번호 목록(실천 3가지). */
  list?: string[];
}

export interface MonthView {
  month: number;
  /** 제목 첫 줄: "2월 · 일·직업운, 재물운" */
  titleTop: string;
  /** 제목 둘째 줄: 그 달의 성격 "판을 세우고 돈과 일의 방향을 잡는 달" */
  titleBottom: string;
  /** 설명 줄: "임인월 · 상승 흐름 — 나에게는 내 뜻을 밀어붙이는 달입니다." */
  lead: string;
  sections: MonthViewSection[];
}

// 계산 리포트의 월 테마 "OO 월운이 <그 달의 성격> 달이자, 나에게는 <나에게 주는 의미> 달".
export function splitMonthTheme(theme: string | undefined): { season: string; personal: string } | null {
  const match = theme?.match(/월운이\s*(.+?)\s*달이자,\s*나에게는\s*(.+?)\s*달$/);
  return match ? { season: match[1], personal: match[2] } : null;
}

export function buildMonthView(flow: YearlyMonthFlow | undefined, prose: SajuYearlyAiMonthlyFlow | undefined, month: number): MonthView {
  const k = koreanizeGanzi;
  const theme = splitMonthTheme(flow ? k(flow.theme) : undefined);
  const areas = (flow?.relatedAreas ?? []).map((area) => CATEGORY_LABEL[area]).join(', ');
  const tone = MOMENTUM_LABEL[flow?.momentum ?? 'steady'];
  const ganji = flow?.monthlyGanji ? `${k(flow.monthlyGanji)}월 · ` : '';

  const overview = k(prose?.summary || flow?.summary || '');
  const areaLines = AREA_ORDER.flatMap((key) => {
    const text = prose?.areas?.[key];
    return text ? [`${AREA_LABEL[key]} — ${k(text)}`] : [];
  });
  const actions = (prose?.actions?.length ? prose.actions : [prose?.action || flow?.action || '']).map(k).filter(Boolean);
  const supplement = [
    flow?.signals?.period ? `이달 기운이 머무는 기간: ${flow.signals.period}(절기 기준)` : null,
    flow?.supplement
      ? `채우면 좋은 기운: ${flow.supplement.element} — 색 ${flow.supplement.colors.join('·')}, 방향 ${flow.supplement.directions.join('·')}(참고용)`
      : null,
  ].filter((line): line is string => !!line);

  const sections: MonthViewSection[] = [
    { key: 'overview' as const, label: '이달의 총운', paragraphs: [overview] },
    { key: 'areas' as const, label: '분야별 운', paragraphs: areaLines },
    { key: 'focus' as const, label: '먼저 살펴볼 것', paragraphs: [k(prose?.focus || flow?.opportunity || '')] },
    { key: 'caution' as const, label: '조심할 점', paragraphs: [k(prose?.caution || flow?.caution || '')] },
    { key: 'actions' as const, label: '이렇게 해보세요', paragraphs: [], list: actions },
    { key: 'supplement' as const, label: '이달의 보완 포인트', paragraphs: supplement },
  ].filter((section) => section.paragraphs.some(Boolean) || section.list?.length);

  return {
    month,
    titleTop: areas ? `${month}월 · ${areas}` : `${month}월`,
    titleBottom: theme ? `${theme.season} 달` : `${tone} 흐름의 달`,
    lead: `${ganji}${tone} 흐름${theme ? ` — 나에게는 ${theme.personal} 달입니다.` : '입니다.'}`,
    sections,
  };
}

/** PDF 쪽 나눔용 평문(문단은 빈 줄로, 목록은 번호로). */
export function monthSectionText(section: MonthViewSection): string {
  if (section.list?.length) return section.list.map((item, index) => `${index + 1}. ${item}`).join('\n\n');
  return section.paragraphs.filter(Boolean).join('\n\n');
}
