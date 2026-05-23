// 2026-05-23 — 궁합 깊은 풀이 출력 파싱 + naming-policy 검증(②-b).
//   ohaeng-guidance-validator 와 동일하게 total-review-validator 의 hardTextReasons/countGyeol 재사용.
import { hardTextReasons, countGyeol } from '@/lib/saju/total-review-validator';
import {
  COMPATIBILITY_INTERPRETATION_MIN_SECTIONS,
  COMPATIBILITY_INTERPRETATION_MAX_SECTIONS,
  COMPATIBILITY_INTERPRETATION_MIN_BODY,
  COMPATIBILITY_INTERPRETATION_MAX_BODY,
} from './compatibility-interpretation-prompts';

export interface ParsedCompatibilitySection {
  title: string;
  body: string;
}

const MAX_TITLE_LEN = 40;

/** LLM 자유 텍스트 응답에서 {"sections":[{title,body}]} 를 방어적으로 추출. 실패 시 null. */
export function parseCompatibilitySections(raw: string): ParsedCompatibilitySection[] | null {
  const text = raw.trim();
  if (!text) return null;

  // 코드펜스/머리말 제거 후 첫 '{' ~ 마지막 '}' 구간만 파싱.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  const sections = (parsed as { sections?: unknown })?.sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;

  const result: ParsedCompatibilitySection[] = [];
  for (const item of sections) {
    const title = (item as { title?: unknown })?.title;
    const body = (item as { body?: unknown })?.body;
    if (typeof title !== 'string' || typeof body !== 'string') return null;
    result.push({ title: title.trim(), body: body.trim() });
  }
  return result;
}

export interface CompatibilitySectionsValidationResult {
  ok: boolean;
  reasons: string[];
}

/** 섹션 개수·제목/본문 길이·한자/명리어/일일톤/자극어 0건 검증. */
export function validateCompatibilitySections(
  sections: ParsedCompatibilitySection[]
): CompatibilitySectionsValidationResult {
  const reasons: string[] = [];

  if (
    sections.length < COMPATIBILITY_INTERPRETATION_MIN_SECTIONS ||
    sections.length > COMPATIBILITY_INTERPRETATION_MAX_SECTIONS
  ) {
    reasons.push(
      `섹션 수 ${sections.length}개 (${COMPATIBILITY_INTERPRETATION_MIN_SECTIONS}~${COMPATIBILITY_INTERPRETATION_MAX_SECTIONS})`
    );
  }

  sections.forEach((section, index) => {
    const titleLen = [...section.title].length;
    const bodyLen = [...section.body].length;
    if (titleLen === 0 || titleLen > MAX_TITLE_LEN) {
      reasons.push(`섹션 ${index + 1} 제목 길이 ${titleLen}자 (1~${MAX_TITLE_LEN})`);
    }
    if (
      bodyLen < COMPATIBILITY_INTERPRETATION_MIN_BODY ||
      bodyLen > COMPATIBILITY_INTERPRETATION_MAX_BODY
    ) {
      reasons.push(
        `섹션 ${index + 1} 본문 길이 ${bodyLen}자 (${COMPATIBILITY_INTERPRETATION_MIN_BODY}~${COMPATIBILITY_INTERPRETATION_MAX_BODY})`
      );
    }
    reasons.push(...hardTextReasons(section.title, `궁합 풀이 섹션 ${index + 1} 제목`));
    reasons.push(...hardTextReasons(section.body, `궁합 풀이 섹션 ${index + 1} 본문`));
    const gyeol = countGyeol(section.body);
    if (gyeol > 1) reasons.push(`섹션 ${index + 1} '결' 과다: ${gyeol}회 (최대 1회)`);
  });

  return { ok: reasons.length === 0, reasons };
}
