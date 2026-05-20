import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { UserSituation } from '@/lib/saju/types';
import { CHAPTER_META } from './chapter-prompts';
import { buildChapter1Input } from './build-chapter1-input';
import type { ChapterLLMInput } from './chapter-input-types';

// 2026-05-20 V2-5 PR L — 챕터 6 (직업 방향) LLM 입력 converter.
//
// buildChapter1Input 의 saju 변환 재사용. 차별 포인트는 chapterId=6 + chapter
// (lens="어떤 일의 방식이 본인 사주와 호환되는가") + forbiddenTopics
// (구체적 회사 이름 추천 금지, 재물=5장 영역). LLM 이 *일의 결* 관점으로 풀이.

export function buildChapter6Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  options: { name?: string | null; age?: number | null } = {}
): ChapterLLMInput {
  const base = buildChapter1Input(sajuData, userSituation, options);
  return {
    ...base,
    chapterId: 6,
    chapter: CHAPTER_META[6],
  };
}
