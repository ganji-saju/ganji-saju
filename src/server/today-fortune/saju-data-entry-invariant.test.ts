// 2026-05-19 — /api/today-fortune entry points 가 V1↔V2 어떤 산식으로 fresh sajuData
//   를 만들든 동일 결과를 내야 한다는 invariant. fresh-saju-data.ts 의 helper 구현이
//   향후 V2 (loadSajuDataV2) 로 전환될 때 회귀 자동 차단.
//
//   E2E saju.spec.ts:157 의 "사주↔운세 점수 일치" 회귀 source 도 사전 차단:
//   사주 페이지 (V2-3 envelope V1 path) ↔ 운세 페이지 (fresh path) 의 score 일관성.
//
//   보완 ①: 시간 고정 (deterministic, KST drift 차단)
//   보완 ②: KST 자정 경계 케이스 추가 (UTC 14:59 / 15:00 / 15:01)
//   보완 ③: envelope V1 path ↔ fresh path 도 invariant (DB row 시나리오)
//   보완 ④: score 만이 아니라 사주 핵심 필드 deep equal
import assert from 'node:assert/strict';
import {
  calculateSajuDataV1,
  type SajuDataV1,
} from '@/domain/saju/engine/saju-data-v1';
import {
  loadSajuDataV2,
  type SajuDataV2,
} from '@/domain/saju/engine/saju-data-v2-upgrade';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { computeSajuIljinScore } from './build-today-fortune';
import {
  computeSajuAreaScores,
  UNIFIED_AREA_ORDER,
} from '@/lib/today-fortune/compute-saju-area-scores';
import type { TodayCalendarType, TodayTimeRule } from '@/lib/today-fortune/types';

declare const test: (name: string, fn: () => void) => void;

// 보완 ①: 시간 고정 — KST 자정 후 매일 fail 가능성 (PR #222 / PR #223 회귀 패턴) 차단.
const FIXED_NOW = new Date('2026-05-19T10:00:00Z'); // UTC 10:00 = KST 19:00

interface InputCase {
  label: string;
  draft: {
    calendarType: TodayCalendarType;
    timeRule: TodayTimeRule;
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    unknownBirthTime: boolean;
    gender: string;
    birthLocationCode: string;
    birthLocationLabel: string;
    birthLatitude: string;
    birthLongitude: string;
  };
}

const BASE_LOCATION = {
  birthLocationCode: 'custom',
  birthLocationLabel: '서울특별시',
  birthLatitude: '37.5665',
  birthLongitude: '126.9780',
};

// codex 권고 5 케이스 — 사주 산식 분기 다양성.
const CASES: InputCase[] = [
  {
    label: 'standard (1982-01-29 08:45 male)',
    draft: {
      calendarType: 'solar',
      timeRule: 'standard',
      year: '1982', month: '1', day: '29', hour: '8', minute: '45',
      unknownBirthTime: false,
      gender: 'male',
      ...BASE_LOCATION,
    },
  },
  {
    label: 'trueSolarTime (경도 보정)',
    draft: {
      calendarType: 'solar',
      timeRule: 'trueSolarTime',
      year: '1990', month: '6', day: '15', hour: '12', minute: '30',
      unknownBirthTime: false,
      gender: 'female',
      ...BASE_LOCATION,
    },
  },
  {
    label: 'earlyZi (자시 조기 적용)',
    draft: {
      calendarType: 'solar',
      timeRule: 'earlyZi',
      year: '1985', month: '11', day: '7', hour: '23', minute: '15',
      unknownBirthTime: false,
      gender: 'male',
      ...BASE_LOCATION,
    },
  },
  {
    label: 'unknownTime (시간 미상)',
    draft: {
      calendarType: 'solar',
      timeRule: 'standard',
      year: '1978', month: '3', day: '22', hour: '', minute: '',
      unknownBirthTime: true,
      gender: 'female',
      ...BASE_LOCATION,
    },
  },
  {
    label: 'lunar (음력 변환)',
    draft: {
      calendarType: 'lunar',
      timeRule: 'standard',
      year: '1995', month: '8', day: '15', hour: '7', minute: '0',
      unknownBirthTime: false,
      gender: 'male',
      ...BASE_LOCATION,
    },
  },
];

function parseInput(caseItem: InputCase) {
  const parsed = resolveUnifiedBirthInput(caseItem.draft, { requireGender: false });
  if (!parsed.ok) {
    throw new Error(`invariant 케이스 "${caseItem.label}" parse 실패: ${parsed.error}`);
  }
  return parsed.input;
}

// 사주 원국 핵심 필드 — V1↔V2 deep equal 대상.
const CORE_FIELDS: Array<keyof SajuDataV1> = [
  'pillars',
  'dayMaster',
  'fiveElements',
  'yongsin',
  'tenGods',
  'strength',
  'pattern',
];

