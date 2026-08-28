// 🔴 2026-08-28 — 수호신 모션 포스터의 **상단 여백** 가드.
//
//   힉스필드(Seedance 2.0)는 --aspect_ratio 를 뭘 주든 3:4 로 내보낸다. 원본은 580×720
//   (0.806)이라 그대로 넣으면 좌우를 잘라 3:4 를 만들고, 그만큼 인물이 확대돼 **위가 잘린다**.
//   카드 모션 12종은 패딩 없이 생성돼서 뿔이 긴 sheep 이 실제로 잘렸다(사용자 제보).
//   배너 6종은 패딩 후 생성해 멀쩡했다 — 같은 파이프라인인데 입력만 달랐다.
//
//   생성 전 소스를 3:4 로 상하 대칭 패딩하면 예방된다. 이 테스트는 결과물에서 확인한다.
//   ⚠️ 홈에 실제로 걸리는 키만 본다(tiger·rat 등 미사용 에셋은 고쳐도 보이는 게 없다).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GANGI_HOME_CARDS, GANGI_HOME_BANNERS } from './gangi-market';

declare const test: (name: string, fn: () => Promise<void>) => void;

const MOTION_DIR = path.join(process.cwd(), 'public/images/gangi/guardians/motion');

/** 맨 위 3줄에서 배경과 다른 픽셀의 비율(%). 0 이 아니면 프레임 밖으로 잘린 것. */
async function topEdgeContact(file: string): Promise<number> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width } = info;
  const rows = 3;
  // 배경색 = 맨 윗줄 좌우 모서리의 중앙값(한지 종이톤).
  const corner: number[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < 12; x += 1) corner.push(data[y * width + x]!, data[y * width + (width - 1 - x)]!);
  }
  corner.sort((a, b) => a - b);
  const bg = corner[Math.floor(corner.length / 2)]!;

  let hits = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < width; x += 1) if (Math.abs(data[y * width + x]! - bg) > 30) hits += 1;
  }
  return (hits / (rows * width)) * 100;
}

test('홈에 걸린 수호신 모션은 위가 잘리지 않는다', async () => {
  const ids = new Set<string>();
  for (const card of GANGI_HOME_CARDS) if (card.image) ids.add(card.image);
  for (const banner of GANGI_HOME_BANNERS) if (banner.character) ids.add(`${banner.character}-banner`);

  const clipped: string[] = [];
  for (const id of [...ids].sort()) {
    const poster = path.join(MOTION_DIR, `${id}.webp`);
    if (!fs.existsSync(poster)) continue; // 존재 여부는 home-banner-assets.test.ts 담당
    const contact = await topEdgeContact(poster);
    if (contact > 1) clipped.push(`${id}: 상단 접촉 ${contact.toFixed(1)}% — 패딩한 소스로 재생성할 것`);
  }

  assert.deepEqual(clipped, [], `모션 에셋이 위에서 잘렸다:\n${clipped.join('\n')}`);
});
