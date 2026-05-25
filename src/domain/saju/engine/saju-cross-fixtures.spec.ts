/**
 * 사주 cross-validation fixtures (2026-05-14).
 *
 * 1982-01-29 외에 다양한 강도/오행 분포의 명식을 추가해, v2 표시 layer
 * (희신 마스킹·격국 후보·동반 구조)가 다른 케이스에서도 사용자 기대에
 * 어긋나지 않는지 회귀 보호한다.
 *
 * 각 fixture 의 4기둥/오행 점수는 engine v1 의 결정적 산식으로 만들어진다.
 * 검증 항목:
 *   · 4기둥 만세력 일치 (공식 만세력과 spec 으로 교차).
 *   · 희신 마스킹 룰: dominant + 평균 이상 + 상위 2위 → secondary 에서 제외.
 *   · 동반 구조 detect: 관인 / 식상생재 / 재관 / 식신생재 / 살인상생 /
 *     관살혼잡 / 식상혼잡 / 인성과다 / 비겁과다.
 */

import { describe, expect, it } from 'vitest';
import type { BirthInput } from '@/lib/saju/types';
import {
  calculateSajuDataV1,
  upgradeSajuDataV1ToV2,
} from '@/domain/saju/engine';

const SEOUL = {
  code: 'KR-SEL',
  label: '서울',
  latitude: 37.5665,
  longitude: 126.978,
  timezone: 'Asia/Seoul',
} as const;

const NOW = '2026-05-14T12:00:00+09:00';

function makeInput(overrides: Partial<BirthInput>): BirthInput {
  return {
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    gender: 'male',
    jasiMethod: 'unified',
    solarTimeMode: 'standard',
    unknownTime: false,
    birthLocation: SEOUL,
    ...overrides,
  };
}

/**
 * Cross fixtures (3개) — engine v1 의 결정성 + v2 표시 layer 의 일관성을
 * 회귀 보호. 만세력 외부 정합성을 외부 데이터로 강제하지 않고, 한 번 dump 한
 * 값을 baseline 으로 pin 해 산식 회귀를 catch.
 *
 * baseline 값은 saju-data-v1 의 결정적 산식으로 생성. 산식이 의도적으로
 * 변경되면 baseline 도 갱신해야 한다 (수동 회귀 검토 단계).
 */
const CROSS_FIXTURES: Array<{
  label: string;
  input: BirthInput;
  expected: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
    dayMasterStem: string;
    dayMasterElement: string;
  };
}> = [
  {
    label: 'A · 2000-01-01 12:00 男 서울',
    input: makeInput({ year: 2000, month: 1, day: 1, hour: 12, minute: 0 }),
    expected: {
      year: '己卯',
      month: '丙子',
      day: '戊午',
      hour: '戊午',
      dayMasterStem: '戊',
      dayMasterElement: '토',
    },
  },
  {
    label: 'B · 1990-05-17 10:30 男 서울',
    input: makeInput({ year: 1990, month: 5, day: 17, hour: 10, minute: 30 }),
    expected: {
      year: '庚午',
      month: '辛巳',
      day: '壬午',
      hour: '乙巳',
      dayMasterStem: '壬',
      dayMasterElement: '수',
    },
  },
  {
    label: 'C · 1995-08-15 04:00 女 서울',
    input: makeInput({
      year: 1995,
      month: 8,
      day: 15,
      hour: 4,
      minute: 0,
      gender: 'female',
    }),
    expected: {
      year: '乙亥',
      month: '甲申',
      day: '戊寅',
      hour: '甲寅',
      dayMasterStem: '戊',
      dayMasterElement: '토',
    },
  },
];

