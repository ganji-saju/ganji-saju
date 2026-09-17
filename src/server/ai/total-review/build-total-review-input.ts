// 2026-05-21 — 원국(SajuDataV1/V2) + personalizationContext → 총평 LLM 입력 JSON.
//   _easy 필드를 *미리* 일상어로 도출해 LLM 이 추측/한자노출 하지 않도록 잠근다. spec §2·§1-2.
//   wonkuk/current_timeline 은 deepStripHanja 로 한자 0건 보장(엔진 라벨 방어).
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { SajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { MYEONGRI_GLOSSARY } from '@/lib/saju/terminology';
import { GANGUK_EASY, KYEOKGUK_CAREER_FIT, SIPSIN_SHORT, padToThree } from './total-review-content';
import type {
  TotalReviewContext,
  TotalReviewInput,
  TotalReviewOhaengEntry,
  TotalReviewTimeline,
  TotalReviewWonkuk,
} from './total-review-types';

export interface BuildTotalReviewInputOptions {
  userName?: string | null;
  gender?: 'M' | 'F' | null;
  /** 미지정 시 data.input.birth.year 로 계산 */
  currentAge?: number | null;
  /** 테스트 결정성용 — 미지정 시 new Date() */
  now?: Date;
}

// ── context enum → 한글 라벨 (총평 톤, concern 은 가운뎃점 표기) ──────────────
const RELATIONSHIP_LABELS: Record<string, string> = {
  single: '솔로',
  dating: '연애 중',
  married: '기혼',
  separated: '이별 후 정리 중',
};
const OCCUPATION_LABELS: Record<string, string> = {
  employee: '직장인',
  'self-employed': '자영업/프리랜서',
  student: '학생',
  homemaker: '가정 살림',
  'job-seeking': '구직 중',
  other: '기타 활동',
};
const CONCERN_LABELS: Record<string, string> = {
  business: '사업·이직',
  romance: '결혼·연애',
  family: '자녀·가족',
  health: '건강·멘탈',
  wealth: '재물·투자',
  other: '',
};

// 천간/지지(한자) → 오행. current_timeline 의 ganzi 는 한자 형태.
const STEM_ELEMENT: Record<string, string> = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토',
  己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수',
};
const BRANCH_ELEMENT: Record<string, string> = {
  子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화',
  午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수',
};

const ELEMENT_PLAIN_EFFECT_LOCAL: Record<string, string> = {
  목: '막힌 흐름을 틔우고 새 방향을 세우는',
  화: '차가운 기운을 데우고 전달력을 살리는',
  토: '흩어진 기운을 붙잡아 현실감과 안정감을 만드는',
  금: '복잡한 흐름을 정리하고 원칙을 정하는',
  수: '과열된 흐름을 식히고 생각을 깊게 만드는',
};

function elementLabel(element: string): string {
  return `${element} 기운`;
}

/** glossary plainCue 의 앞부분(키워드)만. 'X·Y·Z — 설명' → 'X·Y·Z'. */
function elementCue(element: string | undefined): string {
  if (!element) return '';
  const cue = MYEONGRI_GLOSSARY[element]?.plainCue;
  if (!cue) return elementLabel(element);
  return cue.split(/\s*[—–-]\s*/)[0]?.trim() || elementLabel(element);
}

