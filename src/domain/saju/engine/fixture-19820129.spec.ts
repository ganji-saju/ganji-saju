/**
 * Regression fixture: 1982-01-29 08:45 男 서울 (壬子 일주, 辛酉/辛丑/壬子/甲辰).
 *
 * 이 명식은 사용자 보고된 "壬水 丑월, 金水 강세, 火 결핍" 케이스의 대표 fixture.
 * 계산값 자체는 유지하고, 사용자 화면에 노출되는 해석 라벨이 다음 기준을 만족하는지
 * 회귀 보호한다.
 */

import { describe, expect, it } from 'vitest';
import type { BirthInput } from '@/lib/saju/types';
import {
  calculateSajuDataV1,
  upgradeSajuDataV1ToV2,
} from '@/domain/saju/engine';

export const FIXTURE_19820129: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  minute: 45,
  gender: 'male',
  jasiMethod: 'unified',
  solarTimeMode: 'standard',
  unknownTime: false,
  birthLocation: {
    code: 'KR-SEL',
    label: '서울',
    latitude: 37.5665,
    longitude: 126.978,
    timezone: 'Asia/Seoul',
  },
};

const CALCULATED_AT = '2026-05-14T12:00:00+09:00';

describe('1982-01-29 fixture · 계산값 (engine v1 무수정)', () => {
  it('년주 辛酉 / 월주 辛丑 / 일주 壬子 / 시주 甲辰', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, {
      calculatedAt: CALCULATED_AT,
      timezone: 'Asia/Seoul',
      location: '서울',
    });

    expect(v1.pillars.year.ganzi).toBe('辛酉');
    expect(v1.pillars.month.ganzi).toBe('辛丑');
    expect(v1.pillars.day.ganzi).toBe('壬子');
    expect(v1.pillars.hour?.ganzi).toBe('甲辰');
  });

  it('일간 壬(수)', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    expect(v1.dayMaster.stem).toBe('壬');
    expect(v1.dayMaster.element).toBe('수');
  });

  it('strength: 중화 66 (신강 경계 67 근접)', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    expect(v1.strength?.level).toBe('중화');
    expect(v1.strength?.score).toBe(66);
  });

  it('pattern: 정관격 (정관 십신)', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    expect(v1.pattern?.name).toBe('정관격');
    expect(v1.pattern?.tenGod).toBe('정관');
  });

  it('yongsin: 火(primary) / 木·水(secondary) / 金(kiyshin), method=희기신보정', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    expect(v1.yongsin?.primary.value).toBe('화');
    expect(v1.yongsin?.method).toBe('희기신보정');
    expect(v1.yongsin?.secondary?.map((s) => s.value)).toEqual(['목', '수']);
    expect(v1.yongsin?.kiyshin?.map((s) => s.value)).toEqual(['금']);
  });

  it('fiveElements: 금이 dominant, 화가 weakest, 점수 분포 spec 일치', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    expect(v1.fiveElements.dominant).toBe('금');
    expect(v1.fiveElements.weakest).toBe('화');
    expect(v1.fiveElements.byElement.목.score).toBeCloseTo(1.6, 1);
    expect(v1.fiveElements.byElement.화.score).toBe(0);
    expect(v1.fiveElements.byElement.토.score).toBeCloseTo(3.4, 1);
    expect(v1.fiveElements.byElement.금.score).toBeCloseTo(4.3, 1);
    expect(v1.fiveElements.byElement.수.score).toBeCloseTo(3.5, 1);
  });
});

describe('1982-01-29 fixture · 표시 라벨 (v2 interpretation)', () => {
  it('신강/신약 표시값이 "신강에 가까운 중화"', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: CALCULATED_AT });

    // executiveSummary 에 "신강에 가까운 중화" 또는 v2 친근 표현 포함
    const summary = v2.interpretation.executiveSummary;
    expect(summary).toMatch(/신강에 가까운 중화|에너지가 강한 편에 가까운/);
  });

  it('격국 표기에 "정관격 후보" + 월지 丑의 己土 근거 + 관인 구조 동반', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: CALCULATED_AT });

    const patternBlock = v2.interpretation.blocks.find((block) => block.id === 'pattern');
    expect(patternBlock).toBeDefined();
    if (!patternBlock) return;

    const blockText = JSON.stringify(patternBlock);
    expect(blockText).toMatch(/정관격 후보/);
    expect(blockText).toMatch(/월지 丑의 己土 기준/);
    expect(blockText).toMatch(/관인 구조 동반/);
  });

  it('용신은 火, 희신은 木 — 水/金 은 희신으로 강하게 노출되지 않는다', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: CALCULATED_AT });

    const blockJson = JSON.stringify(v2.interpretation.blocks);

    // 용신 블록의 본문에 火 또는 "화 기운" 이 등장.
    expect(blockJson).toMatch(/火|화 기운/);

    // 希神(보조 도움 기운) 후보에 木 또는 "목 기운" 등장 → 화 결핍 보완.
    expect(blockJson).toMatch(/木|목 기운/);

    // 水(수 기운) 가 도움/희신처럼 강하게 등장하지 않아야 함.
    // "조절할" / "주의" 컨텍스트에서만 등장하도록 제한.
    const yongsinBlock = v2.interpretation.blocks.find(
      (block) => block.id === 'yongsin'
    );
    if (yongsinBlock) {
      const yongsinText = JSON.stringify(yongsinBlock);
      // 도움 기운 1순위가 "물 기운" 으로 잡히면 fail
      expect(yongsinText).not.toMatch(/도움이 되는 1순위 기운[^.]*수 기운|1순위[^.]*수\(/);
    }
  });

  it('주의 오행에 金, 水 가 포함되어 노출된다', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: CALCULATED_AT });

    const blockJson = JSON.stringify(v2.interpretation.blocks);
    expect(blockJson).toMatch(/조절할.*금|주의.*金|조절할.*수|주의.*水/);
  });

  it('2026-05-14 기준 세운 丙午 / 월운 癸巳', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });

    expect(v1.currentLuck?.saewoon?.ganzi).toBe('丙午');
    expect(v1.currentLuck?.wolwoon?.ganzi).toBe('癸巳');
  });
});

describe('1982-01-29 fixture · 검증 메타', () => {
  it('모든 interpretation claim 에 evidence 가 존재', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: CALCULATED_AT });

    for (const block of v2.interpretation.blocks) {
      for (const claim of block.claims) {
        expect(claim.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('금지 표현(반드시/100%/무조건/죽음/암 확정 등)이 본문에 없다', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, { calculatedAt: CALCULATED_AT });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: CALCULATED_AT });

    const fullText = [
      v2.interpretation.executiveSummary,
      ...v2.interpretation.blocks.flatMap((block) => [
        block.summary,
        ...block.claims.map((claim) => claim.text),
        ...(block.actions ?? []),
      ]),
      ...v2.interpretation.disclaimers,
    ].join(' ');

    expect(fullText).not.toMatch(/반드시|100%|무조건|결정적|확실히 일어|죽음 확정|수명/);
  });

  it('currentLuck TTL 32일 초과 시 verification 이 stale 경고를 띄운다', () => {
    const v1 = calculateSajuDataV1(FIXTURE_19820129, {
      calculatedAt: '2024-01-01T00:00:00+09:00',
    });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: CALCULATED_AT });

    const hasStale = v2.verification.issues.some(
      (issue) => issue.code === 'CURRENT_LUCK_STALE'
    );
    expect(hasStale).toBe(true);
  });
});
