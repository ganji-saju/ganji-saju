// 2026-05-25 — PDF 실데이터 반영용 순수 텍스트 헬퍼.
//   목적: PDF가 (1) 실제 이름 (목업 '달빛이' 제거), (2) 결제한 LLM 깊은 풀이 본문을
//   서술 슬롯에 반영하도록. report-document.tsx 의 buildPdfModel 이 사용. 순수(테스트 고정).
import type { Element } from './types';

/** 리포트 대상 이름 — 사주 입력 이름 우선 → 프로필 표시명 → 중립 폴백(목업 '달빛이' 금지). */
export function resolvePdfSubjectName(
  input: { name?: string | null },
  metadata?: { displayName?: string | null }
): string {
  return input.name?.trim() || metadata?.displayName?.trim() || '고객';
}

/** LLM 본편 섹션 텍스트 선택 — 있으면 trim, 없거나 빈 값이면 fallback(결정론 generic). */
export function pickInterpretationText(
  interpretation: { sections?: Record<string, string> } | null | undefined,
  key: string,
  fallback: string
): string {
  const text = interpretation?.sections?.[key];
  return typeof text === 'string' && text.trim() ? text.trim() : fallback;
}

/** 첫 N문장 (짧은 슬롯에 긴 LLM 본문을 넣을 때 레이아웃 보호용). 단문/빈값 안전. */
export function firstSentences(text: string, count = 1): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/(?<=[.!?。])\s+/).filter(Boolean);
  return parts.slice(0, count).join(' ').trim() || trimmed;
}

// 2026-05-25 — 대운 곡선/12개월 키워드를 고정값이 아니라 실제 사주 기반 결정론으로.
const ELEMENT_GENERATES: Record<Element, Element> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const ELEMENT_CONTROLS: Record<Element, Element> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

/**
 * 대운 cycle 점수 — cycle 천간 오행이 일간(day master) 오행 대비 갖는 십성 관계로 결정론 산출.
 * 인성(cycle 生 일간) > 비화(동일) > 식상(일간 生 cycle) > 재(일간 克 cycle) > 관(cycle 克 일간).
 * 같은 cycle 천간이라도 일간이 다르면 다른 점수 → 사주별 상이(고정 PHASE_VALUE 대체).
 */
export function cycleFortuneScore(cycleElement: Element, dayMasterElement: Element): number {
  if (cycleElement === dayMasterElement) return 80; // 비화
  if (ELEMENT_GENERATES[cycleElement] === dayMasterElement) return 85; // 인성
  if (ELEMENT_GENERATES[dayMasterElement] === cycleElement) return 76; // 식상
  if (ELEMENT_CONTROLS[dayMasterElement] === cycleElement) return 70; // 재
  if (ELEMENT_CONTROLS[cycleElement] === dayMasterElement) return 66; // 관
  return 72;
}

/** 월 점수(실 monthScores) → 키워드. 고정 MONTH_KEYWORDS 대체. */
export function monthKeywordForScore(score: number): string {
  if (score >= 82) return '도약';
  if (score >= 70) return '성장';
  if (score >= 58) return '유지';
  if (score >= 45) return '점검';
  return '정비';
}
