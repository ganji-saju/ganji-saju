import assert from 'node:assert/strict';
import { buildTodayFortuneRunSummary } from './run-log';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 보관함에 같은 날짜 항목이 여러 개 뜰 수 있다(유니크 키에 source_session_id 가 들어가서
// 세션이 다르면 별도 행). 날짜만 쓰면 제목이 똑같아 구분이 안 되므로 생성 시각을 붙인다.

test('run 요약 문구는 KST 생성 시각을 오전/오후 12시간제로 붙인다', () => {
  // 2026-07-10T05:52:02Z = KST 14:52
  assert.equal(
    buildTodayFortuneRunSummary('2026-07-10', '2026-07-10T05:52:02.069Z'),
    '2026-07-10 오후 2시 52분에 본 오늘운세 무료 풀이'
  );
});

test('run 요약 문구는 오전 시각을 오전으로 표기한다', () => {
  // 2026-07-10T00:05:00Z = KST 09:05
  assert.equal(
    buildTodayFortuneRunSummary('2026-07-10', '2026-07-10T00:05:00.000Z'),
    '2026-07-10 오전 9시 5분에 본 오늘운세 무료 풀이'
  );
});

test('run 요약 문구는 정오·자정을 12시로 표기하고 0분은 생략한다', () => {
  // 2026-07-10T03:00:00Z = KST 12:00 (정오)
  assert.equal(
    buildTodayFortuneRunSummary('2026-07-10', '2026-07-10T03:00:00.000Z'),
    '2026-07-10 오후 12시에 본 오늘운세 무료 풀이'
  );
  // 2026-07-09T15:30:00Z = KST 2026-07-10 00:30 (자정 직후)
  assert.equal(
    buildTodayFortuneRunSummary('2026-07-10', '2026-07-09T15:30:00.000Z'),
    '2026-07-10 오전 12시 30분에 본 오늘운세 무료 풀이'
  );
});

test('generatedAt 이 유효하지 않으면 날짜만 쓰는 기존 문구로 되돌아간다', () => {
  assert.equal(
    buildTodayFortuneRunSummary('2026-07-10', 'not-a-date'),
    '2026-07-10에 본 오늘운세 무료 풀이'
  );
  assert.equal(
    buildTodayFortuneRunSummary('2026-07-10', ''),
    '2026-07-10에 본 오늘운세 무료 풀이'
  );
});
