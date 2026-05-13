import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { ConcernId, TodayCalendarType, TodayScoreItem, TodayTimeRule } from '@/lib/today-fortune/types';
import type { BirthInput, Branch, Element } from '@/lib/saju/types';

type ConcernWindowCopy = {
  favorableTitle: string; favorableTail: string; cautionTitle: string; cautionTail: string;
  actNowTitle: string; waitTitle: string; actNowTail: string; waitTail: string;
};

export const CONCERN_WINDOW_COPY: Record<ConcernId, ConcernWindowCopy> = {
  love_contact: {
    favorableTitle: '먼저 닿는 말을 쓰기 좋은 시간',
    favorableTail: '짧은 안부나 확인처럼 부담이 낮은 표현부터 꺼내는 편이 맞습니다.',
    cautionTitle: '감정 해석이 과열되기 쉬운 시간',
    cautionTail: '반응을 재촉하거나 감정의 결론을 묻는 말은 한 템포 늦추는 편이 안전합니다.',
    actNowTitle: '오늘 먼저 연락할 때',
    waitTitle: '조금 늦춰서 연락할 때',
    actNowTail: '안부처럼 가벼운 첫 문장을 쓰면 흐름을 열기 쉽습니다.',
    waitTail: '말의 온도와 길이를 다듬으면 충돌을 줄이기 좋습니다.',
  },
  money_spend: {
    favorableTitle: '정산과 확인을 끝내기 좋은 시간',
    favorableTail: '수입 확대보다 약속된 금액과 고정비를 먼저 정리하는 편이 정확합니다.',
    cautionTitle: '과신 결제가 새기 쉬운 시간',
    cautionTail: '비교 없이 결제하거나 권유만 믿고 움직이는 선택은 한 번 더 확인하세요.',
    actNowTitle: '오늘 바로 결제할 때',
    waitTitle: '하루 보류하고 다시 볼 때',
    actNowTail: '정해진 생활성 지출은 구조를 분명히 하고 끝내는 쪽이 낫습니다.',
    waitTail: '비교와 정산을 거치면 손실 체감이 확실히 줄어듭니다.',
  },
  work_meeting: {
    favorableTitle: '기준과 역할을 먼저 세우기 좋은 시간',
    favorableTail: '회의나 계약은 결론보다 조건과 책임 범위를 선명히 하는 쪽이 더 강합니다.',
    cautionTitle: '확답이 부담으로 남기 쉬운 시간',
    cautionTail: '합의가 덜 된 상태에서 바로 확답하거나 서명하는 흐름은 조심해야 합니다.',
    actNowTitle: '오늘 미팅을 바로 진행할 때',
    waitTitle: '한 번 더 조율하고 진행할 때',
    actNowTail: '기준과 역할만 분명하면 속도는 충분히 붙습니다.',
    waitTail: '수정안과 다음 약속을 함께 잡으면 주도권을 덜 잃습니다.',
  },
  relationship_conflict: {
    favorableTitle: '말의 순서를 조율하기 좋은 시간',
    favorableTail: '큰 대화보다 짧은 확인과 사실 정리를 먼저 두는 편이 흐름을 덜 흔듭니다.',
    cautionTitle: '서운함이 결론처럼 커지기 쉬운 시간',
    cautionTail: '단정형 표현이나 감정의 잔상을 크게 남기는 말은 줄이는 편이 좋습니다.',
    actNowTitle: '바로 말할 때',
    waitTitle: '조금 식힌 뒤 말할 때',
    actNowTail: '사실과 감정을 분리해 말하면 오해를 줄이기 쉽습니다.',
    waitTail: '질문형 문장으로 바꾸면 상대의 방어를 낮추는 데 도움이 됩니다.',
  },
  energy_health: {
    favorableTitle: '힘을 써도 버틸 수 있는 시간',
    favorableTail: '집중해야 할 일은 짧게 나누고, 중간 회복 시간을 분명히 두는 편이 맞습니다.',
    cautionTitle: '피로가 누적되기 쉬운 시간',
    cautionTail: '몰아서 움직이기보다 쉬는 길이와 강도를 미리 정해두는 편이 안전합니다.',
    actNowTitle: '일정을 바로 진행할 때',
    waitTitle: '중간에 쉬어가며 쓸 때',
    actNowTail: '짧은 성과는 날 수 있지만 회복 구간이 없으면 뒷심이 급히 떨어질 수 있습니다.',
    waitTail: '집중 시간은 오히려 길어지고 판단도 차분해지기 쉽습니다.',
  },
  general: {
    favorableTitle: '하루의 첫 행동을 정하기 좋은 시간',
    favorableTail: '큰 결론보다 작은 행동 하나를 먼저 끝내는 편이 전체 흐름을 안정시킵니다.',
    cautionTitle: '균형이 무너지기 쉬운 시간',
    cautionTail: '생각만 길어지거나 반대로 너무 서두르면 좋은 흐름도 거칠어질 수 있습니다.',
    actNowTitle: '바로 움직일 때',
    waitTitle: '흐름을 먼저 보고 움직일 때',
    actNowTail: '작게라도 먼저 끝내는 행동이 하루 전체의 기준을 만들어 줍니다.',
    waitTail: '우선순위를 먼저 세우면 뒤쪽 선택이 훨씬 가벼워집니다.',
  },
};

export const FREE_RESULT_GUIDE_COPY: Record<
  ConcernId,
  {
    opportunityTitle: string;
    opportunityBody: string;
    riskTitle: string;
    riskBody: string;
  }
