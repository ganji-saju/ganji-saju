// 2026-08-30 — 수호신 모션 자산 존재 가드.
//
//   원래 이 단언은 zodiac-wheel-loading.spec.ts 에 있었다. 로딩 화면이 12지신 클립을
//   한 마리씩 돌렸기 때문에 "12개가 다 있나"를 거기서 봤던 것이다. 로딩이 원반 1개로
//   바뀌면서 그 테스트를 지웠는데, **클립을 실제로 쓰는 건 로딩이 아니라 이 컴포넌트다.**
//   가드가 쓰는 쪽이 아니라 우연히 같이 쓰던 쪽에 붙어 있었던 셈이라 여기로 옮긴다.
//
//   비면 조용하다: MOTION_IDS 에 있는 id 로 <video> 를 그리는데 파일이 없으면 poster 가
//   404 나고 **초상이 통째로 빈 칸**이 된다. 에러도, 콘솔 경고도 사용자에겐 안 보인다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = 'src/components/gangi/guardian-portrait.tsx';
const MOTION_DIR = 'public/images/gangi/guardians/motion';

/** 컴포넌트가 "모션 있음"으로 선언한 id 목록(MOTION_IDS). */
function motionIds(): string[] {
  const src = fs.readFileSync(path.join(process.cwd(), SOURCE), 'utf8');
  const block = src.match(/const MOTION_IDS = new Set\(\[([\s\S]*?)\]\);/)?.[1];
  if (!block) throw new Error('MOTION_IDS 를 못 찾았다 — 테스트가 소스 구조를 따라가야 한다');
  return [...block.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!);
}

describe('수호신 모션 자산', () => {
  const ids = motionIds();

  it('12지가 빠짐없이 들어 있다', () => {
    const zodiac = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
                    'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig'];
    for (const id of zodiac) expect(ids, `${id} 가 MOTION_IDS 에서 빠졌다`).toContain(id);
  });

  it('선언한 id 마다 영상과 포스터가 실제로 있다', () => {
    for (const id of ids) {
      for (const ext of ['mp4', 'webp']) {
        const file = path.join(process.cwd(), MOTION_DIR, `${id}.${ext}`);
        expect(fs.existsSync(file), `${MOTION_DIR}/${id}.${ext} 없음 — 초상이 빈 칸이 된다`).toBe(true);
      }
    }
  });
});