// ============================================================
// 보완 ④: 사주 핵심 필드 deep equality — V1 ↔ V2 fresh
// ============================================================
for (const caseItem of CASES) {
  test(`V1↔V2 fresh: ${caseItem.label} — 사주 핵심 필드 deep equal`, () => {
    const input = parseInput(caseItem);
    const v1 = calculateSajuDataV1(input);
    const v2 = loadSajuDataV2(input, null);

    for (const field of CORE_FIELDS) {
      assert.deepEqual(
        v1[field],
        v2[field as keyof SajuDataV2],
        `${caseItem.label} — ${field} drift`
      );
    }
  });
}

// ============================================================
// score invariant — V1 ↔ V2 fresh, 시간 고정 (보완 ①)
// ============================================================
for (const caseItem of CASES) {
  test(`V1↔V2 fresh: ${caseItem.label} — iljinScore.totalScore 동일 (시간 고정)`, () => {
    const input = parseInput(caseItem);
    const v1 = calculateSajuDataV1(input);
    const v2 = loadSajuDataV2(input, null);

    const v1Score = computeSajuIljinScore(v1, { now: FIXED_NOW });
    const v2Score = computeSajuIljinScore(v2, { now: FIXED_NOW });

    assert.equal(
      v1Score?.totalScore,
      v2Score?.totalScore,
      `${caseItem.label} — iljinScore.totalScore drift (V1 ${v1Score?.totalScore} / V2 ${v2Score?.totalScore})`
    );
  });
}

// ============================================================
// 보완 ③: envelope V1 path ↔ fresh path invariant
//   (E2E saju.spec.ts:157 회귀 source 추정 — DB row 의 V1 envelope 처리 vs 새 계산 일관성)
// ============================================================
for (const caseItem of CASES) {
  test(`envelope V1 ↔ fresh: ${caseItem.label} — loadSajuDataV2(input, storedV1) ≡ loadSajuDataV2(input, null)`, () => {
    const input = parseInput(caseItem);
    const storedV1 = calculateSajuDataV1(input);
    const v2FromStored = loadSajuDataV2(input, storedV1);
    const v2Fresh = loadSajuDataV2(input, null);

    // 시간 고정으로 today ganzi drift 차단.
    const storedScore = computeSajuIljinScore(v2FromStored, { now: FIXED_NOW });
    const freshScore = computeSajuIljinScore(v2Fresh, { now: FIXED_NOW });

    assert.equal(
      storedScore?.totalScore,
      freshScore?.totalScore,
      `${caseItem.label} — envelope V1 ↔ fresh drift (E2E 회귀 source: 사주 페이지 ${storedScore?.totalScore} / 운세 페이지 ${freshScore?.totalScore})`
    );

    // 사주 핵심 필드도 동일 (envelope path 가 enrichSajuDataV1 등으로 달라지지 않는지 확인).
    for (const field of CORE_FIELDS) {
      assert.deepEqual(
        v2FromStored[field as keyof SajuDataV2],
        v2Fresh[field as keyof SajuDataV2],
        `${caseItem.label} — envelope V1 ↔ fresh ${field} drift`
      );
    }
  });
}

// ============================================================
// 보완 ③ 확장 — stored V1 (옛 timestamp) path ↔ fresh path invariant
//   E2E saju.spec.ts:157 회귀 source 정밀 검증: real DB 의 reading row 는 옛
//   시점에 저장된 V1 객체 + envelope. 그 V1 의 metadata.calculatedAt 이 옛
//   timestamp → enrichSajuDataV1 의 calculateLuckData(input, oldTimestamp) 가
//   옛 currentLuck 산출. PR #264 invariant ③ (fresh storedV1) 가 reproduce
//   못 한 시나리오.
// ============================================================
const OLD_TIMESTAMP = '2025-01-01T00:00:00.000Z'; // 1년 이상 전 — currentLuck stale 보장
for (const caseItem of CASES) {
  test(`stored V1 (옛 timestamp) ↔ fresh: ${caseItem.label} — iljinScore.totalScore 동일`, () => {
    const input = parseInput(caseItem);
    const storedV1Old = calculateSajuDataV1(input, { calculatedAt: OLD_TIMESTAMP });
    const v2FromOld = loadSajuDataV2(input, storedV1Old);
    const v2Fresh = loadSajuDataV2(input, null);

    const oldScore = computeSajuIljinScore(v2FromOld, { now: FIXED_NOW });
    const freshScore = computeSajuIljinScore(v2Fresh, { now: FIXED_NOW });

    assert.equal(
      oldScore?.totalScore,
      freshScore?.totalScore,
      `${caseItem.label} — stored 옛 timestamp ↔ fresh drift (iljinScore.totalScore: stored ${oldScore?.totalScore} / fresh ${freshScore?.totalScore})`
    );
  });
}

