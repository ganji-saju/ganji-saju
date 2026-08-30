// 2026-08-30 #715 — 로딩 화면의 경과 표시.
//
//   제보: "로딩이 너무 길어서 풀이가 안 나오는 건가 오류가 난 건가 오해하기 쉽다."
//   진짜 진행률은 만들 수 없다(서버 컴포넌트가 LLM 생성을 통째로 await 하고 그동안
//   서버→클라이언트 통로가 없다). 그래서 **바는 살아 있다는 신호일 뿐이고 진실은 경과 초**다.
//   여기서 지키는 건 그 바가 **거짓말을 하지 않는다**는 것이다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { elapsedProgress } from './zodiac-wheel-loading';

const EST = 50_000;

describe('로딩 바는 거짓말하지 않는다', () => {
  it('절대 100% 에 닿지 않는다', () => {
    // 🔴 100% 에서 멈춰 있으면 "끝났는데 안 넘어간다" 로 읽혀 **지금보다 더 고장 같아 보인다.**
    //    고치러 온 문제를 되레 키우는 자리라 값으로 막는다.
    for (const mult of [1, 2, 5, 20, 100]) {
      expect(elapsedProgress(EST * mult, EST)).toBeLessThan(1);
    }
  });

  it('예상을 한참 넘겨도 계속 움직인다(멈춰 보이지 않는다)', () => {
    // 예상치가 짧게 잡혔을 때 바가 굳으면 그것도 고장으로 읽힌다.
    const a = elapsedProgress(EST * 3, EST);
    const b = elapsedProgress(EST * 4, EST);
    expect(b).toBeGreaterThan(a);
  });

  it('단조 증가한다 — 뒤로 가지 않는다', () => {
    let prev = -1;
    for (let ms = 0; ms <= EST * 3; ms += 1_000) {
      const v = elapsedProgress(ms, EST);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('시작은 0, 예상 시점엔 눈에 띄게 차 있다', () => {
    expect(elapsedProgress(0, EST)).toBe(0);
    // 예상 시간에 도달하면 절반 이상 — "거의 안 움직인다" 로 보이면 안 된다.
    expect(elapsedProgress(EST, EST)).toBeGreaterThan(0.5);
  });

  it('예상이 0/음수여도 터지지 않는다', () => {
    expect(elapsedProgress(1000, 0)).toBe(0);
    expect(elapsedProgress(1000, -5)).toBe(0);
  });
});

describe('채움 막대가 실제로 채워진다', () => {
  it('옛 왕복 애니메이션(zl-bar)보다 센 선택자로 잡는다', () => {
    // 🔴 실제로 당한 버그: 클래스 하나(0,1,0)로 뒀더니 `.zodiac-loading-bar span`(0,1,1)이
    //    이겨서 zl-bar 가 채움 막대를 좌우로 밀고 다녔다. width 는 정상이라 **수치로는
    //    안 잡히고** 화면을 봐야 보였다. 선택자를 약하게 되돌리면 조용히 재발한다.
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/components/saju/zodiac-wheel-loading.css'),
      'utf8'
    );
    expect(css).toContain('.zodiac-loading-bar .zodiac-loading-bar-fill');
    // 약한 선언(줄머리에 바로 오는 단독 클래스)이 남아 있으면 안 된다.
    expect(css).not.toMatch(/^\.zodiac-loading-bar-fill\s*\{/m);
  });
});

describe('로딩 화면 배선', () => {
  it('PDF 인쇄 화면은 자기 loading.tsx 를 갖는다', () => {
    // premium/loading.tsx 를 공유하면 /premium(빠름)에도 긴 예상이 걸려 거짓말이 된다.
    const file = 'src/app/saju/[slug]/premium/print/loading.tsx';
    expect(fs.existsSync(path.join(process.cwd(), file)), `${file} 없음`).toBe(true);
    expect(fs.readFileSync(path.join(process.cwd(), file), 'utf8')).toContain('estimateMs');
  });

  it('모든 로딩 화면이 estimateMs 를 넘긴다', () => {
    const dir = path.join(process.cwd(), 'src/app');
    const missing: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name === 'loading.tsx') {
          const src = fs.readFileSync(full, 'utf8');
          if (src.includes('GangiLoadingOverlay') && !src.includes('estimateMs')) {
            missing.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(dir);
    expect(
      missing,
      `estimateMs 를 안 넘기면 느려져도 경과 표시가 안 뜬다:\n  ${missing.join('\n  ')}`
    ).toEqual([]);
  });
});
