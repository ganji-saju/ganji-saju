// 2026-08-30 #716 — 선택된 버튼의 글자색.
//
//   제보: "성별 고르는 거에서 클릭하면 버튼은 붉은데 텍스트는 검정이라 잘 안 보여."
//   실측: 인주 배경(#B3372A)에 먹색 글자(#1C1A17) = **대비 2.89** (큰 글씨 기준 3.0 미달).
//
//   🔴 원인은 특이도가 아니라 **캐스케이드 레이어**다. components.css 는 전부
//   `@layer components` 안이고 Tailwind utilities 레이어는 **그 뒤**에 온다.
//   레이어가 다르면 특이도는 아예 비교되지 않는다 — 뒤 레이어가 무조건 이긴다.
//   그래서 `.gangi-birth-card-choice.is-selected * { color:#fff }`(0,2,0)가
//   `text-[var(--app-ink)]`(0,1,0)에게 졌다. **CSS 만 봐서는 맞아 보인다.**
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** 선택 상태를 CSS 로 칠하는 버튼들 — 자식이 색을 박으면 그 CSS 가 진다. */
const FILES = [
  'src/components/saju/shared/unified-birth-info-fields.tsx',
  'src/app/zodiac/zodiac-birth-check.tsx',
];

describe('선택 버튼 안에서 글자색을 하드코딩하지 않는다', () => {
  it.each(FILES)('%s', (file) => {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    const offenders: string[] = [];
    // `is-selected` 로 토글되는 <button> 블록 안의 text 색 유틸리티를 찾는다.
    for (const m of src.matchAll(/is-selected'\)\}([\s\S]{0,600}?)<\/button>/g)) {
      // 주석은 설명하느라 클래스명을 그대로 쓴다 — 걷어내고 본다.
      const code = m[1]!.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      const hits = code.match(/\btext-\[[^\]]*\]|\btext-(?:white|black|slate-\d+|gray-\d+)\b/g);
      if (hits) offenders.push(hits.join(', '));
    }
    expect(
      offenders,
      `선택 상태 색이 Tailwind utilities 레이어에 져서 안 보이게 된다. 색은 CSS 가 잡는다:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });
});
