// 2026-08-29 — 로딩 화면이 12지신 모션 에셋을 직접 참조한다. 파일이 하나라도 없으면
//   로딩 한가운데가 404 로 비고, 로딩은 그 자체로 "화면이 멈춘 것처럼" 보이는 자리다.
//   에셋을 옮기거나 이름을 바꾸면 여기서 먼저 걸린다(home-banner-assets 와 같은 취지).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = 'src/components/saju/zodiac-wheel-loading.tsx';
const MOTION_DIR = 'public/images/gangi/guardians/motion';

/** 컴포넌트가 들고 있는 12지 id 목록(BRANCHES 의 id 필드). */
function branchIds(): string[] {
  const src = fs.readFileSync(path.join(process.cwd(), SOURCE), 'utf8');
  const block = src.match(/const BRANCHES = \[([\s\S]*?)\] as const;/)?.[1];
  if (!block) throw new Error('BRANCHES 배열을 못 찾았다 — 테스트가 소스 구조를 따라가야 한다');
  return [...block.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]!);
}

describe('12지신 로딩 화면', () => {
  const ids = branchIds();

  it('12지가 빠짐없이 12개다', () => {
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it('각 지지의 모션 영상과 포스터가 실제로 있다', () => {
    for (const id of ids) {
      for (const ext of ['mp4', 'webp']) {
        const file = path.join(process.cwd(), MOTION_DIR, `${id}.${ext}`);
        expect(fs.existsSync(file), `${MOTION_DIR}/${id}.${ext} 없음 — 로딩 가운데가 404`).toBe(true);
      }
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
