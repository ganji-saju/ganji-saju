import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { UserSituation } from '@/lib/saju/types';
import { CHAPTER_META } from './chapter-prompts';
import { buildChapter1Input } from './build-chapter1-input';
import type { ChapterLLMInput } from './chapter-input-types';

// 2026-05-20 V2-5 PR L — 챕터 7 (건강 리듬) LLM 입력 converter.
//
// buildChapter1Input 의 saju 변환 재사용. 차별 포인트는 chapterId=7 + chapter
// (lens="사주 오행 균형이 신체·수면·체력에 어떤 결로") + forbiddenTopics
// (구체적 질병 진단 = 의료법 위반 위험 - 절대 금지, 특정 약·영양제 추천 금지).
//
// 7장은 의료법 측면에서 *가장 엄격한 가드* 가 필요 — system prompt 의
// forbiddenTopics 가 핵심 안전망.

export function buildChapter7Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  options: { name?: string | null; age?: number | null } = {}
): ChapterLLMInput {
  const base = buildChapter1Input(sajuData, userSituation, options);
  return {
    ...base,
    chapterId: 7,
    chapter: CHAPTER_META[7],
  };
}
