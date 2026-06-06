import type {
  SajuDataV1,
  SajuSymbolRef,
  SajuYongsinCandidate,
  TenGodCode,
  YongsinConfidence,
} from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { OrreryRelation } from '@/domain/saju/engine/orrery-adapter';
import {
  ELEMENT_INFO,
  getLuckyElementsFromSajuData,
  getPersonalityFromSajuData,
} from '@/lib/saju/elements';
import {
  limitSajuSentences,
  simplifySajuCopy,
  simplifySajuCopyList,
} from '@/lib/saju/public-copy';
import type { BirthInput, Element } from '@/lib/saju/types';
import type {
  FocusTopic,
  FocusTopicMeta,
  FocusTopicOption,
  ReportEvidenceCard,
  ReportEvidenceComputed,
  ReportEvidenceKey,
  ReportInsight,
  ReportScore,
  ReportTimelineItem,
  SajuReport,
} from './types';
import {
  getInterpretationScoreBand,
  getTopicInterpretationRule,
  selectEvidenceCard,
  toEvidenceSnippet,
} from './interpretation-rule-table';
import { getEvidenceSource, getEvidenceTopicMapping } from './topic-rule-table';

export const FOCUS_TOPIC_META: Record<FocusTopic, FocusTopicMeta> = {
  today: {
    label: '오늘',
    badge: '오늘의 흐름',
    subtitle: '오늘 바로 체감되는 흐름과 행동 포인트를 압축해서 보여줍니다.',
  },
  love: {
    label: '연애',
    badge: '연애 포커스',
    subtitle: '감정의 온도와 말할 타이밍을 중심으로 읽어드립니다.',
  },
  wealth: {
    label: '재물',
    badge: '재물 포커스',
    subtitle: '돈의 흐름, 지출 감각, 기회 포착 포인트를 정리합니다.',
  },
  career: {
    label: '직장',
    badge: '직장 포커스',
    subtitle: '성과, 역할 변화, 이직 타이밍을 현실적으로 정리합니다.',
  },
  relationship: {
    label: '관계',
    badge: '관계 포커스',
    subtitle: '가까운 사람과의 거리감과 조율 포인트를 읽어드립니다.',
  },
};

export const FOCUS_TOPIC_OPTIONS: FocusTopicOption[] = [
  { key: 'today', label: '오늘' },
  { key: 'love', label: '연애' },
  { key: 'wealth', label: '재물' },
  { key: 'career', label: '직장' },
  { key: 'relationship', label: '관계' },
];

const SCORE_LABELS: Record<ReportScore['key'], string> = {
  overall: '총운',
  love: '연애',
  wealth: '재물',
  career: '직장',
  relationship: '관계',
};

const TOPIC_SCORE_KEYS: Record<FocusTopic, ReportScore['key']> = {
  today: 'overall',
  love: 'love',
  wealth: 'wealth',
  career: 'career',
  relationship: 'relationship',
};

const STRENGTH_INTERPRETATION: Record<'신강' | '중화' | '신약', string> = {
  신강:
    '기본적으로 스스로 판을 끌고 가는 힘이 강한 편이라, 장점은 추진력으로 드러나지만 과하면 혼자 짊어지는 피로로 바뀌기 쉽습니다.',
  중화:
    '진행하는 힘과 조율하는 힘이 크게 한쪽으로 치우치지 않아 상황을 읽고 맞추는 감각이 살아 있습니다. 다만 결정이 늦어지지 않도록 원칙을 먼저 세우는 편이 좋습니다.',
  신약:
    '외부 환경과 관계의 온도에 영향을 더 많이 받는 명식이라, 무리해서 버티기보다 나를 돕는 환경과 사람을 잘 고르는 것이 성패를 크게 가릅니다.',
};

const TEN_GOD_INTERPRETATION: Record<TenGodCode, string> = {
  비견: '나와 비슷한 사람, 동료, 형제 같은 관계가 삶에서 자주 부각됩니다. 스스로 서려는 마음이 강하지만 양보가 어려워질 때도 있습니다.',
  겁재: '가까운 사람과 재물이나 역할을 나누는 문제에서 갈등이 생기기 쉬운 십신입니다. 정이 깊을수록 경계를 분명히 할 필요가 있습니다.',
  식신: '내가 키워내고 길러내는 힘이 좋아 자녀, 취미, 결과물, 생활의 여유 같은 주제가 삶을 따뜻하게 만듭니다.',
  상관: '전달력과 재주는 뛰어나지만 답답한 틀을 견디기 어려운 편입니다. 재능이 잘 쓰이면 매력이 되고, 억눌리면 불편함이 커집니다.',
  편재: '사람과 기회를 넓게 움직이며 돈과 활동의 물결이 크게 드나드는 흐름입니다. 잘 맞으면 기회가 크지만 흩어지지 않게 관리가 필요합니다.',
  정재: '꾸준히 쌓아 안정적으로 지키는 재물 감각이 돋보입니다. 한 번 믿은 구조를 오래 가져가지만 변화에는 시간이 걸릴 수 있습니다.',
  편관: '경쟁, 압박, 책임 속에서 단련되며 힘이 생기는 십신입니다. 버텨내는 힘은 강하지만 긴장을 오래 품지 않도록 조절이 필요합니다.',
  정관: '자리, 책임, 명예, 질서를 중시하는 흐름이라 역할을 바르게 감당하려는 마음이 큽니다. 스스로 기대가 높아 피로가 쌓일 수 있습니다.',
  편인: '남다른 감각과 직관, 혼자 깊이 파고드는 힘이 강합니다. 보통 사람보다 다른 방식으로 이해하고 받아들이는 재능이 있습니다.',
  정인: '돌봄, 후원, 배움의 흐름이 삶에서 중요한 힘으로 작용합니다. 누군가를 품고, 또 누군가에게 도움을 받는 인연이 크게 남습니다.',
};

const GAN_ELEMENT_MAP: Record<string, Element> = {
  甲: '목',
  乙: '목',
  丙: '화',
  丁: '화',
  戊: '토',
  己: '토',
  庚: '금',
  辛: '금',
  壬: '수',
  癸: '수',
};

const JI_ELEMENT_MAP: Record<string, Element> = {
  子: '수',
  丑: '토',
  寅: '목',
  卯: '목',
  辰: '토',
  巳: '화',
  午: '화',
  未: '토',
  申: '금',
  酉: '금',
  戌: '토',
  亥: '수',
};

const LUCK_ELEMENT_GUIDE: Record<Element, { theme: string; chance: string; caution: string; action: string }> = {
  목: {
    theme: '새 계획, 성장, 공부, 관계 확장',
    chance: '새로운 역할이나 배움이 열릴 때 빨리 싹을 틔우는 힘이 있습니다.',
    caution: '방향을 너무 많이 벌리면 시작은 많은데 마무리가 약해질 수 있습니다.',
    action: '계획을 세 개 이하로 줄이고, 한 가지는 매주 반복해 보세요.',
  },
  화: {
    theme: '말, 노출, 인정, 속도',
    chance: '말, 발표, 브랜딩, 관계의 온도를 올리는 데 힘이 붙습니다.',
    caution: '감정과 속도가 앞서면 피로와 오해가 같이 커질 수 있습니다.',
    action: '중요한 말은 바로 꺼내되, 결론 전 한 번 더 확인하세요.',
  },
  토: {
    theme: '안정, 책임, 자산화, 생활 기반',
    chance: '흩어진 일을 구조화하고 오래 가져갈 기반을 만들기 좋습니다.',
    caution: '안정을 중시하다 변화 타이밍을 놓치거나 책임을 과하게 안을 수 있습니다.',
    action: '고정비, 역할, 생활 루틴을 정리해 부담을 숫자로 확인하세요.',
  },
  금: {
    theme: '정리, 원칙, 계약, 결단',
    chance: '원칙을 정하고 불필요한 것을 덜어내는 판단력이 살아납니다.',
    caution: '말이 차갑게 들리거나 결과만 보고 관계의 온도를 놓칠 수 있습니다.',
    action: '계약, 일정, 책임 범위를 문장으로 남겨 오해를 줄이세요.',
  },
  수: {
    theme: '휴식, 판단, 정보, 이동',
    chance: '생각을 깊게 하고 정보를 모아 다음 선택의 질을 높이기 좋습니다.',
    caution: '고민이 길어지면 실행이 늦어지고 감정이 안쪽으로 고일 수 있습니다.',
    action: '잠, 자료 정리, 이동 계획처럼 흐름을 정돈하는 루틴을 먼저 잡으세요.',
  },
};

// 2026-05-23 — naming-policy §2 위반(오행 추상어 신조어 금지) 정정. "새 시작/말/
//   정리/원칙/생각" 추상 단서를 사이트 표준 표기 "X 기운"(목/화/토/금/수 + 기운)으로
//   교체. 단일 소스는 ELEMENT_INFO[element].name. 토→"정리"·금→"원칙"은 의미상
//   오류이기도 했음(토=담아냄·안정, 금=단단함·결단).
// 첫 등장 의미 병기("토 기운(담아냄·안정)")용 한 줄 설명 — naming-policy §2 표.
const ELEMENT_MEANING: Record<Element, string> = {
  목: '자라남·시작',
  화: '전달·열정',
  토: '담아냄·안정',
  금: '단단함·결단',
  수: '흐름·깊이',
};

