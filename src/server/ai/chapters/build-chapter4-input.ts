import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { UserSituation } from '@/lib/saju/types';
import { CHAPTER_META } from './chapter-prompts';
import { buildChapter1Input } from './build-chapter1-input';
import type { ChapterLLMInput, ChapterPriorDigest } from './chapter-input-types';

export function buildChapter4Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  options: { name?: string | null; age?: number | null } = {},
  priorChapterDigests?: ChapterPriorDigest[]
): ChapterLLMInput {
  const base = buildChapter1Input(sajuData, userSituation, options, priorChapterDigests);
  return {
    ...base,
    chapterId: 4,
    chapter: CHAPTER_META[4],
  };
}
