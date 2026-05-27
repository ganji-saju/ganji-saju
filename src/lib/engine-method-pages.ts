import { simplifySajuCopy, simplifySajuCopyList } from '@/lib/saju/public-copy';

export interface EngineMethodSection {
  title: string;
  body: string;
}

export interface EngineMethodEntry {
  slug: string;
  title: string;
  summary: string;
  description: string;
  eyebrow: string;
  question: string;
  lead: string;
  keywords: string[];
  relatedSlugs: string[];
  sections: EngineMethodSection[];
  checklist: string[];
  closing: string;
}

export function getEngineMethodEntry(slug: string) {
  return ENGINE_METHOD_ENTRIES.find((item) => item.slug === slug);
}

export function getEngineMethodEntriesBySlug(slugs: string[]) {
  return slugs
    .map((slug) => getEngineMethodEntry(slug))
    .filter((item): item is EngineMethodEntry => Boolean(item));
}

const RAW_ENGINE_METHOD_ENTRIES: EngineMethodEntry[] = [
  {
    slug: 'why-ai-saju-can-drift',
    title: 'AI 사주가 왜 흔들리는가',
    summary:
      '같은 생년월일인데도 다른 AI에서 격국과 용신이 달라지는 이유를, 계산과 설명이 섞일 때 생기는 흔들림 관점에서 정리한 글입니다.',
    description:
      'AI 사주가 왜 흔들리는지, 명식 계산과 설명 레이어를 분리하지 않으면 어떤 문제가 생기는지 간지사주 관점으로 정리한 페이지입니다.',
    eyebrow: 'AI 사주 해설',
    question: '왜 같은 질문인데 AI마다 사주풀이가 달라질까요?',
    lead:
      '대화형 AI는 문장을 잘 쓰지만, 명식 계산과 격국·용신 해석까지 동시에 맡기면 원칙이 흔들릴 수 있습니다. 간지사주이 계산과 설명을 분리하는 이유도 여기에 있습니다.',
    keywords: ['AI 사주', '사주 계산 정보', '격국 해석', '용신 해석'],
    relatedSlugs: [
      'why-ai-saju-differs-from-calendar-apps',
      'why-pattern-judgments-diverge',
      'why-yongsin-is-hard',
    ],
    sections: [
      {
        title: '흔들림은 말투보다 풀이 방식에서 먼저 시작됩니다',
        body:
          '사주에서 가장 민감한 지점은 말투가 아니라 풀이 정보입니다. 출생 정보를 어떤 규칙으로 명식으로 바꾸고, 월령과 강약을 어떤 바탕으로 보는지에 따라 같은 명식도 다른 결론으로 이어질 수 있습니다.',
      },
      {
        title: '대화형 AI는 설명과 계산을 한 번에 하려 하기 쉽습니다',
        body:
          '프롬프트 안에 명식, 격국, 용신, 대운 해석을 한 번에 묶어버리면 모델은 문맥상 그럴듯한 결과를 선택하려는 경향이 생깁니다. 이때 사용자는 문장이 자연스러워서 맞는 말처럼 느끼지만, 실제 풀이 흐름은 흔들릴 수 있습니다.',
      },
      {
        title: '그래서 간지사주는 계산 정보와 설명을 나눕니다',
        body:
          '간지사주는 명식, 강약, 격국, 용신, 대운·세운을 먼저 계산하고, AI는 이미 계산된 결과를 선생의 말투로 풀어내는 역할만 맡습니다. 이 구조가 있어야 여선생과 남선생의 말투가 달라도 풀이 방식은 유지됩니다.',
      },
    ],
    checklist: [
      '명식 계산을 AI가 직접 다시 하지 않는가',
      '격국·용신의 판단 단서를 결과 화면에서 확인할 수 있는가',
      '출생시각과 출생지 보정 원칙이 분리돼 있는가',
      '긴 글보다 핵심 단서가 먼저 보이는가',
    ],
    closing:
      '결국 AI 사주에서 중요한 것은 “누가 더 멋지게 말하느냐”보다 “누가 먼저 풀이 방식을 안정적으로 잡느냐”입니다. 간지사주는 그 흔들리는 부분을 먼저 잡고, 말투는 그 다음 단계에서 다룹니다.',
  },
  {
    slug: 'what-is-true-solar-time',
    title: '진태양시란 무엇인가',
    summary:
      '왜 사주 입력에서 출생지와 분 단위 시각을 묻는지, 진태양시가 표준시와 어떤 차이를 만드는지 일반 사용자 언어로 정리한 글입니다.',
    description:
      '진태양시가 무엇인지, 출생지와 경도 보정이 사주풀이에 왜 중요한지 간지사주 관점으로 설명한 페이지입니다.',
    eyebrow: '시간 보정 방식',
    question: '사주 보는데 왜 출생지와 몇 분 차이까지 중요할까요?',
    lead:
      '사주는 시주와 절기 경계에서 몇 분 차이로도 해석의 중심이 달라질 수 있습니다. 진태양시는 바로 이 경계 구간을 더 정확하게 읽기 위한 시간 보정 정보입니다.',
    keywords: ['진태양시', '출생지 사주', '시주 계산', '절기 경계'],
    relatedSlugs: [
      'why-jeolgi-matters-in-chart-calculation',
      'what-if-birth-hour-is-unknown',
      'why-ai-saju-differs-from-calendar-apps',
    ],
    sections: [
      {
        title: '표준시와 진태양시는 같은 시간을 다르게 읽습니다',
        body:
          '우리가 일상에서 쓰는 표준시는 행정상 편의를 위해 맞춘 시간입니다. 반면 진태양시는 출생지의 경도를 반영해, 실제 태양 시간에 가깝게 다시 읽는 방식입니다.',
      },
      {
        title: '왜 출생지 경도가 들어가야 하나요?',
        body:
          '같은 한국 안에서도 동쪽과 서쪽은 태양이 뜨고 지는 감각이 조금씩 다릅니다. 절기 직전이나 자시 경계처럼 민감한 구간에서는 이 차이가 시주나 일주 해석에 영향을 줄 수 있습니다.',
      },
      {
        title: '간지사주는 시간을 모를 때도 안전하게 읽습니다',
        body:
          '시간이 정확하면 진태양시와 야자시·조자시 적용을 분리해 더 정밀하게 읽고, 시간이 불확실하면 시주 해석을 줄여 일간·월령·현재 운 중심으로 해석합니다. 정밀도와 안전성을 함께 챙기려는 구조입니다.',
      },
    ],
    checklist: [
      '출생지 입력이 실제 보정 계산에 쓰이는가',
      '진태양시와 표준시를 구분해 보여주는가',
      '자시 경계 규칙을 별도 옵션으로 분리하는가',
      '시간을 모를 때 시주 해석을 줄이는 안전 장치가 있는가',
    ],
    closing:
      '진태양시는 사주를 더 어렵게 만들기 위한 옵션이 아니라, 경계 구간을 더 신중하게 보기 위한 정보입니다. 그래서 간지사주는 출생지와 시간 규칙을 “추가 입력”이 아니라 “정밀도 메시지”로 같이 설명합니다.',
  },
  {
    slug: 'why-yongsin-is-hard',
    title: '용신 계산은 왜 어려운가',
    summary:
      '용신이 단순 오행 하나를 찍는 문제가 아니라, 강약·격국·계절성을 같이 묶어 판단해야 하는 이유를 간지사주 관점으로 정리한 글입니다.',
    description:
      '용신 계산이 왜 어려운지, 강약·격국·계절성을 어떻게 같이 봐야 하는지 간지사주 관점으로 설명한 페이지입니다.',
    eyebrow: '격국 · 용신 해설',
    question: '왜 어떤 곳은 수용신, 어떤 곳은 화용신이라고 말할까요?',
    lead:
      '용신은 “부족한 오행 하나를 채우는 문제”처럼 보이지만 실제로는 그렇게 단순하지 않습니다. 강약, 월령, 격국, 계절성, 현재 운이 어떻게 겹치는지를 함께 봐야 하기 때문입니다.',
    keywords: ['용신 계산', '격국 용신', '사주 강약', '계절성 사주'],
    relatedSlugs: [
      'why-pattern-judgments-diverge',
      'why-jeolgi-matters-in-chart-calculation',
      'how-far-to-trust-gongmang-and-shinsal',
    ],
    sections: [
      {
        title: '용신은 억부만으로 끝나지 않습니다',
        body:
          '일간이 강한지 약한지만 보고 바로 용신을 정하면 현실 해석이 단순해질 수 있습니다. 실제 명식에서는 계절의 춥고 더움, 월령의 주도권, 격국의 방향성을 같이 봐야 보완 기운이 왜 필요한지 설명할 수 있습니다.',
      },
      {
        title: '격국과 용신이 함께 흔들리는 이유가 있습니다',
        body:
          '격국이 달라지면 명식이 어떤 역할을 중심으로 움직이는지 자체가 바뀝니다. 그러면 용신도 “무엇을 보완해야 하는가”가 달라질 수 있어, 같은 명식이라도 해석 순서가 바뀌면 결과가 달라지는 일이 생깁니다.',
      },
      {
        title: '간지사주는 후보와 이유를 함께 보여줍니다',
        body:
          '간지사주는 최종 용신 하나만 던지는 대신, 후보와 보조 기운, 기신, 그리고 왜 그런 판단이 나왔는지를 참고 단서와 함께 보여줍니다. 사용자는 결과를 외우기보다 내 사주의 흐름을 이해할 수 있습니다.',
      },
    ],
    checklist: [
      '강약 점수만이 아니라 월령과 격국 후보를 같이 보여주는가',
      '용신 하나만이 아니라 보조·기신도 함께 설명하는가',
      '실전 행동 조언이 용신 설명과 연결되는가',
      '논쟁적인 구간은 참고 해석으로 낮춰 표시하는가',
    ],
    closing:
      '용신 계산이 어려운 이유는 오행 하나를 고르는 일이 아니라, 명식 전체의 균형과 역할을 함께 읽는 일이기 때문입니다. 그래서 간지사주는 용신을 “정답 한 줄”보다 “왜 그렇게 보았는지 알 수 있는 구조”로 보여주려고 합니다.',
  },
  {
    slug: 'why-pattern-judgments-diverge',
    title: '격국 해석은 왜 갈리는가',
    summary:
      '같은 명식인데도 정관격, 종격, 재격처럼 격국 이름이 달라지는 이유를 월령·투출·강약의 우선순위 관점에서 풀어낸 글입니다.',
    description:
      '격국 해석이 왜 갈리는지, 월령과 투출, 강약 중 무엇을 더 중요하게 보느냐가 결과에 어떤 차이를 만드는지 설명한 페이지입니다.',
    eyebrow: '격국 해석',
    question: '왜 어떤 곳은 정관격, 어떤 곳은 종격이라고 말할까요?',
    lead:
      '격국은 이름 하나를 붙이는 작업처럼 보이지만, 실제로는 월령의 주도권, 천간 투출, 일간 강약 중 무엇을 더 크게 보느냐에 따라 해석이 달라질 수 있습니다. 격국이 갈리면 그 뒤 용신과 현실 조언도 함께 달라지기 쉽습니다.',
    keywords: ['격국 해석', '정관격', '종격', '월령 사주', '투출'],
    relatedSlugs: [
      'why-yongsin-is-hard',
      'why-jeolgi-matters-in-chart-calculation',
      'why-ai-saju-can-drift',
    ],
    sections: [
      {
        title: '격국은 먼저 월령의 주도권을 확인하는 작업입니다',
        body:
          '사주에서 격국을 읽을 때는 무엇보다 월령이 어떤 기운을 잡고 있는지 먼저 봅니다. 계절과 월지가 주는 기세를 무시하면, 표면적으로 드러난 천간만 보고 격국을 섣불리 정하는 일이 생길 수 있습니다.',
      },
      {
        title: '천간 투출과 일간 강약 중 무엇을 더 보느냐가 결과를 바꿉니다',
        body:
          '같은 명식도 어떤 신이 투출했는지, 그 신이 실제로 힘을 쓰는지, 일간이 그 흐름을 감당할 만큼 강한지에 따라 해석의 중심이 달라집니다. 그래서 어떤 해석은 정관격을 우선하고, 다른 해석은 종격 가능성을 더 강하게 보는 식의 차이가 생깁니다.',
      },
      {
        title: '간지사주는 후보와 최종 해석을 같이 보여줍니다',
        body:
          '간지사주는 격국 이름 하나만 던지지 않고, 어떤 후보를 검토했고 왜 그 판단이 우선됐는지를 쉬운 판단 단서로 확인할 수 있게 둡니다.',
      },
    ],
    checklist: [
      '월령과 계절성이 격국 후보보다 먼저 설명되는가',
      '투출 여부와 실제 작동력을 같이 보여주는가',
      '격국 후보와 최종 해석이 함께 남는가',
      '격국이 달라질 때 용신과 행동 조언도 같이 달라지는가',
    ],
    closing:
      '격국 해석이 갈리는 이유는 해석자가 말을 다르게 붙여서가 아니라, 월령·투출·강약의 우선순위를 다르게 보기 때문입니다. 그래서 간지사주는 최종 이름보다 왜 그렇게 보았는지를 같이 남기는 방식을 택합니다.',
  },
  {
    slug: 'what-if-birth-hour-is-unknown',
    title: '출생시를 모르면 어디까지 읽을 수 있나',
    summary:
      '태어난 시간을 모를 때 사주풀이가 완전히 불가능한지, 무엇은 읽고 무엇은 보수적으로 낮춰야 하는지를 안전 원칙 중심으로 설명한 글입니다.',
    description:
      '출생시를 모를 때 사주에서 어디까지 읽을 수 있는지, 시주 해석을 줄이고 어떤 축을 중심으로 안전하게 해석해야 하는지 간지사주 관점으로 설명한 페이지입니다.',
    eyebrow: '입력 정밀도 가이드',
    question: '태어난 시간을 모르는데도 사주를 볼 수 있나요?',
    lead:
      '출생시를 모른다고 해서 사주풀이가 완전히 멈추는 것은 아닙니다. 다만 시주가 바꾸는 영역을 무리해서 단정하지 않고, 일간·월령·대운처럼 더 안정적인 축을 중심으로 읽어야 결과가 덜 흔들립니다.',
    keywords: ['출생시 모름', '사주 시주', '사주 정확도', '시간 모를 때 사주'],
    relatedSlugs: [
      'what-is-true-solar-time',
      'why-jeolgi-matters-in-chart-calculation',
      'how-to-read-daewoon-and-sewoon-together',
    ],
    sections: [
      {
        title: '시간을 몰라도 읽을 수 있는 축은 남아 있습니다',
        body:
          '년주, 월주, 일주는 그대로 남기 때문에 기본 성향, 계절성, 강약, 격국 후보, 현재 운의 큰 방향은 여전히 읽을 수 있습니다. 특히 일간과 월령 중심 해석은 시간 정보가 없을 때도 비교적 안정적으로 남는 축입니다.',
      },
      {
        title: '시주가 바꾸는 부분은 더 조심스럽게 다뤄야 합니다',
        body:
          '시주는 후반 인생 감각, 자식궁, 세부 관계 반응, 일부 합충 구조에 영향을 줄 수 있습니다. 시간을 모르는데 이 부분을 단정적으로 말하면 그럴듯해 보여도 단서가 약해지기 때문에, 간지사주는 시주 중심 해석을 줄이고 참고 수준으로 낮춥니다.',
      },
      {
        title: '간지사주는 시간을 모를 때 안전 장치를 먼저 켭니다',
        body:
          '입력 단계에서 시간을 모른다고 선택하면 시주 해석 비중이 내려가고, 결과에서도 일간·월령·대운 중심으로 읽습니다. 이 방식은 “모르는 정보를 아는 척하지 않는 것”이 장기적으로 더 신뢰를 만든다는 원칙에서 나온 선택입니다.',
      },
    ],
    checklist: [
      '시간 미상일 때 시주 판단을 줄이는가',
      '일간·월령·대운 중심 해석으로 자동 전환되는가',
      '시주가 필요한 영역은 참고 수준으로 낮추는가',
      '정밀도가 낮아진 이유를 사용자에게 설명하는가',
    ],
    closing:
      '출생시를 모를 때 중요한 것은 “어디까지 말할 수 있나”보다 “어디서부터는 보수적으로 낮춰야 하나”입니다. 간지사주는 그 경계를 숨기지 않고, 안전하게 읽는 방식을 결과 안에서 같이 보여주려 합니다.',
  },
  {
    slug: 'why-ai-saju-differs-from-calendar-apps',
    title: 'AI 사주와 만세력 앱이 다르게 나오는 이유',
    summary:
      '같은 생년월일인데 AI 사주 결과와 만세력 앱의 기둥·용신·해석이 다르게 느껴지는 이유를 계산 정보와 설명 레이어 차이로 풀어낸 글입니다.',
    description:
      'AI 사주와 만세력 앱 결과가 왜 다르게 나오는지, 계산 정보와 설명 레이어가 어떤 차이를 만드는지 간지사주 관점으로 설명한 페이지입니다.',
    eyebrow: '만세력 비교',
    question: '왜 만세력 앱 결과와 AI 사주 설명이 서로 다르게 보일까요?',
    lead:
      '만세력 앱은 기둥과 운의 구조를 보여주는 데 강하고, 대화형 AI는 문장 설명에 강합니다. 문제는 계산 정보와 설명 레이어가 분리되지 않으면 사용자가 “기둥이 다른가, 말투만 다른가”를 구분하기 어려워진다는 점입니다.',
    keywords: ['만세력 앱', 'AI 사주 비교', '사주 결과 차이', '기둥 계산'],
    relatedSlugs: [
      'why-ai-saju-can-drift',
      'what-is-true-solar-time',
      'why-jeolgi-matters-in-chart-calculation',
    ],
    sections: [
      {
        title: '만세력 앱은 보통 구조를, AI는 보통 설명을 잘합니다',
        body:
          '전통적인 만세력 앱은 년주·월주·일주·시주와 운의 흐름을 안정적으로 보여주는 데 강합니다. 반면 대화형 AI는 사용자의 질문에 맞춰 문장을 정리하는 데 강하지만, 계산 정보이 노출되지 않으면 그 설명이 어디서 왔는지 확인하기 어렵습니다.',
      },
      {
        title: '다르게 보이는 이유는 계산 차이와 설명 차이가 섞여 있기 때문입니다',
        body:
          '어떤 서비스는 표준시만 쓰고, 어떤 서비스는 진태양시나 자시 규칙을 분리합니다. 또 어떤 서비스는 격국과 용신을 단순 오행 중심으로 풀고, 어떤 서비스는 강약과 월령을 더 우선합니다. 사용자는 이 둘을 한꺼번에 보게 되니 “앱이 틀렸나, AI가 틀렸나”처럼 느끼기 쉽습니다.',
      },
      {
        title: '간지사주는 만세력 감각과 설명 레이어를 이어주려 합니다',
        body:
          '간지사주는 명식과 운의 구조를 먼저 정리하고, AI는 그 구조를 사용자가 이해하기 쉬운 말로 풀어주는 역할만 맡습니다. 그래서 만세력처럼 기본 구조를 확인하면서도, 대화형 서비스처럼 현실적인 설명을 같이 받을 수 있습니다.',
      },
    ],
    checklist: [
      '기둥 계산 정보와 시간 규칙이 결과에 같이 보이는가',
      '격국·용신이 계산값인지 AI 추측인지 구분되는가',
      '만세력 구조와 자연어 설명이 분리돼 있는가',
      '다른 앱과 달라질 수 있는 지점을 단서로 보여주는가',
    ],
    closing:
      'AI 사주와 만세력 앱이 다르게 느껴지는 이유는 둘 중 하나가 무조건 틀려서가 아니라, 계산 정보와 설명 방식이 한 화면에서 분리되어 보이지 않기 때문입니다. 간지사주는 그 차이를 구조와 설명 사이에서 직접 보여주려 합니다.',
  },
  {
    slug: 'why-jeolgi-matters-in-chart-calculation',
    title: '절기 반영 명식은 왜 중요한가',
    summary:
      '사주에서 월이 단순한 달력이 아니라 절기로 나뉘는 이유와, 절기 반영이 격국·강약·계절성 해석에 어떤 영향을 주는지 설명한 글입니다.',
    description:
      '절기 반영 명식이 왜 중요한지, 달력 월과 사주 월이 어떻게 다르고 그 차이가 격국과 강약 해석에 어떤 영향을 주는지 간지사주 관점으로 정리한 페이지입니다.',
    eyebrow: '절기 반영 해설',
    question: '왜 같은 3월생이어도 사주 월이 다르게 읽히는 일이 생길까요?',
    lead:
      '사주에서 월은 달력 숫자가 아니라 절기의 흐름으로 잡습니다. 같은 3월이라도 절기 경계를 넘었는지에 따라 월령이 바뀌고, 그 변화는 격국·강약·용신 해석의 출발점을 함께 바꿉니다.',
    keywords: ['절기 사주', '월령', '사주 월주', '명식 계산 정보'],
    relatedSlugs: [
      'what-is-true-solar-time',
      'why-pattern-judgments-diverge',
      'why-yongsin-is-hard',
    ],
    sections: [
      {
        title: '사주에서 월은 달력이 아니라 계절의 문턱입니다',
        body:
          '일상에서는 3월이면 모두 같은 3월이지만, 사주에서는 입춘·경칩·청명처럼 절기 경계를 먼저 봅니다. 이 원칙은 “지금 어떤 기운이 계절의 주도권을 쥐고 있는가”를 읽기 위한 장치입니다.',
      },
      {
        title: '월령이 바뀌면 강약과 격국의 첫 단추도 달라집니다',
        body:
          '월령은 어떤 기운이 계절의 배경을 잡고 있는지 보여주기 때문에, 일간이 어디서 힘을 얻고 어디서 힘을 잃는지 판단하는 바탕이 됩니다. 절기 반영을 놓치면 강약 점수와 격국 후보가 함께 흔들릴 수 있습니다.',
      },
      {
        title: '간지사주는 절기 반영을 결과 화면 가까이에 붙입니다',
        body:
          '간지사주는 명식 계산에서 절기 반영을 먼저 적용하고, 결과 화면에서도 공식 음양력 대조와 판단 단서를 함께 보여줍니다. 사용자는 긴 글을 읽기 전에 “월이 왜 이렇게 잡혔는지”를 직접 확인할 수 있습니다.',
      },
    ],
    checklist: [
      '월주가 달력 월이 아니라 절기 반영으로 계산되는가',
      '월령이 강약과 격국의 출발점으로 설명되는가',
      '절기 경계에 가까운 출생은 재확인 메시지가 있는가',
      '결과 화면에서 월령 단서를 직접 볼 수 있는가',
    ],
    closing:
      '절기 반영 명식은 사주를 어렵게 보이게 만들기 위한 장치가 아니라, 계절의 실제 주도권을 놓치지 않기 위한 정보입니다. 그래서 간지사주는 월령을 계산의 앞단에 두고, 그 결과를 판단 단서와 같이 보여줍니다.',
  },
  {
    slug: 'how-to-read-daewoon-and-sewoon-together',
    title: '대운과 세운은 어떻게 같이 읽는가',
    summary:
      '대운과 세운을 따로따로 보지 않고, 큰 배경과 올해의 촉발점을 어떻게 함께 읽어야 하는지 설명한 글입니다.',
    description:
      '대운과 세운을 함께 읽는 원칙이 무엇인지, 장기 흐름과 올해 사건성이 어떻게 연결되는지 간지사주 관점으로 설명한 페이지입니다.',
    eyebrow: '운 흐름 해설',
    question: '왜 올해 운세만 보면 안 되고, 대운까지 같이 봐야 하나요?',
    lead:
      '세운은 한 해의 촉발점이고, 대운은 그 촉발점이 어떤 배경 위에서 작동하는지 알려주는 큰 흐름입니다. 올해 운만 따로 보면 말은 빠르지만, 왜 그 일이 지금 더 크게 체감되는지는 놓치기 쉽습니다.',
    keywords: ['대운 세운', '사주 운세 흐름', '연간 운세', '대운 해석'],
    relatedSlugs: [
      'what-if-birth-hour-is-unknown',
      'how-far-to-trust-gongmang-and-shinsal',
      'why-ai-saju-differs-from-calendar-apps',
    ],
    sections: [
      {
        title: '대운은 배경, 세운은 촉발점에 가깝습니다',
        body:
          '대운은 10년 단위로 삶의 무게 중심이 어디에 놓이는지 보여주고, 세운은 그 해에 어떤 주제가 유독 강하게 표면으로 올라오는지 알려줍니다. 같은 세운이라도 어떤 대운 위에 놓였는지에 따라 체감 강도는 달라질 수 있습니다.',
      },
      {
        title: '그래서 사건보다 맥락을 먼저 확인해야 합니다',
        body:
          '세운만 보면 “올해 관계가 흔들린다”처럼 읽힐 수 있지만, 대운까지 같이 보면 그 흔들림이 새로운 확장인지, 정리 국면인지, 오래 쌓인 문제의 표면화인지가 달라집니다. 이 구분이 있어야 행동 조언도 덜 단선적이 됩니다.',
      },
      {
        title: '간지사주는 현재 운을 장기 흐름과 같이 엮어 보여줍니다',
        body:
          '간지사주 리포트에서는 세운·월운·오늘 흐름을 보여줄 때도 현재 대운을 함께 붙입니다. 올해 전략서와 깊은 사주풀이에서 같은 명식을 다르게 쓰는 이유도, 한 해의 촉발점과 평생 원칙을 분리해 보여주기 위해서입니다.',
      },
    ],
    checklist: [
      '세운 설명에 현재 대운이 같이 보이는가',
      '올해의 사건성과 장기 과제가 구분되는가',
      '월운과 오늘 흐름이 대운 배경 안에서 설명되는가',
      '올해 전략서와 깊은 사주풀이가 역할별로 분리돼 있는가',
    ],
    closing:
      '대운과 세운을 같이 읽는다는 것은 “올해 무슨 일이 있나”를 넘어서 “왜 지금 이 일이 크게 체감되나”를 보는 일에 가깝습니다. 간지사주는 이 배경과 촉발점을 한 화면에서 함께 보이게 하려 합니다.',
  },
  {
    slug: 'how-far-to-trust-gongmang-and-shinsal',
    title: '공망과 신살은 어디까지 참고해야 하나',
    summary:
      '공망과 신살을 공포스럽게 단정하지 않고, 보조 신호로 어디까지 참고해야 하는지 설명한 글입니다.',
    description:
      '공망과 신살을 사주에서 어디까지 참고해야 하는지, 보조 신호로 어떻게 읽어야 하는지 간지사주 관점으로 설명한 페이지입니다.',
    eyebrow: '보조 해석 방식',
    question: '공망이나 신살이 나오면 정말 나쁜 일이 생긴다고 봐야 하나요?',
    lead:
      '공망과 신살은 많은 분들이 가장 먼저 불안해하는 항목이지만, 실제로는 중심 해석을 뒤집는 원칙이 아니라 보조 신호에 가깝습니다. 문제는 이 항목이 과장되면 사주가 구조 해석이 아니라 공포 예언처럼 들린다는 점입니다.',
    keywords: ['공망', '신살', '사주 해석 원칙', '사주 불안'],
    relatedSlugs: [
      'how-to-read-daewoon-and-sewoon-together',
      'why-yongsin-is-hard',
      'what-if-birth-hour-is-unknown',
    ],
    sections: [
      {
        title: '공망과 신살은 중심 해석 위에 얹는 보조 신호입니다',
        body:
          '강약, 격국, 용신, 대운처럼 명식의 뼈대를 먼저 읽지 않고 공망이나 신살부터 앞세우면 해석이 쉽게 과장됩니다. 이 항목은 어디서 속도를 늦추고 재확인을 해야 하는지 알려주는 보조 표지에 가깝습니다.',
      },
      {
        title: '불안감을 키우는 단정 문장은 오히려 신뢰를 깎습니다',
        body:
          '“이 신살이 있으니 반드시 이별한다” 같은 말은 사용자의 불안을 키울 뿐 아니라, 실제 명식 구조를 설명하는 데도 도움이 되지 않습니다. 같은 신살도 원국과 현재 운 맥락에 따라 체감이 달라지기 때문에 단정적으로 말하기 어렵습니다.',
      },
      {
        title: '간지사주는 공망·신살을 행동 가이드로 낮춰 씁니다',
        body:
          '간지사주는 공망과 신살을 겁을 주는 장식이 아니라, 확인 절차와 속도 조절을 알려주는 보조 단서로 사용합니다. 그래서 결과 화면에서도 “참고 해석”과 “실전 조언”을 분리해 보여주고, 중심 판단 단서와 섞이지 않게 다룹니다.',
      },
    ],
    checklist: [
      '공망과 신살이 강약·격국보다 앞서지 않는가',
      '보조 단서와 중심 해석이 분리돼 보이는가',
      '공포형 단정 문구를 피하고 행동 가이드로 낮추는가',
      '현재 운 맥락 안에서만 참고 신호로 쓰는가',
    ],
    closing:
      '공망과 신살을 어디까지 믿어야 하느냐는 질문의 답은, “중심 해석을 보강하는 선까지”입니다. 간지사주는 이 항목을 두려움이 아니라 재확인과 속도 조절의 신호로 다루는 쪽을 선택합니다.',
  },
];

