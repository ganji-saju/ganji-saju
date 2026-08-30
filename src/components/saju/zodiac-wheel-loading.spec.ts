// 2026-08-29 — 로딩 화면이 에셋을 직접 참조한다. 파일이 없으면 로딩 한가운데가 404 로 비고,
//   로딩은 그 자체로 "화면이 멈춘 것처럼" 보이는 자리다. 에셋을 옮기거나 이름을 바꾸면
//   여기서 먼저 걸린다(home-banner-assets 와 같은 취지).
// 2026-08-30 #711 — 원반 영상 1개에서 **얼굴 12장 고리**로 바뀌었다. 지킬 것도 바뀐다:
//   12지가 12개인지, 얼굴 파일이 다 있는지, 그리고 **고리와 얼굴의 회전 주기가 같은지**.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = 'src/components/saju/zodiac-wheel-loading.tsx';
const CSS = 'src/components/saju/zodiac-wheel-loading.css';
const FACE_DIR = 'public/images/gangi/guardians/faces';

const source = fs.readFileSync(path.join(process.cwd(), SOURCE), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), CSS), 'utf8');

/** 컴포넌트가 들고 있는 12지 id 목록(BRANCHES 의 id 필드). */
function branchIds(): string[] {
  const block = source.match(/const BRANCHES = \[([\s\S]*?)\] as const;/)?.[1];
  if (!block) throw new Error('BRANCHES 배열을 못 찾았다 — 테스트가 소스 구조를 따라가야 한다');
  return [...block.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]!);
}

describe('12지신 로딩 화면', () => {
  const ids = branchIds();

  it('12지가 빠짐없이 12개다', () => {
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it('각 지지의 얼굴 파일이 실제로 있다', () => {
    for (const id of ids) {
      const file = path.join(process.cwd(), FACE_DIR, `${id}.webp`);
      expect(fs.existsSync(file), `${FACE_DIR}/${id}.webp 없음 — 고리에 빈 칸이 생긴다`).toBe(true);
    }
  });

  it('고리와 얼굴의 회전 주기가 같다', () => {
    // 얼굴은 고리와 **반대로 같은 속도**로 돌아야 항상 똑바로 선다. 한쪽 주기만 바꾸면
    // 얼굴이 천천히 기울다가 뒤집힌다 — 느려서 눈에 안 띄고, 한 바퀴를 봐야 드러난다.
    const ring = css.match(/\.zodiac-loading-ring\s*\{[^}]*animation:\s*zl-spin\s+(\d+)s/)?.[1];
    const face = css.match(/\.zodiac-loading-face-img\s*\{[^}]*animation:\s*zl-spin-back\s+(\d+)s/)?.[1];
    expect(ring, '고리 회전 주기를 못 찾았다').toBeTruthy();
    expect(face, '얼굴 역회전 주기를 못 찾았다').toBeTruthy();
    expect(face).toBe(ring);
  });

  it('보라 구버전 잔재(별입자·보라 그라데이션)가 남아 있지 않다', () => {
    // 개편 전 카드 색. 다시 들어오면 로딩만 옛 브랜드로 튄다.
    for (const stale of ['#1a0a2e', '#2e1156', '#45178a']) {
      expect(css).not.toContain(stale);
    }
  });
});
