// 2026-08-29 — 로딩 화면이 모션 에셋을 직접 참조한다. 파일이 없으면 로딩 한가운데가 404 로
//   비고, 로딩은 그 자체로 "화면이 멈춘 것처럼" 보이는 자리다. 에셋을 옮기거나 이름을
//   바꾸면 여기서 먼저 걸린다(home-banner-assets 와 같은 취지).
// 2026-08-30 — 12종 순환에서 **12지신이 함께 선 원반 1개**로 바뀌었다. 지킬 것도 바뀐다:
//   에셋 2개(mp4·poster)와, 모바일에서 자동재생을 살려주는 속성 3개.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = 'src/components/saju/zodiac-wheel-loading.tsx';
const MOTION_DIR = 'public/images/gangi/guardians/motion';

const source = fs.readFileSync(path.join(process.cwd(), SOURCE), 'utf8');

describe('12지신 로딩 화면', () => {
  it('원반 모션과 포스터가 실제로 있다', () => {
    for (const file of ['zodiac-wheel.mp4', 'zodiac-wheel.webp']) {
      const full = path.join(process.cwd(), MOTION_DIR, file);
      expect(fs.existsSync(full), `${MOTION_DIR}/${file} 없음 — 로딩 한가운데가 404`).toBe(true);
    }
  });

  it('컴포넌트가 참조하는 경로가 그 파일들이다', () => {
    // 상수만 바꾸고 파일은 안 옮긴 경우를 잡는다(위 테스트는 파일만 본다).
    for (const ref of ['zodiac-wheel.mp4', 'zodiac-wheel.webp']) {
      expect(source).toContain(ref);
    }
  });

  it('모바일 자동재생 속성(muted·playsInline·loop)이 살아 있다', () => {
    // 셋 중 하나만 빠져도 iOS Safari 는 재생을 거부한다 — 화면엔 포스터가 굳어 있고
    // 에러도 안 난다. "모션이 안 도는데 원인이 안 보이는" 대표 유형이라 값으로 잡는다.
    const video = source.match(/<video[\s\S]*?\/>/)?.[0];
    expect(video, '<video> 를 못 찾았다 — 테스트가 소스 구조를 따라가야 한다').toBeTruthy();
    for (const attr of ['muted', 'playsInline', 'loop']) {
      expect(video).toContain(attr);
    }
  });

  it('보라 구버전 잔재(별입자·보라 그라데이션)가 남아 있지 않다', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/components/saju/zodiac-wheel-loading.css'),
      'utf8'
    );
    // 개편 전 카드 색. 다시 들어오면 로딩만 옛 브랜드로 튄다.
    for (const stale of ['#1a0a2e', '#2e1156', '#45178a']) {
      expect(css).not.toContain(stale);
    }
  });
});
