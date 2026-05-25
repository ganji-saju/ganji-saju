// 2026-05-25 — PDF 실데이터 반영용 순수 텍스트 헬퍼.
//   목적: PDF가 (1) 실제 이름 (목업 '달빛이' 제거), (2) 결제한 LLM 깊은 풀이 본문을
//   서술 슬롯에 반영하도록. report-document.tsx 의 buildPdfModel 이 사용. 순수(테스트 고정).

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