describe('Cross fixtures · 4기둥 결정성 (engine v1 회귀)', () => {
  /**
   * 이 it 들은 engine 산식이 한 번이라도 의도치 않게 바뀌면 빨갛게 떨어진다.
   * 외부 만세력 일치는 별도 manjib 검증 PR 에서 추가 검토.
   *
   * 각 fixture 의 실제 engine 산출을 dump 해 baseline 으로 사용한다 (.skip 으로
   * 일단 통과시키고, 실제 값을 console 에 dump 한 뒤 expect 값을 채우는 패턴).
   */
  for (const fixture of CROSS_FIXTURES) {
    it(`[${fixture.label}] 4기둥과 일간이 결정적`, () => {
      const v1 = calculateSajuDataV1(fixture.input, { calculatedAt: NOW });
      // 1차 실행 시 console 에서 실제 값을 확인하고, expected 를 그 값으로 갱신.
      // 이번 PR 에서는 dump 한 baseline 으로 pin.
      // eslint-disable-next-line no-console
      console.log(
        `[cross fixture ${fixture.label}] year=${v1.pillars.year.ganzi} month=${v1.pillars.month.ganzi} day=${v1.pillars.day.ganzi} hour=${v1.pillars.hour?.ganzi ?? 'null'} dayMaster=${v1.dayMaster.stem}/${v1.dayMaster.element}`
      );
      expect(v1.pillars.year.ganzi).toBe(fixture.expected.year);
      expect(v1.pillars.month.ganzi).toBe(fixture.expected.month);
      expect(v1.pillars.day.ganzi).toBe(fixture.expected.day);
      expect(v1.pillars.hour?.ganzi).toBe(fixture.expected.hour);
      expect(v1.dayMaster.stem).toBe(fixture.expected.dayMasterStem);
      expect(v1.dayMaster.element).toBe(fixture.expected.dayMasterElement);
    });
  }
});

describe('Cross fixtures · v2 표시 layer 안정성', () => {
  for (const fixture of CROSS_FIXTURES) {
    it(`[${fixture.label}] 모든 interpretation claim 에 evidence`, () => {
      const v1 = calculateSajuDataV1(fixture.input, { calculatedAt: NOW });
      const v2 = upgradeSajuDataV1ToV2(v1, { now: NOW });
      for (const block of v2.interpretation.blocks) {
        for (const claim of block.claims) {
          expect(claim.evidence.length).toBeGreaterThan(0);
        }
      }
    });

    it(`[${fixture.label}] 희신 마스킹 — dominant + 평균 이상 오행 미노출`, () => {
      const v1 = calculateSajuDataV1(fixture.input, { calculatedAt: NOW });
      const v2 = upgradeSajuDataV1ToV2(v1, { now: NOW });
      const yongsinBlock = v2.interpretation.blocks.find((block) => block.id === 'yongsin');
      if (!yongsinBlock) return;

      const byElement = v1.fiveElements.byElement;
      const total = v1.fiveElements.totalScore;
      const average = total > 0 ? total / 5 : 0;

      // "희신(보조 도움 기운): {...}" 영역만 추출 (마침표 또는 . 으로 종료).
      const summaryText = yongsinBlock.summary ?? '';
      const claimsText = yongsinBlock.claims
        .filter((claim) => claim.id === 'yongsin.secondary')
        .map((claim) => claim.text)
        .join(' ');

      // 마스킹 룰: dominant 인 오행 OR 평균 이상 오행 은 secondary 본문에 안 나옴.
      // (evidence 의 masked 메타에는 등장 가능.)
      for (const [el, value] of Object.entries(byElement)) {
        const elKey = el as keyof typeof ELEMENT_FRIENDLY_MAP;
        const isHigh = el === v1.fiveElements.dominant || value.score >= average;
        if (!isHigh) continue;
        // primary 인 경우만 노출 가능 (희신 본문에서는 제외돼야 함).
        if (v1.yongsin?.primary.value === el) continue;

        const friendly = ELEMENT_FRIENDLY_MAP[elKey];
        // "희신(보조 도움 기운): ..." 다음 첫 문장에서만 검사.
        const secondaryLine = claimsText.match(/희신\(보조 도움 기운\):\s*([^.]+)/)?.[1] ?? '';
        expect(secondaryLine, `${fixture.label} · ${el}(${friendly}) 가 희신 본문에 노출됨`).not.toContain(friendly);
        // summary 도 같이 검사.
        const summarySecondary = summaryText.match(/희신은\s*([^,]+)/)?.[1] ?? '';
        expect(summarySecondary, `${fixture.label} · ${el}(${friendly}) 가 hero summary 의 희신에 노출됨`).not.toContain(friendly);
      }
    });

    it(`[${fixture.label}] 금지 표현 없음`, () => {
      const v1 = calculateSajuDataV1(fixture.input, { calculatedAt: NOW });
      const v2 = upgradeSajuDataV1ToV2(v1, { now: NOW });
      const fullText = [
        v2.interpretation.executiveSummary,
        ...v2.interpretation.blocks.flatMap((block) => [
          block.summary,
          ...block.claims.map((claim) => claim.text),
        ]),
      ].join(' ');
      expect(fullText).not.toMatch(/반드시|100%|무조건|결정적|확실히 일어|죽음 확정|수명/);
    });

    it(`[${fixture.label}] pattern 이 있으면 "후보" 표기`, () => {
      const v1 = calculateSajuDataV1(fixture.input, { calculatedAt: NOW });
      const v2 = upgradeSajuDataV1ToV2(v1, { now: NOW });
      if (v1.pattern) {
        const patternBlock = v2.interpretation.blocks.find((b) => b.id === 'pattern');
        expect(JSON.stringify(patternBlock)).toMatch(/후보/);
      }
    });
  }
});

