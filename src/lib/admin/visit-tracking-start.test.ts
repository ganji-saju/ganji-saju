import assert from 'node:assert/strict';
import { VISIT_TRACKING_START_KEY } from './analytics-rollup';

declare const test: (name: string, fn: () => void) => void;

// 2026-07-20 — 관리자 차트에서 "실측 시작 이전" 구간을 감추는 기준일 가드.
//
// 배경: 커밋 5a06e9c3 이전에는 호스트 판정 버그로 실사용자 방문이 **전량 폐기**됐다.
//   그래서 그 이전 visitors=0 은 "사람이 0명"이 아니라 "세지 못함"이고, 복원할 원본도 없다.
//   0 을 길게 그리면 "예전엔 잘 됐는데 지금 죽었다"는 **정반대 착시**를 만든다.
//   (실제로 그 구간에 남아 있던 2,540행은 크롤러였다 — 2페이지 이상 본 사람 0명, 인당 PV 1.000)
const CLAMP = (dates: string[]) => dates.filter((d) => d >= VISIT_TRACKING_START_KEY);

test('실측 시작일: 방문 집계 수정 배포일(2026-07-19)', () => {
  assert.equal(VISIT_TRACKING_START_KEY, '2026-07-19');
});

test('실측 시작일 이전 날짜는 표시에서 제외된다', () => {
  const axis = ['2026-07-04', '2026-07-10', '2026-07-18', '2026-07-19', '2026-07-20'];
  assert.deepEqual(CLAMP(axis), ['2026-07-19', '2026-07-20']);
});

test('경계일(시작일 당일)은 포함한다', () => {
  assert.deepEqual(CLAMP(['2026-07-18', '2026-07-19']), ['2026-07-19']);
});
