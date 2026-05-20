import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { UserSituation } from '@/lib/saju/types';
import { CHAPTER_META } from './chapter-prompts';
import { buildChapter1Input } from './build-chapter1-input';
import type { ChapterLLMInput } from './chapter-input-types';

// 2026-05-20 V2-5 PR L — 챕터 3 (역할과 보완 힌트) LLM 입력 converter.
//
// buildChapter1Input 의 saju 변환 재사용. 차별 포인트는 chapterId=3 + chapter
// (lens="사주가 가리키는 반복되는 삶의 역할 + 보완 축") + forbiddenTopics
// (성격 일반=1장, 오행 분포 자체=2장). LLM 이 동일 saju 에 *역할 렌즈* 적용.

export function buildChapter3Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  options: { name?: string | null; age?: number | null } = {}
): ChapterLLMInput {
  const base = buildChapter1Input(sajuData, userSituation, options);
  return {
    ...base,
    chapterId: 3,
    chapter: CHAPTER_META[3],
  };
}
