import { describe, expect, it } from 'vitest';
import { DREAM_DICTIONARY } from '@/lib/dream-dictionary';
import { buildDreamPersonalReading, DREAM_COMPANIONS, DREAM_ENDINGS, DREAM_FEELINGS } from './dream-personalize';

describe('꿈해몽 상황 선택', () => {
  it('고른 상황마다 문장이 생기고, 모든 사전 항목·조합에 비문 조사·예고·공포 표현이 없다', () => {
    for (const meaning of Object.values(DREAM_DICTIONARY)) {
      for (const f of DREAM_FEELINGS) for (const e of DREAM_ENDINGS) for (const c of DREAM_COMPANIONS) {
        const lines = buildDreamPersonalReading(meaning, { feeling: f.id, ending: e.id, companion: c.id });
        // 키워드 자체(예: '죽음')는 사전 항목이라 금지어 검사에서 뺀다.
        const text = lines.join(' ').replaceAll(meaning.keyword, '○');
        expect(lines.length).toBeGreaterThanOrEqual(3);
        expect(text).not.toMatch(/관계과|변화과|관계을|변화을|반드시|죽음|사고가|큰일/);
      }
    }
  });

  it('길몽인데 기분이 나빴으면 준비·점검으로, 흉몽인데 편안했으면 정리로 읽는다', () => {
    const good = buildDreamPersonalReading({ keyword: '돼지', category: 'animal', fortune: '길몽' }, { feeling: 'scared' }).join(' ');
    expect(good).toContain('준비와 점검');
    const bad = buildDreamPersonalReading({ keyword: '이빨', category: 'object', fortune: '흉몽' }, { feeling: 'calm' }).join(' ');
    expect(bad).toContain('정리와 마무리');
  });

  it('아무것도 고르지 않으면 빈 목록', () => {
    expect(buildDreamPersonalReading({ keyword: '물', category: 'nature', fortune: '중립' }, {})).toEqual([]);
  });
});