> = {
  love_contact: {
    opportunityTitle: '먼저 건네도 좋은 말',
    opportunityBody: '긴 고백보다 짧은 안부가 좋아요. 상대가 답하기 편한 문장 하나만 보내보세요.',
    riskTitle: '오늘 줄일 말',
    riskBody: '왜 답이 늦었는지 따지거나 마음을 바로 확인하려는 말은 피하는 편이 좋아요.',
  },
  money_spend: {
    opportunityTitle: '오늘 챙길 돈',
    opportunityBody: '새로 사기보다 이미 나가기로 한 돈, 구독료, 약속된 금액부터 확인해보세요.',
    riskTitle: '오늘 미룰 결제',
    riskBody: '권유만 듣고 바로 결제하는 일은 피하세요. 가격과 조건을 한 번 더 보면 충분합니다.',
  },
  work_meeting: {
    opportunityTitle: '먼저 정하면 좋은 기준',
    opportunityBody: '회의나 계약은 결론보다 조건, 일정, 책임 범위를 먼저 적어두면 편해요.',
    riskTitle: '오늘 피할 확답',
    riskBody: '아직 정리되지 않은 일에 바로 “네”라고 답하지 마세요. 확인 후 답해도 늦지 않습니다.',
  },
  relationship_conflict: {
    opportunityTitle: '오해를 줄이는 말',
    opportunityBody: '바로 판단하기보다 “내가 이렇게 이해해도 될까?”처럼 확인하는 말이 좋아요.',
    riskTitle: '오늘 피할 표현',
    riskBody: '항상, 절대, 너는 원래 같은 단정적인 말은 줄이세요. 대화가 커질 수 있습니다.',
  },
  energy_health: {
    opportunityTitle: '오늘 살릴 컨디션',
    opportunityBody: '중요한 일은 짧게 나눠서 해보세요. 중간에 쉬는 시간을 먼저 잡으면 훨씬 낫습니다.',
    riskTitle: '오늘 무리할 일',
    riskBody: '한 번에 몰아서 끝내려는 일정은 피하세요. 피곤해지면 판단도 같이 흐려질 수 있습니다.',
  },
  general: {
    opportunityTitle: '오늘 먼저 끝낼 일',
    opportunityBody: '큰 결정보다 미뤄둔 작은 일 하나를 끝내면 하루가 훨씬 가벼워져요.',
    riskTitle: '오늘 줄일 습관',
    riskBody: '생각만 오래 하거나 급하게 정하는 일은 줄이세요. 할 일 하나만 고르면 충분합니다.',
  },
};

export const TIME_BRANCH_LABELS: Record<Branch, string> = {
  子: '밤 정리',
  丑: '새벽 점검',
  寅: '아침 준비',
  卯: '아침 시작',
  辰: '오전 정리',
  巳: '오전 집중',
  午: '점심 전후',
  未: '오후 정돈',
  申: '오후 확인',
  酉: '저녁 마무리',
  戌: '저녁 정리',
  亥: '밤 휴식',
};

export const TIME_BRANCH_WINDOW_COPY: Record<
  Branch,
  {
    favorableTitle: string;
    favorableBody: string;
    cautionTitle: string;
    cautionBody: string;
  }
> = {
  子: {
    favorableTitle: '내일 할 일 하나만 정하기 좋아요',
    favorableBody: '생각이 많아지는 시간이라 큰 결론보다 내일 첫 행동 하나를 적어두면 편합니다.',
    cautionTitle: '늦은 결론은 줄여요',
    cautionBody: '감정이 길어지기 쉬워 중요한 답장은 아침에 다시 보는 편이 좋습니다.',
  },
  丑: {
    favorableTitle: '돈과 약속을 차분히 확인하기 좋아요',
    favorableBody: '급히 바꾸기보다 빠진 금액, 시간, 약속을 조용히 확인하기 좋은 때입니다.',
    cautionTitle: '혼자 오래 붙잡지 마세요',
    cautionBody: '생각이 무거워지면 작은 일도 크게 느껴질 수 있어 잠깐 멈추는 편이 좋습니다.',
  },
  寅: {
    favorableTitle: '아침 준비를 시작하기 좋아요',
    favorableBody: '복잡한 일보다 몸을 깨우고 오늘 할 일을 가볍게 펼치기 좋은 시간입니다.',
    cautionTitle: '서두른 출발은 줄여요',
    cautionBody: '급하게 시작하면 빠뜨리는 일이 생기기 쉬워 순서를 먼저 확인하세요.',
  },
  卯: {
    favorableTitle: '연락과 가벼운 시작에 좋아요',
    favorableBody: '짧은 연락, 간단한 정리, 작은 시작처럼 부담 없는 행동에 잘 맞습니다.',
    cautionTitle: '말이 빨라지지 않게 해요',
    cautionBody: '좋은 뜻도 길게 말하면 부담이 될 수 있어 짧고 부드럽게 전하세요.',
  },
  辰: {
    favorableTitle: '해야 할 일을 정리하기 좋아요',
    favorableBody: '머릿속에 흩어진 일을 목록으로 나누면 오늘의 우선순위가 잘 보입니다.',
    cautionTitle: '계획만 늘리지 마세요',
    cautionBody: '생각이 많아져 실행이 늦어질 수 있으니 가장 작은 일부터 시작하세요.',
  },
  巳: {
    favorableTitle: '집중해서 처리하기 좋아요',
    favorableBody: '짧게 몰입해서 끝낼 수 있는 일에 잘 맞습니다. 알림은 잠시 줄여도 좋습니다.',
    cautionTitle: '말과 판단이 뜨거워질 수 있어요',
    cautionBody: '확답이나 결제는 한 번 더 확인하고, 감정적인 말은 조금 식힌 뒤 전하세요.',
  },
  午: {
    favorableTitle: '사람과 맞추기 좋아요',
    favorableBody: '혼자 결정하기보다 함께 확인하고 조율하는 일에 잘 맞는 시간입니다.',
    cautionTitle: '기분대로 정하지 마세요',
    cautionBody: '순간 기분이 선택을 크게 만들 수 있어 금액과 약속은 다시 확인하세요.',
  },
  未: {
    favorableTitle: '오후 계획을 다듬기 좋아요',
    favorableBody: '오전에 놓친 것을 정리하고 남은 일을 현실적으로 줄이기 좋은 때입니다.',
    cautionTitle: '피로한 상태의 약속은 줄여요',
    cautionBody: '컨디션이 흔들리면 판단도 흐려질 수 있어 무리한 약속은 피하세요.',
  },
  申: {
    favorableTitle: '결정 전 확인하기 좋아요',
    favorableBody: '바로 정하기보다 비교, 확인, 재점검을 거치면 실수가 줄어듭니다.',
    cautionTitle: '마음이 급해지기 쉬워요',
    cautionBody: '빨리 끝내고 싶은 마음이 커질 수 있어 중요한 선택은 숫자와 조건을 보세요.',
  },
  酉: {
    favorableTitle: '마무리와 정리에 좋아요',
    favorableBody: '오늘 한 일을 정리하고, 남은 답장이나 확인을 깔끔하게 끝내기 좋습니다.',
    cautionTitle: '평가에 예민해지지 마세요',
    cautionBody: '상대 반응을 크게 해석하기 쉬우니 사실과 감정을 나눠서 보세요.',
  },
  戌: {
    favorableTitle: '하루를 정리하기 좋아요',
    favorableBody: '새 일을 늘리기보다 오늘 끝낸 것과 남길 것을 나누면 마음이 가벼워집니다.',
    cautionTitle: '늦은 시간 확답은 줄여요',
    cautionBody: '피곤한 상태에서는 말이 딱딱해질 수 있어 중요한 대화는 짧게만 하세요.',
  },
  亥: {
    favorableTitle: '마음 정리와 휴식에 좋아요',
    favorableBody: '몸을 쉬게 하고 마음에 남은 일을 덜어내기 좋은 시간입니다.',
    cautionTitle: '생각을 오래 굴리지 마세요',
    cautionBody: '늦은 고민은 커지기 쉬워 내일 확인할 것만 적고 쉬는 편이 좋습니다.',
  },
};

