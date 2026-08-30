// 2026-08-30 #714 — 네 기둥을 늘어놓는 **순서**.
//
//   제보: 결과 페이지의 사주팔자 블록은 연→월→일→시, 바로 아래 도식은 시→일→월→연 으로
//   반대였다. 평생리포트 패널도 연→시 방향이었다.
//   🔴 이건 **각 화면만 보면 멀쩡해 보인다** — 두 블록을 나란히 놓고 봐야 드러난다.
//   그래서 오래 안 잡혔고, 값으로 잡아야 한다.
//
//   정본은 만세력 관례이자 도식·PDF 가 이미 쓰던 **시 → 일 → 월 → 연**.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PILLAR_DISPLAY_ORDER } from './saju-screen-helpers';

/** 주석을 걷어낸 소스. 주석엔 설명하느라 '년주' 같은 표기가 그대로 들어가므로
 *  코드만 봐야 한다(이 가드를 처음 붙였을 때 내가 쓴 주석에 걸렸다). */
function read(rel: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석 + JSX {/* ... */}
    .replace(/^[ \t]*\/\/.*$/gm, ''); // 줄 주석(https:// 를 건드리지 않게 줄머리만)
}

/** 소스에서 '○주' 표기가 나오는 순서를 뽑는다(중복 제거). */
function pillarSequence(source: string): string[] {
  const seen: string[] = [];
  for (const m of source.matchAll(/['"]([시일월연년])주['"]/g)) {
    const key = m[1] === '년' ? '연' : m[1]!;
    if (!seen.includes(key)) seen.push(key);
    if (seen.length === 4) break;
  }
  return seen;
}

describe('네 기둥 표시 순서', () => {
  it('정본은 시 → 일 → 월 → 연 이다', () => {
    expect([...PILLAR_DISPLAY_ORDER]).toEqual(['시', '일', '월', '연']);
  });

  it.each([
    ['PDF', 'src/components/report/report-document.tsx'],
    ['평생리포트 패널', 'src/components/ai/lifetime-report-panel.tsx'],
  ])('%s 도 같은 순서다', (_name, file) => {
    expect(pillarSequence(read(file))).toEqual([...PILLAR_DISPLAY_ORDER]);
  });

  it.each([
    ['결과 페이지 사주팔자', 'src/app/saju/[slug]/page.tsx'],
    ['명식 도식', 'src/features/saju-detail/sections/myeongsik-section.tsx'],
  ])('%s 는 배열을 다시 적지 않고 공용 상수를 쓴다', (_name, file) => {
    // 배열을 손으로 또 적으면 순서가 갈린다 — 애초에 못 적게 막는다.
    expect(read(file)).toContain('PILLAR_DISPLAY_ORDER');
  });

  it("'년주' 표기가 화면에 남아 있지 않다", () => {
    // 두음법칙상 年柱 는 '연주'. 한 화면에 '년주'/'연주' 가 섞여 있었다.
    const offenders: string[] = [];
    for (const file of [
      'src/app/saju/[slug]/page.tsx',
      'src/features/saju-detail/sections/myeongsik-section.tsx',
      'src/components/report/report-document.tsx',
      'src/components/ai/lifetime-report-panel.tsx',
    ]) {
      if (/['"]년주['"]/.test(read(file))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