const METHOD_TITLE_OVERRIDES: Record<string, string> = {
  'why-ai-saju-can-drift': 'AI 사주 결과가 왜 달라질까',
  'what-is-true-solar-time': '출생지와 시간이 왜 필요할까',
  'why-yongsin-is-hard': '부족한 기운은 어떻게 읽을까',
  'why-pattern-judgments-diverge': '타고난 역할 흐름은 왜 다르게 보일까',
  'what-if-birth-hour-is-unknown': '태어난 시간을 모르면 어디까지 볼 수 있을까',
  'why-ai-saju-differs-from-calendar-apps': '만세력 앱과 결과가 왜 다를까',
  'why-jeolgi-matters-in-chart-calculation': '계절 흐름은 왜 볼까',
  'how-to-read-daewoon-and-sewoon-together': '큰 흐름과 올해 흐름은 어떻게 같이 볼까',
  'how-far-to-trust-gongmang-and-shinsal': '불안한 보조 해석은 어디까지 믿을까',
};

const METHOD_EYEBROW_OVERRIDES: Record<string, string> = {
  'why-ai-saju-can-drift': '결과 차이 도움말',
  'what-is-true-solar-time': '시간과 장소 도움말',
  'why-yongsin-is-hard': '균형 보기 도움말',
  'why-pattern-judgments-diverge': '타고난 역할 도움말',
  'what-if-birth-hour-is-unknown': '시간 미상 도움말',
  'why-ai-saju-differs-from-calendar-apps': '앱 결과 차이 도움말',
  'why-jeolgi-matters-in-chart-calculation': '계절 흐름 도움말',
  'how-to-read-daewoon-and-sewoon-together': '올해 흐름 도움말',
  'how-far-to-trust-gongmang-and-shinsal': '불안 줄이기 도움말',
};

