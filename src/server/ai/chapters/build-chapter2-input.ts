import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { UserSituation } from '@/lib/saju/types';
import { CHAPTER_META } from './chapter-prompts';
import { buildChapter1Input } from './build-chapter1-input';
import type { ChapterLLMInput } from './chapter-input-types';

// 2026-05-20 V2-5 PR L — 챕터 2 (기운의 균형) LLM 입력 converter.
//
// buildChapter1Input 의 saju 변환 재사용. 차별 포인트는 chapterId / chapter
// (lens="오행 5 기운의 강약") + system prompt 의 forbiddenTopics (성격 묘사 = 1장 영역,
// 관계/재물/직업 = 4/5/6 영역). LLM 이 같은 데이터에 다른 *렌즈* 를 적용.

export function buildChapter2Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  options: { name?: string | null; age?: number | null } = {}
): ChapterLLMInput {
  const base = buildChapter1Input(sajuData, userSituation, options);
  return {
    ...base,
    chapterId: 2,
    chapter: CHAPTER_META[2],
  };
}
