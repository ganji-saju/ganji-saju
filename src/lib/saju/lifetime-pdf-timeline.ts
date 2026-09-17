import { Solar } from 'lunar-typescript';
import type { ReadingRecord } from './readings';
import type { Branch, Element, Stem } from './types';
import type { SajuLifetimeReport } from '@/domain/saju/report/lifetime-types';
import type { TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import { getBranchPrimaryTenGod, getTenGodHangul } from '@/domain/saju/engine/orrery-adapter';
import { BRANCH_TO_ELEMENT as BRANCH_ELEMENT, STEM_TO_ELEMENT as STEM_ELEMENT, isBranchChung, isYukhap } from '@/lib/today-fortune/iljin-rules';
import { ganziToKorean } from './terminology';
import { yearToGanji } from './year-ganji';

/** Age is the calendar year minus the original solar birth year, not birthday age. */
export interface LifetimePdfYear {
  year: number;
  age: number;
  ganzi: string;
  label: string;
  theme: string;
  majorLuckLabel: string;
  phase: string;
  overview: string;
  learningCareer: string;
  relationships: string;
  resources: string;
  wellbeing: string;
  action: string;
  isCurrent: boolean;
}

export interface LifetimePdfCycle {
  index: number;
  startYear: number;
  endYear: number;
  startAge: number;
  endAge: number;
  ganzi: string;
  label: string;
  title: string;
  overview: string;
  mental: string;
  relationships: string;
  resources: string;
  actions: string[];
  transition: { before: string; entry: string; after: string };
  isCurrent: boolean;
}

export interface LifetimePdfTimeline {
  years: LifetimePdfYear[];
  cycles: LifetimePdfCycle[];
  notes: string[];
}

type GodGuide = {
  theme: string;
  meaning: string;
  learning: string;
  relation: string;
  resource: string;
  mental: string;
  action: string;
};

// These are interpretation rules, not event predictions or scores. Stem polarity
// distinguishes all ten gods; the branch and natal interactions add a second axis.
const GOD_GUIDES: Record<TenGodCode, GodGuide> = {
  비견: {
    theme: '내 기준과 함께하는 힘', meaning: '일간과 같은 기운으로 자기 기준과 독립성을 살피는 관계',
    learning: '스스로 정한 작은 과제를 끝내며 자신만의 방법을 확인하세요. 다른 사람의 속도와 비교하기보다 이전 기록과 비교하면 강점이 보입니다.',
    relation: '의견이 같은 사람과도 역할을 나누고 서로 다른 선택을 존중하세요. 도움을 주는 일과 대신 결정하는 일을 구분하면 관계가 편안해집니다.',
    resource: '자기 몫과 공동으로 쓰는 몫을 구분해 보세요. 함께 쓸 때의 기준을 먼저 정하면 작은 불만이 쌓이는 일을 줄일 수 있습니다.',
    mental: '자기 확신은 출발점이지만 모든 일을 혼자 감당해야 한다는 뜻은 아닙니다. 혼자 해볼 일과 도움을 청할 일을 나누는 연습이 균형을 만듭니다.',
    action: '혼자 마무리할 일 하나와 도움을 받을 일 하나를 정하고, 끝낸 뒤 어떤 방식이 편했는지 적어 보세요.',
  },
  겁재: {
    theme: '협력 속에서 지키는 경계', meaning: '같은 오행에 음양이 달라 협력과 경쟁의 경계를 살피는 관계',
    learning: '함께 하는 과제에서 자신의 역할을 분명히 해보세요. 비교에 힘을 쓰기보다 서로 잘하는 부분을 나누면 같은 노력으로 더 많이 배울 수 있습니다.',
    relation: '친밀함과 모든 요구를 받아주는 태도는 다릅니다. 불편한 부탁에는 가능한 범위를 말하고 상대의 거절도 같은 기준으로 존중하세요.',
    resource: '공동으로 쓰는 물건과 시간을 먼저 정리해 보세요. 분위기에 휩쓸려 약속하기 전에 자신의 여유를 확인하는 습관이 도움이 됩니다.',
    mental: '주변의 반응에 속도를 맞추다 보면 필요한 휴식을 놓칠 수 있습니다. 인정받고 싶은 마음을 알아차린 뒤 본인이 감당할 범위를 다시 정하세요.',
    action: '함께할 일에는 역할과 마감, 각자 맡는 몫을 적고 중간에 한 번 서로 확인해 보세요.',
  },
  식신: {
    theme: '꾸준한 표현과 생활의 기초', meaning: '일간이 만들어 내는 기운 중 꾸준한 생산과 표현을 살피는 관계',
    learning: '작은 결과물을 여러 번 완성하는 방식이 어울립니다. 설명하거나 직접 만들어 보는 시간을 마련하고 결과보다 반복한 과정에서 배움을 찾아보세요.',
    relation: '마음을 크게 증명하기보다 자주 안부를 묻고 약속을 지키는 표현을 선택하세요. 상대가 편하게 받는 방식인지 살피는 것도 중요합니다.',
    resource: '생활에 자주 쓰는 것부터 제자리를 만들어 보세요. 잘 유지되는 습관을 늘리고 한 번에 많은 것을 바꾸려는 계획은 작게 나누세요.',
    mental: '눈에 띄는 성과가 적어도 반복하는 힘은 남습니다. 휴식까지 일정의 일부로 두고 오래 지속할 수 있는 속도를 찾는 데 의미를 두세요.',
    action: '일주일에 반복할 작은 활동 하나를 정하고 완성한 결과를 모아 변화가 보이도록 해보세요.',
  },
  상관: {
    theme: '질문을 개선으로 연결하기', meaning: '일간의 표현에 다른 음양이 더해져 질문과 새로운 방식을 살피는 관계',
    learning: '익숙한 방식에서 불편한 점을 발견하면 작은 대안을 시험해 보세요. 잘못을 찾는 데서 멈추지 않고 바꾼 뒤의 차이를 확인하는 것이 핵심입니다.',
    relation: '옳은 말도 전달 순서에 따라 다르게 받아들여집니다. 관찰한 사실과 원하는 변화를 나누어 말하고 상대의 설명을 들을 시간을 남겨두세요.',
    resource: '새로운 도구나 방식은 작은 범위에서 먼저 써보세요. 좋아 보인다는 이유만으로 기존의 안정적인 방법을 모두 바꾸지 않아도 됩니다.',
    mental: '답답함은 바꾸고 싶은 지점을 알려주는 신호일 수 있습니다. 감정을 바로 결론으로 삼기보다 무엇이 불편한지 구체적으로 나누어 보세요.',
    action: '바꾸고 싶은 방식 하나를 골라 작은 실험을 하고, 좋아진 점과 그대로 둬야 할 점을 따로 기록하세요.',
  },
  편재: {
    theme: '넓어진 선택과 우선순위', meaning: '일간이 조절하는 기운 중 외부 자원과 여러 선택지를 살피는 관계',
    learning: '서로 다른 경험을 연결해 보는 데 의미를 두세요. 관심을 넓히되 동시에 벌이는 일을 제한하고 실제로 끝낼 수 있는 한 가지를 먼저 고르세요.',
    relation: '새로운 만남의 수보다 함께 무엇을 할 수 있는지 살펴보세요. 친해지는 속도에 맞춰 약속을 늘리지 말고 신뢰를 확인할 시간을 두세요.',
    resource: '눈앞의 선택이 늘어날수록 남겨둘 여유도 필요합니다. 사용할 몫과 보관할 몫을 구분하고 모르는 제안은 충분히 알아본 뒤 결정하세요.',
    mental: '기회를 놓칠까 하는 마음이 커질 때에는 이미 맡은 일을 돌아보세요. 선택하지 않는 것도 시간과 에너지를 지키는 결정입니다.',
    action: '관심 있는 선택지를 세 가지 이내로 적고, 필요한 시간과 도움을 비교한 뒤 하나만 시험하세요.',
  },
  정재: {
    theme: '작은 축적과 관리의 기준', meaning: '일간이 조절하는 기운 중 일정한 관리와 축적을 살피는 관계',
    learning: '범위와 순서를 정한 뒤 차근차근 확인하는 방식이 어울립니다. 시작할 때의 목표를 작게 잡고 끝낸 과정에서 다음 기준을 만들어 보세요.',
    relation: '사소한 약속을 구체적으로 정하면 서로 기대하는 일이 선명해집니다. 잘 챙기는 마음이 상대를 통제하는 기준이 되지 않도록 의견도 물어보세요.',
    resource: '자주 쓰는 몫과 가끔 필요한 몫을 나누어 관리하세요. 부족할 때만 점검하기보다 일정한 간격으로 남은 자원을 확인하는 습관이 도움이 됩니다.',
    mental: '계획을 지키는 힘과 변화를 받아들이는 여유를 함께 두세요. 예상과 달라진 상황이 생기면 자신을 탓하기보다 기준을 다시 조정하면 됩니다.',
    action: '자주 쓰는 시간이나 물건 하나를 골라 사용 전후를 기록하고 줄이거나 유지할 기준을 정하세요.',
  },
  편관: {
    theme: '도전의 크기와 회복의 간격', meaning: '일간을 조절하는 기운 중 요구와 대응력을 살피는 관계',
    learning: '낯선 과제는 한 번에 해결하기보다 단계별로 연습하세요. 어려운 부분을 구체적으로 묻고 중간 점검을 두면 압박을 배움으로 바꾸기 쉽습니다.',
    relation: '요구가 커지는 관계에서는 가능한 범위를 먼저 말하세요. 단호함과 공격적인 표현을 구분하고 혼자 해결하기 어려운 일은 적절한 도움을 받으세요.',
    resource: '예상하지 못한 일에 쓸 여유를 남겨두세요. 촉박한 상황일수록 확인할 항목을 줄여 적고 중요한 결정은 충분한 설명을 들은 뒤 진행하세요.',
    mental: '긴장하는 모습을 약점으로 여기지 않아도 됩니다. 요구를 작은 단위로 나누고 마친 뒤 회복할 시간을 확보하면 부담을 조절하기 쉽습니다.',
    action: '부담스러운 과제를 세 단계로 나누고 각 단계에서 도움을 청할 사람이나 방법을 정해 두세요.',
  },
  정관: {
    theme: '역할과 신뢰를 쌓는 순서', meaning: '일간을 조절하는 기운 중 역할과 약속의 기준을 살피는 관계',
    learning: '기준이 분명한 과제에서 완성도를 높여보세요. 요구하는 수준을 먼저 확인하고 결과를 설명할 수 있도록 과정과 근거를 정리하는 연습이 좋습니다.',
    relation: '약속과 역할을 지키되 자신과 다른 방식도 존중하세요. 책임을 맡을 때에는 어디까지 할 수 있는지 말하고 상대의 몫도 남겨두는 편이 좋습니다.',
    resource: '정해진 기준을 확인한 뒤 필요한 몫을 배분하세요. 책임감 때문에 자신의 여유를 모두 내주기보다 유지할 수 있는 범위를 정하는 것이 중요합니다.',
    mental: '잘해야 한다는 기준이 높아질수록 작은 진전도 확인해 보세요. 완벽하게 해내는 것보다 약속한 범위를 안정적으로 지키는 일이 신뢰를 만듭니다.',
    action: '맡은 역할에서 꼭 지킬 기준 두 가지를 정하고 나머지는 조정할 수 있는 여유로 남겨두세요.',
  },
  편인: {
    theme: '깊이 살피고 직접 확인하기', meaning: '일간을 돕는 기운 중 탐색과 다른 관점을 살피는 관계',
    learning: '궁금한 주제를 깊이 살피되 생각한 내용을 실제 활동으로 옮겨보세요. 여러 설명을 비교하고 직접 확인한 것과 아직 추측인 것을 구분하면 도움이 됩니다.',
    relation: '혼자 생각할 시간이 필요하다는 점을 말로 설명하세요. 상대의 의도를 미리 단정하기보다 짧게 확인하는 대화가 불필요한 오해를 줄여줍니다.',
    resource: '새 정보를 모으는 일과 실제로 사용하는 일을 구분해 보세요. 준비가 끝없이 길어지지 않도록 작은 실행에 필요한 만큼부터 정리하세요.',
    mental: '생각이 많아질 때에는 머릿속의 질문을 밖으로 꺼내 적어보세요. 바로 답할 수 없는 질문은 잠시 내려놓고 생활의 일정한 리듬을 유지하세요.',
    action: '관심 있는 질문 하나에 대해 확인한 사실과 추측을 나누어 적고, 직접 해볼 수 있는 방법 하나를 정하세요.',
  },
  정인: {
    theme: '배움과 도움을 받아들이기', meaning: '일간을 돕는 기운 중 기초 학습과 돌봄을 살피는 관계',
    learning: '기본을 다시 익히고 신뢰할 수 있는 설명을 찾는 방식이 어울립니다. 도움받은 내용을 자신의 말로 정리한 뒤 혼자 해보는 시간을 이어가세요.',
    relation: '배려를 받는 일도 관계의 일부입니다. 고마움을 표현하되 상대가 원하는 방식을 물어보고 서로 편안한 도움의 범위를 정해 보세요.',
    resource: '지금 쓸 몫뿐 아니라 배우고 회복할 몫도 남겨두세요. 익숙하다는 이유만으로 유지하는 것과 실제로 필요한 것을 구분해 정리하면 좋습니다.',
    mental: '충분히 준비한 뒤 시작하고 싶은 마음을 존중하되 작은 시도까지 미루지는 마세요. 안전한 도움을 바탕으로 직접 선택하는 경험을 늘려보세요.',
    action: '도움을 받은 내용 하나를 자기 말로 정리하고, 같은 일을 한 번 스스로 해본 뒤 필요한 질문을 추가하세요.',
  },
};

const ELEMENT_ROUTINE: Record<Element, string> = {
  목: '새로운 활동을 늘릴 때에는 익숙한 생활 순서도 함께 유지하세요. 작은 움직임 뒤에 쉬는 시간을 두어 자기 속도를 확인하는 편이 좋습니다.',
  화: '사람을 만나고 표현하는 시간 뒤에는 조용히 쉬는 시간을 붙여보세요. 들뜬 날에도 식사와 취침 순서를 비슷하게 유지해 보세요.',
  토: '맡은 일을 돌보는 시간과 자신이 쉬는 시간을 구분하세요. 해야 할 일이 많을수록 식사와 휴식을 일정의 빈칸에 미루지 않는 편이 좋습니다.',
  금: '일을 정돈하는 과정에서 스스로에게 지나치게 엄격해지지 않는지 살펴보세요. 긴 집중 뒤에는 가볍게 움직이고 편하게 대화하는 시간을 두세요.',
  수: '오래 생각하거나 정보를 접한 뒤에는 몸을 움직이는 짧은 활동을 이어보세요. 잠들기 전 새로운 정보를 더 찾기보다 하루를 정리해 보세요.',
};

// The annual stem supplies the focus; the branch's main hidden stem supplies
// the way to put it into practice. These are not a rotation of synonymous copy.
const YEAR_METHODS: Record<TenGodCode, { focus: string; learning: string; resource: string; rhythm: string; action: string }> = {
  비견: {
    focus: '독립적인 연습',
    learning: '설명을 듣는 데서 끝내지 말고 도움 없이 해볼 부분을 남겨야 자신의 방식이 드러납니다.',
    resource: '함께 쓰는 것에도 각자 결정할 수 있는 몫을 남겨야 작은 선택마다 허락을 구하지 않아도 됩니다.',
    rhythm: '혼자 집중하는 시간과 함께 보내는 시간을 구분하고, 혼자 처리할 수 있다는 이유로 쉬는 시간까지 채우지는 마세요.',
    action: '다른 사람의 방식을 그대로 따르던 일에서 직접 선택할 부분을 하나 찾고, 필요한 도움의 범위도 함께 정하세요.',
  },
  겁재: {
    focus: '서로의 몫을 나누는 연습',
    learning: '같은 목표를 가진 사람과 방법을 비교하되, 서로 대신해 줄 부분보다 각자 맡을 부분을 먼저 나누세요.',
    resource: '공동으로 쓰는 시간과 물건은 누가 얼마나 맡을지 합의해야 부담이 한쪽으로 몰리지 않습니다.',
    rhythm: '여럿의 일정에 맞춘 날에는 따로 쉴 시간을 남기고, 다른 사람의 속도를 따라가기 위해 여유를 없애지는 마세요.',
    action: '함께하는 활동 하나에서 참여 범위와 쉬어갈 때의 약속을 합의하고, 한 사람에게 몰린 몫을 다시 나누세요.',
  },
  식신: {
    focus: '만들고 반복하는 연습',
    learning: '눈에 보이는 작은 결과물을 직접 만들고 같은 과정을 되풀이하며 손에 익는 순서를 찾으세요.',
    resource: '계속 써야 하는 재료와 시간을 먼저 확보하고, 새로 늘리는 것보다 이미 가진 것을 오래 쓰는 방법을 살펴보세요.',
    rhythm: '준비하고 활동한 뒤 정리하는 순서를 일정하게 두면 다시 시작하기가 수월합니다. 재미있는 활동도 마칠 시점을 정해 두세요.',
    action: '직접 만든 결과물을 모아 두고 다시 해볼 과정을 고르세요. 완성의 크기보다 반복하기 편한 순서를 남기는 것이 과제입니다.',
  },
  상관: {
    focus: '대안을 시험하는 연습',
    learning: '기존 방법과 바꾼 방법을 같은 조건에서 비교하고, 설명만 그럴듯한 대안과 실제 도움이 되는 대안을 구분하세요.',
    resource: '새 도구나 방식을 시험할 몫을 작게 떼어 두고, 바꾼 뒤에 필요한 유지 비용과 수고도 함께 비교하세요.',
    rhythm: '불편한 점을 고치는 시간에는 끝낼 기준이 필요합니다. 개선할 일을 떠올렸더라도 쉬는 동안 바로 처리하려 하지 마세요.',
    action: '불편한 과정 하나를 바꿔 보고 이전 방법과 차이를 비교하세요. 효과가 없다면 되돌릴 수 있도록 원래 방법도 남겨 두세요.',
  },
  편재: {
    focus: '선택지를 비교하는 연습',
    learning: '다른 분야의 경험을 연결하되 모두 시작하지는 말고, 필요한 시간과 준비를 비교해 먼저 해볼 것을 고르세요.',
    resource: '선택마다 드는 준비와 지속 부담을 따로 비교하세요. 시작할 여유가 있어도 계속 유지할 여유는 다를 수 있습니다.',
    rhythm: '이동과 만남을 여러 건 이어 잡기보다 사이에 여백을 두세요. 새 활동을 더할 때에는 먼저 줄일 일도 함께 골라야 합니다.',
    action: '관심 있는 선택지를 시간·준비·유지 부담으로 비교해 하나를 고르세요. 선택하지 않은 일은 당장 해야 할 목록에서 빼두세요.',
  },
  정재: {
    focus: '쌓인 것을 관리하는 연습',
    learning: '진행 순서와 끝낼 범위를 미리 정하고, 이미 익힌 부분은 유지하면서 미완성인 부분부터 마무리하세요.',
    resource: '반복해서 드는 몫과 한 번만 드는 몫을 구분하세요. 사용 내역을 보면 계속 남겨둘 것과 줄일 것을 가리기 쉽습니다.',
    rhythm: '준비에 드는 시간을 실제 일정에 포함하고, 정해둔 순서가 생활에 맞는지 살펴보세요. 빠진 일을 쉬는 시간에 몰아넣지 않는 편이 좋습니다.',
    action: '자주 사용하는 물건이나 시간의 흐름을 살피고 찾기 쉬운 자리를 정하세요. 비슷한 것을 더 늘리기 전에 가진 것부터 확인하세요.',
  },
  편관: {
    focus: '어려움을 나누는 연습',
    learning: '난도가 높은 부분을 따로 연습하고, 막히는 지점에서 누구에게 무엇을 물을지 구체적으로 준비하세요.',
    resource: '일정이 어긋났을 때 쓸 여유와 도움받을 경로를 먼저 남기세요. 부담을 줄일 순서를 정하면 급하게 모두 포기할 필요가 줄어듭니다.',
    rhythm: '집중을 많이 요구하는 활동 뒤에는 가벼운 일이나 휴식을 배치하세요. 긴장한 상태를 다음 일정까지 끌고 가지 않도록 구분하는 것이 핵심입니다.',
    action: '어려운 활동에서 멈추고 도움을 구할 기준을 미리 정하세요. 끝까지 버티는 것만 목표로 삼지 말고 다시 시도할 여유를 남기세요.',
  },
  정관: {
    focus: '약속한 기준을 맞추는 연습',
    learning: '완성의 기준을 먼저 확인하고 설명할 근거를 남기세요. 혼자 높인 기준보다 서로 이해한 기준을 맞추는 데 힘을 쓰세요.',
    resource: '맡은 역할에 필요한 몫부터 배분하되, 요청을 받을 때마다 책임의 범위까지 늘어나고 있지는 않은지 확인하세요.',
    rhythm: '정해진 약속 사이에 준비와 마무리 시간을 넣으세요. 빈 시간마다 다른 부탁을 받아들이면 원래 약속을 지킬 여유가 줄어듭니다.',
    action: '함께 정한 기준과 혼자 높여 잡은 기준을 구분하세요. 꼭 필요한 약속은 지키고 추가 요청은 가능한 범위를 다시 설명해 보세요.',
  },
  편인: {
    focus: '의문을 직접 확인하는 연습',
    learning: '서로 다른 설명을 비교한 뒤 직접 확인할 질문을 하나 남기세요. 자료를 모으는 단계와 실제로 해보는 단계를 구분하는 것이 좋습니다.',
    resource: '조사와 준비에 쓸 몫의 한계를 정하세요. 당장 확인할 수 없는 정보를 더 모으기보다 작은 실행에 필요한 것부터 마련하세요.',
    rhythm: '생각이 이어질 때에는 질문을 적어 두고 생활로 돌아올 구분점이 필요합니다. 답을 찾는 시간과 조용히 쉬는 시간을 분리해 보세요.',
    action: '확인한 사실과 아직 추측인 내용을 나누세요. 생각만으로 답을 정하기 어려운 질문은 직접 해보거나 적절한 사람에게 물어보세요.',
  },
  정인: {
    focus: '배운 것을 자기 것으로 만드는 연습',
    learning: '믿을 만한 설명을 구하고 배운 순서를 다시 해보세요. 도움을 받은 뒤에는 혼자 해보며 추가로 필요한 질문을 찾는 과정이 중요합니다.',
    resource: '배우고 회복하는 데 필요한 몫을 먼저 남기세요. 도움받을 수 있는 자원을 확인하되 전부 대신해 주는 방식에만 기대지는 마세요.',
    rhythm: '익숙하고 편안한 순서를 하루의 기준으로 두세요. 새로운 설명이나 활동을 받아들인 뒤에는 서두르지 않고 소화할 시간을 남겨두는 편이 좋습니다.',
    action: '도움받은 방법을 자신의 말이나 행동으로 다시 표현해 보세요. 잘 이해되지 않은 부분을 골라 다시 묻는 데까지 이어가면 좋습니다.',
  },
};

function annualScope(age: number) {
  if (age <= 5) return { learning: '보호자가 놀이를 준비할 때', resource: '놀이 공간과 돌봄 시간을 마련할 때', action: '보호자가 아이의 반응을 보며 돌봄에 적용할 과제입니다.' };
  if (age <= 12) return { learning: '놀이와 기초 학습에서는', resource: '준비물과 용돈을 챙길 때', action: '아이가 해볼 부분과 보호자가 도울 부분을 나눠 적용하세요.' };
  if (age <= 18) return { learning: '공부와 관심 분야를 탐색할 때', resource: '용돈과 공부·취미 시간을 나눌 때', action: '진로를 한 번에 정하기보다 관심 분야에서 적용해 보세요.' };
  if (age <= 34) return { learning: '배움과 새로운 역할을 경험할 때', resource: '생활비와 배움에 쓸 여유를 나눌 때', action: '배움과 활동에서 실제로 선택할 수 있는 범위에 적용하세요.' };
  if (age <= 54) return { learning: '쌓아온 경험을 다음 활동에 활용할 때', resource: '정기적인 지출과 장기적인 필요를 살필 때', action: '이미 맡은 역할에 무리가 없는 범위에서 적용해 보세요.' };
  if (age <= 74) return { learning: '경험을 나누거나 새 관심사를 배울 때', resource: '지속할 활동과 생활의 여유를 배분할 때', action: '이전 성과보다 지금 이어가고 싶은 활동에 적용해 보세요.' };
  return { learning: '본인의 관심 활동을 이어갈 때', resource: '자주 쓰는 물건과 도움받을 방법을 정리할 때', action: '본인이 원하는 방식과 생활 여건을 먼저 존중해 적용하세요.' };
}

function opening(text: string): string {
  return text.split('. ')[0].replace(/\.$/, '') + '.';
}

function detail(text: string): string {
  return text.slice(text.indexOf('. ') + 2);
}

function lifeStage(age: number) {
  if (age <= 5) return { label: '돌봄과 탐색', learning: '보호자가 놀이와 반복을 통해 아이의 반응을 살피는 시기입니다.', relationships: '관계의 중심은 돌봄을 주는 어른과 가까운 환경입니다.', resources: '돈의 운보다 안전한 공간, 놀이 시간, 돌봄의 일관성을 살펴보세요.', action: '이 조언은 아이에게 요구하기보다 보호자가 놀이와 돌봄 환경에 맞춰 활용하세요.' };
  if (age <= 12) return { label: '기초 학습과 친구 관계', learning: '학교와 일상에서 배우는 방식과 자신감을 쌓는 시기입니다.', relationships: '친구와 함께하는 규칙을 배우되 불편한 일은 믿을 만한 어른에게 말할 수 있어야 합니다.', resources: '물건을 아끼고 준비물을 챙기는 경험으로 관리의 기초를 익혀보세요.', action: '보호자와 함께 실천할 일을 작게 정하고 노력한 과정을 확인하세요.' };
  if (age <= 18) return { label: '자기 이해와 진로 탐색', learning: '관심과 잘하는 일을 탐색하되 한 번의 평가로 진로를 고정하지 않는 시기입니다.', relationships: '친구와 다른 의견을 말할 권리, 도움을 요청할 권리를 함께 익혀보세요.', resources: '용돈과 공부·취미 시간을 관리하며 선택의 기준을 연습하세요.', action: '진로와 친구 문제는 혼자 결론내리지 말고 신뢰하는 어른과 상의할 수 있습니다.' };
  if (age <= 34) return { label: '경험과 기반 만들기', learning: '배움과 일을 통해 나에게 맞는 역할과 환경을 확인하는 시기입니다.', relationships: '친구, 동료, 가까운 사람과 기대하는 역할을 구체적으로 나누어 보세요.', resources: '생활비, 배움에 쓸 비용, 남겨둘 여유를 나누어 실제 형편에 맞는 기준을 세워보세요.', action: '큰 선택은 실제 조건을 확인하고 되돌릴 수 있는 작은 경험부터 시작하세요.' };
  if (age <= 54) return { label: '역할 조율과 지속 가능성', learning: '쌓아온 경험을 활용하면서 맡는 일의 범위와 지속 가능한 방식을 점검하는 시기입니다.', relationships: '일과 가까운 관계에서 자신에게 몰린 역할이 있는지 함께 점검해 보세요.', resources: '정기적인 지출과 장기적인 필요를 구분하고 감당할 수 있는 범위에서 계획하세요.', action: '이미 맡은 일과 새로 맡을 일을 함께 놓고 시간과 체력의 여유를 먼저 확인하세요.' };
  if (age <= 74) return { label: '경험의 활용과 생활 재설계', learning: '경험을 나누거나 관심 분야를 새롭게 배우며 생활의 우선순위를 조정하는 시기입니다.', relationships: '오래된 인연과 새로운 모임 사이에서 편안하게 이어갈 관계를 골라보세요.', resources: '수입이나 역할이 달라져도 유지할 생활 기준과 도움을 받을 경로를 정리해 보세요.', action: '이전의 성과만 기준으로 삼기보다 현재의 생활 조건에서 편안한 선택을 찾아보세요.' };
  return { label: '일상의 자율성과 연결', learning: '나이만으로 활동을 제한하지 않고 본인의 관심과 생활 여건에 맞춰 배움을 이어가는 시기입니다.', relationships: '필요한 도움을 받으면서도 본인의 의사와 선택이 존중되는 관계를 살펴보세요.', resources: '자주 쓰는 물건, 연락처, 도움받을 방법을 찾기 편하게 정리해 보세요.', action: '활동의 크기보다 본인이 원하는 일과 편안하게 이어갈 수 있는 일상을 기준으로 삼으세요.' };
}

function guideFor(dayStem: Stem, ganzi: string) {
  const god = getTenGodHangul(dayStem, ganzi[0] as Stem);
  return { god, ...GOD_GUIDES[god] };
}

function branchReading(reading: ReadingRecord, branch: Branch): string {
  const natal = [
    ['태어난 해', reading.sajuData.pillars.year],
    ['태어난 달', reading.sajuData.pillars.month],
    ['태어난 날', reading.sajuData.pillars.day],
    ['태어난 시간', reading.sajuData.input.hourKnown ? reading.sajuData.pillars.hour : null],
  ] as const;
  const clash = natal.filter(([, pillar]) => pillar && isBranchChung(branch, pillar.branch)).map(([label]) => label);
  const combine = natal.filter(([, pillar]) => pillar && isYukhap(branch, pillar.branch)).map(([label]) => label);
  const repeated = natal.filter(([, pillar]) => pillar?.branch === branch).map(([label]) => label);
  const signals = [
    clash.length ? `${clash.join('·')}의 지지와 충: 서로 다르게 기대하는 부분을 먼저 조율하세요.` : '',
    combine.length ? `${combine.join('·')}의 지지와 육합: 함께할 접점을 찾되 각자의 몫도 남겨두세요.` : '',
    repeated.length ? `${repeated.join('·')}의 지지가 반복: 익숙한 반응이 지금도 편한지 확인하세요.` : '',
  ].filter(Boolean);
  return signals.length ? signals.join(' ') : '원국과 직접적인 충·육합·같은 지지의 반복은 없습니다. 관계의 큰 변화를 전제하기보다 평소의 대화와 약속을 살펴보세요.';
}

function supportElements(reading: ReadingRecord, report: SajuLifetimeReport): Element[] {
  const symbols = reading.sajuData.yongsin
    ? [reading.sajuData.yongsin.primary, ...reading.sajuData.yongsin.secondary]
    : [];
  const elements = symbols.flatMap((symbol): Element[] => {
    if (symbol.type === 'element' && Object.hasOwn(ELEMENT_ROUTINE, symbol.value)) return [symbol.value as Element];
    if (symbol.type === 'stem' && Object.hasOwn(STEM_ELEMENT, symbol.value)) return [STEM_ELEMENT[symbol.value as Stem]];
    if (symbol.type === 'branch' && Object.hasOwn(BRANCH_ELEMENT, symbol.value)) return [BRANCH_ELEMENT[symbol.value as Branch]];
    return [];
  });
  if (!elements.length) {
    for (const symbol of report.patternAndYongsin.supportSymbols) {
      const match = symbol.match(/([목화토금수]) 기운/);
      if (match) elements.push(match[1] as Element);
    }
  }
  return [...new Set(elements)];
}

type CycleRange = Pick<LifetimePdfCycle, 'index' | 'ganzi' | 'startYear' | 'endYear' | 'startAge' | 'endAge'>;

function getCycleRanges(reading: ReadingRecord): CycleRange[] {
  const snapshot = reading.sajuData.input;
  if (!snapshot.gender) return [];
  const corrected = snapshot.birthTimeCorrection?.adjustedBirth;
  const birth = corrected ?? {
    ...snapshot.birth,
    hour: snapshot.hourKnown ? snapshot.birth.hour ?? 12 : 12,
    minute: snapshot.hourKnown ? snapshot.birth.minute ?? 30 : 0,
  };
  const eightChar = Solar.fromYmdHms(birth.year, birth.month, birth.day, birth.hour, birth.minute, 0).getLunar().getEightChar();
  const sect = snapshot.jasiMethod === 'split' ? 1 : 2;
  eightChar.setSect(sect);
  // Same birth snapshot, correction, sect and gender as calculateLuckData. Ask
  // for an extra cycle: the engine's ten rows can end at calendar age 99.
  const yun = eightChar.getYun(snapshot.gender === 'male' ? 1 : 0, sect);
  return yun.getDaYun(12)
    .filter((cycle) => cycle.getIndex() > 0 && cycle.getStartYear() <= reading.input.year + 100 && cycle.getEndYear() >= reading.input.year)
    .map((cycle) => ({
      index: cycle.getIndex(),
      ganzi: cycle.getGanZhi(),
      startYear: cycle.getStartYear(),
      endYear: cycle.getEndYear(),
      // Keep full cycle boundaries, including the final cycle if it ends after
      // age 100. The annual records themselves stop at exactly age 100.
      startAge: cycle.getStartYear() - reading.input.year,
      endAge: cycle.getEndYear() - reading.input.year,
    }));
}

function cycleContext(cycle: CycleRange | undefined, ranges: CycleRange[], year: number): string {
  if (cycle) return `${ganziToKorean(cycle.ganzi)} 대운 · ${cycle.startYear}–${cycle.endYear}년`;
  return ranges.length && year < ranges[0].startYear ? '첫 대운 시작 전 · 성장 환경 중심' : '대운 미산정 · 연간 흐름만 참고';
}

function yearPhase(cycle: CycleRange | undefined, year: number) {
  if (!cycle) return { label: '', action: '연간 과제 중 지금의 생활에 맞는 것부터 골라 적용하세요.' };
  const offset = year - cycle.startYear;
  if (offset === 0) return { label: '대운 진입', action: '새 대운의 진입기에는 전부 바꾸기보다 작은 범위에서 새 방식을 시험하세요.' };
  if (offset === 1) return { label: '적응과 확인', action: '적응기에는 첫 시도를 돌아보고 도움이 된 방식은 남기고 무리한 약속은 조정하세요.' };
  if (year === cycle.endYear) return { label: '다음 대운 준비', action: '대운의 마무리에는 유지할 일과 정리할 일을 나누고 다음 기간에 넘길 과제를 골라두세요.' };
  if (year === cycle.endYear - 1) return { label: '이어갈 것 선별', action: '다음 기간에도 이어갈 활동을 골라 필요한 준비와 도움을 확인하세요. 새 일을 더하기 전의 점검입니다.' };
  if (offset <= 3) return { label: '시도 범위 조절', action: '초기에 익힌 방법이 있다면 적용 범위를 한 단계 넓혀 보되, 감당할 수 있는지 먼저 살피세요.' };
  if (offset <= 5) return { label: '중간 점검', action: '대운의 중간에서는 시작할 때의 목표와 현재의 필요를 비교하고 더는 맞지 않는 기준을 조정하세요.' };
  return { label: '지속할 방식 정착', action: '도움이 된 방법을 생활 속에 정착시키고, 반복하는 부담을 줄여 오래 이어갈 수 있게 다듬으세요.' };
}

function annualCycleReading(cycle: CycleRange | undefined, branch: Branch): string {
  if (!cycle) return '';
  const cycleBranch = cycle.ganzi[1] as Branch;
  if (isBranchChung(branch, cycleBranch)) return '세운과 대운의 지지가 충하므로, 장기 계획과 당장의 요구가 엇갈리는 부분을 먼저 조정하는 관점입니다.';
  if (isYukhap(branch, cycleBranch)) return '세운과 대운의 지지가 육합하므로, 올해의 시도를 오래 이어갈 활동과 연결하는 관점입니다.';
  if (branch === cycleBranch) return '세운과 대운의 지지가 같으므로, 오랫동안 반복해 온 방법의 장점과 부담을 함께 돌아보는 관점입니다.';
  return '';
}

/** PDF-only, synchronous, no DB/LLM or daily/monthly report generation. */
export function buildLifetimePdfTimeline(
  reading: ReadingRecord,
  report: SajuLifetimeReport,
  targetYear: number,
): LifetimePdfTimeline {
  const birthYear = reading.input.year;
  const dayStem = reading.sajuData.dayMaster.stem;
  const dayElement = reading.sajuData.dayMaster.element;
  const supports = supportElements(reading, report);
  const supportLabel = supports.map((element) => `${element} 기운`).join('·');
  const ranges = getCycleRanges(reading);
  const years = Array.from({ length: 101 }, (_, age): LifetimePdfYear => {
    const year = birthYear + age;
    // A representative date after 입춘 avoids incorrectly using January's
    // previous-year pillar. We intentionally do not attach a daily score.
    const ganzi = yearToGanji(year);
    const guide = guideFor(dayStem, ganzi);
    const branch = ganzi[1] as Branch;
    const branchGod = getBranchPrimaryTenGod(dayStem, branch);
    const method = YEAR_METHODS[branchGod];
    const stage = lifeStage(age);
    const scope = annualScope(age);
    const cycle = ranges.find((item) => year >= item.startYear && year <= item.endYear);
    const phase = yearPhase(cycle, year);
    const majorGuide = cycle ? guideFor(dayStem, cycle.ganzi) : null;
    const majorMeaning = annualCycleReading(cycle, branch) || (majorGuide
      ? majorGuide.god === guide.god
        ? '대운과 올해 천간의 십성이 같아 장기 과제를 올해의 작은 활동으로 구체화하는 데 초점을 둡니다.'
        : `대운의 장기 주제는 '${majorGuide.theme}'입니다. 올해에는 '${method.focus}'으로 접근해 보세요.`
      : ranges.length ? '첫 대운 전이므로 보호자가 마련하는 성장 환경을 중심으로 읽습니다.' : '대운 방향을 정하지 않고 연간 기운과 원국의 관계로 읽습니다.');
    const previous = age > 0 ? guideFor(dayStem, yearToGanji(year - 1)) : null;
    const shift = previous ? `지난해의 '${YEAR_METHODS[previous.god].focus}'보다 올해에는 '${YEAR_METHODS[guide.god].focus}'에 무게를 두는 해석입니다.` : '출생 연도에는 성과보다 아이의 반응과 돌봄 환경을 중심에 둡니다.';
    // Each authored guide has a focus sentence and a supporting sentence. When
    // both axes agree, use the support instead of repeating the same advice.
    const sameGod = guide.god === branchGod;
    const relationScope = age <= 5 ? '돌봄을 맡은 어른들의 관계에 적용하세요.' : age <= 18 ? '친구나 함께 배우는 사람과 적용하세요.' : age <= 54 ? '함께 활동하거나 가까운 사람과 적용하세요.' : '본인의 선택과 이어갈 인연을 살펴보세요.';
    return {
      year, age, ganzi,
      label: `${year}년 · ${age}세 · ${ganziToKorean(ganzi)}`,
      theme: guide.theme,
      majorLuckLabel: cycleContext(cycle, ranges, year),
      phase: [stage.label, phase.label].filter(Boolean).join(' · '),
      overview: `천간 ${guide.god}: ${guide.theme}. 지지 본기 ${branchGod}: ${method.focus}. ${majorMeaning} ${shift}`,
      learningCareer: `${scope.learning} ${sameGod ? detail(guide.learning) : opening(guide.learning)} ${method.learning}`,
      relationships: `${relationScope} ${opening(guide.relation)} ${detail(GOD_GUIDES[branchGod].relation)} ${branchReading(reading, branch)}`,
      resources: `${scope.resource} ${sameGod ? detail(guide.resource) : opening(guide.resource)} ${method.resource}`,
      wellbeing: `${age <= 5 ? '돌봄을 맡은 보호자의 생활 리듬도 함께 살펴보세요. ' : ''}${sameGod ? detail(guide.mental) : opening(guide.mental)} ${method.rhythm}`,
      action: `${scope.action} ${phase.action} ${method.action}`,
      isCurrent: year === targetYear,
    };
  });
  const cycles = ranges.map((range, index): LifetimePdfCycle => {
    const guide = guideFor(dayStem, range.ganzi);
    const stage = lifeStage(Math.max(0, range.startAge));
    const nextStage = lifeStage(range.endAge);
    const previous = ranges[index - 1];
    const previousTheme = previous ? guideFor(dayStem, previous.ganzi).theme : '성장 환경과 기본 생활';
    const label = `${ganziToKorean(range.ganzi)} 대운 · ${range.startYear}–${range.endYear}년 · ${range.startAge}–${range.endAge}세`;
    const hasStageChange = stage.label !== nextStage.label;
    const transitionBasis = `교운기는 ${range.startYear}년을 중심으로 이전 방식과 새 과제를 비교하는 참고 구간입니다. 정확한 사건 발생 시점을 뜻하지 않습니다.`;
    return {
      ...range, label,
      title: `${ganziToKorean(range.ganzi)} 대운 — ${guide.theme}`,
      overview: `${range.startYear}–${range.endYear}년의 ${ganziToKorean(range.ganzi)} 대운은 ${dayElement} 일간에 ${guide.god}의 관계입니다. ${guide.meaning}로 읽고 생활의 선택에 적용합니다. ${stage.learning} ${hasStageChange ? `후반에는 '${nextStage.label}'의 관점도 함께 살펴보세요.` : ''} ${branchReading(reading, range.ganzi[1] as Branch)}`.trim(),
      mental: `${guide.mental} ${ELEMENT_ROUTINE[BRANCH_ELEMENT[range.ganzi[1] as Branch]]} ${supportLabel ? `원국의 보완 방향인 ${supportLabel}을 함께 고려하되, 약한 기운 하나로 성격이나 삶을 단정하지 않습니다.` : '보완 기운이 명확하지 않은 자료에서는 실제 생활의 반응을 먼저 확인하세요.'}`,
      relationships: `${stage.relationships} ${guide.relation} ${hasStageChange ? `기간 후반에는 ${nextStage.relationships}` : '상대의 실제 의사와 상황을 확인하는 대화를 판단의 기준으로 삼으세요.'}`,
      resources: `${stage.resources} ${guide.resource} ${guide.learning} ${hasStageChange ? `기간 후반에는 ${nextStage.resources}` : '계획은 이 기간 전체를 한 번에 확정하기보다 생활 조건이 달라질 때마다 다시 점검하세요.'}`,
      actions: [guide.action, stage.action, hasStageChange ? nextStage.action : '일정한 간격으로 유지할 일, 줄일 일, 도움을 받을 일을 나누어 점검하세요.'],
      transition: {
        before: `${range.startYear - 1}년 전후에는 '${previousTheme}'에서 익힌 방식을 점검하고 새 기간에도 유지할 것과 조정할 것을 나누어 보세요. ${transitionBasis}`,
        entry: `${range.startYear}년은 '${guide.theme}'의 과제를 새로 시험하는 기준 연도입니다. ${stage.action} 한 번에 큰 결정을 내리기보다 작은 시도로 생활의 반응을 확인하세요.`,
        after: `${range.startYear + 1}–${range.startYear + 2}년에는 첫 시도에서 실제로 도움이 된 방식을 남기고 무리가 있던 약속을 조정해 보세요. ${guide.action} 적응의 속도에는 개인차가 있습니다.`,
      },
      isCurrent: targetYear >= range.startYear && targetYear <= range.endYear,
    };
  });
  const notes = [
    '나이는 출생한 양력 연도를 0세로 두는 연도 나이로, 생일 기준 만 나이와 다를 수 있습니다.',
    '연간 간지는 입춘 이후 기준이며 입춘 전에는 전년도 세운도 함께 봅니다. 연도 경계는 사건 발생일을 뜻하지 않습니다.',
    '대운은 생시·자시·출생지 보정을 반영합니다. 연간 기록은 100세까지이며 마지막 대운은 실제 경계를 보존해 그 이후까지 이어질 수 있습니다.',
    '과거는 회고, 미래는 선택의 참고입니다. 천간은 올해 주제, 지지의 본기는 실천 방식으로 읽으며 충·육합·반복은 사건을 예고하지 않습니다.',
    '대운의 단계는 장기 계획의 점검 순서입니다. 풀이가 결과나 건강을 보장하지 않으며, 몸의 변화나 불편함은 실제 상태에 맞는 도움을 받으세요.',
  ];
  if (!reading.sajuData.input.hourKnown) notes.push('출생 시각을 모르는 경우 정오를 기준으로 대운을 추정합니다. 시주와 세밀한 교운 시점은 확정할 수 없습니다.');
  if (!reading.sajuData.input.gender) notes.push('성별 정보가 없어 순행·역행 대운은 계산하지 않았습니다. 연도별 세운과 원국의 관계만 제공합니다.');
  return { years, cycles, notes };
}
