// 2026-05-16 PR #167 — 행운 패키지 사주 + 일진 hybrid 검증.
import assert from 'node:assert/strict';
import { buildTodayLuckyPackage } from './lucky-package';

declare const test: (name: string, fn: () => void) => void;

const baseOpts = {
  luckyElement: '화' as const,
  unluckyElement: '금' as const,
  todayBranch: '午',
  todayStemElement: null,
  dateKey: '2026-05-16',
  dayGanzi: '甲寅',
};

test('buildTodayLuckyPackage - 일진 없으면 lucky element 만 사용', () => {
  const p = buildTodayLuckyPackage(baseOpts);
  // 화 = 빨강색·진분홍색 (2개)
  assert.deepEqual(p.colors, ['빨강색', '진분홍색']);
  // 화 = 2·7
  assert.deepEqual(p.numbers, [2, 7]);
});

test('buildTodayLuckyPackage - 일진 element 가 사주 lucky 와 같으면 lucky 만', () => {
  // 사주 lucky=화, 오늘 일진 천간=丙(火) → 같음 → 화 하나만
  const p = buildTodayLuckyPackage({ ...baseOpts, todayStemElement: '화' });
  assert.deepEqual(p.colors, ['빨강색', '진분홍색']);
  assert.equal(p.colors.length, 2);
});

test('buildTodayLuckyPackage - 일진 element 가 다르면 두 element 결합 (예: 화 + 수)', () => {
  // 사주 lucky=화, 오늘 일진=壬(수) → 다름 → 화+수 둘 다
  const p = buildTodayLuckyPackage({ ...baseOpts, todayStemElement: '수' });
  // 화(빨강·진분홍) + 수(검정·남색) = 4개
  assert.equal(p.colors.length, 4);
  assert.ok(p.colors.includes('빨강색'));
  assert.ok(p.colors.includes('검정색'));
  // numbers: 화(2,7) + 수(1,6) = 4개
  assert.deepEqual(p.numbers.sort(), [1, 2, 6, 7]);
});

test('buildTodayLuckyPackage - 일진 element 가 unlucky (기신) 이면 일진 무시', () => {
  // 사주 lucky=화, unlucky=금, 오늘 일진=庚(金) = 기신 → 일진 무시, 화만
  const p = buildTodayLuckyPackage({ ...baseOpts, todayStemElement: '금' });
  // 화만 (금 제외)
  assert.deepEqual(p.colors, ['빨강색', '진분홍색']);
  // 흰색 (금색) 안 들어가야
  assert.ok(!p.colors.includes('흰색'));
});

test('buildTodayLuckyPackage - 어제와 오늘 일진 다르면 colors/numbers 변동', () => {
  const p1 = buildTodayLuckyPackage({ ...baseOpts, todayStemElement: '목' });
  const p2 = buildTodayLuckyPackage({ ...baseOpts, todayStemElement: '수' });
  // 두 결과의 colors 합집합 비교 — 화+목 vs 화+수
  assert.notDeepEqual(p1.colors.sort(), p2.colors.sort());
  assert.notDeepEqual(p1.aromas.sort(), p2.aromas.sort());
});

test('buildTodayLuckyPackage - 로또 번호는 dateKey 기반 매일 변동', () => {
  const p1 = buildTodayLuckyPackage({ ...baseOpts, dateKey: '2026-05-16' });
  const p2 = buildTodayLuckyPackage({ ...baseOpts, dateKey: '2026-05-17' });
  const nums1 = p1.lottoNumbers.map((n) => n.number).join(',');
  const nums2 = p2.lottoNumbers.map((n) => n.number).join(',');
  assert.notEqual(nums1, nums2);
});

test('buildTodayLuckyPackage - avoid 항목은 unluckyElement 기반', () => {
  const p = buildTodayLuckyPackage(baseOpts);
  // 금 = 흰색·은색
  assert.deepEqual(p.avoidColors, ['흰색', '은색']);
});

test('buildTodayLuckyPackage - 궁합 띠는 오늘 일진 지지 기반', () => {
  // 午 → 寅午戌 三合 → 寅(범), 戌(개)
  const p = buildTodayLuckyPackage({ ...baseOpts, todayBranch: '午' });
  assert.ok(p.zodiacFriends.length === 2);
  const labels = p.zodiacFriends.join(',');
  assert.ok(labels.includes('범') || labels.includes('개'));
});