function stripHanja(value: string): string {
  return value
    .replace(/[一-鿿]/g, '')
    .replace(/[（(]\s*[）)]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function deepStripHanja<T>(value: T): T {
  if (typeof value === 'string') return stripHanja(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => deepStripHanja(item)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) out[key] = deepStripHanja(val);
    return out as T;
  }
  return value;
}

export function buildTotalReviewInput(
  data: SajuDataV1 | SajuDataV2,
  ctx: SajuPersonalizationContext,
  options: BuildTotalReviewInputOptions = {}
): TotalReviewInput {
  const now = options.now ?? new Date();
  const birthYear = data.input?.birth?.year ?? null;
  const currentAge =
    options.currentAge ?? (birthYear ? now.getFullYear() - birthYear + 1 : null);

  return {
    user: {
      name: options.userName ?? null,
      gender: options.gender ?? null,
      current_age: currentAge,
    },
    context: buildContext(ctx),
    wonkuk: deepStripHanja(buildWonkuk(data, ctx)),
    current_timeline: deepStripHanja(buildTimeline(data, now)),
  };
}

function buildContext(ctx: SajuPersonalizationContext): TotalReviewContext {
  const situation = ctx.userSituation;
  const relationship = situation?.relationshipStatus
    ? RELATIONSHIP_LABELS[situation.relationshipStatus] ?? null
    : null;
  const occupation = situation?.occupation
    ? OCCUPATION_LABELS[situation.occupation] ?? null
    : null;

  let concern: string | null = null;
  const concernKey = situation?.currentConcern ?? null;
  const note = situation?.concernNote?.trim() || null;
  if (concernKey && CONCERN_LABELS[concernKey]) {
    concern = CONCERN_LABELS[concernKey];
  } else if (note) {
    concern = note.slice(0, 40);
  }

  return {
    relationship_status: relationship,
    occupation_status: occupation,
    concern,
  };
}

function buildWonkuk(
  data: SajuDataV1 | SajuDataV2,
  ctx: SajuPersonalizationContext
): TotalReviewWonkuk {
  const dm = data.dayMaster;

  const ilgan_easy = {
    label: ctx.sixtyGapja?.title ?? `${dm.element} 기운`,
    detail: [dm.description ?? ctx.sixtyGapja?.core ?? '', data.input.hourKnown ? '' : '태어난 시간은 미입력입니다. 시간 정보에 의존하는 개인사와 특정 시기를 추측하지 않습니다.'].filter(Boolean).join(' '),
    metaphor: dm.metaphor ?? '',
  };
  const ilju_easy = {
    label: ctx.sixtyGapja?.title ?? '',
    detail: ctx.sixtyGapja?.core ?? '',
  };

  const ohaeng_balance: Record<string, number> = Object.fromEntries(
    (Object.entries(data.fiveElements.byElement) as [string, { count: number }][]).map(
      ([element, value]) => [element, value.count]
    )
  );

  const weakest = data.fiveElements.weakest;
  const weakestState = data.fiveElements.byElement[weakest]?.state;
  const ohaeng_lack_easy: TotalReviewOhaengEntry[] =
    weakestState === 'missing' || weakestState === 'weak'
      ? [
          {
            element: weakest,
            label: elementLabel(weakest),
            meaning: `${ELEMENT_PLAIN_EFFECT_LOCAL[weakest] ?? '원칙을 정하는'} 기운이 부족한 편이에요.`,
          },
        ]
      : [];

  const dominant = data.fiveElements.dominant;
  const dominantState = data.fiveElements.byElement[dominant]?.state;
  const ohaeng_excess_easy: TotalReviewOhaengEntry[] =
    dominantState === 'strong'
      ? [
          {
            element: dominant,
            label: elementLabel(dominant),
            meaning: `${elementLabel(dominant)}이 풍부해 한쪽으로 쏠리기 쉬운 편이에요.`,
          },
        ]
      : [];

  const ganguk_easy = data.strength
    ? GANGUK_EASY[data.strength.level]
    : { label: '', detail: '' };

  const yongsin_easy = {
    primary: {
      label: data.yongsin?.primary?.label ?? '',
      meaning:
        data.yongsin?.plainSummary ??
        data.yongsin?.candidates?.[0]?.plainSummary ??
        (data.yongsin?.practicalActions?.[0] ?? ''),
    },
    secondary: data.yongsin?.secondary?.[0]
      ? { label: data.yongsin.secondary[0].label, meaning: '' }
      : null,
  };

  const tenGod = data.pattern?.tenGod ?? null;
  // naming-policy §3·§4: glossary plainCue 는 "돌봄·후원·배움의 결" 처럼 "X의 결" 패턴이 있어
  //   §12 위반 → SIPSIN_SHORT("말하고 베푸는 별" 등 자연 명사·"의 결" 없는 설명)로 도출.
  const patternCue = tenGod ? SIPSIN_SHORT[tenGod] ?? '' : '';
  // naming-policy §4 + 총평 §2: 격국 원어("식신격")를 입력 label 에 노출하지 않고 설명형으로.
  //   (총평은 jargon-free — 본문에 격국명 금지. 원어 echo → validator fallback 위험 차단.)
  const kyeokguk_easy = {
    label: patternCue ? `${patternCue}을 중심 역할의 후보로 읽는 사주` : '',
    detail: patternCue ? `${patternCue}을 역할 해석의 근거로 봅니다. ${data.pattern?.confidence === '낮음' ? '판단 신뢰도가 낮아 한 가지 역할로 단정하지 않습니다.' : '직업명이나 성공 여부를 확정하는 근거는 아닙니다.'}` : '특정 역할을 중심으로 확정할 정보가 부족합니다.',
    career_fit: tenGod ? KYEOKGUK_CAREER_FIT[tenGod] ?? [] : [],
  };

  // 강점 3 = sixtyGapja.strengths(2) + 격국·지배오행·일반 보강
  const strengthFillers = [
    patternCue ? `${patternCue}이 잘 살아 있는 강점` : '',
    `${elementLabel(dominant)}을 자연스럽게 쓰는 힘`,
    '전체 흐름을 살피고 조율하는 감각',
    '꾸준히 신뢰를 쌓아가는 힘',
  ].filter(Boolean);
  const key_strengths_easy = padToThree(ctx.sixtyGapja?.strengths ?? [], strengthFillers);

  // 약점 3 = sixtyGapja.watchPoints(1) + 부족오행·강약·일반 보강
  const strengthLevel = data.strength?.level;
  const weaknessFillers = [
    ohaeng_lack_easy.length > 0 ? `${elementLabel(weakest)} 비중이 작아 관련 행동이 덜 익숙한지 살펴볼 수 있으나, 실제 약점이나 질환이 있다는 뜻은 아님` : '',
    strengthLevel === '신약' ? '너무 많은 일·사람에 둘러싸이면 본인 페이스를 잃기 쉬움' : '',
    strengthLevel === '신강' ? '주관이 강해 주변과 속도를 맞추는 자리에서 마찰이 생기기 쉬움' : '',
    data.pattern?.confidence === '낮음' ? '중심 역할의 판단 신뢰도가 낮으므로 특정 성격적 약점을 확정하지 않음' : '',
    '자료에 없는 약점은 만들어내지 않고 실제로 반복되는 행동인지 확인할 것',
    '보완 방향을 능력의 부족이나 특정 사건의 예고로 해석하지 않을 것',
  ].filter(Boolean);
  const key_weaknesses_easy = padToThree(ctx.sixtyGapja?.watchPoints ?? [], weaknessFillers);

  return {
    ilgan_easy,
    ilju_easy,
    ohaeng_balance,
    ohaeng_lack_easy,
    ohaeng_excess_easy,
    ganguk_easy,
    yongsin_easy,
    kyeokguk_easy,
    key_strengths_easy,
    key_weaknesses_easy,
  };
}

function buildTimeline(data: SajuDataV1 | SajuDataV2, now: Date): TotalReviewTimeline {
  const major = data.currentLuck?.currentMajorLuck ?? null;
  const startAge = major?.startAge ?? null;
  const endAge = major?.endAge ?? null;
  const majorGanzi = major?.ganzi ?? '';
  const stemEl = majorGanzi ? STEM_ELEMENT[majorGanzi.charAt(0)] : undefined;
  const branchEl = majorGanzi ? BRANCH_ELEMENT[majorGanzi.charAt(1)] : undefined;
  const cues = [elementCue(stemEl), elementCue(branchEl)].filter(Boolean);

  const labelShort =
    startAge != null && endAge != null ? `${startAge}-${endAge}세` : '지금 시기';
  const daewoonMeaning = cues.length
    ? `${cues.join(' 기운과 ')} 기운을 살피는 10년입니다. 원국의 강점과 보완 방향을 함께 읽되, 구체적인 사건이나 직업·관계 변화를 예고하지 않습니다.`
    : '현재 대운은 미산정입니다. 시기 변화나 전환 나이를 만들지 말고 원국과 입력된 현재 상황을 기준으로 설명합니다.';

  const saewoonGanzi = data.currentLuck?.saewoon?.ganzi ?? '';
  const saewoonEl = saewoonGanzi ? STEM_ELEMENT[saewoonGanzi.charAt(0)] : undefined;
  const wolGanzi = data.currentLuck?.wolwoon?.ganzi ?? '';
  const wolEl = wolGanzi ? STEM_ELEMENT[wolGanzi.charAt(0)] : undefined;

  return {
    daewoon: {
      label_short: labelShort,
      label_easy:
        startAge != null && endAge != null
          ? `지금 진행 중인 ${startAge}-${endAge}세의 10년`
          : major ? '현재 대운의 나이 범위 미상' : '현재 대운 미산정',
      is_current: Boolean(major),
      meaning_easy: daewoonMeaning,
    },
    saewoon: {
      label_easy: `올해 ${now.getFullYear()}년`,
      meaning_easy: saewoonEl
        ? `${elementCue(saewoonEl)} 흐름이 올해를 통과해요.`
        : '올해의 흐름이 한 해를 통과해요.',
    },
    wolun: {
      label_easy: '이번 달',
      meaning_easy: wolEl
        ? `${elementCue(wolEl)} 흐름이 이번 달에 비치는 시기예요.`
        : '이번 달의 흐름이 차분히 비치는 시기예요.',
    },
  };
}
