import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type {
  LifetimeCareerDirectionSection,
  LifetimeCoreIdentitySection,
  LifetimeHealthRhythmSection,
  LifetimePatternAndYongsinSection,
  LifetimeRelationshipPatternSection,
  LifetimeStrengthBalanceSection,
  LifetimeWealthStyleSection,
} from '@/domain/saju/report/lifetime-types';
import type { UserSituation } from '@/lib/saju/types';
import { CHAPTER_META } from './chapter-prompts';
import { buildChapter1Input } from './build-chapter1-input';
import type {
  ChapterLLMInput,
  ChapterPriorDigest,
} from './chapter-input-types';

// 2026-05-20 V2-5 PR K — 챕터 9 (평생 활용 전략) LLM synthesis 입력 변환.
//
// 9장은 1~8장과 *완전히 다른 구조* 의 synthesis 챕터 (report-llm-spec.md §4-9).
// 입력의 차별 포인트:
//   1. saju 데이터 — buildChapter1Input 의 변환을 그대로 재사용 (기본형).
//   2. **priorChapterDigests** — 1~7장 본문의 첫 문장 50자 digest 7개.
//      LLM 이 1~7장 결을 *복사가 아닌 재해석* 으로 압축할 수 있도록 입력에 제공.
//   3. chapterId=9, chapter=CHAPTER_META[9] (lens="평생 의사결정 원칙 3~5개").
//
// 출력 본문은 enhance-lifetime-chapter9 가 lifetimeStrategy.summary 만 교체.

const MAX_DIGEST_LENGTH = 50;

/**
 * 1~7장 본문(summary) 의 첫 문장을 50자 이내로 압축.
 * 50자 초과 시 47자 + '...' 로 잘라 LLM context 절약.
 */
export function extractChapterDigest(summary: string): string {
  const trimmed = (summary ?? '').trim();
  if (!trimmed) return '';
  // 첫 문장: '.', '!', '?', 줄바꿈 으로 끊음.
  const match = trimmed.match(/^[^.!?\n]+[.!?]?/u);
  const firstSentence = (match ? match[0] : trimmed).trim();
  if (firstSentence.length <= MAX_DIGEST_LENGTH) return firstSentence;
  return firstSentence.slice(0, MAX_DIGEST_LENGTH - 1).trimEnd() + '…';
}

/**
 * baseReport 의 1~7장 섹션. 8장(majorLuckTimeline) 은 daewoon-llm-spec 별도 처리 → 제외.
 */
export interface PriorChapterSummaries {
  coreIdentity: LifetimeCoreIdentitySection;
  strengthBalance: LifetimeStrengthBalanceSection;
  patternAndYongsin: LifetimePatternAndYongsinSection;
  relationshipPattern: LifetimeRelationshipPatternSection;
  wealthStyle: LifetimeWealthStyleSection;
  careerDirection: LifetimeCareerDirectionSection;
  healthRhythm: LifetimeHealthRhythmSection;
}

/**
 * SajuDataV1|V2 + UserSituation + 1~7장 본문 → 챕터 9 LLM 입력.
 *
 * saju 데이터 변환은 buildChapter1Input 재사용 (기본형). 9장은 사주 *전체* 를
 * 종합하는 챕터라 1장과 동일한 기본 ChapterSaju 가 적합.
 *
 * @param priorChapters 1~7장의 LifetimeReport 섹션. 각 섹션의 summary 가 digest 소스.
 */
export function buildChapter9Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  priorChapters: PriorChapterSummaries,
  options: { name?: string | null; age?: number | null } = {}
): ChapterLLMInput {
  const base = buildChapter1Input(sajuData, userSituation, options);

  const priorChapterDigests: ChapterPriorDigest[] = [
    {
      chapterId: 1,
      title: CHAPTER_META[1].title,
      digest: extractChapterDigest(priorChapters.coreIdentity.summary),
    },
    {
      chapterId: 2,
      title: CHAPTER_META[2].title,
      digest: extractChapterDigest(priorChapters.strengthBalance.summary),
    },
    {
      chapterId: 3,
      title: CHAPTER_META[3].title,
      digest: extractChapterDigest(priorChapters.patternAndYongsin.summary),
    },
    {
      chapterId: 4,
      title: CHAPTER_META[4].title,
      digest: extractChapterDigest(priorChapters.relationshipPattern.summary),
    },
    {
      chapterId: 5,
      title: CHAPTER_META[5].title,
      digest: extractChapterDigest(priorChapters.wealthStyle.summary),
    },
    {
      chapterId: 6,
      title: CHAPTER_META[6].title,
      digest: extractChapterDigest(priorChapters.careerDirection.summary),
    },
    {
      chapterId: 7,
      title: CHAPTER_META[7].title,
      digest: extractChapterDigest(priorChapters.healthRhythm.summary),
    },
  ];

  return {
    ...base,
    chapterId: 9,
    chapter: CHAPTER_META[9],
    priorChapterDigests,
  };
}
