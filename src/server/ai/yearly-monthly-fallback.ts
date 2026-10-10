// 2026-10-10 — 월별 기본 풀이(AI 실패·미설정 시). 예전엔 1문장 88자로 잘라 "두 줄"만 나갔다.
//   6항목(총운·분야별·먼저 볼 것·조심할 점·실천 3가지)을 그 사람의 월운 근거(십성·원국 합충·용신)로 채운다.
//   보완 포인트(기간·색·방향)는 계산값이라 화면이 report 에서 직접 그린다.
import type { TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import { describeMonthSignals } from '@/domain/saju/report/monthly-signals';
import type { YearlyMonthFlow } from '@/domain/saju/report/yearly-types';
import { koreanizeGanzi } from '@/lib/saju/terminology';

export type MonthlyAreaKey = 'wealth' | 'work' | 'love' | 'health';
export const MONTHLY_AREA_KEYS: MonthlyAreaKey[] = ['wealth', 'work', 'love', 'health'];
export const MONTHLY_AREA_LABEL: Record<MonthlyAreaKey, string> = {
  wealth: '재물', work: '일·직업', love: '애정·관계', health: '건강',
};

// 그 달 천간 십성(사람마다 다름) × 분야. 십성이 없으면 흐름(momentum)만으로 쓴다.
const AREA_BY_TEN_GOD: Record<TenGodCode, Record<MonthlyAreaKey, string>> = {
  비견: {
    wealth: '돈은 내 판단으로 움직이고 싶어지지만, 함께 쓰는 돈은 나누는 기준을 먼저 정해 두는 편이 좋습니다.',
    work: '혼자 끝낼 수 있는 일에서 속도가 붙고, 동료와는 역할을 분명히 나눌수록 부딪힘이 줄어듭니다.',
    love: '내 뜻을 앞세우기 쉬운 때라, 상대의 일정과 기분을 한 번 묻고 움직이면 관계가 편안해집니다.',
    health: '의욕이 앞서 몸을 몰아붙이기 쉬우니 운동량은 평소보다 조금만 늘리는 편이 좋습니다.',
  },
  겁재: {
    wealth: '나가는 돈이 늘기 쉬운 달입니다. 빌려주거나 함께 투자하자는 이야기는 금액과 기한을 글로 남겨 두세요.',
    work: '경쟁자가 눈에 들어오는 때라, 성과는 기록으로 남기고 공을 나눌 사람은 미리 정해 두는 편이 좋습니다.',
    love: '사소한 비교가 서운함으로 번지기 쉬우니, 다른 사람 이야기보다 두 사람 사이의 일에 집중해 보세요.',
    health: '무리한 약속이 겹치기 쉬워 수면이 밀리기 쉽습니다. 일주일에 하루는 일정을 비워 두세요.',
  },
  식신: {
    wealth: '내 실력으로 버는 돈에 힘이 붙습니다. 작게라도 내 기술이나 취미를 수입으로 연결해 볼 만합니다.',
    work: '손에 익은 일을 꾸준히 해낼수록 평가가 좋아지는 달입니다. 결과물을 눈에 보이게 정리해 두세요.',
    love: '편안한 대화와 함께 먹고 즐기는 시간이 관계를 부드럽게 만듭니다.',
    health: '식사와 휴식의 리듬이 잡히기 좋은 때라, 미뤄 둔 생활 습관을 하나 정해 시작해 보세요.',
  },
  상관: {
    wealth: '새로운 수입 아이디어가 떠오르지만, 계약이나 큰 지출은 조건을 한 번 더 읽고 결정하세요.',
    work: '말과 기획이 돋보이는 달입니다. 다만 윗사람의 방식에 대한 불만은 제안의 형태로 바꿔 전하는 편이 좋습니다.',
    love: '표현이 풍부해지는 만큼 말이 날카로워질 수 있으니, 서운한 이야기는 하루 묵혔다가 꺼내 보세요.',
    health: '생각이 많아 잠이 얕아지기 쉽습니다. 잠들기 전 화면을 보는 시간을 줄여 보세요.',
  },
  편재: {
    wealth: '큰돈이 오가는 기회가 보이는 달입니다. 기대 수익보다 잃어도 괜찮은 한도를 먼저 정하세요.',
    work: '바깥 활동과 새로운 거래처에서 기회가 생기기 쉽습니다. 연락처와 약속을 꼼꼼히 정리해 두세요.',
    love: '새로운 만남이나 모임이 늘기 쉬운 때입니다. 즐거움과 함께 상대에게 쓰는 시간의 균형을 챙기세요.',
    health: '이동과 약속이 많아져 체력이 흩어지기 쉬우니, 일정 사이에 쉬는 틈을 미리 넣어 두세요.',
  },
  정재: {
    wealth: '고정 수입과 살림을 다지기 좋은 달입니다. 자동이체와 고정비를 정리하면 남는 돈이 보입니다.',
    work: '꼼꼼함이 인정받는 때라, 숫자와 마감을 정확히 지키는 것만으로도 신뢰가 쌓입니다.',
    love: '약속을 지키는 작은 성실함이 관계를 단단하게 만듭니다. 함께 쓰는 돈 이야기를 차분히 나눠 보세요.',
    health: '규칙적인 생활이 잘 맞는 달입니다. 식사 시간을 일정하게 지켜 보세요.',
  },
  편관: {
    wealth: '갑작스러운 지출이 생기기 쉬우니 비상금을 먼저 떼어 두고 나머지로 계획을 세우세요.',
    work: '예상하지 못한 책임이나 압박이 들어올 수 있습니다. 맡을 범위와 기한을 처음에 분명히 해 두세요.',
    love: '내 여유가 줄어 상대에게 날이 서기 쉬운 때입니다. 바쁜 사정을 미리 말해 두면 오해가 줄어듭니다.',
    health: '긴장과 피로가 몸에 쌓이기 쉬운 달입니다. 어깨·허리처럼 자주 뭉치는 곳을 틈틈이 풀어 주세요.',
  },
  정관: {
    wealth: '안정적인 수입 구조를 다지기 좋은 때입니다. 급한 투자보다 규칙에 맞는 저축이 잘 맞습니다.',
    work: '평가와 자리, 규칙이 중요해지는 달입니다. 맡은 일을 정해진 방식대로 끝내면 인정이 따라옵니다.',
    love: '관계를 공식적으로 정리하거나 약속을 다지기 좋은 때입니다. 서로의 기대를 말로 확인해 보세요.',
    health: '책임감에 쉬는 것을 미루기 쉽습니다. 정해진 휴식 시간을 일정표에 넣어 두세요.',
  },
  편인: {
    wealth: '돈보다 생각과 공부에 마음이 가는 달입니다. 큰 결정은 정보를 충분히 모은 뒤로 미루는 편이 좋습니다.',
    work: '혼자 깊이 파고드는 일에 강해지는 때라, 조사·분석·기획 업무를 먼저 끝내 두세요.',
    love: '혼자만의 시간이 필요해지는 달입니다. 거리를 두고 싶을 때는 이유를 짧게라도 전해 주세요.',
    health: '생각이 많아 끼니를 거르기 쉽습니다. 가벼운 산책으로 머리를 식혀 보세요.',
  },
  정인: {
    wealth: '문서와 계약이 돈과 연결되는 달입니다. 서류를 꼼꼼히 읽고 도장을 찍는 습관이 손해를 막아 줍니다.',
    work: '배움과 자격, 도와주는 사람을 만나기 좋은 때입니다. 조언을 구할 사람을 한 명 정해 연락해 보세요.',
    love: '상대에게 기대고 의지하기 좋은 달입니다. 고마운 마음을 말로 표현하면 관계가 따뜻해집니다.',
    health: '몸이 쉬고 싶다는 신호를 보내기 쉬운 때입니다. 충분히 자고 몸을 회복시키는 데 시간을 쓰세요.',
  },
};

// 같은 흐름의 달이 여러 번 나오므로 문장을 여러 개 두고, 이미 쓴 문장은 건너뛴다(한 풀이 안 반복 0 가드).
const AREA_BY_MOMENTUM: Record<YearlyMonthFlow['momentum'], Record<MonthlyAreaKey, string[]>> = {
  rise: {
    wealth: [
      '준비해 둔 계획이 있다면 작은 규모로 먼저 실행해 보기 좋은 흐름입니다.',
      '들어올 돈의 일정을 정리해 두면 다음 결정을 훨씬 가볍게 내릴 수 있습니다.',
      '작은 부수입이나 아끼는 습관 하나가 눈에 띄는 차이를 만들기 쉬운 때입니다.',
    ],
    work: [
      '미뤄 둔 제안이나 결정을 꺼내기 좋은 흐름입니다.',
      '새로 맡는 일이 생기면 처음 일주일 안에 방향을 잡아 두면 끝까지 수월합니다.',
      '그동안 쌓아 둔 결과를 보여 줄 자리를 먼저 만들어 보세요.',
    ],
    love: [
      '먼저 연락하고 약속을 잡기에 부담이 적은 흐름입니다.',
      '함께하고 싶은 계획을 구체적인 날짜로 제안해 보기 좋은 때입니다.',
      '새로운 사람을 만나는 자리에 한 번쯤 나가 보기 좋은 흐름입니다.',
    ],
    health: [
      '새 운동이나 생활 습관을 시작하기 좋은 흐름입니다.',
      '몸이 가벼울 때 걷는 시간을 조금씩 늘려 체력을 쌓아 두세요.',
      '컨디션이 좋은 날을 기록해 두면 나에게 맞는 생활 리듬을 찾기 쉽습니다.',
    ],
  },
  steady: {
    wealth: [
      '새로 벌이기보다 지금의 수입과 지출을 점검하기 좋은 흐름입니다.',
      '정기적으로 나가는 돈 가운데 줄일 수 있는 항목을 하나 찾아보세요.',
      '저축 목표를 금액과 날짜로 다시 적어 두기 좋은 때입니다.',
    ],
    work: [
      '하던 일을 꾸준히 이어가며 마무리를 챙기기 좋은 흐름입니다.',
      '업무 순서와 자료를 정리해 두면 다음 달 바쁠 때 큰 도움이 됩니다.',
      '눈에 띄는 변화보다 실수를 줄이는 쪽이 평가에 더 좋게 작용합니다.',
    ],
    love: [
      '익숙한 관계를 편안하게 돌보기 좋은 흐름입니다.',
      '자주 만나는 사람에게 고마운 일을 한 가지 말로 전해 보세요.',
      '큰 이벤트보다 평소의 대화 시간을 조금 늘리는 편이 관계에 좋습니다.',
    ],
    health: [
      '지금의 생활 리듬을 지키는 것이 가장 좋은 관리입니다.',
      '잠드는 시간과 일어나는 시간을 일정하게 맞춰 보세요.',
      '물을 자주 마시고 앉아 있는 시간을 중간중간 끊어 주세요.',
    ],
  },
  caution: {
    wealth: [
      '큰 지출과 투자 결정은 한 번 더 비교한 뒤로 미루는 편이 좋습니다.',
      '충동구매가 늘기 쉬우니 장바구니에 넣고 하루 뒤에 결제해 보세요.',
      '보증이나 돈을 빌려주는 일은 이달만큼은 거절하는 쪽이 마음이 편합니다.',
    ],
    work: [
      '확정보다 확인을 먼저 두고, 일정에 여유를 두는 편이 좋습니다.',
      '중요한 메일과 서류는 보내기 전에 한 번 더 읽어 보세요.',
      '새 일을 늘리기보다 지금 맡은 일의 마감을 지키는 데 힘을 모으세요.',
    ],
    love: [
      '감정이 앞설 때는 결론을 서두르지 말고 시간을 두고 이야기해 보세요.',
      '서운한 일이 생기면 상대의 사정을 먼저 묻는 편이 다툼을 줄여 줍니다.',
      '피곤할 때 나온 말은 오래 남기 쉬우니 중요한 대화는 쉬고 난 뒤에 나눠 보세요.',
    ],
    health: [
      '피로가 쌓이기 쉬운 흐름이라 무리한 일정은 줄이는 편이 좋습니다.',
      '늦은 밤 일정을 줄이고 수면 시간을 먼저 확보해 보세요.',
      '몸이 보내는 작은 신호를 넘기지 말고 쉬는 날을 하루 더 잡아 두세요.',
    ],
  },
};

const RELATION_CAUTION: Record<string, string> = {
  충: '평소와 다른 변화가 갑자기 들어올 수 있으니 중요한 약속은 하루 이틀 여유를 두고 잡으세요.',
  형: '사소한 말이 다툼으로 번지기 쉬우니 서류와 말 모두 한 번 더 확인하세요.',
  원진: '서운한 마음이 쌓이기 쉬우니 작은 오해는 그때그때 풀어 두세요.',
  해: '믿었던 계획이 조금씩 어긋날 수 있으니 중간 점검 날짜를 미리 정해 두세요.',
  파: '한 번 정한 일이 틀어질 수 있으니 대안을 하나 준비해 두세요.',
};
const RELATION_FOCUS: Record<string, string> = {
  육합: '도와줄 사람과 손을 잡기 좋은 때라 혼자 하던 일을 함께 나눠 보세요.',
  삼합: '여러 일이 한 방향으로 모이기 좋은 때라 흩어진 계획을 하나로 묶어 보세요.',
  방합: '주변의 기운이 같은 쪽으로 모이는 때라 비슷한 목표를 가진 사람과 함께해 보세요.',
};

function splitSentences(text: string) {
  return text.split(/(?<=[.!?。])\s+/).map((line) => line.trim()).filter(Boolean);
}

/** 12개월을 순서대로 만들며 이미 쓴 문장은 건너뛴다(한 풀이 안 반복 0). */
export function buildFallbackMonthlyFlows(flows: YearlyMonthFlow[]) {
  const used = new Set<string>();
  const fresh = (candidates: Array<string | null | undefined | false>, take = 1) => {
    const picked: string[] = [];
    for (const line of candidates) {
      if (!line || used.has(line) || picked.length >= take) continue;
      used.add(line);
      picked.push(line);
    }
    return picked;
  };
  return flows.map((flow) => {
    const signals = flow.signals;
    const ganji = flow.monthlyGanji ? koreanizeGanzi(flow.monthlyGanji) : null;
    const strongest = signals?.natalRelations[0];
    const gods = [signals?.stemTenGod, signals?.branchTenGod].filter((g): g is TenGodCode => !!g);
    const areas = Object.fromEntries(MONTHLY_AREA_KEYS.map((key) => [key, [
      ...fresh(gods.map((god) => AREA_BY_TEN_GOD[god][key])),
      ...fresh(AREA_BY_MOMENTUM[flow.momentum][key]),
    ].join(' ')]).filter(([, text]) => text)) as Partial<Record<MonthlyAreaKey, string>>;
    const otherArea = MONTHLY_AREA_KEYS.find((key) => !signals?.focusAreas.includes(key as never)) ?? 'work';
    // 계산 리포트 문장도 분야 조합이 같은 달끼리 겹칠 수 있다 → 같은 규칙으로 거르고, 비면 다른 근거 문장으로 채운다.
    const spare = (key: MonthlyAreaKey) => [...gods.map((god) => AREA_BY_TEN_GOD[god][key]), ...AREA_BY_MOMENTUM[flow.momentum][key]];
    const focus = [...fresh(splitSentences(flow.opportunity), 2), ...fresh([strongest && RELATION_FOCUS[strongest.kind]])];
    const caution = [...fresh(splitSentences(flow.caution), 2), ...fresh([strongest && RELATION_CAUTION[strongest.kind]])];
    return {
      month: flow.month,
      summary: [...fresh(splitSentences(flow.summary), 2), ...fresh(signals ? describeMonthSignals(signals, ganji) : [], 3)].join(' ') || flow.summary,
      areas,
      focus: (focus.length ? focus : fresh([...MONTHLY_AREA_KEYS.flatMap(spare), signals?.tenGodTheme
        && `${flow.month}월에는 ${signals.tenGodTheme} 쪽에서 먼저 기회를 찾아보세요.`])).join(' ') || flow.opportunity,
      caution: (caution.length ? caution : fresh([...spare('health'), signals?.tenGodTheme
        && `${flow.month}월에는 ${signals.tenGodTheme}에 마음이 쏠려 다른 일을 놓치지 않도록 일정을 한 번 더 살펴보세요.`])).join(' ') || flow.caution,
      // action 칸에 첫 실천을 복사하면 반복 제거가 목록 쪽을 지운다 — 목록만 둔다.
      actions: (() => {
        const supplement = flow.supplement
          ? `${flow.month}월에는 ${flow.supplement.colors[0]} 계열의 소품이나 옷으로 부족한 ${flow.supplement.element} 기운을 채워 보세요(참고용).`
          : null;
        const base = [flow.action, supplement].filter((line): line is string => !!line);
        // 실천은 항상 3개 — 남은 근거 문장(그 달 십성 → 흐름)으로 채운다.
        return [...base, ...fresh([otherArea, ...MONTHLY_AREA_KEYS].flatMap(spare), 3 - base.length)].slice(0, 3);
      })(),
    };
  });
}
