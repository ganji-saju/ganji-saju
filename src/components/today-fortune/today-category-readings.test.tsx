import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { TodayCategoryReadings } from './today-category-readings';
import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

it('renders the personal answer and evidence while accepting earlier saved results', () => {
  const score = {
    key: 'wealth' as const, label: '재물', score: 61, summary: '약속한 금액부터 확인해보세요.',
    reading: {
      question: '오늘 무엇을 확인할까요?', answer: '약속한 금액부터 확인해보세요.',
      evidence: '원국과 오늘을 함께 읽은 근거입니다.', example: '비용을 나눌 상황이라면 총액을 확인하세요.',
      choice: '조건이 확인되면 결정하세요.',
    },
  };
  const result = { dateKey: '2026-09-18', scores: [score] } as TodayFortuneFreeResult;
  const html = renderToStaticMarkup(createElement(TodayCategoryReadings, { result }));
  for (const value of Object.values(score.reading)) expect(html).toContain(value);
  expect(html).toContain('결과의 확률은 아닙니다');

  const { reading: _reading, ...legacyScore } = score;
  const legacy = renderToStaticMarkup(createElement(TodayCategoryReadings, { result: { ...result, scores: [legacyScore] } }));
  expect(legacy).toContain(legacyScore.summary);
  expect(legacy).not.toContain(score.reading.evidence);
  expect(legacy).not.toContain('오늘의 선택 기준');
});