const ELEMENT_READING_COPY: Record<
  Element,
  {
    label: string;
    gift: string;
    action: string;
    avoid: string;
    today: string;
    love: string;
    wealth: string;
    career: string;
    relationship: string;
  }
> = {
  목: {
    label: ELEMENT_INFO.목.name,
    gift: '새로운 일을 여는 힘',
    action: '할 일을 하나만 골라 바로 시작하세요.',
    avoid: '계획만 늘리면 마무리가 흐려질 수 있어요.',
    today: '작은 시작 하나가 하루 분위기를 바꿉니다.',
    love: '연애는 긴 설명보다 먼저 다가가는 짧은 말이 잘 맞습니다.',
    wealth: '재물은 새 지출보다 앞으로 쓸 돈의 순서를 먼저 잡으세요.',
    career: '일은 새 업무를 벌리기보다 시작할 한 가지를 분명히 고르세요.',
    relationship: '관계는 먼저 안부를 묻는 쪽이 어색함을 풀어줍니다.',
  },
  화: {
    label: ELEMENT_INFO.화.name,
    gift: '마음을 드러내는 힘',
    action: '하고 싶은 말을 짧고 부드럽게 먼저 꺼내세요.',
    avoid: '감정이 앞서면 말이 세게 들릴 수 있어요.',
    today: '말을 미루지 않을수록 흐름이 빨리 풀립니다.',
    love: '연애는 마음을 숨기기보다 가벼운 말으로 온도를 맞추세요.',
    wealth: '재물은 충동 결제보다 왜 필요한지 한 줄로 적어보세요.',
    career: '일은 보고와 발표처럼 드러나는 장면에서 힘이 붙습니다.',
    relationship: '관계는 칭찬과 감사처럼 따뜻한 말이 먼저 닿습니다.',
  },
  토: {
    label: ELEMENT_INFO.토.name,
    gift: '흩어진 것을 모으는 힘',
    action: '일정, 돈, 약속 중 하나를 정리하세요.',
    avoid: '붙잡는 일이 많아지면 몸과 마음이 무거워질 수 있어요.',
    today: '정리를 먼저 하면 나머지 선택이 훨씬 가벼워집니다.',
    love: '연애는 감정 결론보다 약속과 생활 리듬을 맞추는 쪽이 좋습니다.',
    wealth: '재물은 고정비, 정산, 결제 예정액을 확인할 때 안정됩니다.',
    career: '일은 맡은 범위와 마감을 정리하면 평가가 좋아집니다.',
    relationship: '관계는 서로의 역할과 기대치를 차분히 맞추는 날입니다.',
  },
  금: {
    label: ELEMENT_INFO.금.name,
    gift: '원칙을 정하는 힘',
    action: '오늘 꼭 할 일과 미룰 일을 나눠보세요.',
    avoid: '원칙이 지나치면 말이 차갑게 들릴 수 있어요.',
    today: '우선순위를 줄일수록 판단이 또렷해집니다.',
    love: '연애는 애매한 말보다 가능한 것과 어려운 것을 분명히 말하세요.',
    wealth: '재물은 금액, 조건, 계약 내용을 확인할 때 손실을 줄입니다.',
    career: '일은 역할과 책임 범위를 문장으로 남기면 안정됩니다.',
    relationship: '관계는 말의 순서와 확인이 오해를 줄여줍니다.',
  },
  수: {
    label: ELEMENT_INFO.수.name,
    gift: '흐름을 읽는 힘',
    action: '바로 결정하기 전 자료와 마음을 한 번 확인하세요.',
    avoid: '생각이 길어지면 실행이 늦어질 수 있어요.',
    today: '잠깐 멈춰 확인하는 시간이 결과를 부드럽게 만듭니다.',
    love: '연애는 감정을 단정하지 말고 상대의 흐름을 조금 더 보세요.',
    wealth: '재물은 정보 확인과 비교가 먼저일 때 안정됩니다.',
    career: '일은 자료를 모으고 방향을 다시 잡는 데 유리합니다.',
    relationship: '관계는 바로 답하기보다 한 박자 두고 말하면 편해집니다.',
  },
};

const PUBLIC_TEN_GOD_TONES: Record<TenGodCode, { label: string; strength: string; caution: string }> = {
  비견: {
    label: '내 선택이 뚜렷한 편',
    strength: '스스로 정한 원칙을 밀고 가는 힘',
    caution: '혼자 다 떠안지 않기',
  },
  겁재: {
    label: '가까운 사람과 역할을 나누는 편',
    strength: '사람 사이의 힘겨루기를 빨리 감지하는 감각',
    caution: '정 때문에 경계를 흐리지 않기',
  },
  식신: {
    label: '꾸준히 만들어내는 편',
    strength: '작게 쌓아 결과로 만드는 힘',
    caution: '편한 쪽으로만 미루지 않기',
  },
  상관: {
    label: '말과 아이디어가 빠른 편',
    strength: '답답한 틀을 새롭게 바꾸는 감각',
    caution: '말이 앞서서 관계를 다치게 하지 않기',
  },
  편재: {
    label: '기회와 사람을 넓게 보는 편',
    strength: '새 기회를 빠르게 알아보는 감각',
    caution: '너무 많은 일을 동시에 벌리지 않기',
  },
  정재: {
    label: '돈과 일을 안정적으로 쌓는 편',
    strength: '꾸준히 지키고 관리하는 힘',
    caution: '변화가 필요할 때 너무 늦게 움직이지 않기',
  },
  편관: {
    label: '압박 속에서 집중력이 살아나는 편',
    strength: '어려운 상황에서도 버티는 힘',
    caution: '긴장을 오래 품지 않기',
  },
  정관: {
    label: '책임과 원칙을 중요하게 보는 편',
    strength: '맡은 일을 바르게 정리하는 힘',
    caution: '스스로에게 너무 엄격해지지 않기',
  },
  편인: {
    label: '혼자 깊게 파악하는 편',
    strength: '남들이 놓친 흐름을 읽는 감각',
    caution: '생각만 깊어지고 실행이 늦어지지 않기',
  },
  정인: {
    label: '배움과 도움을 크게 쓰는 편',
    strength: '도움을 받고 다시 키워내는 힘',
    caution: '기다림이 길어져 선택을 미루지 않기',
  },
};

const CORE_TERM_EXPLAINERS = {
  strength: [
    {
      term: '강약',
      hanja: '强弱',
      meaning: '일간이 명식 안에서 버티고 움직일 힘이 강한지 약한지를 보는 정보입니다.',
    },
    {
      term: '일간',
      hanja: '日干',
      meaning: '태어난 날의 천간으로, 사주 해석에서 나 자신을 대표하는 글자입니다.',
    },
  ],
  pattern: [
    {
      term: '격국',
      hanja: '格局',
      meaning: '월령과 십신을 중심으로 이 명식이 어떤 역할과 구조로 움직이는지 잡는 틀입니다.',
    },
    {
      term: '월령',
      hanja: '月令',
      meaning: '태어난 달의 계절 기운입니다. 사주 전체 분위기를 잡는 가장 큰 배경으로 봅니다.',
    },
    {
      term: '십신',
      hanja: '十神',
      meaning: '일간과 다른 글자의 관계를 열 가지 역할로 나눈 해석 언어입니다.',
    },
  ],
  relations: [
    {
      term: '합',
      hanja: '合',
      meaning: '글자끼리 서로 끌어당겨 묶이거나 한 방향으로 힘이 모이는 관계입니다.',
    },
    {
      term: '충',
      hanja: '沖',
      meaning: '글자끼리 부딪혀 변화, 이동, 긴장, 결정을 만들기 쉬운 관계입니다.',
    },
  ],
  gongmang: [
    {
      term: '공망',
      hanja: '空亡',
      meaning: '있어도 바로 채워지지 않거나, 기대보다 늦게 드러나는 빈자리의 축입니다.',
    },
  ],
  specialSals: [
    {
      term: '신살',
      hanja: '神煞',
      meaning: '원국을 보조적으로 읽는 표지입니다. 길흉을 단정하기보다 작용 방식과 속도를 살핍니다.',
    },
  ],
};

const EVIDENCE_ACTIONS = {
  strength: {
    신강: ['혼자 짊어지는 일 줄이기', '결정 전 한 번 더 조율하기', '강한 추진력을 역할 분담으로 나누기'],
    중화: ['판단 원칙을 먼저 정하기', '기회와 부담을 함께 비교하기', '결정을 너무 미루지 않기'],
    신약: ['나를 돕는 환경 먼저 만들기', '무리한 약속 줄이기', '도움을 요청할 사람을 정해두기'],
  },
  pattern: ['반복되는 역할을 인식하기', '관계에서 맡는 자리를 정리하기', '일의 역할과 책임 범위 쓰기'],
  relations: ['부딪히는 주제는 바로 결론내지 않기', '묶이는 관계는 약속을 명확히 하기', '변화 신호를 일정 관리에 반영하기'],
  gongmang: ['중요 약속은 재확인하기', '비어 있는 역할을 무리해서 채우지 않기', '마감과 전달 과정을 한 번 더 점검하기'],
  specialSals: ['도움 흐름은 적극 활용하기', '주의 흐름은 속도를 늦추기', '신살은 단정 대신 보조 힌트로 보기'],
};

function clampScore(value: number) {
  return Math.max(48, Math.min(92, Math.round(value)));
}