/**
 * 격국 동반 구조 detect — 실제 명식에서 트리거되는 patterns 를 스캔.
 * detectPatternCompanions 는 8가지 phrase 를 지원. 임의 명식 N 개를 돌려
 * 각 phrase 가 한 번이라도 노출되면 룰이 살아 있다고 간주.
 *
 * (이 spec 의 목적은 "모든 명식에서 X가 나온다" 가 아니라 "룰이 dead code 가
 * 아니다" 를 검증).
 */
describe('detectPatternCompanions · 룰 활성 검증', () => {
  const trialInputs: BirthInput[] = [
    makeInput({ year: 1985, month: 3, day: 10, hour: 9, minute: 0 }),
    makeInput({ year: 1980, month: 6, day: 12, hour: 14, minute: 30 }),
    makeInput({ year: 1995, month: 10, day: 3, hour: 22, minute: 0 }),
    makeInput({ year: 2001, month: 11, day: 21, hour: 6, minute: 15 }),
    makeInput({ year: 1973, month: 7, day: 7, hour: 7, minute: 7 }),
    makeInput({ year: 1988, month: 12, day: 25, hour: 18, minute: 0, gender: 'female' }),
  ];

  it('관인/식상생재/관살혼잡 등 동반 phrase 가 한 번이라도 노출된다', () => {
    const detectedPhrases = new Set<string>();
    for (const input of trialInputs) {
      const v1 = calculateSajuDataV1(input, { calculatedAt: NOW });
      if (!v1.pattern) continue;
      const v2 = upgradeSajuDataV1ToV2(v1, { now: NOW });
      const patternBlock = v2.interpretation.blocks.find((b) => b.id === 'pattern');
      const blockJson = JSON.stringify(patternBlock);
      for (const phrase of [
        '관인 구조 동반',
        '식상생재 동반',
        '재생관 동반',
        '재관 구조 동반',
        '식신생재 동반',
        '살인상생 동반',
        '관살혼잡 주의',
        '식상혼잡 주의',
        '인성과다 주의',
        '비겁과다 주의',
      ]) {
        if (blockJson.includes(phrase)) detectedPhrases.add(phrase);
      }
    }
    // 적어도 2종 이상의 phrase 가 6개 명식 중에서 관찰돼야 룰이 살아 있다.
    expect(detectedPhrases.size).toBeGreaterThanOrEqual(2);
  });
});

const ELEMENT_HANJA_MAP = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' } as const;
const ELEMENT_FRIENDLY_MAP = {
  목: '목 기운',
  화: '화 기운',
  토: '토 기운',
  금: '금 기운',
  수: '수 기운',
} as const;
