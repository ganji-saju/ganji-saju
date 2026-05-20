import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_PATTERN_TEMPLATES } from './build-lifetime-report';
import {
  FORBIDDEN_ABSOLUTE_PHRASES,
  FORBIDDEN_OLD_ELEMENT_LABELS,
} from '@/lib/saju/chapter-validator';

// 2026-05-20 P0 ⑥ 회귀 가드 — 진단서 §3-1 ⑥ "챕터 제목 fallback 자극 표현" 차단.
//
// chapter-validator 의 FORBIDDEN_ABSOLUTE_PHRASES 는 LLM 챕터 본문(generate-chapter)
// 검증에만 적용됨. 9 대운 카드 제목 (`buildChapterTitleText`) 은 LLM 호출 전
// deterministic fallback 이라 동일 가드가 누락되어 있었음.
//
// 이 테스트는 fallback templates 가 chapter-validator 와 동일한 톤 룰을
// 만족하는지를 빌드타임에 강제로 검증함.

test('CHAPTER_PATTERN_TEMPLATES: 자극·공포·강요 표현 0건', () => {
  for (const [pattern, candidates] of Object.entries(CHAPTER_PATTERN_TEMPLATES)) {
    for (const candidate of candidates) {
      for (const banned of FORBIDDEN_ABSOLUTE_PHRASES) {
        assert.ok(
          !candidate.includes(banned),
          `[${pattern}] "${candidate}" 에 금지 표현 "${banned}" 잔존 — chapter-validator 와 톤 정책 불일치`
        );
      }
    }
  }
});

test('CHAPTER_PATTERN_TEMPLATES: 옛 X과/와 Y 오행 라벨 0건', () => {
  for (const [pattern, candidates] of Object.entries(CHAPTER_PATTERN_TEMPLATES)) {
    for (const candidate of candidates) {
      for (const label of FORBIDDEN_OLD_ELEMENT_LABELS) {
        assert.ok(
          !candidate.includes(label),
          `[${pattern}] "${candidate}" 에 옛 오행 라벨 "${label}" 잔존 — 새 자연 비유 라벨로 치환 필요`
        );
      }
    }
  }
});

test('CHAPTER_PATTERN_TEMPLATES: 한자 0건 (사주팔자 카드 외 본문)', () => {
  const HANJA_PATTERN = /[一-鿿]/u;
  for (const [pattern, candidates] of Object.entries(CHAPTER_PATTERN_TEMPLATES)) {
    for (const candidate of candidates) {
      const match = candidate.match(HANJA_PATTERN);
      assert.ok(
        !match,
        `[${pattern}] "${candidate}" 에 한자 "${match?.[0]}" 노출 — 일상어로 풀이 필요`
      );
    }
  }
});

test('CHAPTER_PATTERN_TEMPLATES: 각 카테고리 후보 3개 이상 (랜덤 다양화 보장)', () => {
  for (const [pattern, candidates] of Object.entries(CHAPTER_PATTERN_TEMPLATES)) {
    assert.ok(
      candidates.length >= 3,
      `[${pattern}] 후보가 ${candidates.length}개 — 9 대운 카드 중복 방지를 위해 최소 3개 필요`
    );
  }
});
