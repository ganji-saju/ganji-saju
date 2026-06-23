#!/usr/bin/env node
/**
 * 2026-06-23 — 메인 캐릭터 카드 이미지 최적화(타로 cards-opt 패턴).
 *   원본 투명배경 PNG(~2MB)를 카드용 avif/webp/png 로 변환. 폭 640px(retina 카드).
 *   변환본만 git 커밋(public/images/gangi/characters/), 원본은 비커밋.
 *
 * 사용: node scripts/optimize-gangi-characters.mjs [소스폴더]
 *   기본 소스: ~/Downloads/간지사주 이미지
 * 멱등: 같은 입력이면 같은 출력(덮어씀).
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SRC_DIR = process.argv[2] || path.join(os.homedir(), 'Downloads', '간지사주 이미지');
const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'gangi', 'characters');
const WIDTH = 640; // retina 카드(표시 ~320px)

// id ← 시안 slide3 매핑. 원본 파일명(공백 포함) 그대로.
const MAP = [
  { id: 'saju', src: '사주_ 백담.png' },
  { id: 'daewoon', src: '대운_존명.png' },
  { id: 'taekil', src: '상담_.png' },
  { id: 'gunghap', src: '궁합_ 설화.png' },
  { id: 'dream', src: '꿈해몽_천녀.png' },
  { id: 'consult', src: '상담.png' },
  { id: 'tarot', src: '무료타로.png' },
  { id: 'today', src: '무료운세.png' },
];

mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
for (const { id, src } of MAP) {
  const inPath = path.join(SRC_DIR, src);
  if (!existsSync(inPath)) {
    console.error(`✗ 원본 없음: ${inPath}`);
    continue;
  }
  // 투명배경 보존(트림 후 폭 리사이즈). contain 아닌 원본 비율 유지.
  const base = sharp(inPath).trim({ threshold: 10 }).resize({ width: WIDTH, withoutEnlargement: true });
  const outBase = path.join(OUT_DIR, id);
  await base.clone().avif({ quality: 62 }).toFile(`${outBase}.avif`);
  await base.clone().webp({ quality: 78 }).toFile(`${outBase}.webp`);
  await base.clone().png({ compressionLevel: 9, palette: true }).toFile(`${outBase}.png`);
  ok += 1;
  console.log(`✓ ${id}  (${src})`);
}

console.log(`\n완료: ${ok}/${MAP.length} → ${path.relative(process.cwd(), OUT_DIR)}/{id}.{avif,webp,png}`);
