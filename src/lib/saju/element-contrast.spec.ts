// 2026-08-30 회귀 가드 — "오행 원형도표 가운데 한자가 회색이라 안 보인다"(사용자 제보).
//
//   원인: 원소 색(마크용)을 **글자색으로** 그대로 썼다. 금(金) #9E9E9E 는 흰 배경 대비
//   2.68:1 — 본문 최소치(4.5)는 물론 큰 글씨 기준(3)도 못 넘는다. 드래그하면 보였다는 건
//   글자가 없는 게 아니라 대비가 없다는 뜻이었다. 5색 중 3색(목·토·금)이 3:1 미만이었다.
//
//   규칙: 마크(도넛 조각·범례 점·배경)는 color, **글자는 textColor**.
import { describe, expect, it } from 'vitest';
import { ELEMENT_INFO } from './elements';

/** WCAG 상대 휘도. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('오행 색 대비', () => {
  const elements = Object.entries(ELEMENT_INFO);

  it('다섯 원소 모두 textColor 를 가진다', () => {
    expect(elements).toHaveLength(5);
    for (const [name, info] of elements) {
      expect(info.textColor, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('textColor 는 흰 배경에서 본문 최소 대비(4.5:1)를 넘는다', () => {
    for (const [name, info] of elements) {
      const ratio = contrast(info.textColor, '#FFFFFF');
      expect(ratio, `${name} ${info.textColor} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('마크용 color 와 글자용 textColor 는 서로 다르다(같아지면 대비가 무너진다)', () => {
    for (const [name, info] of elements) {
      expect(info.textColor, name).not.toBe(info.color);
    }
  });
});
