import assert from 'node:assert/strict';
import { calculateSajuDataV1, normalizeToSajuDataV1 } from './saju-data-v1';
import { getBirthLocationPreset } from '@/lib/saju/birth-location';

declare const test: (name: string, fn: () => void) => void;

test('normalizeToSajuDataV1 enriches older complete data missing stem ten gods', () => {
  const input = {
    year: 1990,
    month: 1,
    day: 1,
    hour: 12,
    gender: 'male' as const,
  };
  const oldData = JSON.parse(JSON.stringify(calculateSajuDataV1(input)));

  delete oldData.pillars.year.stemTenGod;
  delete oldData.pillars.month.stemTenGod;
  delete oldData.pillars.day.stemTenGod;
  delete oldData.pillars.hour.stemTenGod;

  const normalized = normalizeToSajuDataV1(input, oldData);

  assert.equal(normalized.pillars.day.stemTenGod, null);
  assert.ok(normalized.pillars.year.stemTenGod);
  assert.ok(normalized.pillars.month.stemTenGod);
  assert.ok(normalized.pillars.hour?.stemTenGod);
});

test('calculateSajuDataV1 records longitude-adjusted birth time metadata', () => {
  const seoul = getBirthLocationPreset('seoul');
  assert.ok(seoul);

  const data = calculateSajuDataV1({
    year: 1982,
    month: 1,
    day: 29,
    hour: 0,
    minute: 10,
    gender: 'male',
    birthLocation: seoul,
    solarTimeMode: 'longitude',
  });

  assert.equal(data.input.location, '서울');
  assert.equal(data.input.birthTimeCorrection?.offsetMinutes, -32);
  assert.equal(data.input.birthTimeCorrection?.adjustedBirth.day, 28);
  assert.equal(data.extensions?.orrery?.input.longitude, 126.978);
});

test('calculateSajuDataV1 exposes yongsin candidates and explanation layers', () => {
  const data = calculateSajuDataV1({
    year: 1982,
    month: 1,
    day: 29,
    hour: 8,
    gender: 'male',
  });

  assert.ok(data.yongsin?.primary);
  assert.ok((data.yongsin?.candidates?.length ?? 0) >= 2);
  assert.ok(data.yongsin?.confidence);
  assert.match(data.yongsin?.plainSummary ?? '', /용신 메모:/);
  assert.match(data.yongsin?.technicalSummary ?? '', /전문적으로는/);
  assert.ok((data.yongsin?.practicalActions?.length ?? 0) >= 2);
  assert.ok(data.yongsin?.terms?.some((term) => term.term === '용신' && term.hanja === '用神'));
});

test('calculatePattern exposes multi-rank candidates with tougchul / supporting fields (P1)', () => {
  // 2026-05-15 P1: 격국 알고리즘 강화 회귀 가드. 본기/중기/여기 후보 multi-rank +
  // 천간 투출 + 협력 지지 검사가 노출되어야 함.
  const data = calculateSajuDataV1({
    year: 1982,
    month: 1,
    day: 29,
    hour: 8,
    gender: 'male',
  });

  assert.ok(data.pattern, 'pattern 이 산출되어야 합니다');
  assert.ok(data.pattern!.name.length > 0, 'pattern.name 비어있으면 안 됨');
  assert.ok(
    ['확정', '보통', '낮음'].includes(data.pattern!.confidence),
    `confidence 가 enum 값이어야 합니다: ${data.pattern!.confidence}`
  );
  assert.equal(typeof data.pattern!.tougchul, 'boolean');
  assert.ok(Array.isArray(data.pattern!.supportingPillars));
  assert.ok(Array.isArray(data.pattern!.candidates), 'candidates 가 배열이어야 함');
  // hidden stems 가 있는 일반 명식이면 후보가 최소 1개는 있어야 함.
  assert.ok(data.pattern!.candidates.length >= 1, 'candidates 최소 1건');
  // candidates 가 score desc 정렬되어 있는지.
  for (let i = 1; i < data.pattern!.candidates.length; i += 1) {
    assert.ok(
      data.pattern!.candidates[i - 1].score >= data.pattern!.candidates[i].score,
      'candidates score desc 정렬'
    );
  }
  // top candidate 의 source / tenGod / name 이 채워져 있어야.
  const top = data.pattern!.candidates[0];
  assert.ok(['본기', '중기', '여기'].includes(top.source));
  assert.ok(top.tenGod);
  assert.ok(top.name.length > 0);
});