export const CONCERN_EASY_TIME_COPY: Record<
  ConcernId,
  {
    favorable: string;
    caution: string;
  }
> = {
  love_contact: {
    favorable: '연락은 짧게, 부담 없는 말부터 시작해보세요.',
    caution: '상대 반응을 바로 결론으로 보지 말고 한 템포 늦춰보세요.',
  },
  money_spend: {
    favorable: '새로 사기보다 금액, 조건, 고정비를 먼저 확인하기 좋습니다.',
    caution: '즉흥 결제나 권유성 구매는 잠시 보류하는 편이 낫습니다.',
  },
  work_meeting: {
    favorable: '회의나 약속은 역할, 조건, 다음 할 일을 짧게 정리하면 좋습니다.',
    caution: '합의가 덜 된 일에 바로 확답하지 말고 한 번 더 조율하세요.',
  },
  relationship_conflict: {
    favorable: '큰 대화보다 사실 확인과 짧은 질문으로 시작하는 편이 좋습니다.',
    caution: '서운한 마음을 결론처럼 말하면 길어질 수 있어 표현을 낮춰보세요.',
  },
  energy_health: {
    favorable: '힘든 일은 짧게 나누고, 쉬는 시간을 먼저 정하면 덜 지칩니다.',
    caution: '몸을 몰아서 쓰기보다 속도를 낮추고 물, 식사, 휴식을 챙기세요.',
  },
  general: {
    favorable: '큰 계획보다 지금 끝낼 수 있는 작은 일 하나에 잘 맞습니다.',
    caution: '생각만 길어지거나 너무 서두르면 흐름이 흐트러질 수 있습니다.',
  },
};

export const PUBLIC_ELEMENT_LABELS: Record<Element, string> = {
  목: '시작',
  화: '표현',
  토: '정리',
  금: '기준',
  수: '생각',
};

export const PUBLIC_ELEMENT_COPY: Record<
  Element,
  {
    supportAction: string;
    supportShort: string;
    weakCare: string;
    strongCaution: string;
    bodyCue: string;
  }
> = {
  목: {
    supportAction: '작은 계획 하나를 바로 시작해보세요',
    supportShort: '작게 시작하세요',
    weakCare: '시작을 미루다 보면 하루가 늘어질 수 있어요',
    strongCaution: '일을 너무 많이 벌리면 마무리가 흐려질 수 있어요',
    bodyCue: '새로운 일은 크게 벌리지 말고 작게 열 때 편합니다.',
  },
  화: {
    supportAction: '짧게라도 먼저 표현해보세요',
    supportShort: '짧게 표현하세요',
    weakCare: '말을 너무 아끼면 오해가 길어질 수 있어요',
    strongCaution: '감정이 앞서면 말이 세게 들릴 수 있어요',
    bodyCue: '마음은 길게 설명하기보다 짧고 부드럽게 꺼낼 때 좋습니다.',
  },
  토: {
    supportAction: '돈, 일정, 할 일을 한 번 정리해보세요',
    supportShort: '먼저 정리하세요',
    weakCare: '생활 리듬이 흩어지면 판단도 같이 흔들릴 수 있어요',
    strongCaution: '붙잡는 일이 많아지면 몸과 마음이 무거워질 수 있어요',
    bodyCue: '흩어진 일을 한곳에 모아두면 하루가 훨씬 안정됩니다.',
  },
  금: {
    supportAction: '오늘의 기준을 두 개만 정해보세요',
    supportShort: '기준을 세우세요',
    weakCare: '기준이 흐리면 작은 선택도 오래 끌릴 수 있어요',
    strongCaution: '정답을 빨리 내리려다 말이 딱딱해질 수 있어요',
    bodyCue: '정할 것과 미룰 것을 나누면 선택이 쉬워집니다.',
  },
  수: {
    supportAction: '잠깐 멈춰서 자료와 마음을 확인해보세요',
    supportShort: '잠깐 확인하세요',
    weakCare: '생각을 정리하지 않으면 감정이 안쪽에서 커질 수 있어요',
    strongCaution: '생각이 길어지면 실행이 늦어질 수 있어요',
    bodyCue: '바로 결론내기보다 한 번 확인하면 실수가 줄어듭니다.',
  },
};

