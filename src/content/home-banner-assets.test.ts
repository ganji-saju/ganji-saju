// 🔴 2026-08-28 — 홈 배너 캐릭터의 **배너 전용 에셋** 존재 가드.
//
//   배너 초상은 카드와 같은 캐릭터 키를 쓰지만 파일은 다르다: `{character}-banner`.
//   그 변형은 6종(t7·ox·dog·snake·rabbit·pig)만 만들어 뒀는데, 카드 키(rooster 등)를
//   그대로 배너에 넣으면 **빌드도 타입도 통과하고 404 만 난다.** 초상이 사라진 자리에
//   텍스트는 계속 우측 34% 를 비워 둬서 "배너가 잘렸다"로 보인다(실제 제보).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GANGI_HOME_BANNERS } from './gangi-market';

declare const test: (name: string, fn: () => void) => void;

// GuardianPortrait 의 실제 경로 규칙:
//   · MOTION_IDS 에 있으면  <video poster=motion/{id}.webp src=motion/{id}.mp4>
//   · 없으면                <img src=guardians/{id}.jpg>   ← 배너 변형은 이 파일이 없다
// 배너는 `{character}-banner` 를 쓰므로 **모션 에셋 2종이 반드시 있어야** 한다.
const MOTION_DIR = path.join(process.cwd(), 'public/images/gangi/guardians/motion');

test('배너 캐릭터는 -banner 모션 에셋(webp 포스터 + mp4)을 가진다', () => {
  const missing: string[] = [];

  for (const banner of GANGI_HOME_BANNERS) {
    if (!banner.character || banner.image) continue; // 완성형 이미지 배너는 초상을 안 쓴다
    const id = `${banner.character}-banner`;
    for (const ext of ['webp', 'mp4']) {
      if (!fs.existsSync(path.join(MOTION_DIR, `${id}.${ext}`))) {
        missing.push(`${banner.id}: motion/${id}.${ext} 없음`);
      }
    }
  }

  assert.deepEqual(missing, [], `배너 에셋 누락 — 초상이 404 로 사라지고 우측 34% 가 빈다:\n${missing.join('\n')}`);
});

// GuardianPortrait 의 MOTION_IDS 화이트리스트에도 등록돼 있어야 <video> 로 간다.
//   파일만 있고 목록에 없으면 <img guardians/{id}.jpg> 로 떨어져 똑같이 404 다.
test('배너 캐릭터는 GuardianPortrait MOTION_IDS 에 등록돼 있다', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/gangi/guardian-portrait.tsx'),
    'utf8'
  );
  for (const banner of GANGI_HOME_BANNERS) {
    if (!banner.character || banner.image) continue;
    const id = `${banner.character}-banner`;
    assert.ok(
      source.includes(`'${id}'`),
      `${banner.id}: MOTION_IDS 에 '${id}' 없음 — <img>.jpg 로 떨어져 404 난다`
    );
  }
});
