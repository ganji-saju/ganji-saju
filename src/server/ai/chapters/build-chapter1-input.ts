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

// 2026-05-19 (a) 2-1 — SajuDataV1 + UserSituation → ChapterLLMInput 변환 helper.
//   챕터 1 (타고난 성향) 의 LLM 호출 입력을 만든다. enhanceLifetimeChapter1WithLLM
//   호출 직전 데이터 준비 단계.

const STEM_HANJA_TO_KOREAN: Record<Stem, string> = {
  甲: '갑',
  乙: '을',
  丙: '병',
  丁: '정',
  戊: '무',
  己: '기',
  庚: '경',
  辛: '신',
  壬: '임',
  癸: '계',
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
  const entry = MYEONGRI_GLOSSARY[name];
  return entry?.plainCue ?? '';
}

/** ChapterUserContext.occupation 으로 narrowing — homemaker/other 는 null. */
function narrowOccupation(
  value: OccupationCategory | null | undefined
): ChapterUserContext['occupation'] {
  if (value === 'employee' || value === 'self-employed' || value === 'student' || value === 'job-seeking') {
    return value;
  }
  return null;
}

/** ChapterUserContext.currentConcern 으로 narrowing — romance→love, family→relationship 매핑. */
function narrowConcern(
  value: ConcernCategory | null | undefined
): ChapterUserContext['currentConcern'] {
  if (value === 'business' || value === 'health' || value === 'wealth') return value;
  if (value === 'romance') return 'love';
  if (value === 'family') return 'relationship';
  return null;
}

/**
 * SajuDataV1 또는 SajuDataV2 + UserSituation 을 챕터 1 LLM 입력으로 변환.
 *
 * V2 는 V1 의 superset (V1 의 모든 핵심 필드 보존 + interpretation/verification/legacy
 * 추가 필드). 본 함수가 사용하는 필드는 모두 V1+V2 공통이라 union 타입으로 받음.
 * (engine/index.ts 의 공식 가이드: "새 코드는 가급적 v2 를".)
 *
 * - pillars: 한자 ganzi → 한글 (toKoreanGanzi)
 * - dayMaster: stem 한글 + element 한글 표기 라벨 ('토 기운')
 * - fiveElements: dominant/weakest 자연 비유 라벨 + distribution (목/화/토/금/수 키)
 * - pattern: 격국 + plainCue (MYEONGRI_GLOSSARY)
 * - strength: 신강/중화/신약 → 일상어
 * - tenGods: dominant + shortageList
 *
 * @param priorChapterDigests 직렬 생성 시 앞서 작성된 챕터들의 digest. 있으면
 *   user message 에 "이미 다룬 결론 — 반복 회피" 로 주입돼 챕터 간 문장 중복 차단.
 *   첫 챕터(또는 병렬 호출)는 미전달 → 기존 동작 그대로.
 */
export function buildChapter1Input(
  sajuData: SajuDataV1 | SajuDataV2,
  userSituation: UserSituation | null,
  options: { name?: string | null; age?: number | null } = {},
  priorChapterDigests?: ChapterPriorDigest[]
): ChapterLLMInput {
  const { pillars, dayMaster, fiveElements, pattern, yongsin, strength, tenGods } =
    sajuData;

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
      supportElements: [], // 2026-05-19: getLuckyElementsFromSajuData 통합은 후속 PR
      distribution: {
        // 2026-05-19: SajuFiveElements.byElement[el].percentage 0~100 → 0~1 비율로
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
      // SajuYongsin.primary 는 SajuSymbolRef { type, value, label }.
      //   '금 기운' 같은 한글 표기 라벨이 아니라 명리 글자/술어 (예: '火') 이므로 label 그대로 노출.
      primary: yongsin?.primary?.label ?? '',
      reason: yongsin?.rationale?.[0] ?? '',
    },
    strength: STRENGTH_TO_KOREAN[strength?.level ?? ''] ?? '균형이 잡힌 편',
    tenGods: {
      dominant: tenGods?.dominant ?? '',
      // 2026-05-19: byType count === 0 인 십성 코드들을 부족 항목으로.
      shortageList: tenGods?.byType
        ? Object.entries(tenGods.byType)
            .filter(([, count]) => count === 0)
            .map(([code]) => code)
        : [],
    },
    notableSinsals: [], // 2026-05-19: 신살 매핑은 후속 PR (sajuData 의 sinsals 구조 확인 후)
  };

  const userContext: ChapterUserContext = {
    name: options.name ?? null,
    age: options.age ?? null,
    relationshipStatus: userSituation?.relationshipStatus ?? null,
    occupation: narrowOccupation(userSituation?.occupation),
    currentConcern: narrowConcern(userSituation?.currentConcern),
  };

  return {
    chapterId: 1,
    chapter: CHAPTER_META[1],
    saju,
    userContext,
    ...(priorChapterDigests && priorChapterDigests.length > 0
      ? { priorChapterDigests }
      : {}),
  };
}