export const TEN_GOD_PUBLIC_TONES: Record<string, { headline: string; body: string; caution: string }> = {
  비견: {
    headline: '혼자 해결하려는 마음이 강한 날',
    body: '혼자 다 처리하려는 힘이 먼저 올라올 수 있어요.',
    caution: '다 맡으려 하지 말고 하나는 나누세요.',
  },
  겁재: {
    headline: '가까운 사람과 선을 맞춰야 하는 날',
    body: '정 때문에 역할이나 돈의 경계가 흐려질 수 있어요.',
    caution: '부탁을 바로 받기보다 가능한 범위를 먼저 말하세요.',
  },
  식신: {
    headline: '꾸준히 만든 것이 힘이 되는 날',
    body: '새로운 자극보다 해오던 것을 이어갈 때 편해요.',
    caution: '기분 따라 루틴을 깨지 않는 편이 좋습니다.',
  },
  상관: {
    headline: '말과 아이디어가 빨라지는 날',
    body: '생각이 빠르게 튀어나와 분위기를 바꿀 수 있어요.',
    caution: '솔직함이 세게 들리지 않게 한 번 낮춰 말하세요.',
  },
  편재: {
    headline: '기회가 넓게 보이는 날',
    body: '사람, 제안, 돈의 흐름이 넓게 보일 수 있어요.',
    caution: '좋아 보여도 바로 잡기보다 조건을 먼저 확인하세요.',
  },
  정재: {
    headline: '돈과 약속을 지키기 좋은 날',
    body: '꾸준히 쌓는 일과 정해진 약속에서 안정감이 생겨요.',
    caution: '변화를 무조건 미루기보다 필요한 조정은 작게 해보세요.',
  },
  편관: {
    headline: '압박 속에서도 집중이 살아나는 날',
    body: '부담이 있어도 해야 할 일을 좁히면 힘이 납니다.',
    caution: '긴장을 오래 끌고 가지 말고 중간에 쉬어가세요.',
  },
  정관: {
    headline: '책임과 기준이 중요해지는 날',
    body: '역할을 바르게 해내려는 마음이 강해질 수 있어요.',
    caution: '완벽하게 하려다 지치지 않게 우선순위를 줄이세요.',
  },
  편인: {
    headline: '생각이 깊어지는 날',
    body: '남들이 놓친 부분을 혼자 깊게 살피기 쉬워요.',
    caution: '확인을 너무 오래 끌지 말고 기준을 정하면 멈추세요.',
  },
  정인: {
    headline: '도움과 배움이 편하게 들어오는 날',
    body: '혼자 버티기보다 묻고 배우면 일이 부드러워져요.',
    caution: '기다리기만 하지 말고 필요한 도움을 먼저 요청하세요.',
  },
};

export const PUBLIC_TIME_BRANCH_COPY: Record<
  Branch,
  {
    label: string;
    action: string;
    caution: string;
    summary: string;
  }
> = {
  子: {
    label: '밤 생각 시간',
    action: '늦은 판단은 메모만 남기고 아침에 다시 보세요',
    caution: '밤에 커진 걱정을 그대로 결론으로 삼지 마세요',
    summary: '생각이 깊어질수록 답을 미루는 편이 안전합니다.',
  },
  丑: {
    label: '새벽 점검 시간',
    action: '돈, 약속, 준비물을 조용히 확인하세요',
    caution: '혼자 오래 붙잡으면 작은 일도 무겁게 느껴질 수 있어요',
    summary: '빠진 것을 찾아내는 감각이 살아납니다.',
  },
  寅: {
    label: '아침 준비 시간',
    action: '오늘 할 일을 두 가지로 줄여 시작하세요',
    caution: '출발부터 너무 많은 일을 잡지 마세요',
    summary: '시작의 힘은 좋지만 순서가 필요합니다.',
  },
  卯: {
    label: '아침 연락 시간',
    action: '짧은 연락이나 가벼운 시작을 먼저 해보세요',
    caution: '좋은 뜻도 길게 설명하면 부담이 될 수 있어요',
    summary: '말문을 부드럽게 여는 데 강점이 있습니다.',
  },
  辰: {
    label: '오전 정리 시간',
    action: '머릿속 일을 목록으로 나눠보세요',
    caution: '계획만 늘리다 실행이 늦어지지 않게 하세요',
    summary: '흩어진 일을 정리하면 하루가 편해집니다.',
  },
  巳: {
    label: '오전 집중 시간',
    action: '알림을 줄이고 한 가지 일에 집중하세요',
    caution: '확답과 결제는 한 번 더 확인하세요',
    summary: '집중력은 좋지만 판단이 빨라질 수 있습니다.',
  },
  午: {
    label: '대화 조율 시간',
    action: '혼자 정하기보다 한 사람과 확인해보세요',
    caution: '기분만으로 약속이나 돈을 정하지 마세요',
    summary: '사람과 맞추면 일이 더 쉽게 풀립니다.',
  },
  未: {
    label: '오후 정리 시간',
    action: '남은 일을 현실적으로 줄여보세요',
    caution: '피곤한 상태에서 새 약속을 늘리지 마세요',
    summary: '오전에 놓친 것을 수습하기 좋습니다.',
  },
  申: {
    label: '비교 확인 시간',
    action: '바로 정하지 말고 조건을 비교하세요',
    caution: '빨리 끝내고 싶은 마음이 실수를 부를 수 있어요',
    summary: '확인과 재점검에서 안정감이 생깁니다.',
  },
  酉: {
    label: '저녁 마무리 시간',
    action: '답장, 정산, 약속 확인을 깔끔하게 끝내세요',
    caution: '상대 반응을 너무 크게 해석하지 마세요',
    summary: '마무리와 정리에 힘이 붙습니다.',
  },
  戌: {
    label: '하루 정리 시간',
    action: '오늘 끝낸 것과 내일 넘길 일을 나누세요',
    caution: '피곤할 때 중요한 대화를 길게 끌지 마세요',
    summary: '새로 늘리기보다 덜어내야 편합니다.',
  },
  亥: {
    label: '밤 휴식 시간',
    action: '몸을 쉬게 하고 내일 볼 것만 적어두세요',
    caution: '늦은 고민을 오래 굴리지 마세요',
    summary: '마음 정리와 회복이 먼저입니다.',
  },
};

