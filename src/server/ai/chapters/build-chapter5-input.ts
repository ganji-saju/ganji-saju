import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type {
  ConcernCategory,
  Element,
  OccupationCategory,
  Stem,
  UserSituation,
} from '@/lib/saju/types';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { toKoreanGanzi } from '@/lib/saju/ganzi-korean';
import { MYEONGRI_GLOSSARY } from '@/lib/saju/terminology';
import { CHAPTER_META } from './chapter-prompts';
import type {
  ChapterLLMInput,
  ChapterPriorDigest,
  ChapterUserContext,
  ChapterSaju,
} from './chapter-input-types';

// 2026-05-20 V2-5 PR J — 챕터 5 (재물 감각) LLM 입력 converter.
//   PR #256 (a) 2-1 의 buildChapter1Input 과 동일 구조. chapterId / chapter meta 만 다름.
//   helper 들은 의식적 복제 — PR J 후속 별도 PR 에서 공통화 검토.

const STEM_HANJA_TO_KOREAN: Record<Stem, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};

const STRENGTH_TO_KOREAN: Record<string, ChapterSaju['strength']> = {
  신강: '에너지가 강한 편',
  중화: '균형이 잡힌 편',
  신약: '에너지가 차분한 편',
};

function elementLabel(element: Element | null | undefined): string {
  if (!element) return '';
  return ELEMENT_INFO[element].name;
}

function patternPlainCue(name: string | null | undefined): string {
  if (!name) return '';
  return MYEONGRI_GLOSSARY[name]?.plainCue ?? '';
}

function narrowOccupation(
  value: OccupationCategory | null | undefined
): ChapterUserContext['occupation'] {
  if (value === 'employee' || value === 'self-employed' || value === 'student' || value === 'job-seeking') {
    return value;
  }
  return null;
}

function narrowConcern(
  value: ConcernCategory | null | undefined
): ChapterUserContext['currentConcern'] {
  if (value === 'business' || value === 'health' || value === 'wealth') return value;
  if (value === 'romance') return 'love';
  if (value === 'family') return 'relationship';
  return null;
}

export function buildChapter5Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  options: { name?: string | null; age?: number | null } = {},
  priorChapterDigests?: ChapterPriorDigest[]
): ChapterLLMInput {
  const { pillars, dayMaster, fiveElements, pattern, yongsin, strength, tenGods } = sajuData;

  const saju: ChapterSaju = {
    pillars: {
      year: toKoreanGanzi(pillars.year.ganzi),
      month: toKoreanGanzi(pillars.month.ganzi),
      day: toKoreanGanzi(pillars.day.ganzi),
      hour: pillars.hour ? toKoreanGanzi(pillars.hour.ganzi) : null,
    },
    dayMaster: {
      stem: STEM_HANJA_TO_KOREAN[dayMaster.stem] ?? dayMaster.stem,
      element: elementLabel(dayMaster.element),
      metaphor: dayMaster.metaphor ?? '',
    },
    fiveElements: {
      dominant: elementLabel(fiveElements.dominant),
      weakest: elementLabel(fiveElements.weakest),
      supportElements: [],
      distribution: {
        목: (fiveElements.byElement?.목?.percentage ?? 0) / 100,
        화: (fiveElements.byElement?.화?.percentage ?? 0) / 100,
        토: (fiveElements.byElement?.토?.percentage ?? 0) / 100,
        금: (fiveElements.byElement?.금?.percentage ?? 0) / 100,
        수: (fiveElements.byElement?.수?.percentage ?? 0) / 100,
      },
    },
    pattern: {
      label: pattern?.name ?? '',
      plainCue: patternPlainCue(pattern?.name),
    },
    yongsin: {
      primary: yongsin?.primary?.label ?? '',
      reason: yongsin?.rationale?.[0] ?? '',
    },
    strength: STRENGTH_TO_KOREAN[strength?.level ?? ''] ?? '균형이 잡힌 편',
    tenGods: {
      dominant: tenGods?.dominant ?? '',
      shortageList: tenGods?.byType
        ? Object.entries(tenGods.byType).filter(([, c]) => c === 0).map(([code]) => code)
        : [],
    },
    notableSinsals: [],
  };

  const userContext: ChapterUserContext = {
    name: options.name ?? null,
    age: options.age ?? null,
    relationshipStatus: userSituation?.relationshipStatus ?? null,
    occupation: narrowOccupation(userSituation?.occupation),
    currentConcern: narrowConcern(userSituation?.currentConcern),
  };

  return {
    chapterId: 5,
    chapter: CHAPTER_META[5],
    saju,
    userContext,
    ...(priorChapterDigests && priorChapterDigests.length > 0
      ? { priorChapterDigests }
      : {}),
  };
}
