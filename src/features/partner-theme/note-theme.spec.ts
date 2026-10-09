import { describe, expect, it } from 'vitest';
import { NOTE_COLORS } from './note-theme';

// WCAG 2.x 상대 휘도 대비.
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('올해운 노트 색 대비(4.5:1)', () => {
  it.each([
    ['본문 글자', NOTE_COLORS.ink, NOTE_COLORS.bg],
    ['보조 글자', NOTE_COLORS.muted, NOTE_COLORS.bg],
    ['진한 코랄 글자', NOTE_COLORS.coralInk, NOTE_COLORS.bg],
    ['주 버튼 흰 글자', '#FFFFFF', NOTE_COLORS.ink],
    ['코랄 버튼 흰 글자', '#FFFFFF', NOTE_COLORS.coralInk],
    ['카드 위 보조 글자', NOTE_COLORS.muted, NOTE_COLORS.card],
  ])('%s', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('장식용 코랄은 글자 대비 미달 — 글자에 쓰지 않는다(이 값이 바뀌면 이 테스트를 다시 본다)', () => {
    expect(contrast(NOTE_COLORS.coral, NOTE_COLORS.bg)).toBeLessThan(4.5);
  });
});