export interface PublicTodayProfile {
  dayLabel: string;
  dominantElement: Element;
  weakestElement: Element;
  supportElement: Element;
  dominantLabel: string;
  weakestLabel: string;
  supportLabel: string;
  tenGod: string | null;
  roleHeadline: string;
  roleBody: string;
  roleCaution: string;
  strengthBody: string;
  actionShort: string;
  actionBody: string;
  balanceBody: string;
  cautionBody: string;
  hourLabel: string;
  hourAction: string;
  hourCaution: string;
  hourSummary: string;
  calendarCue: string;
  locationCue: string;
  timeRuleCue: string;
  signatureSeed: number;
}

export function compactStrings(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

export function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeSentenceKey(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function getLastReadableChar(value: string) {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (!char) continue;
    if (/\s/.test(char)) continue;
    if (/["'“”‘’)\]}.,!?]/.test(char)) continue;
    return char;
  }

  return '';
}

export function hasBatchimLike(value: string) {
  const lastChar = getLastReadableChar(value);
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;

  return code % 28 !== 0;
}

export function endsWithRieulBatchim(value: string) {
  const lastChar = getLastReadableChar(value);
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;

  return code % 28 === 8;
}

export function withKoreanParticle(value: string, consonantParticle: string, vowelParticle: string) {
  if (consonantParticle === '으로' && vowelParticle === '로' && endsWithRieulBatchim(value)) {
    return `${value}${vowelParticle}`;
  }

  return `${value}${hasBatchimLike(value) ? consonantParticle : vowelParticle}`;
}

export function polishFortuneCopy(text: string) {
  return simplifySajuCopy(text)
    .replace(/([^\s]+\s*\([^)]+\))\([^)]+\)/g, '$1')
    .replace(/([^\s]+(?:\s*\([^)]+\))?)을\(를\)/g, (_, value: string) => withKoreanParticle(value, '을', '를'))
    .replace(/([0-9]+점)로 계산되어/g, (_, value: string) => `${withKoreanParticle(value, '으로', '로')} 계산되어`)
    .replace(/\s+/g, ' ')
    .trim();
}

export function joinUniqueSentences(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const sentences: string[] = [];

  for (const part of compactStrings(parts)) {
    for (const sentence of splitSentences(simplifySajuCopy(part))) {
      const key = normalizeSentenceKey(sentence);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sentences.push(sentence);
    }
  }

  return sentences.join(' ');
}

export function uniqueStrings(parts: Array<string | null | undefined>, limit?: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of compactStrings(parts)) {
    const readablePart = simplifySajuCopy(part);
    if (!readablePart || seen.has(readablePart)) continue;
    seen.add(readablePart);
    result.push(readablePart);
    if (limit && result.length >= limit) break;
  }

  return result;
}

export function compactActionDescription(
  description: string,
  evidenceSnippet: string | null
) {
  const withoutScorePrefix = description.replace(/^[^.!?]+점 기준입니다\.\s*/, '').trim();
  const withoutEvidence = evidenceSnippet
    ? withoutScorePrefix.replace(evidenceSnippet, '').trim()
    : withoutScorePrefix;

  return joinUniqueSentences([withoutEvidence]);
}

export function normalizeElement(value: string | null | undefined): Element | null {
  const matched = value?.match(/[목화토금수]/u)?.[0] as Element | undefined;
  return matched ?? null;
}

export function getPrimarySupportElement(sajuData: SajuDataV1) {
  return normalizeElement(sajuData.yongsin?.primary?.value ?? sajuData.yongsin?.primary?.label);
}

export function buildSignatureSeed(
  input: BirthInput,
  sajuData: SajuDataV1,
  options: { calendarType: TodayCalendarType; timeRule: TodayTimeRule }
) {
  const locationSeed = input.birthLocation
    ? Math.round(Math.abs(input.birthLocation.latitude * 10) + Math.abs(input.birthLocation.longitude * 10))
    : 0;
  const ganziSeed = Array.from(
    `${sajuData.pillars.day.ganzi}${sajuData.pillars.hour?.ganzi ?? ''}`
  ).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const calendarSeed = options.calendarType === 'lunar' ? 19 : 0;
  const timeRuleSeed =
    options.timeRule === 'trueSolarTime'
      ? 29
      : options.timeRule === 'earlyZi'
        ? 17
        : options.timeRule === 'nightZi'
          ? 11
          : 0;

  return (
    input.year * 3 +
    input.month * 11 +
    input.day * 17 +
    (input.hour ?? 6) * 23 +
    (input.minute ?? 0) +
    locationSeed +
    ganziSeed +
    calendarSeed +
    timeRuleSeed
  );
}

