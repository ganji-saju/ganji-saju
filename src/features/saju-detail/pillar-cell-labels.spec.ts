// 2026-08-30 #713 — 사주 도식 라벨.
//
//   제보: "천간 천간 천간 천간 / 지지 지지 지지 지지 — 이게 맞는 거야?" 아니었다.
//   '천간'·'지지' 는 행 이름인데 칸마다 찍혀 네 기둥에 같은 글자가 반복됐다.
//
//   여기서 지키는 건 **틀려도 화면이 멀쩡해 보이는** 두 가지다.
import { describe, expect, it } from 'vitest';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { pillarCellLabels } from './saju-screen-helpers';

/** 12지 정기(正氣) — 만세력 정본. 지지의 십신은 이 글자 기준으로 매긴다. */
const PRIMARY_HIDDEN_STEM: Record<string, string> = {
  子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙',
  午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬',
};

const saju = calculateSajuDataV1({
  year: 1990, month: 5, day: 3, hour: 14, minute: 0,
  gender: 'male',
});

describe('사주 도식 라벨', () => {
  it('지지 십신은 지장간 **본기**에서 나온다', () => {
    // 🔴 hiddenStems 의 순서가 바뀌면(여기→정기 순으로 정렬 등) 도식의 지지 십신이
    //    통째로 틀린 값이 된다. 그런데 화면은 멀쩡해 보인다 — 값으로만 잡힌다.
    for (const p of [saju.pillars.year, saju.pillars.month, saju.pillars.day, saju.pillars.hour]) {
      if (!p) continue;
      expect(p.hiddenStems[0]?.stem, `${p.branch} 의 첫 지장간이 정기가 아니다`).toBe(
        PRIMARY_HIDDEN_STEM[p.branch]
      );
    }
  });

  it('일주 천간은 십신 대신 "일원" 이다', () => {
    // 일간은 비교 기준 자신이라 십신이 없다(stemTenGod = null). 그대로 두면 '-' 가 찍힌다.
    const day = pillarCellLabels(saju.pillars.day, true);
    expect(saju.pillars.day.stemTenGod).toBeNull();
    expect(day.stem).toContain('일원');
  });

  it('기둥마다 라벨이 다르다 — 같은 글자가 반복되지 않는다', () => {
    const labels = [saju.pillars.hour, saju.pillars.day, saju.pillars.month, saju.pillars.year]
      .map((p, i) => pillarCellLabels(p ?? null, i === 1));
    // 이 사주(戊辰 일주)는 시/일/월/년 = 己未·戊辰·庚辰·庚午 라 천간 라벨이 다 다르다.
    for (const l of labels) {
      expect(l.stem).not.toBe('천간');
      expect(l.branch).not.toBe('지지');
      expect(l.stem).toMatch(/^[가-힣] · .+/);
      expect(l.branch).toMatch(/^[가-힣] · .+/);
    }
    expect(new Set(labels.map((l) => l.stem)).size).toBeGreaterThan(1);
  });

  it('시간 미입력(시주 없음)이면 빈 칸으로 떨어진다', () => {
    expect(pillarCellLabels(null, false)).toEqual({ stem: '-', branch: '-' });
  });
});