// ============================================================
// 보완 ③ 확장+ — computeSajuAreaScores 6 영역 score invariant (E2E 사주 페이지 실제 산식)
//   사주 페이지의 SajuAreaCardsSection 이 사용하는 helper. iljinScore.totalScore 만이
//   아니라 buildSajuReport + buildDailyDelta + buildConditionScore + unifyScoresWithIljinScore
//   가 모두 통과한 6 영역 통일 score. 이게 stored vs fresh 다르면 E2E 회귀 source 확정.
// ============================================================
for (const caseItem of CASES) {
  test(`stored V1 (옛 timestamp) ↔ fresh: ${caseItem.label} — computeSajuAreaScores 6 영역 동일`, () => {
    const input = parseInput(caseItem);
    const storedV1Old = calculateSajuDataV1(input, { calculatedAt: OLD_TIMESTAMP });
    const v2FromOld = loadSajuDataV2(input, storedV1Old);
    const v2Fresh = loadSajuDataV2(input, null);

    const oldAreas = computeSajuAreaScores(input, v2FromOld, { now: FIXED_NOW });
    const freshAreas = computeSajuAreaScores(input, v2Fresh, { now: FIXED_NOW });

    for (const key of UNIFIED_AREA_ORDER) {
      const oldScore = oldAreas.find((s) => s.key === key)?.score;
      const freshScore = freshAreas.find((s) => s.key === key)?.score;
      assert.equal(
        oldScore,
        freshScore,
        `${caseItem.label} — "${key}" stored 옛 timestamp ↔ fresh drift (stored ${oldScore} / fresh ${freshScore})`
      );
    }
  });
}

// ============================================================
// minute=null vs minute=N 사주 invariant — E2E saju.spec.ts:157 회귀 진짜 source.
//   옛 시드 reading 의 birth.minute = null 인데, 새 폼 제출 시 profile.birth_minute = N
//   이면 새 BirthInput.minute = N → 다른 사주 산출. 같은 birth 라도 minute 차이로
//   사주↔운세 페이지 score 불일치.
//
//   본 invariant 는 minute=null vs minute=0 두 input 의 사주 결과가 다른지 검증:
//   같으면 minute 무관 (가설 기각), 다르면 가설 확인 + fix 의미 명확.
// ============================================================
const MINUTE_VARIANTS = ['0', '15', '30', '45', '59'];
for (const caseItem of CASES) {
  if (caseItem.draft.unknownBirthTime) continue; // unknownTime 케이스는 minute 자체 의미 없음
  for (const variant of MINUTE_VARIANTS) {
    test(`minute=null vs minute=${variant} invariant: ${caseItem.label} — 같은 사주 (시진 동일)`, () => {
      const inputNullMinute = parseInput(caseItem); // minute = '' → BirthInput.minute = undefined
      const draftWithMinute = {
        ...caseItem.draft,
        minute: variant,
      };
      const parsedWithMinute = resolveUnifiedBirthInput(draftWithMinute, { requireGender: false });
      if (!parsedWithMinute.ok) throw new Error(`minute=${variant} parse 실패: ${caseItem.label}`);
      const inputWithMinute = parsedWithMinute.input;

      const v1NullMinute = calculateSajuDataV1(inputNullMinute);
      const v1WithMinute = calculateSajuDataV1(inputWithMinute);

      // 시진(2시간 단위) 이 같으면 시주(時柱) 동일이라야.
      assert.deepEqual(
        v1NullMinute.pillars.hour,
        v1WithMinute.pillars.hour,
        `${caseItem.label} — minute=null vs minute=${variant} 시주 drift (null: ${JSON.stringify(v1NullMinute.pillars.hour)} / ${variant}: ${JSON.stringify(v1WithMinute.pillars.hour)})`
      );

      // 사주 핵심 필드 deep equal.
      for (const field of CORE_FIELDS) {
        assert.deepEqual(
          v1NullMinute[field],
          v1WithMinute[field],
          `${caseItem.label} — minute=null vs minute=${variant} ${field} drift`
        );
      }
    });
  }
}

// ============================================================
// 보완 ②: KST 자정 경계 — V1↔V2 모두 같은 오늘 ganzi 사용 (PR #222 KST drift fix 회귀 차단)
// ============================================================
const KST_BOUNDARY_CASES: Array<{ label: string; now: Date }> = [
  { label: 'UTC 14:59 (KST 23:59 — 자정 직전)', now: new Date('2026-05-19T14:59:00Z') },
  { label: 'UTC 15:00 (KST 다음날 00:00 — 자정 직후)', now: new Date('2026-05-19T15:00:00Z') },
  { label: 'UTC 15:01 (KST 다음날 00:01)', now: new Date('2026-05-19T15:01:00Z') },
];

for (const { label, now } of KST_BOUNDARY_CASES) {
  test(`KST 경계 ${label} — V1↔V2 동일 totalScore`, () => {
    const input = parseInput(CASES[0]); // standard case 로 단일화
    const v1 = calculateSajuDataV1(input);
    const v2 = loadSajuDataV2(input, null);

    const v1Score = computeSajuIljinScore(v1, { now });
    const v2Score = computeSajuIljinScore(v2, { now });

    assert.equal(
      v1Score?.totalScore,
      v2Score?.totalScore,
      `${label} — KST 자정 경계 drift (V1 ${v1Score?.totalScore} / V2 ${v2Score?.totalScore})`
    );
  });
}