export function pickVariant<T>(items: T[], seed: number, offset = 0) {
  return items[Math.abs(seed + offset) % items.length];
}

export function buildCalendarCue(calendarType: TodayCalendarType) {
  return calendarType === 'lunar'
    ? '음력 생일은 양력 날짜로 바꿔 오늘 흐름에 맞춰 봤어요.'
    : '양력 생일 기준으로 오늘 흐름을 봤어요.';
}

export function buildTimeRuleCue(input: BirthInput, timeRule: TodayTimeRule) {
  if (input.unknownTime) return '태어난 시간이 없어 하루 전체 흐름 중심으로 봤어요.';
  if (timeRule === 'trueSolarTime' && input.birthLocation) {
    return `${input.birthLocation.label}의 위치를 반영해 시간을 더 좁혀 봤어요.`;
  }
  if (timeRule === 'earlyZi') return '자시를 이른 밤 기준으로 나눠 봤어요.';
  if (timeRule === 'nightZi') return '늦은 밤 자시를 한 흐름으로 묶어 봤어요.';
  return '표준시 기준으로 태어난 시간을 반영했어요.';
}

export function buildLocationCue(input: BirthInput) {
  if (!input.birthLocation) return '출생지는 비어 있어 시간 해석은 넓게만 봤어요.';
  if (input.solarTimeMode === 'longitude') {
    return `${input.birthLocation.label} 출생지 보정까지 함께 봤어요.`;
  }
  return `${input.birthLocation.label} 출생 정보까지 함께 두고 봤어요.`;
}

export function buildPublicTodayProfile(
  input: BirthInput,
  sajuData: SajuDataV1,
  options: { calendarType: TodayCalendarType; timeRule: TodayTimeRule }
): PublicTodayProfile {
  const dominantElement = sajuData.fiveElements.dominant;
  const weakestElement = sajuData.fiveElements.weakest;
  const supportElement = getPrimarySupportElement(sajuData) ?? weakestElement;
  const tenGod = sajuData.pattern?.tenGod ?? sajuData.tenGods?.dominant ?? null;
  const roleTone = tenGod ? TEN_GOD_PUBLIC_TONES[tenGod] : null;
  const signatureSeed = buildSignatureSeed(input, sajuData, options);
  const dayLabel = PUBLIC_ELEMENT_LABELS[sajuData.dayMaster.element];
  const supportCopy = PUBLIC_ELEMENT_COPY[supportElement];
  const dominantCopy = PUBLIC_ELEMENT_COPY[dominantElement];
  const weakestCopy = PUBLIC_ELEMENT_COPY[weakestElement];
  const hourBranch = sajuData.pillars.hour?.branch ?? null;
  const hourCopy = hourBranch
    ? PUBLIC_TIME_BRANCH_COPY[hourBranch]
    : {
        label: '전체 흐름형',
        action: '오늘은 시간보다 하루 전체 리듬을 먼저 보세요',
        caution: '세부 시간에 맞추려 하기보다 무리한 선택을 줄이세요',
        summary: '태어난 시간이 없어 하루 전체 흐름으로 넓게 봅니다.',
      };
  const strengthBody =
    sajuData.strength?.level === '신강'
      ? '내가 먼저 끌고 가려는 힘이 강해지는 편입니다.'
      : sajuData.strength?.level === '신약'
        ? '주변 분위기와 컨디션에 영향을 받기 쉬운 편입니다.'
        : '상황을 보고 맞추는 감각이 살아 있는 편입니다.';

  return {
    dayLabel,
    dominantElement,
    weakestElement,
    supportElement,
    dominantLabel: PUBLIC_ELEMENT_LABELS[dominantElement],
    weakestLabel: PUBLIC_ELEMENT_LABELS[weakestElement],
    supportLabel: PUBLIC_ELEMENT_LABELS[supportElement],
    tenGod,
    roleHeadline: roleTone?.headline ?? `${dayLabel} 감각이 먼저 드러나는 날`,
    roleBody: roleTone?.body ?? `${dayLabel} 쪽 성향이 오늘 선택의 첫 반응으로 올라옵니다.`,
    roleCaution: roleTone?.caution ?? supportCopy.weakCare,
    strengthBody,
    actionShort: supportCopy.supportShort,
    actionBody: supportCopy.supportAction,
    balanceBody: `${dominantCopy.bodyCue} ${supportCopy.bodyCue}`,
    cautionBody:
      dominantElement === weakestElement
        ? supportCopy.weakCare
        : `${dominantCopy.strongCaution} ${weakestCopy.weakCare}`,
    hourLabel: hourCopy.label,
    hourAction: hourCopy.action,
    hourCaution: hourCopy.caution,
    hourSummary: hourCopy.summary,
    calendarCue: buildCalendarCue(options.calendarType),
    locationCue: buildLocationCue(input),
    timeRuleCue: buildTimeRuleCue(input, options.timeRule),
    signatureSeed,
  };
}