function simplifyMethodText(value: string) {
  return simplifySajuCopy(value)
    .replace(/AI 사주가 왜 흔들리는가/g, 'AI 사주 결과가 왜 달라질까')
    .replace(/AI 사주가 왜 흔들리는지/g, 'AI 사주 결과가 왜 달라지는지')
    .replace(/설명 레이어/g, '설명 방식')
    .replace(/계산 정보/g, '풀이 정보')
    .replace(/구조 해석/g, '흐름 설명')
    .replace(/계산과 설명/g, '풀이와 설명')
    .replace(/계산된 결과/g, '정리된 결과')
    .replace(/계산된 구조/g, '정리된 흐름')
    .replace(/계산을 먼저/g, '정보를 먼저')
    .replace(/계산을/g, '풀이 정보를')
    .replace(/계산/g, '풀이 정보')
    .replace(/판단 힌트/g, '확인 단서')
    .replace(/판단/g, '확인')
    .replace(/원칙/g, '안내')
    .replace(/명리/g, '사주풀이')
    .replace(/참고 해석/g, '참고용 해석')
    .replace(/논쟁적 해석/g, '의견이 갈릴 수 있는 해석')
    .replace(/뼈대/g, '큰 흐름')
    .replace(/역할 흐름/g, '타고난 역할')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function simplifyMethodEntry(entry: EngineMethodEntry): EngineMethodEntry {
  return {
    ...entry,
    title: METHOD_TITLE_OVERRIDES[entry.slug] ?? simplifyMethodText(entry.title),
    eyebrow: METHOD_EYEBROW_OVERRIDES[entry.slug] ?? simplifyMethodText(entry.eyebrow),
    summary: simplifyMethodText(entry.summary),
    description: simplifyMethodText(entry.description),
    question: simplifyMethodText(entry.question),
    lead: simplifyMethodText(entry.lead),
    keywords: simplifySajuCopyList(entry.keywords).map((keyword) => simplifyMethodText(keyword)),
    sections: entry.sections.map((section) => ({
      title: simplifyMethodText(section.title),
      body: simplifyMethodText(section.body),
    })),
    checklist: entry.checklist.map((item) => simplifyMethodText(item)),
    closing: simplifyMethodText(entry.closing),
  };
}

export const ENGINE_METHOD_ENTRIES: EngineMethodEntry[] = RAW_ENGINE_METHOD_ENTRIES.map(simplifyMethodEntry);