function hasBatchim(value: string) {
  const trimmed = value.trim();
  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;

  return code % 28 !== 0;
}

function withParticle(value: string, consonantParticle: string, vowelParticle: string) {
  return `${value}${hasBatchim(value) ? consonantParticle : vowelParticle}`;
}

function getElementEntries(data: SajuDataV1 | SajuDataV2) {
  return (Object.entries(data.fiveElements.byElement) as [Element, SajuDataV1['fiveElements']['byElement'][Element]][])
    .map(([element, value]) => [element, value.count] as [Element, number])
    .sort((a, b) => b[1] - a[1]);
}

function getElementTone(element: Element) {
  const copy = ELEMENT_READING_COPY[element];

  return {
    label: copy.label,
    move: copy.today,
    avoid: copy.avoid,
    cue: copy.label,
  };
}

function getOrreryExtension(data: SajuDataV1 | SajuDataV2) {
  return data.extensions?.orrery ?? null;
}

function hasIndexedSpecialSal(value: number[] | null | undefined) {
  return Boolean(value && value.length > 0);
}

function getSpecialSalGroups(data: SajuDataV1 | SajuDataV2) {
  const specialSals = getOrreryExtension(data)?.specialSals;
  const supportive: string[] = [];
  const cautionary: string[] = [];

  if (!specialSals) return { supportive, cautionary };

  if (hasIndexedSpecialSal(specialSals.cheonul)) supportive.push('천을귀인');
  if (hasIndexedSpecialSal(specialSals.cheonduk)) supportive.push('천덕귀인');
  if (hasIndexedSpecialSal(specialSals.wolduk)) supportive.push('월덕귀인');
  if (hasIndexedSpecialSal(specialSals.munchang)) supportive.push('문창귀인');
  if (hasIndexedSpecialSal(specialSals.geumyeo)) supportive.push('금여');
  if (hasIndexedSpecialSal(specialSals.dohwa)) cautionary.push('도화');
  if (hasIndexedSpecialSal(specialSals.yangin)) cautionary.push('양인');
  if (specialSals.baekho) cautionary.push('백호');
  if (specialSals.goegang) cautionary.push('괴강');
  if (specialSals.hongyeom) cautionary.push('홍염');

  return { supportive, cautionary };
}

function buildFiveElementRatio(data: SajuDataV1 | SajuDataV2): ReportEvidenceComputed['fiveElementRatio'] {
  return (Object.keys(data.fiveElements.byElement) as Element[]).reduce<
    NonNullable<ReportEvidenceComputed['fiveElementRatio']>
  >((accumulator, element) => {
    accumulator[element] = data.fiveElements.byElement[element].percentage;
    return accumulator;
  }, {});
}

function buildBaseComputed(data: SajuDataV1 | SajuDataV2): ReportEvidenceComputed {
  return {
    dayMaster: data.dayMaster.stem,
    dayMasterElement: data.dayMaster.element,
    monthPillar: data.pillars.month.ganzi,
    fiveElementRatio: buildFiveElementRatio(data),
    strength: data.strength?.level ?? null,
    strengthScore: data.strength?.score ?? null,
    pattern: data.pattern?.name ?? null,
    tenGod: data.pattern?.tenGod ?? data.tenGods?.dominant ?? null,
    yongsin: data.yongsin
      ? [data.yongsin.primary, ...data.yongsin.secondary].map((symbol) => symbol.label)
      : [],
    currentLuck: compactStrings([
      data.currentLuck?.currentMajorLuck?.ganzi
        ? `${data.currentLuck.currentMajorLuck.ganzi} 대운`
        : null,
      data.currentLuck?.saewoon?.ganzi ? `${data.currentLuck.saewoon.ganzi} 세운` : null,
      data.currentLuck?.wolwoon?.ganzi ? `${data.currentLuck.wolwoon.ganzi} 월운` : null,
    ]),
  };
}