export function buildPublicTodayHeadline(
  concernId: ConcernId,
  profile: PublicTodayProfile
) {
  switch (concernId) {
    case 'love_contact':
      return `마음은 ${profile.actionShort.replace('하세요', '하면')} 편해지는 날`;
    case 'money_spend':
      return `돈은 새로 쓰기보다 ${profile.actionShort.replace('하세요', '할')} 날`;
    case 'work_meeting':
      return `일은 ${profile.actionShort.replace('하세요', '할')} 때 풀리는 날`;
    case 'relationship_conflict':
      return `관계는 말보다 순서를 먼저 볼 날`;
    case 'energy_health':
      return `몸과 마음은 무리보다 회복이 먼저인 날`;
    case 'general':
    default:
      return pickVariant(
        [
          `${profile.roleHeadline}, ${profile.actionShort}`,
          `${profile.hourLabel}이라 ${withKoreanParticle(profile.supportLabel, '을', '를')} 챙기면 좋은 날`,
          `${withKoreanParticle(profile.dominantLabel, '이', '가')} 먼저 나오고 ${withKoreanParticle(profile.weakestLabel, '을', '를')} 놓치기 쉬운 날`,
        ],
        profile.signatureSeed
      );
  }
}

export function buildPublicTodayBody(
  concernId: ConcernId,
  profile: PublicTodayProfile,
  unknownBirthTime: boolean
) {
  const concernLine =
    concernId === 'love_contact'
      ? '오늘은 마음을 크게 확인하기보다 상대가 답하기 쉬운 한마디가 더 좋습니다.'
      : concernId === 'money_spend'
        ? '오늘은 새 결제보다 이미 나갈 돈과 약속된 금액을 먼저 보는 쪽이 낫습니다.'
        : concernId === 'work_meeting'
          ? '오늘은 결론을 빨리 내기보다 역할, 일정, 조건을 짧게 맞추는 편이 좋습니다.'
          : concernId === 'relationship_conflict'
            ? '오늘은 맞고 틀림을 가르기보다 오해가 커지지 않게 말의 순서를 낮추는 편이 좋습니다.'
            : concernId === 'energy_health'
              ? '오늘은 몰아서 버티기보다 쉬는 구간을 먼저 잡아야 오래 갑니다.'
              : '오늘은 큰 결정보다 지금 바로 정리할 수 있는 작은 일 하나가 하루를 바꿉니다.';

  return joinUniqueSentences([
    profile.roleBody,
    profile.strengthBody,
    profile.hourSummary,
    concernLine,
    `${profile.supportLabel} 쪽을 챙기면 좋아요. ${profile.actionBody}.`,
    profile.hourAction,
    profile.cautionBody,
    profile.calendarCue,
    unknownBirthTime ? '태어난 시간이 정확하지 않아 시간대 해석은 넓게만 봅니다.' : null,
  ]);
}

export function buildPublicReasonBody(profile: PublicTodayProfile, unknownBirthTime: boolean) {
  return joinUniqueSentences(
    pickVariant(
      [
        [
          `${profile.roleHeadline}입니다.`,
          `${profile.dominantLabel} 쪽 반응이 먼저 나오고, ${profile.weakestLabel} 쪽은 놓치기 쉬워요.`,
          `그래서 오늘은 ${profile.actionBody}.`,
          profile.roleCaution,
        ],
        [
          `${withKoreanParticle(profile.hourLabel, '으로', '로')} 봅니다.`,
          profile.hourSummary,
          `오늘 먼저 할 일은 ${profile.hourAction}.`,
          profile.hourCaution,
        ],
        [
          `${withKoreanParticle(profile.supportLabel, '을', '를')} 챙기는 날입니다.`,
          profile.locationCue,
          profile.timeRuleCue,
          `오늘은 ${profile.actionBody}.`,
        ],
      ],
      profile.signatureSeed,
      3
    ).concat(
      unknownBirthTime ? ['태어난 시간이 없으면 세부 시간보다 하루 전체 흐름을 중심으로 보세요.'] : []
    )
  );
}

export function buildPublicGroundingSummary(
  profile: PublicTodayProfile,
  kasiComparison: KasiSingleInputComparison | null | undefined
) {
  return {
    primaryConcept: `${profile.supportLabel} 챙기기`,
    factLines: [
      `내 기본 반응: ${profile.dayLabel}`,
      `강하게 나오는 쪽: ${profile.dominantLabel}`,
      `오늘 챙길 쪽: ${profile.supportLabel}`,
      `시간 리듬: ${profile.hourLabel}`,
    ],
    evidenceLines: [
      profile.roleBody,
      `${withKoreanParticle(profile.weakestLabel, '이', '가')} 부족해질 때는 ${PUBLIC_ELEMENT_COPY[profile.weakestElement].weakCare}`,
    ],
    kasi: {
      available: Boolean(kasiComparison),
      ok: !kasiComparison || kasiComparison.issues.length === 0,
      summary: kasiComparison && kasiComparison.issues.length > 0
        ? '달력 기준은 일부 확인이 필요합니다.'
        : '달력 기준 확인 완료',
    },
  };
}

export function getAxisElement(key: TodayScoreItem['key'], profile: PublicTodayProfile) {
  switch (key) {
    case 'overall':
      return profile.supportElement;
    case 'love':
      return profile.supportElement === '화' ? '화' : profile.weakestElement;
    case 'wealth':
      return profile.dominantElement === '토' || profile.dominantElement === '금'
        ? profile.dominantElement
        : profile.supportElement;
    case 'career':
      return profile.dominantElement;
    case 'relationship':
      return profile.weakestElement;
    case 'condition':
    default:
      return profile.weakestElement;
  }
}

