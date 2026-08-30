// 2026-08-30 회귀 가드 — "관계·신살 신호에 합충 한자가 나온다"(사용자 재제보).
//
//   2026-05-20 정책: 본문·칩은 한글만, **사주팔자 4기둥 카드만** 한자 정체성 유지.
//   그 정책이 서술문(build-narrative)에만 적용되고 evidence 로 조립되는 관계·신살 카드는
//   빠져 있었다. 글로서리(FRIENDLY_TERM_MAP)는 **술어**만 바꾸므로 간지 글자가 그대로 남는다
//   — "글로서리가 통과해도 한자는 남는다"는 게 이 버그의 핵심이라 값으로 잡는다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRANCH_PROFILES, STEM_PROFILES } from './pdf-report-maps';
import { ganziToKorean, koreanizeGanzi } from './terminology';

describe('koreanizeGanzi', () => {
  it('간지 쌍을 한글 음으로 바꾼다', () => {
    expect(koreanizeGanzi('己未')).toBe('기미');
    expect(koreanizeGanzi('庚午')).toBe('경오');
    expect(koreanizeGanzi('戊辰')).toBe('무진');
  });

  it('실제 제보 문장을 통째로 한글로 만든다', () => {
    expect(
      koreanizeGanzi('육합 · 태어난 시간 묶음 己未 · 태어난 해 庚午 · 토 기운으로 합하는 관계')
    ).toBe('육합 · 태어난 시간 묶음 기미 · 태어난 해 경오 · 토 기운으로 합하는 관계');
  });

  it('낱글자(공망 지지)도 바꾼다', () => {
    expect(koreanizeGanzi('戌')).toBe('술');
    expect(koreanizeGanzi('亥')).toBe('해');
  });

  it('쌍을 낱글자보다 먼저 처리한다(기미가 기·미로 쪼개지지 않게)', () => {
    // 己 단독은 '기', 未 단독은 '미' — 쌍 처리가 늦으면 같은 결과라 구분이 안 되므로
    // 쌍 사이에 다른 글자가 낀 경우로 순서를 확인한다.
    expect(koreanizeGanzi('己未 庚 午')).toBe('기미 경 오');
  });

  it('오행 한자(木火土金水)는 건드리지 않는다 — 다른 표기 체계다', () => {
    expect(koreanizeGanzi('토(土) 기운')).toBe('토(土) 기운');
  });

  it('빈 값은 빈 문자열', () => {
    expect(koreanizeGanzi(null)).toBe('');
    expect(koreanizeGanzi(undefined)).toBe('');
  });
});

describe('간지 변환기는 한 곳에만 있다', () => {
  it('지역 복사본이 다시 생기지 않았다', () => {
    // 2026-08-30 — 같은 함수가 5벌로 흩어져 있어서 정책(한글화)이 한 곳에만 적용되고
    //   관계·신살 카드는 빠지는 일이 벌어졌다. 복사본이 다시 생기면 같은 누락이 재발한다.
    const files = collect(path.join(process.cwd(), 'src'));
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(process.cwd(), file);
      if (rel === 'src/lib/saju/terminology.ts') continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/function\s+(ganziToKorean|withKoreanGanzi|formatGanziWithHanja|ganziForBody)\s*\(/.test(text)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `간지 변환은 @/lib/saju/terminology 에서 import 하세요(지역 정의 금지).\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });
});

function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe('공용 변환기가 기존 구현들과 같은 값을 낸다', () => {
  it('60간지 전수 — STEM_PROFILES/BRANCH_PROFILES 파생값과 일치', () => {
    // report-document 는 원래 프로필 데이터에서 한글을 뽑아 썼다. 공용 함수로 바꾸면서
    // PDF 문구가 바뀌지 않았음을 값으로 증명한다(눈으로 못 보는 자리라 더 필요하다).
    const stems = Object.keys(STEM_PROFILES) as Array<keyof typeof STEM_PROFILES>;
    const branches = Object.keys(BRANCH_PROFILES) as Array<keyof typeof BRANCH_PROFILES>;
    expect(stems.length).toBe(10);
    expect(branches.length).toBe(12);
    for (let i = 0; i < 60; i += 1) {
      const ganzi = `${stems[i % 10]}${branches[i % 12]}`;
      const fromProfiles = `${STEM_PROFILES[stems[i % 10]!].korean[0]}${
        BRANCH_PROFILES[branches[i % 12]!].korean[0]
      }`;
      expect(ganziToKorean(ganzi), ganzi).toBe(fromProfiles);
    }
  });
});
