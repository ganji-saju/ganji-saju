import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuNarrative } from '@/domain/saju/report/build-narrative';
import { SajuNarrativeCard } from '@/components/saju/saju-narrative-card';
import { ElementsSection } from './elements-section';
import { NatureSection } from './nature-section';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';

describe('기본사주 질문과 오행 풀이 표시', () => {
  it('실제 카드가 각 질문의 답·계산 근거·생활 사례·선택 기준을 모두 표시한다', () => {
    const data = calculateSajuDataV1({ year: 1982, month: 1, day: 29, hour: 8, gender: 'male' });
    const narrative = buildSajuNarrative(data, null);
    const html = renderToStaticMarkup(createElement(SajuNarrativeCard, { narrative }));
    for (const item of narrative.questions) {
      for (const text of Object.values(item)) {
        // React의 텍스트 escape와 같은 규칙으로 비교한다.
        const escaped = renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
        expect(html).toContain(escaped);
      }
    }
    expect(html.match(/풀이 근거/g)).toHaveLength(4);
    expect(html.match(/<strong>선택 기준/g)).toHaveLength(4);
  });

  it('성향의 일주 설명은 한 번만 표시하고 원국의 격국 조건을 함께 표시한다', () => {
    const data = calculateSajuDataV1({ year: 1982, month: 1, day: 29, hour: 8, gender: 'male' });
    const context = buildSajuPersonalizationContext(data);
    const grounding = { personalizationContext: context } as Parameters<typeof NatureSection>[0]['grounding'];
    const html = renderToStaticMarkup(createElement(NatureSection, { sajuData: data, grounding }));
    expect(html.split(context.sixtyGapja!.core)).toHaveLength(2);
    expect(html).toContain(data.pattern!.name);
    expect(html).toContain('같은 일주도 무엇이 다를까요?');
  });

  it('균형의 최소 오행은 결핍으로 표시하지 않고 계산된 용신을 보완 방향으로 사용한다', () => {
    const data = calculateSajuDataV1({ year: 1982, month: 1, day: 29, hour: 8, gender: 'male' });
    data.fiveElements.weakest = '목';
    data.fiveElements.byElement.목.state = 'balanced';
    data.yongsin!.primary = { type: 'element', value: '금', label: '금 기운' };
    const html = renderToStaticMarkup(createElement(ElementsSection, { sajuData: data }));
    expect(html).toContain('금 기운을 보완 방향으로 읽습니다');
    expect(html).toContain('부족한 상태로 분류되지 않았습니다');
    expect(html).not.toMatch(/비어 있어요|서쪽|은색|소품|붉은 계열/);
  });
});