export function buildAxisScoreSummary(
  key: TodayScoreItem['key'],
  score: number,
  profile: PublicTodayProfile
) {
  const element = getAxisElement(key, profile);
  const label = PUBLIC_ELEMENT_LABELS[element];
  const copy = PUBLIC_ELEMENT_COPY[element];
  const band = score >= 78 ? 'high' : score >= 68 ? 'mid' : 'low';

  if (key === 'overall') {
    return pickVariant(
      band === 'high'
        ? [
            `${profile.roleHeadline}이라 ${copy.supportShort.replace('하세요', '하면')} 하루가 빨리 열립니다.`,
            `${profile.hourLabel} 리듬이 살아 있어 ${profile.hourAction}.`,
          ]
        : band === 'mid'
          ? [
              `${withKoreanParticle(label, '을', '를')} 챙기면 하루가 안정됩니다. ${copy.supportAction}.`,
              `${profile.hourLabel}이라 ${profile.hourAction}.`,
            ]
          : [
              `${withKoreanParticle(label, '을', '를')} 놓치기 쉬워요. 오늘은 속도를 낮추고 ${copy.supportShort}.`,
              `${profile.hourCaution}. 먼저 ${copy.supportShort}.`,
            ],
      profile.signatureSeed,
      5
    );
  }

  if (key === 'love') {
    return band === 'high'
      ? '마음을 어렵게 설명하기보다 짧고 부드럽게 꺼내면 좋습니다.'
      : band === 'mid'
        ? `${label} 쪽을 챙기면 감정이 덜 엉킵니다. 답을 재촉하지 마세요.`
        : '오늘은 확인보다 여백이 필요합니다. 말의 양을 줄이면 편해요.';
  }

  if (key === 'wealth') {
    return band === 'high'
      ? `${label} 감각이 살아 있어 작은 기회를 정리하기 좋습니다.`
      : band === 'mid'
        ? '새로 쓰기보다 이미 나갈 돈과 구독, 약속된 금액을 확인하세요.'
        : '즉흥 결제는 미루고 필요한 것만 남기는 편이 안전합니다.';
  }

  if (key === 'career') {
    return band === 'high'
      ? `${label} 쪽 강점이 일에서 보입니다. 결론을 먼저 말하면 전달이 쉽습니다.`
      : band === 'mid'
        ? '할 일을 넓히기보다 맡은 범위와 마감부터 분명히 하세요.'
        : '새 일을 더 받기보다 이미 맡은 일을 끝까지 정리하는 편이 좋습니다.';
  }

  if (key === 'relationship') {
    return band === 'high'
      ? '짧은 안부나 확인처럼 가벼운 말이 관계를 편하게 만듭니다.'
      : band === 'mid'
        ? `${withKoreanParticle(label, '이', '가')} 비면 오해가 커질 수 있어요. 사실과 기분을 나눠 말하세요.`
        : '서운함을 결론처럼 말하지 말고 한 번 더 확인하는 편이 안전합니다.';
  }

  return pickVariant(
    band === 'high'
      ? [
          '몸이 가볍게 따라오는 편입니다. 그래도 쉬는 시간을 끼워 넣으세요.',
          `${profile.hourLabel} 리듬을 살려 짧게 집중하고 쉬어가세요.`,
        ]
      : band === 'mid'
        ? [
            `${withKoreanParticle(label, '이', '가')} 부족해지면 쉽게 지칠 수 있어요. 중간 휴식을 먼저 잡으세요.`,
            `${profile.hourCaution}. 물, 식사, 쉬는 시간을 먼저 챙기세요.`,
          ]
        : [
            '무리해서 버티기보다 일정 하나를 줄이는 편이 낫습니다.',
            `${profile.hourLabel}이라 회복 구간을 먼저 비워두세요.`,
          ],
    profile.signatureSeed,
    11
  );
}

export function buildPublicOpportunity(
  concernId: ConcernId,
  profile: PublicTodayProfile
) {
  const staticCopy = FREE_RESULT_GUIDE_COPY[concernId];
  if (concernId !== 'general') {
    return {
      title: staticCopy.opportunityTitle,
      body: joinUniqueSentences([
        staticCopy.opportunityBody,
        `${withKoreanParticle(profile.supportLabel, '을', '를')} 챙기려면 ${profile.actionBody}.`,
        profile.hourAction,
      ]),
    };
  }

  return pickVariant(
    [
      {
        title: `${withKoreanParticle(profile.supportLabel, '을', '를')} 살리는 작은 행동`,
        body: `${profile.actionBody}. 이것 하나만 해도 오늘이 훨씬 덜 복잡해집니다.`,
      },
      {
        title: `${profile.hourLabel}에 맞는 첫 행동`,
        body: `${profile.hourAction}. 크게 바꾸기보다 이 한 가지를 먼저 해보세요.`,
      },
      {
        title: `${withKoreanParticle(profile.dominantLabel, '을', '를')} 좋은 쪽으로 쓰기`,
        body: `${profile.balanceBody} 그래서 오늘은 ${profile.actionBody}.`,
      },
    ],
    profile.signatureSeed,
    7
  );
}

export function buildPublicRisk(
  concernId: ConcernId,
  profile: PublicTodayProfile
) {
  const staticCopy = FREE_RESULT_GUIDE_COPY[concernId];
  if (concernId !== 'general') {
    return {
      title: staticCopy.riskTitle,
      body: joinUniqueSentences([staticCopy.riskBody, profile.roleCaution, profile.hourCaution]),
    };
  }

  return pickVariant(
    [
      {
        title: `${withKoreanParticle(profile.weakestLabel, '이', '가')} 비는 순간`,
        body: `${PUBLIC_ELEMENT_COPY[profile.weakestElement].weakCare}. ${profile.roleCaution}`,
      },
      {
        title: `${profile.hourLabel}에서 조심할 점`,
        body: `${profile.hourCaution}. 급히 정하기보다 한 번 확인하세요.`,
      },
      {
        title: `${withKoreanParticle(profile.dominantLabel, '이', '가')} 과해질 때`,
        body: `${PUBLIC_ELEMENT_COPY[profile.dominantElement].strongCaution}. 오늘은 ${profile.actionShort}.`,
      },
    ],
    profile.signatureSeed,
    13
  );
}
