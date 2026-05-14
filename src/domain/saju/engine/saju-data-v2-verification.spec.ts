/**
 * Vitest regression spec for saju-data/v2.
 *
 * 실행: `npm run test:spec`
 *
 * 검증 항목:
 *  - v1 → v2 업그레이드 시 schemaVersion / interpretation / verification 필드가 채워지는가
 *  - pillar.ganzi 가 stem+branch 와 불일치하면 검증이 잡아내는가
 *  - calculatedAt 이 32일 이상 지난 currentLuck 를 stale 로 표시하는가
 *  - v2 interpretation 의 모든 claim 에 evidence 가 붙어있는가
 */

import { describe, expect, it } from 'vitest';
import type { BirthInput } from '@/lib/saju/types';
import {
  calculateSajuDataV1,
  type SajuDataV1,
} from './saju-data-v1';
import {
  SAJU_DATA_V2,
  loadSajuDataV2,
  upgradeSajuDataV1ToV2,
  verifySajuData,
} from './saju-data-v2-upgrade';

const sampleInput: BirthInput = {
  year: 1990,
  month: 5,
  day: 17,
  hour: 10,
  minute: 30,
  gender: 'male',
  unknownTime: false,
  solarTimeMode: 'standard',
  // 'fixed' 는 JasiMethod 가 아니므로 'unified' 로 교정 (split | unified).
  jasiMethod: 'unified',
  birthLocation: {
    code: 'KR-SEL',
    label: '서울',
    timezone: 'Asia/Seoul',
    latitude: 37.5665,
    longitude: 126.978,
  },
};

describe('saju-data/v2 upgrade and verification', () => {
  it('upgrades v1 to v2 with interpretation and verification metadata', () => {
    const v1 = calculateSajuDataV1(sampleInput, {
      calculatedAt: '2026-05-13T12:00:00+09:00',
      timezone: 'Asia/Seoul',
      location: '서울',
    });

    const v2 = upgradeSajuDataV1ToV2(v1, {
      now: '2026-05-13T12:00:00+09:00',
      mode: 'coaching',
      tone: 'balanced',
    });

    expect(v2.schemaVersion).toBe(SAJU_DATA_V2);
    expect(v2.interpretation.blocks.length).toBeGreaterThan(0);
    expect(v2.interpretation.executiveSummary.length).toBeGreaterThan(0);
    expect(v2.verification.score).toBeGreaterThanOrEqual(70);
    expect(v2.metadata.qualityScore).toBe(v2.verification.score);
    expect(v2.legacy.schemaVersion).toBe('saju-data/v1');
    // v1 의 핵심 필드는 v2 에서 그대로 노출되어야 한다.
    expect(v2.input).toBeDefined();
    expect(v2.pillars).toBeDefined();
    expect(v2.dayMaster).toBeDefined();
    expect(v2.fiveElements).toBeDefined();
  });

  it('detects corrupted pillar ganzi', () => {
    const v1 = calculateSajuDataV1(sampleInput, {
      calculatedAt: '2026-05-13T12:00:00+09:00',
    });

    const corrupted: SajuDataV1 = {
      ...v1,
      pillars: {
        ...v1.pillars,
        day: {
          ...v1.pillars.day,
          ganzi: '甲子', // 실제 stem+branch 와 불일치하도록 강제.
        },
      },
    };

    const report = verifySajuData(corrupted, '2026-05-13T12:00:00+09:00');
    const hasGanziError = report.issues.some(
      (issue) => issue.code === 'PILLAR_GANZI_MISMATCH'
    );
    expect(hasGanziError).toBe(true);
    expect(report.status).toBe('fail');
  });

  it('flags stale currentLuck when calculatedAt is older than monthly TTL', () => {
    const v1 = calculateSajuDataV1(sampleInput, {
      calculatedAt: '2025-01-01T00:00:00+09:00',
    });

    const report = verifySajuData(v1, '2026-05-13T12:00:00+09:00');
    expect(
      report.issues.some((issue) => issue.code === 'CURRENT_LUCK_STALE')
    ).toBe(true);
  });

  it('requires every v2 interpretation claim to have evidence', () => {
    const v1 = calculateSajuDataV1(sampleInput, {
      calculatedAt: '2026-05-13T12:00:00+09:00',
    });
    const v2 = upgradeSajuDataV1ToV2(v1, { now: '2026-05-13T12:00:00+09:00' });

    for (const block of v2.interpretation.blocks) {
      for (const claim of block.claims) {
        expect(claim.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('loadSajuDataV2 from raw input bootstraps v2 in one call', () => {
    const v2 = loadSajuDataV2(sampleInput, null, {
      now: '2026-05-13T12:00:00+09:00',
      mode: 'summary',
      tone: 'short',
    });

    expect(v2.schemaVersion).toBe(SAJU_DATA_V2);
    expect(v2.interpretation.profile.mode).toBe('summary');
    expect(v2.interpretation.profile.tone).toBe('short');
  });

  it('loadSajuDataV2 recomputes when stored data is stale', () => {
    const stored = calculateSajuDataV1(sampleInput, {
      calculatedAt: '2025-01-01T00:00:00+09:00',
    });

    const v2 = loadSajuDataV2(sampleInput, stored, {
      now: '2026-05-13T12:00:00+09:00',
    });

    expect(v2.schemaVersion).toBe(SAJU_DATA_V2);
    // stale 한 입력으로 들어왔어도 결과는 새로 마이그레이션된 v2 여야 한다.
    expect(v2.metadata.migratedAt).toBe('2026-05-13T12:00:00+09:00');
  });
});
