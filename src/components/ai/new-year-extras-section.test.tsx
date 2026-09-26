// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { NewYearExtrasSection } from './new-year-extras-section';
import type { SajuNewYearExtras } from '@/server/ai/saju-yearly-interpretation';

const extras: SajuNewYearExtras = {
  categories: { family: '가족 문단입니다.', study: '학업 문단입니다.' },
  quarterlyFlows: [1, 2, 3, 4].map((q) => ({
    quarter: q as 1 | 2 | 3 | 4,
    months: [q * 3 - 2, q * 3 - 1, q * 3] as [number, number, number],
    summary: `${q}분기 요약입니다.`,
    focusCategory: 'wealth' as const,
  })),
  expectations: [{ month: 5, category: 'wealth', text: '계약은 이달 안에 매듭짓기 좋습니다.' }],
  cautions: [{ month: 8, category: 'health', text: '수면 리듬을 먼저 지키세요.' }],
};

it('영역 파트: 가족운·학업·시험운과 기대할 일/조심할 일을 월·분야 라벨과 함께 보여 준다', () => {
  const html = renderToStaticMarkup(createElement(NewYearExtrasSection, { extras, part: 'areas', year: 2027 }));
  expect(html).toContain('가족운');
  expect(html).toContain('학업·시험운');
  expect(html).toContain('2027년에 기대할 일');
  expect(html).toContain('2027년에 조심할 일');
  expect(html).toContain('5월 · 재물운');
  expect(html).toContain('8월 · 건강운');
});

it('분기 파트: 분기 카드 4개와 핵심 분야', () => {
  const html = renderToStaticMarkup(createElement(NewYearExtrasSection, { extras, part: 'quarters', year: 2027 }));
  expect(html.match(/data-quarter=/g)).toHaveLength(4);
  expect(html).toContain('1분기 · 1~3월');
  expect(html).toContain('재물운');
});