function compactStrings(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

function describeCurrentLuckHighlight(currentLuck: SajuDataV1['currentLuck']) {
  if (!currentLuck) return '';

  const currentMajor = currentLuck.currentMajorLuck?.ganzi;
  const saewoon = currentLuck.saewoon?.ganzi;
  const wolwoon = currentLuck.wolwoon?.ganzi;

  if (currentMajor && saewoon) {
    return `현재는 ${currentMajor} 대운과 ${saewoon} 세운이 함께 작동하므로, 단기 반응보다 앞으로 몇 달의 선택 방향을 먼저 정리하는 편이 좋습니다.`;
  }

  if (currentMajor) {
    return `현재는 ${currentMajor} 대운권에 있어 지금의 선택을 길게 이어질 생활 구조와 함께 보는 것이 좋습니다.`;
  }

  if (saewoon || wolwoon) {
    return `${[saewoon ? `${saewoon} 세운` : null, wolwoon ? `${wolwoon} 월운` : null].filter(Boolean).join('과 ')} 흐름이 들어와 있어 오늘의 판단은 속도보다 균형을 우선하는 편이 안정적입니다.`;
  }

  return '';
}

function getDayMasterSummary(data: SajuDataV1 | SajuDataV2) {
  return data.dayMaster.metaphor
    ? `${data.dayMaster.stem} 일간은 ${data.dayMaster.metaphor} 기운을 지녀 ${data.dayMaster.description ?? getPersonalityFromSajuData(data)}`
    : getPersonalityFromSajuData(data);
}

function getSupportElementLabels(data: SajuDataV1 | SajuDataV2) {
  return getLuckyElementsFromSajuData(data)
    .map((element) => getPublicElementCue(element))
    .join(' · ');
}

function getPublicTenGodTone(data: SajuDataV1 | SajuDataV2) {
  const code = data.pattern?.tenGod ?? data.tenGods?.dominant;
  return code ? PUBLIC_TEN_GOD_TONES[code] : null;
}

function getReportProfile(data: SajuDataV1 | SajuDataV2) {
  const supportElement = getLuckyElementsFromSajuData(data)[0] ?? data.fiveElements.weakest;
  const dominantElement = data.fiveElements.dominant;
  const weakestElement = data.fiveElements.weakest;
  const dayElement = data.dayMaster.element;

  return {
    supportElement,
    dominantElement,
    weakestElement,
    dayElement,
    support: ELEMENT_READING_COPY[supportElement],
    dominant: ELEMENT_READING_COPY[dominantElement],
    weakest: ELEMENT_READING_COPY[weakestElement],
    day: ELEMENT_READING_COPY[dayElement],
    role: getPublicTenGodTone(data),
    strength: data.strength?.level ?? null,
  };
}

function stripTopicLead(value: string) {
  return value
    .replace(/^(연애|재물|일|직장|관계)은\s*/u, '')
    .replace(/[.。]\s*$/u, '')
    .trim();
}

function buildScoreSummary(key: ReportScore['key'], score: number, data: SajuDataV1 | SajuDataV2) {
  const profile = getReportProfile(data);
  const isHigh = score >= 80;
  const isMid = score >= 70;
  const roleLabel = profile.role?.label ?? `${withParticle(profile.day.label, '이', '가')} 먼저 반응하는 편`;
  // 2026-05-15: 같은 점수대 사용자 거의 동일 문장으로 떨어지던 회귀 수정.
  // 일주 ganzi + 격국 이름을 cue 로 prepend 해서 "내 사주 풀이" 인 게 보이도록.
  const dayGanzi = data.pillars.day.ganzi;
  const patternName = data.pattern?.name ?? null;
  const cue = patternName
    ? `${dayGanzi} 일주 · ${patternName}.`
    : `${dayGanzi} 일주.`;

  switch (key) {
    case 'love':
      if (isHigh) return `${cue} 연애는 ${stripTopicLead(profile.support.love)} ${roleLabel}이라 먼저 부드럽게 여는 날입니다.`;
      if (isMid) return `${cue} 연애는 마음 확인보다 ${withParticle(profile.weakest.label, '을', '를')} 채우는 말투가 결정합니다.`;
      return `${cue} 연애는 서두르지 말고 ${stripTopicLead(profile.support.love)}.`;
    case 'wealth':
      if (isHigh) return `${cue} 재물은 ${stripTopicLead(profile.support.wealth)} 손에 남는 돈을 만드는 날입니다.`;
      if (isMid) return `${cue} 재물은 ${profile.dominant.label}보다 ${withParticle(profile.support.label, '을', '를')} 챙길 때 안정됩니다.`;
      return `${cue} 재물은 새 결제보다 고정비, 정산, 금액 확인을 먼저 보세요.`;
    case 'career':
      if (isHigh) return `${cue} 직장은 ${stripTopicLead(profile.support.career)} 성과가 밖으로 보이는 날입니다.`;
      if (isMid) return `${cue} 직장은 ${profile.role?.strength ?? profile.support.gift}을 일의 순서로 옮기세요.`;
      return `${cue} 직장은 넓히기보다 맡은 업무와 보고 순서를 먼저 정리하세요.`;
    case 'relationship':
      if (isHigh) return `${cue} 관계는 ${stripTopicLead(profile.support.relationship)} 먼저 말을 여는 날입니다.`;
      if (isMid) return `${cue} 관계는 말의 순서와 확인을 맞추는 날입니다.`;
      return `${cue} 관계는 바로 결론내지 말고 거리와 말을 천천히 맞추세요.`;
    case 'overall':
    default:
      if (isHigh) return `${cue} ${profile.dominant.gift}이 살아 있어 ${profile.support.action}`;
      if (isMid) return `${cue} ${roleLabel}이라 ${profile.support.action}`;
      return `${cue} ${withParticle(profile.weakest.label, '이', '가')} 비기 쉬워 오늘은 ${profile.support.action}`;
  }
}

function buildSummaryHighlights(
  data: SajuDataV1 | SajuDataV2,
  topic: FocusTopic,
  _scoreMap: Record<ReportScore['key'], number>,
  dominant: string,
  weakest: string,
  _evidenceCards: ReportEvidenceCard[]
) {
  const profile = getReportProfile(data);
  const supportLabels = getSupportElementLabels(data) || profile.support.label || dominant;
  const currentLuck = describeCurrentLuckHighlight(data.currentLuck);
  const roleLine = profile.role
    ? `${profile.role.label}이라 ${profile.role.strength}이 오늘 선택에 먼저 드러납니다.`
    : `${withParticle(profile.day.label, '으로', '로')} 먼저 반응하는 편이라, 하루의 첫 선택이 중요합니다.`;
  const balanceLine = `${withParticle(profile.dominant.label, '은', '는')} 충분히 살아 있고 ${withParticle(profile.weakest.label, '은', '는')} 비기 쉬워, ${withParticle(supportLabels, '을', '를')} 챙길수록 하루가 덜 흔들립니다.`;
  const cautionLine = `${withParticle(weakest || profile.weakest.label, '이', '가')} 약해질 때는 ${profile.weakest.avoid}`;

  switch (topic) {
    case 'love':
      return compactStrings([
        roleLine,
        `연애는 상대가 답하기 쉬운 말부터 시작하면 마음의 온도가 더 부드럽게 맞춰집니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'wealth':
      return compactStrings([
        balanceLine,
        `재물은 고정비, 정산, 금액 확인처럼 손에 남는 흐름을 먼저 보면 안정됩니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'career':
      return compactStrings([
        roleLine,
        `직장은 업무 순서, 보고 방식, 성과가 보이는 장면을 먼저 정리하면 흐름이 살아납니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'relationship':
      return compactStrings([
        balanceLine,
        `관계는 말의 순서와 확인이 핵심입니다. 가까운 사람일수록 결론보다 안부와 일정 확인이 먼저입니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'today':
    default:
      return compactStrings([
        roleLine,
        balanceLine,
        currentLuck || cautionLine,
      ]).slice(0, 3);
  }
}

function buildStrengthEvidenceCard(data: SajuDataV1 | SajuDataV2): ReportEvidenceCard {
  const strength = data.strength;
  const computed = buildBaseComputed(data);
  const key = 'strength';

  if (!strength) {
    return {
      key,
      label: '강약',
      title: '강약 분석 준비 안내',
      body: '현재 저장본은 seed 데이터라 강약 점수와 근거가 아직 비어 있습니다.',
      details: ['강약 계산이 연결되면 일간을 돕는 힘과 누르는 힘의 균형을 이 카드에서 먼저 보여줍니다.'],
      computed,
      source: getEvidenceSource(key),
      confidence: '참고',
      topicMapping: getEvidenceTopicMapping(key),
    };
  }

  return {
    key,
    label: '강약',
    title: `${strength.level} · ${strength.score}점`,
    body: STRENGTH_INTERPRETATION[strength.level],
    details: strength.rationale.length > 0
      ? strength.rationale.slice(0, 3)
      : ['강약 점수는 계산되었고, 세부 근거 문장은 다음 단계에서 보강됩니다.'],
    plainSummary: `강약 메모: ${strength.level} · ${strength.score}점`,
    technicalSummary: '전문적으로는 월령의 계절 보정, 일간을 돕는 오행, 일간을 소모시키는 오행, 지지의 뿌리를 함께 계산합니다.',
    practicalActions: EVIDENCE_ACTIONS.strength[strength.level],
    explainers: CORE_TERM_EXPLAINERS.strength,
    computed,
    source: getEvidenceSource(key),
    confidence: '확정',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildPatternEvidenceCard(data: SajuDataV1 | SajuDataV2): ReportEvidenceCard {
  const pattern = data.pattern;
  const computed = buildBaseComputed(data);
  const key = 'pattern';

  if (!pattern) {
    return {
      key,
      label: '격국',
      title: '격국 분석 준비 안내',
      body: '격국 필드가 비어 있어도 카드 자리는 유지합니다.',
      details: ['월령과 십신 원칙의 rule-based 계산이 들어오면 격국 근거가 이 카드로 정리됩니다.'],
      computed,
      source: getEvidenceSource(key),
      confidence: '참고',
      topicMapping: getEvidenceTopicMapping(key),
    };
  }

  return {
    key,
    label: '격국',
    title: pattern.tenGod ? `${pattern.name} · ${pattern.tenGod}` : pattern.name,
    body: pattern.tenGod
      ? `${pattern.tenGod}이 어떤 자리와 관계 패턴으로 나타나는지 해석의 첫 바탕으로 봅니다. 쉽게 말하면 삶에서 반복해서 맡게 되는 자리와 반응 방식을 보는 항목입니다.`
      : '월령의 성격을 바탕으로 사주의 큰 구조를 먼저 읽습니다.',
    details: pattern.rationale.length > 0
      ? pattern.rationale.slice(0, 3)
      : ['격국명은 준비되었고 상세 근거 문장은 다음 단계에서 보강됩니다.'],
    plainSummary: pattern.tenGod
      ? `격국 메모: ${pattern.name} · ${pattern.tenGod}`
      : `격국 메모: ${pattern.name}`,
    technicalSummary: '전문적으로는 월지의 주기운과 지장간을 일간 관점의 십신으로 환산해 격국명을 정합니다.',
    practicalActions: EVIDENCE_ACTIONS.pattern,
    explainers: CORE_TERM_EXPLAINERS.pattern,
    computed,
    source: getEvidenceSource(key),
    confidence: '확정',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildYongsinEvidenceCard(data: SajuDataV1 | SajuDataV2): ReportEvidenceCard {
  const yongsin = data.yongsin;
  const computed = buildBaseComputed(data);
  const key = 'yongsin';

  if (!yongsin) {
    return {
      key,
      label: '용신',
      title: '용신 분석 준비 안내',
      body: '용신과 기신 자리가 열려 있습니다.',
      details: ['조후와 억부 판정이 채워지면 보완해야 할 기운과 피해야 할 기운을 분리해 보여줍니다.'],
      computed,
      source: getEvidenceSource(key),
      confidence: '참고',
      topicMapping: getEvidenceTopicMapping(key),
    };
  }

  const yongsinLabel = formatSymbolList([yongsin.primary, ...yongsin.secondary]);
  const kiyshinLabel = yongsin.kiyshin.length > 0 ? formatSymbolList(yongsin.kiyshin) : '기신 미기재';
  const publicYongsinLabel = formatPublicSymbolList([yongsin.primary, ...yongsin.secondary]);
  const publicKiyshinLabel = yongsin.kiyshin.length > 0 ? formatPublicSymbolList(yongsin.kiyshin) : '';
  const candidateDetails = yongsin.candidates?.slice(0, 3).map(formatYongsinCandidateDetail) ?? [];
  const confidenceLabel = yongsin.confidence ?? '중간';

  return {
    key,
    label: '용신',
    title: publicYongsinLabel ? `${withParticle(publicYongsinLabel, '을', '를')} 챙기는 흐름` : `1순위 ${yongsin.primary.label}`,
    body: `${withParticle(publicYongsinLabel || '균형', '을', '를')} 생활 속에서 챙기면 선택이 덜 흔들립니다. ${
      publicKiyshinLabel
        ? `${withParticle(publicKiyshinLabel, '이', '가')} 과해질 때는 속도와 감정을 한 번 늦추세요.`
        : '과속하거나 한쪽으로 치우친 선택은 한 번 더 조절하는 편이 좋습니다.'
    }`,
    details: [
      yongsin.technicalSummary ?? `${yongsin.method} 바탕으로 ${yongsinLabel}을 보완 축으로 봅니다.`,
      `주의해서 볼 기운: ${kiyshinLabel}. 이 기운은 무조건 나쁘다는 뜻이 아니라, 이미 과하거나 균형을 흐릴 때 조절이 필요하다는 뜻입니다.`,
      ...candidateDetails,
      ...yongsin.rationale.slice(0, 2),
    ].filter(Boolean),
    plainSummary: yongsin.plainSummary,
    technicalSummary: yongsin.technicalSummary,
    practicalActions: yongsin.practicalActions,
    explainers: yongsin.terms?.map((term) => ({
      term: term.term,
      hanja: term.hanja,
      meaning: term.meaning,
    })),
    computed,
    source: getEvidenceSource(key),
    confidence: yongsin.method === 'legacy-placeholder' ? '참고' : mapYongsinConfidence(confidenceLabel),
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function mapYongsinConfidence(confidence: YongsinConfidence): ReportEvidenceCard['confidence'] {
  if (confidence === '높음') return '확정';
  if (confidence === '낮음') return '참고';
  return '보통';
}

function formatYongsinCandidateDetail(candidate: SajuYongsinCandidate) {
  const roleLabel = candidate.role === 'primary' ? '1순위' : candidate.role === 'support' ? '보조' : '참고';
  const secondary = candidate.secondary.length > 0 ? `, 보조 ${formatSymbolList(candidate.secondary)}` : '';
  return `${roleLabel} 후보: ${candidate.method} ${candidate.primary.label}${secondary} · ${candidate.score}점`;
}

function formatRelationEvidenceLine(relation: OrreryRelation) {
  const pair = relation.target ? `${relation.source}-${relation.target}` : relation.source;
  return `${pair}: ${relation.label}${relation.detail ? ` · ${relation.detail}` : ''}`;
}

function buildRelationEvidenceCard(data: SajuDataV1 | SajuDataV2): ReportEvidenceCard {
  const key = 'relations';
  const relations = getOrreryExtension(data)?.relations ?? [];
  const tension = relations.find((relation) =>
    ['충', '형', '해', '파', '천간충'].includes(relation.label)
  );
  const support = relations.find((relation) =>
    ['천간합', '육합', '반합', '삼합', '방합'].includes(relation.label)
  );
  const selected = [tension, support, ...relations].filter(
    (relation, index, array): relation is OrreryRelation =>
      Boolean(relation) && array.findIndex((item) => item === relation) === index
  ).slice(0, 4);
  const labels = [...new Set(selected.map((relation) => relation.label))];
  const computed = {
    ...buildBaseComputed(data),
    relations: selected.map(formatRelationEvidenceLine),
  };

  return {
    key,
    label: '합충',
    title: labels.length > 0 ? labels.join(' · ') : '합충 근거 없음',
    body: selected.length > 0
      ? '합충은 명식 안에서 기운이 묶이거나 부딪히는 지점을 보는 근거입니다. 쉽게 말하면 관계, 이동, 결정의 압력이 어디서 생기는지 보는 항목입니다.'
      : '현재 명식에서 화면에 우선 표시할 합충 관계는 아직 확인되지 않았습니다.',
    details: selected.length > 0
      ? selected.map(formatRelationEvidenceLine)
      : ['합충 데이터가 들어오면 어떤 글자끼리 작용하는지 이 카드에 분리해 표시됩니다.'],
    plainSummary: selected.length > 0
      ? `합충 메모: ${labels.join(' · ')}`
      : '합충 메모: 확인된 흐름 없음',
    technicalSummary: '전문적으로는 천간합, 천간충, 육합, 삼합, 방합, 충·형·해·파를 분리해 봅니다.',
    practicalActions: EVIDENCE_ACTIONS.relations,
    explainers: CORE_TERM_EXPLAINERS.relations,
    computed,
    source: getEvidenceSource(key),
    confidence: selected.length > 0 ? '보통' : '참고',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function formatPillarSlot(slot: string) {
  switch (slot) {
    case 'year':
      return '년주';
    case 'month':
      return '월주';
    case 'day':
      return '일주';
    case 'hour':
      return '시주';
    default:
      return slot;
  }
}

function buildGongmangEvidenceCard(data: SajuDataV1 | SajuDataV2): ReportEvidenceCard {
  const key = 'gongmang';
  const gongmang = getOrreryExtension(data)?.gongmang;
  const branches = gongmang?.branches?.join('·') ?? '';
  const slots = gongmang?.pillarSlots.map(formatPillarSlot) ?? [];
  const computed = {
    ...buildBaseComputed(data),
    gongmang: gongmang?.branches ?? [],
  };

  return {
    key,
    label: '공망',
    title: branches ? `${branches} 공망` : '공망 근거 없음',
    body: branches
      ? '공망은 비어 보이거나 지연되기 쉬운 축을 확인해 약속, 일정, 마무리 방식을 조정하는 근거입니다. 쉽게 말하면 기대가 바로 채워지지 않는 자리를 미리 확인하는 항목입니다.'
      : '현재 저장본에서 공망 값은 아직 확인되지 않았습니다.',
    details: slots.length > 0
      ? [`작용 위치: ${slots.join(' · ')}`]
      : ['공망 글자가 특정 주에 닿으면 이곳에 작용 위치가 함께 표시됩니다.'],
    plainSummary: branches
      ? `공망 메모: ${branches} 공망`
      : '공망 메모: 확인된 흐름 없음',
    technicalSummary: '전문적으로는 일주 원칙 공망 글자를 잡고, 그 글자가 년·월·일·시 어느 자리에 닿는지 확인합니다.',
    practicalActions: EVIDENCE_ACTIONS.gongmang,
    explainers: CORE_TERM_EXPLAINERS.gongmang,
    computed,
    source: getEvidenceSource(key),
    confidence: branches ? '보통' : '참고',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildSpecialSalsEvidenceCard(data: SajuDataV1 | SajuDataV2): ReportEvidenceCard {
  const key = 'specialSals';
  const { supportive, cautionary } = getSpecialSalGroups(data);
  const names = [...supportive, ...cautionary];
  const details = compactStrings([
    supportive.length > 0 ? `도움: ${supportive.join(' · ')}` : null,
    cautionary.length > 0 ? `주의: ${cautionary.join(' · ')}` : null,
  ]);
  const computed = {
    ...buildBaseComputed(data),
    specialSals: names,
  };

  return {
    key,
    label: '신살',
    title: names.length > 0 ? names.slice(0, 5).join(' · ') : '주요 신살 없음',
    body: names.length > 0
      ? '신살은 도움을 받는 통로와 주의해야 할 속도를 함께 보는 보조 근거입니다. 쉽게 말하면 이 명식에서 눈에 띄는 보너스 표지와 주의 표지를 나누어 보는 항목입니다.'
      : '현재 명식에서 우선 표시할 주요 신살은 아직 확인되지 않았습니다.',
    details: details.length > 0 ? details : ['신살 데이터가 들어오면 도움/주의 흐름을 나누어 표시합니다.'],
    plainSummary: names.length > 0
      ? `신살 메모: ${names.slice(0, 5).join(' · ')}`
      : '신살 메모: 주요 표지 없음',
    technicalSummary: '전문적으로는 일간·일지·연지 등을 바탕으로 귀인, 도화, 양인, 백호 같은 보조 표지를 대조합니다.',
    practicalActions: EVIDENCE_ACTIONS.specialSals,
    explainers: CORE_TERM_EXPLAINERS.specialSals,
    computed,
    source: getEvidenceSource(key),
    confidence: '참고',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildEvidenceCards(data: SajuDataV1 | SajuDataV2): ReportEvidenceCard[] {
  return [
    buildStrengthEvidenceCard(data),
    buildPatternEvidenceCard(data),
    buildYongsinEvidenceCard(data),
    buildRelationEvidenceCard(data),
    buildGongmangEvidenceCard(data),
    buildSpecialSalsEvidenceCard(data),
  ];
}

function describeTenGodNarrative(tenGods: SajuDataV1['tenGods']) {
  if (!tenGods?.dominant) return '';
  return TEN_GOD_INTERPRETATION[tenGods.dominant];
}

function formatElementDistribution(data: SajuDataV1 | SajuDataV2) {
  const dominant = data.fiveElements.byElement[data.fiveElements.dominant];
  const weakest = data.fiveElements.byElement[data.fiveElements.weakest];
  // (B) 첫 등장 의미 병기 — 우세 기운만 "토 기운(담아냄·안정)" 식으로 한 번.
  //   "X 기운"은 ㄴ받침으로 끝나 의미 괄호 뒤 조사는 항상 이/은/을 형으로 고정.
  const dominantLabel = getPublicElementCueWithMeaning(data.fiveElements.dominant);
  const weakestLabel = getPublicElementCue(data.fiveElements.weakest);

  return `${dominantLabel}이 ${dominant.percentage}%로 가장 앞에 있고, ${withParticle(weakestLabel, '은', '는')} ${weakest.percentage}%라 이 빈칸을 어떻게 채우느냐가 오늘 선택의 차이를 만듭니다.`;
}

function getPublicElementCue(element: Element) {
  return ELEMENT_INFO[element].name;
}

// 첫 등장 의미 병기 — "토 기운(담아냄·안정)". naming-policy §2: 섹션당 한 번만.
function getPublicElementCueWithMeaning(element: Element) {
  return `${ELEMENT_INFO[element].name}(${ELEMENT_MEANING[element]})`;
}

function getElementFromSymbolLabel(value: string | null | undefined): Element | null {
  const matched = (value ?? '').match(/[목화토금수]/u)?.[0] as Element | undefined;
  return matched ?? null;
}

function formatPublicSymbolList(symbols: SajuSymbolRef[]) {
  return [
    ...new Set(
      symbols
        .map((symbol) => getElementFromSymbolLabel(symbol.label))
        .filter((element): element is Element => Boolean(element))
        .map((element) => getPublicElementCue(element))
    ),
  ].join(' · ');
}

function buildScores(input: BirthInput, data: SajuDataV1 | SajuDataV2): ReportScore[] {
  const entries = getElementEntries(data);
  const strongest = entries[0]?.[1] ?? 0;
  const weakest = entries.at(-1)?.[1] ?? 0;
  const spread = strongest - weakest;
  const uniqueCount = entries.filter(([, count]) => count > 0).length;
  const hourBonus = data.pillars.hour ? 4 : 0;
  const datePulse = ((input.day + input.month) % 7) - 3;
  const yearPulse = (input.year % 6) - 2;
  const balanceBase = 66 + uniqueCount * 3 - spread * 4 + hourBonus;

  const overall = clampScore(balanceBase + datePulse);
  const love = clampScore(balanceBase + datePulse + (uniqueCount >= 4 ? 4 : 1) + (input.day % 5) - 2);
  const wealth = clampScore(balanceBase + yearPulse + strongest * 2 - weakest);
  const career = clampScore(balanceBase + hourBonus + (input.month % 5) - 1 + (strongest >= 2 ? 3 : 0));
  const relations = getOrreryExtension(data)?.relations ?? [];
  const supportRelations = relations.filter((relation) =>
    ['천간합', '육합', '반합', '삼합', '방합'].includes(relation.label)
  ).length;
  const tensionRelations = relations.filter((relation) =>
    ['충', '형', '해', '파', '천간충'].includes(relation.label)
  ).length;
  const relationship = clampScore(
    balanceBase +
      (uniqueCount >= 4 ? 3 : 0) +
      Math.min(supportRelations, 2) * 3 -
      Math.min(tensionRelations, 2) * 2 +
      ((input.year + input.day) % 5) -
      2
  );

  const summaries: Record<ReportScore['key'], string> = {
    overall: buildScoreSummary('overall', overall, data),
    love: buildScoreSummary('love', love, data),
    wealth: buildScoreSummary('wealth', wealth, data),
    career: buildScoreSummary('career', career, data),
    relationship: buildScoreSummary('relationship', relationship, data),
  };

  return [
    { key: 'overall', label: SCORE_LABELS.overall, score: overall, summary: summaries.overall },
    { key: 'love', label: SCORE_LABELS.love, score: love, summary: summaries.love },
    { key: 'wealth', label: SCORE_LABELS.wealth, score: wealth, summary: summaries.wealth },
    { key: 'career', label: SCORE_LABELS.career, score: career, summary: summaries.career },
    { key: 'relationship', label: SCORE_LABELS.relationship, score: relationship, summary: summaries.relationship },
  ];
}

function getHeadline(
  topic: FocusTopic,
  scoreMap: Record<ReportScore['key'], number>,
  data: SajuDataV1 | SajuDataV2
) {
  const dominantCue = getPublicElementCue(data.fiveElements.dominant);
  const weakestCue = getPublicElementCue(data.fiveElements.weakest);
  const supportCue = getPublicElementCue(
    getLuckyElementsFromSajuData(data)[0] ?? data.fiveElements.weakest
  );

  switch (topic) {
    case 'love':
      return scoreMap.love >= 78
        ? `${withParticle(dominantCue, '이', '가')} 살아 있어, 연애는 먼저 분위기를 여는 쪽이 좋습니다.`
        : `${weakestCue} 보완이 필요해, 연애는 속도보다 말의 온도가 중요합니다.`;
    case 'wealth':
      return scoreMap.wealth >= 78
        ? `${withParticle(dominantCue, '이', '가')} 강해, 돈은 작은 기회를 바로 정리하는 감각이 중요합니다.`
        : `${weakestCue} 보완이 필요해, 돈은 새 지출보다 기존 흐름 정리가 먼저입니다.`;
    case 'career':
      return scoreMap.career >= 78
        ? `${withParticle(dominantCue, '이', '가')} 살아 있어, 일은 제안과 피드백에 힘이 붙습니다.`
        : `${supportCue} 보완이 필요해, 일은 속도보다 완성도를 먼저 챙기세요.`;
    case 'relationship':
      return scoreMap.relationship >= 76
        ? `${withParticle(dominantCue, '이', '가')} 따뜻하게 풀려, 짧은 안부가 관계를 바꿉니다.`
        : `${weakestCue} 보완이 필요해, 관계는 거리와 말 순서를 맞추는 게 핵심입니다.`;
    case 'today':
    default:
      return scoreMap.overall >= 78
        ? `${withParticle(dominantCue, '이', '가')} 강해, 오늘은 먼저 움직일수록 체감이 빠릅니다.`
        : `${weakestCue} 보완이 필요해, 오늘은 균형을 잡을수록 편해집니다.`;
  }
}

function buildTopicActions(
  data: SajuDataV1 | SajuDataV2,
  topic: FocusTopic,
  supportElements: Element[],
  scoreMap: Record<ReportScore['key'], number>,
  _evidenceCards: ReportEvidenceCard[]
) {
  const rule = getTopicInterpretationRule(topic);
  const scoreBand = getInterpretationScoreBand(topic, scoreMap);
  const profile = getReportProfile(data);
  const bestTone = getElementTone(supportElements[0] ?? data.fiveElements.dominant);
  const cautionTone = getElementTone(data.fiveElements.weakest);
  const supportLabel = profile.support.label;
  const weaknessLabel = profile.weakest.label;
  const currentLuck = describeCurrentLuckHighlight(data.currentLuck);

  switch (topic) {
    case 'love':
      return {
        primaryAction: {
          title: rule.actionTitles[scoreBand],
          description: compactStrings([
            `${profile.role?.label ?? `${withParticle(supportLabel, '이', '가')} 필요한 흐름`}이라 연애에서는 말의 길이보다 온도가 먼저입니다.`,
            profile.support.love,
            '오늘은 고백처럼 큰 결론보다 상대가 편하게 답할 수 있는 한 문장이 더 잘 맞습니다.',
          ]).join(' '),
        },
        cautionAction: {
          title: rule.cautionTitles[scoreBand],
          description: compactStrings([
            `${withParticle(weaknessLabel, '이', '가')} 비면 상대 반응을 내 마음대로 해석하기 쉽습니다.`,
            '답을 재촉하거나 시험하는 말보다 약속 시간과 말의 온도를 부드럽게 맞추세요.',
          ]).join(' '),
        },
      };
    case 'wealth':
      return {
        primaryAction: {
          title: rule.actionTitles[scoreBand],
          description: compactStrings([
            `${withParticle(supportLabel, '이', '가')} 살아날수록 돈의 흐름이 안정됩니다.`,
            '오늘은 새 투자보다 고정비, 미뤄둔 정산, 결제 예정 금액을 먼저 확인하세요.',
            `${profile.role?.caution ?? '급하게 넓히는 선택'}만 줄이면 손에 남는 돈이 달라집니다.`,
          ]).join(' '),
        },
        cautionAction: {
          title: rule.cautionTitles[scoreBand],
          description: compactStrings([
            `${withParticle(weaknessLabel, '이', '가')} 약해질 때는 만족보다 피로가 남는 소비가 늘 수 있습니다.`,
            '가격 비교 없이 결제하거나 지인 제안만 믿고 움직이는 선택은 오늘 한 번 더 보류하세요.',
          ]).join(' '),
        },
      };
    case 'career':
      return {
        primaryAction: {
          title: rule.actionTitles[scoreBand],
          description: compactStrings([
            `${withParticle(supportLabel, '을', '를')} 업무에 살리면 일의 순서가 또렷해집니다.`,
            '오늘은 할 일을 세 단계로 나누고, 보고나 제안은 결론을 먼저 말한 뒤 근거를 붙이세요.',
            `${profile.role?.strength ?? '내가 잘하는 방식'}을 성과로 보이게 만드는 쪽이 좋습니다.`,
          ]).join(' '),
        },
        cautionAction: {
          title: rule.cautionTitles[scoreBand],
          description: compactStrings([
            currentLuck || '오늘은 단기 반응보다 선택의 방향을 먼저 정리하는 편이 좋습니다.',
            '여러 일을 동시에 넓히기보다 누가 무엇을 언제까지 맡는지 먼저 적어두세요.',
          ]).join(' '),
        },
      };
    case 'relationship':
      return {
        primaryAction: {
          title: rule.actionTitles[scoreBand],
          description: compactStrings([
            `관계는 ${withParticle(supportLabel, '을', '를')} 살린 짧은 확인이 좋습니다.`,
            '가족, 친구, 동료에게는 큰 대화보다 안부, 감사, 일정 확인처럼 부담이 낮은 말이 먼저입니다.',
            '말의 순서와 확인을 맞추면 오해가 줄어듭니다.',
          ]).join(' '),
        },
        cautionAction: {
          title: rule.cautionTitles[scoreBand],
          description: compactStrings([
            `${withParticle(weaknessLabel, '이', '가')} 흔들리면 말의 의도보다 감정의 잔상이 커질 수 있습니다.`,
            '오늘은 “네가 항상” 같은 단정 대신 사실과 감정을 나눠 말하세요.',
          ]).join(' '),
        },
      };
    case 'today':
    default:
      return {
        primaryAction: {
          title: rule.actionTitles[scoreBand],
          description: compactStrings([
            `${profile.role?.label ?? `${withParticle(bestTone.label, '이', '가')} 중요한 흐름`}이라 오늘은 첫 행동을 작게 정하는 게 좋습니다.`,
            bestTone.move,
            profile.support.action,
          ]).join(' '),
        },
        cautionAction: {
          title: rule.cautionTitles[scoreBand],
          description: compactStrings([
            `${withParticle(weaknessLabel, '이', '가')} 흔들리면 같은 고민을 오래 붙잡기 쉽습니다.`,
            cautionTone.avoid,
            '오늘은 꼭 필요한 일 하나만 고르면 충분합니다.',
          ]).join(' '),
        },
      };
  }
}

function buildQuestionFocusInsight(
  topic: FocusTopic,
  supportLabels: string,
  dominant: string,
  evidenceCards: ReportEvidenceCard[]
): ReportInsight {
  const rule = getTopicInterpretationRule(topic);
  const leadEvidence = selectEvidenceCard(evidenceCards, rule.evidencePriority);
  const leadEvidenceSnippet = simplifySajuCopy(toEvidenceSnippet(leadEvidence));
  const supportText = supportLabels || dominant;

  switch (topic) {
    case 'love':
      return {
        eyebrow: '연애 포커스',
        title: `${withParticle(supportText, '으로', '로')} 말의 온도를 조절하는 날입니다.`,
        body: compactStrings([
          leadEvidenceSnippet,
          '좋아하는 마음을 크게 증명하려 하기보다, 상대가 받아들이기 쉬운 말투와 속도를 먼저 고르는 편이 좋습니다. 오늘의 연애운은 결론보다 분위기 회복에 더 민감합니다.',
        ]).join(' '),
      };
    case 'wealth':
      return {
        eyebrow: '재물 포커스',
        title: `${withParticle(supportText, '을', '를')} 돈의 구조 정리에 쓰면 좋습니다.`,
        body: compactStrings([
          leadEvidenceSnippet,
          '수입을 크게 늘리는 선택보다 반복 지출, 미뤄둔 정산, 약속된 금액을 확인하는 쪽이 오늘 재물운을 안정시킵니다. 작은 정리가 다음 기회를 잡는 기반이 됩니다.',
        ]).join(' '),
      };
    case 'career':
      return {
        eyebrow: '직장 포커스',
        title: `${withParticle(supportText, '을', '를')} 역할 정리와 피드백에 쓰세요.`,
        body: compactStrings([
          leadEvidenceSnippet,
          '오늘의 직장운은 무리한 확장보다 정확한 전달에서 힘이 납니다. 보고, 제안, 일정 조율은 핵심을 먼저 말하고 세부를 붙이는 방식이 유리합니다.',
        ]).join(' '),
      };
    case 'relationship':
      return {
        eyebrow: '관계 포커스',
        title: `${withParticle(supportText, '으로', '로')} 가까운 사람과의 거리감을 조율합니다.`,
        body: compactStrings([
          leadEvidenceSnippet,
          '가족, 친구, 동료와의 관계에서는 맞고 틀림보다 서로의 입장을 확인하는 과정이 중요합니다. 짧은 확인과 부드러운 선 긋기가 오해를 줄입니다.',
        ]).join(' '),
      };
    case 'today':
    default:
      return {
        eyebrow: '오늘 포커스',
        title: `${withParticle(FOCUS_TOPIC_META[topic].label, '은', '는')} ${withParticle(supportText, '을', '를')} 먼저 활용하는 것이 좋습니다.`,
        body: compactStrings([
          leadEvidenceSnippet,
          `${FOCUS_TOPIC_META[topic].subtitle} 먼저 체감되는 장점을 살리고, 조급함보다는 반복 가능한 행동으로 연결하는 편이 좋습니다.`,
        ]).join(' '),
      };
  }
}

function buildInsights(data: SajuDataV1 | SajuDataV2, topic: FocusTopic, evidenceCards: ReportEvidenceCard[]): ReportInsight[] {
  const supportElements = getLuckyElementsFromSajuData(data);
  const supportLabels = supportElements.map((element) => getPublicElementCue(element)).join(' · ');
  const dominant = getPublicElementCue(data.fiveElements.dominant);
  const weakest = getPublicElementCue(data.fiveElements.weakest);
  const roleTone = getPublicTenGodTone(data);

  const insights: ReportInsight[] = [
    {
      eyebrow: '타고난 반응',
      title: roleTone?.label ?? `${withParticle(getPublicElementCue(data.dayMaster.element), '이', '가')} 먼저 반응합니다.`,
      body: `${getPersonalityFromSajuData(data)} ${roleTone ? `${roleTone.strength}이 장점으로 살아나지만, ${roleTone.caution}가 필요합니다.` : '오늘은 장점을 크게 쓰기보다 생활 속에서 바로 할 수 있는 선택으로 옮기는 편이 좋습니다.'}`,
    },
    {
      eyebrow: '내 안의 균형',
      title: `${withParticle(dominant, '은', '는')} 앞서고 ${withParticle(weakest, '은', '는')} 비기 쉬운 흐름입니다.`,
      body: `${formatElementDistribution(data)} ${withParticle(dominant, '은', '는')} 장점으로 살리고, ${withParticle(weakest, '은', '는')} 생활 속에서 의식적으로 채우면 흐름이 안정됩니다.`,
    },
    buildQuestionFocusInsight(topic, supportLabels, dominant, evidenceCards),
  ];

  if (data.tenGods?.dominant) {
    insights.push({
      eyebrow: '반복되는 모습',
      title: PUBLIC_TEN_GOD_TONES[data.tenGods.dominant].label,
      body: describeTenGodNarrative(data.tenGods),
    });
  }

  return insights;
}

function getGanziElements(ganzi?: string | null) {
  if (!ganzi) return [];

  const [gan, ji] = Array.from(ganzi);
  const elements = [GAN_ELEMENT_MAP[gan], JI_ELEMENT_MAP[ji]].filter(
    (element): element is Element => Boolean(element)
  );

  return [...new Set(elements)];
}

function formatElementLabels(elements: Element[]) {
  return elements.map((element) => getPublicElementCue(element)).join(' · ');
}

function formatLuckWindow(cycle: NonNullable<SajuDataV1['currentLuck']>['currentMajorLuck']) {
  if (!cycle) return '';
  if (cycle.startAge !== null && cycle.endAge !== null) return `${cycle.startAge}-${cycle.endAge}세`;
  if (cycle.startAge !== null) return `${cycle.startAge}세 이후`;
  if (cycle.endAge !== null) return `${cycle.endAge}세 이전`;
  return '';
}

function describeTopicLuckFocus(topic: FocusTopic) {
  switch (topic) {
    case 'love':
      return '연애에서는 감정의 확신보다 말의 온도와 반복되는 관계 패턴을 먼저 보세요.';
    case 'wealth':
      return '재물에서는 새 기회보다 현금 흐름, 지출 구조, 계약 조건을 먼저 확인하는 쪽이 안전합니다.';
    case 'career':
      return '직장에서는 맡을 역할과 책임 범위를 선명하게 잡을수록 운이 실제 성과로 이어집니다.';
    case 'relationship':
      return '관계에서는 가까운 사람과의 거리감, 말의 순서, 약속의 명확성이 핵심입니다.';
    case 'today':
    default:
      return '오늘은 큰 결론보다 지금 반복하면 앞으로 편해질 선택을 먼저 잡는 것이 좋습니다.';
  }
}

function buildMonthlyLuckReading(data: SajuDataV1 | SajuDataV2, topic: FocusTopic) {
  const wolwoon = data.currentLuck?.wolwoon;
  const monthlyElements = getGanziElements(wolwoon?.ganzi);
  const supportElements = getLuckyElementsFromSajuData(data);
  const supportMatch = monthlyElements.find((element) => supportElements.includes(element));
  const dominant = data.fiveElements.dominant;
  const mainElement = monthlyElements[0] ?? supportElements[0] ?? dominant;
  const mainGuide = LUCK_ELEMENT_GUIDE[mainElement];
  const supportLabel = supportMatch ? getPublicElementCue(supportMatch) : null;

  return {
    headline: wolwoon?.ganzi
      ? `${wolwoon.ganzi} 월운은 ${formatElementLabels(monthlyElements) || mainGuide.theme} 흐름을 건드립니다.`
      : `${getPublicElementCue(mainElement)} 중심 루틴을 만들면 흐름이 붙습니다.`,
    body: wolwoon?.ganzi
      ? `${wolwoon.ganzi} 월운은 ${withParticle(mainGuide.theme, '을', '를')} 현실에서 점검하게 합니다. ${supportLabel ? `특히 ${withParticle(supportLabel, '이', '가')} 필요 흐름과 맞아 이번 달은 약한 부분을 실제 습관으로 채우기 좋습니다.` : mainGuide.chance} ${describeTopicLuckFocus(topic)}`
      : `이번 달은 ${withParticle(mainGuide.theme, '을', '를')} 정리하는 흐름으로 읽습니다. 중요한 선택은 한 번에 몰지 말고 주 단위로 나눠 확인하는 편이 안정적입니다.`,
    points: compactStrings([
      `기회: ${mainGuide.chance}`,
      `주의: ${mainGuide.caution}`,
      `이번 달 실행: ${mainGuide.action}`,
    ]),
  };
}

function buildMajorLuckReading(data: SajuDataV1 | SajuDataV2, topic: FocusTopic) {
  const currentMajor = data.currentLuck?.currentMajorLuck;
  const cautionTone = getElementTone(data.fiveElements.weakest);

  if (!currentMajor) {
    return {
      headline: `${cautionTone.label} 보완이 성과 차이를 만듭니다.`,
      body: cautionTone.avoid,
      points: [
        '성별 또는 생시 정보가 채워지면 현재 대운 구간을 더 정확히 계산합니다.',
        '긴 흐름이 비어 있을 때는 현재 균형과 이번 달 흐름을 먼저 봅니다.',
      ],
    };
  }

  const majorElements = getGanziElements(currentMajor.ganzi);
  const supportElements = getLuckyElementsFromSajuData(data);
  const supportMatches = majorElements.filter((element) => supportElements.includes(element));
  const dominantMatches = majorElements.filter((element) => element === data.fiveElements.dominant);
  const mainElement = supportMatches[0] ?? majorElements[0] ?? data.fiveElements.dominant;
  const mainGuide = LUCK_ELEMENT_GUIDE[mainElement];
  const window = formatLuckWindow(currentMajor);
  const supportText =
    supportMatches.length > 0
      ? `${withParticle(formatElementLabels(supportMatches), '이', '가')} 필요 흐름과 맞아, 이 긴 흐름은 약한 부분을 채우는 방향으로 쓰기 좋습니다.`
      : dominantMatches.length > 0
        ? `${withParticle(formatElementLabels(dominantMatches), '이', '가')} 이미 강한 쪽을 다시 자극하므로, 성과는 빠르지만 과속과 피로를 조심해야 합니다.`
        : `${withParticle(formatElementLabels(majorElements), '이', '가')} 새 배경으로 들어와, 익숙한 방식보다 역할과 환경을 조정하는 선택이 중요합니다.`;

  return {
    headline: `${currentMajor.ganzi} 대운은 ${withParticle(mainGuide.theme, '을', '를')} 장기 과제로 올립니다.`,
    body: compactStrings([
      window ? `${window} 구간의 ${currentMajor.ganzi} 대운입니다.` : `${currentMajor.ganzi} 대운입니다.`,
      supportText,
      `${mainGuide.chance} ${describeTopicLuckFocus(topic)}`,
    ]).join(' '),
    points: compactStrings([
      `기회: ${mainGuide.chance}`,
      `주의: ${mainGuide.caution}`,
      `장기 실행: ${mainGuide.action}`,
    ]),
  };
}

function buildTimeline(data: SajuDataV1 | SajuDataV2, topic: FocusTopic): ReportTimelineItem[] {
  const bestTone = getElementTone(
    getLuckyElementsFromSajuData(data)[0] ?? data.fiveElements.dominant
  );
  const wolwoon = data.currentLuck?.wolwoon;
  const monthlyLuck = buildMonthlyLuckReading(data, topic);
  const majorLuck = buildMajorLuckReading(data, topic);

  return [
    {
      label: '오늘',
      headline: `${withParticle(bestTone.cue, '을', '를')} 먼저 살리는 날`,
      body: `${FOCUS_TOPIC_META[topic].subtitle} 오늘은 ${bestTone.move}${wolwoon?.ganzi ? ` 현재 월운은 ${wolwoon.ganzi}라 작은 말투와 생활 리듬의 조절이 실제 체감 차이로 이어집니다.` : ''}`,
      points: [
        `먼저 할 일: ${bestTone.move}`,
        `피할 흐름: ${getElementTone(data.fiveElements.weakest).avoid}`,
      ],
    },
    {
      label: '이번 달',
      headline: monthlyLuck.headline,
      body: monthlyLuck.body,
      points: monthlyLuck.points,
    },
    {
      label: '대운 흐름',
      headline: majorLuck.headline,
      body: majorLuck.body,
      points: majorLuck.points,
    },
  ];
}

function toMonth(value: number) {
  return ((value - 1) % 12 + 12) % 12 + 1;
}

function toDay(value: number) {
  return ((value - 1) % 28 + 28) % 28 + 1;
}

function formatDateChip(month: number, day: number) {
  return `${month}월 ${day}일`;
}

function buildDates(input: BirthInput, data: SajuDataV1 | SajuDataV2) {
  const entries = getElementEntries(data);
  const strongest = entries[0]?.[1] ?? 0;
  const weakest = entries.at(-1)?.[1] ?? 0;
  const hourSeed = input.hour ?? 6;

  const luckySeed = input.day + strongest + hourSeed;
  const cautionSeed = input.month + weakest + hourSeed;

  return {
    luckyDates: [
      formatDateChip(toMonth(input.month + 1), toDay(luckySeed + 3)),
      formatDateChip(toMonth(input.month + 2), toDay(luckySeed + 11)),
    ],
    cautionDates: [
      formatDateChip(toMonth(input.month + 1), toDay(cautionSeed + 5)),
      formatDateChip(toMonth(input.month + 3), toDay(cautionSeed + 9)),
    ],
  };
}

function getPublicEvidenceLabel(key: ReportEvidenceKey) {
  switch (key) {
    case 'strength':
      return '균형';
    case 'pattern':
      return '역할 흐름';
    case 'yongsin':
      return '보완 힌트';
    case 'relations':
      return '관계 변화';
    case 'gongmang':
      return '확인할 빈자리';
    case 'specialSals':
      return '보조 신호';
    default:
      return '세부 단서';
  }
}

function getPublicEvidenceTitle(card: ReportEvidenceCard) {
  switch (card.key) {
    case 'strength':
      return '기운이 어떻게 쓰이는지 봅니다';
    case 'pattern':
      return '반복해서 맡게 되는 역할을 봅니다';
    case 'yongsin':
      return '균형을 잡는 힌트를 봅니다';
    case 'relations':
      return '관계와 변화가 생기는 지점을 봅니다';
    case 'gongmang':
      return '확인이 필요한 빈자리를 봅니다';
    case 'specialSals':
      return '보조로 참고할 신호를 봅니다';
    default:
      return simplifySajuCopy(card.title);
  }
}

function toPublicEvidenceCard(card: ReportEvidenceCard): ReportEvidenceCard {
  return {
    ...card,
    label: getPublicEvidenceLabel(card.key),
    title: getPublicEvidenceTitle(card),
    body: limitSajuSentences(card.body, 2),
    details: simplifySajuCopyList(card.details, 3),
    practicalActions: card.practicalActions
      ? simplifySajuCopyList(card.practicalActions, 4)
      : card.practicalActions,
    plainSummary: card.plainSummary ? simplifySajuCopy(card.plainSummary) : card.plainSummary,
    technicalSummary: card.technicalSummary
      ? simplifySajuCopy(card.technicalSummary)
      : card.technicalSummary,
  };
}

function toPublicReport(report: SajuReport): SajuReport {
  return {
    ...report,
    headline: simplifySajuCopy(report.headline),
    dayMasterSummary: limitSajuSentences(report.dayMasterSummary, 2),
    summary: limitSajuSentences(report.summary, 3),
    summaryHighlights: simplifySajuCopyList(report.summaryHighlights, 3),
    evidenceCards: report.evidenceCards.map(toPublicEvidenceCard),
    scores: report.scores.map((score) => ({
      ...score,
      summary: limitSajuSentences(score.summary, 1),
    })),
    primaryAction: {
      ...report.primaryAction,
      title: simplifySajuCopy(report.primaryAction.title),
      description: limitSajuSentences(report.primaryAction.description, 2),
    },
    cautionAction: {
      ...report.cautionAction,
      title: simplifySajuCopy(report.cautionAction.title),
      description: limitSajuSentences(report.cautionAction.description, 2),
    },
    insights: report.insights.map((insight) => ({
      ...insight,
      eyebrow: simplifySajuCopy(insight.eyebrow),
      title: simplifySajuCopy(insight.title),
      body: limitSajuSentences(insight.body, 2),
    })),
    timeline: report.timeline.map((item) => ({
      ...item,
      headline: simplifySajuCopy(item.headline),
      body: limitSajuSentences(item.body, 2),
      points: item.points ? simplifySajuCopyList(item.points, 2) : item.points,
    })),
  };
}

export function normalizeFocusTopic(value?: string): FocusTopic {
  if (!value) return 'today';
  if (value in FOCUS_TOPIC_META) return value as FocusTopic;
  return 'today';
}

export function buildSajuReport(
  input: BirthInput,
  data: SajuDataV1 | SajuDataV2,
  topicValue?: string
): SajuReport {
  const focusTopic = normalizeFocusTopic(topicValue);
  const meta = FOCUS_TOPIC_META[focusTopic];
  const scores = buildScores(input, data);
  const scoreMap = Object.fromEntries(scores.map((score) => [score.key, score.score])) as Record<
    ReportScore['key'],
    number
  >;
  const focusScoreKey = TOPIC_SCORE_KEYS[focusTopic];
  const supportElements = getLuckyElementsFromSajuData(data);
  const dominant = ELEMENT_INFO[data.fiveElements.dominant].name.split(' ')[0];
  const weakest = ELEMENT_INFO[data.fiveElements.weakest].name.split(' ')[0];
  const evidenceCards = buildEvidenceCards(data);
  const { primaryAction, cautionAction } = buildTopicActions(
    data,
    focusTopic,
    supportElements,
    scoreMap,
    evidenceCards
  );
  const { luckyDates, cautionDates } = buildDates(input, data);

  const dayMasterSummary = getDayMasterSummary(data);
  const summaryHighlights = buildSummaryHighlights(
    data,
    focusTopic,
    scoreMap,
    dominant,
    weakest,
    evidenceCards
  );

  return toPublicReport({
    focusTopic,
    focusLabel: meta.label,
    focusBadge: meta.badge,
    focusScoreKey,
    headline: getHeadline(focusTopic, scoreMap, data),
    dayMasterSummary,
    summary: compactStrings([dayMasterSummary, ...summaryHighlights]).join(' '),
    summaryHighlights,
    evidenceCards,
    scores,
    primaryAction,
    cautionAction,
    insights: buildInsights(data, focusTopic, evidenceCards),
    timeline: buildTimeline(data, focusTopic),
    luckyDates,
    cautionDates,
    supportElements,
  });
}

function formatSymbolList(symbols: SajuSymbolRef[]) {
  return symbols.map((symbol) => symbol.label).join(' · ');
}
