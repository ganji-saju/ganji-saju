import assert from 'node:assert/strict';
import {
  SCORE_DISCLAIMER,
  getScoreColorClasses,
  OHAENG_COLOR_CLASSES,
} from '../labels';

// 2026-05-22 — Phase 2+3 스펙: 점수/오행 Tailwind 클래스 매핑 + 면책 문구.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('SCORE_DISCLAIMER: naming-policy 면책 문구 고정', () => {
  assert.equal(SCORE_DISCLAIMER, '사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요.');
});

test('getScoreColorClasses: 5레벨 모두 score-* 토큰 클래스 반환', () => {
  const levels = ['excellent', 'good', 'neutral', 'mindful', 'potential'] as const;
  for (const level of levels) {
    const c = getScoreColorClasses(level);
    assert.equal(c.bg, `bg-score-${level}`, `${level} bg`);
    assert.equal(c.bgSoft, `bg-score-${level}-soft`, `${level} bgSoft`);
    assert.equal(c.text, `text-score-${level}`, `${level} text`);
    assert.equal(c.ring, `ring-score-${level}/30`, `${level} ring`);
    assert.equal(c.border, `border-score-${level}/20`, `${level} border`);
    assert.ok(c.gradient.startsWith(`from-score-${level}`), `${level} gradient`);
    assert.equal(c.textDark, 'text-white');
  }
});

test('OHAENG_COLOR_CLASSES: 5오행 모두 ohaeng-* 토큰 클래스', () => {
  const map: Record<string, string> = {
    목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su',
  };
  for (const [oh, key] of Object.entries(map)) {
    const c = OHAENG_COLOR_CLASSES[oh as keyof typeof OHAENG_COLOR_CLASSES];
    assert.equal(c.bg, `bg-ohaeng-${key}`, `${oh} bg`);
    assert.equal(c.soft, `bg-ohaeng-${key}-soft`, `${oh} soft`);
    assert.equal(c.text, `text-ohaeng-${key}`, `${oh} text`);
  }
});
