import { getKstParts } from '@/shared/utils/kst';

export interface TopicBlock {
  title: string;
  body: string;
}

// 2026-05-24 — 연생(태어난 해)별 풀이.
//   같은 띠라도 태어난 해의 천간(60갑자)이 달라 기운의 흐름이 조금씩 다름.
//   닭띠 파일럿: byYear 가 있으면 상세 페이지에서 ?birthYear=YYYY 로 연생 선택 노출.
//   - ganji/ganjiKo/element 은 정체성 표기용(한자/오행 라벨 허용),
//     summary/detail 본문은 naming-policy 에 따라 한글 + "X 기운" 표기만 사용.
export interface ZodiacByYearFortune {
  /** 천간×지지 한자 (정체성 표기, 본문 노출 금지) */
  ganji: string;
  /** 간지 한글 독음 (예: '정유') */
  ganjiKo: string;
  /** 천간 오행 한 줄 라벨 (예: '화 기운') */
  element: string;
  /** 연생 한 줄 요약 */
  summary: string;
  /** 연생 풀이 (3~4문장) */
  detail: string;
  /** 연생별 행동 조언 (1~2문장) */
  action: string;
}

export interface ZodiacFortune {
  slug: string;
  label: string;
  years: string;
  summary: string;
  todayFocus: string;
  action: string;
  /** 연생별 풀이 (연도 → 풀이). 없으면 단일 띠 화면 그대로. */
  byYear?: Record<number, ZodiacByYearFortune>;
}

export interface StarSignFortune {
  slug: string;
  label: string;
  dateRange: string;
  summary: string;
  todayFocus: string;
  action: string;
}

export interface DreamEntry {
  slug: string;
  title: string;
  summary: string;
  meaning: string;
  action: string;
}

const DAILY_HEADLINES = [
  '오늘은 흐름을 가볍게 읽고 작은 행동으로 체감할 날입니다.',
  '관계와 돈, 일의 우선순위를 분명히 할수록 하루가 단단해집니다.',
  '크게 벌리기보다 이미 들어온 신호를 정확히 읽는 쪽이 유리합니다.',
  '오늘의 운은 속도보다 방향을 맞출 때 더 강하게 붙습니다.',
  '한 번에 정답을 찾기보다 기분 좋은 감각을 먼저 잡아보세요.',
];

const DAILY_SUMMARIES = [
  '감정선이 과열되기 전에 먼저 정리하면 좋은 결과로 이어질 가능성이 큽니다.',
  '지출, 연락, 업무처럼 반복되는 루틴을 다듬는 쪽에서 운이 풀립니다.',
  '새로운 제안은 작아 보여도 바로 붙잡는 편이 더 낫습니다.',
  '혼자 판단을 길게 끌기보다 짧은 확인과 피드백이 필요합니다.',
  '주도권은 강한 주장보다 부드러운 타이밍에서 생깁니다.',
];

const DAILY_COLORS = ['네이비', '아이보리', '골드', '인디고', '실버'];
const DAILY_SIGNS = ['연애운', '재물운', '직장운', '관계운', '오늘의 한 줄'];

// 2026-05-18 Phase 2: raw new Date().getDate() (UTC) → getKstParts().day (KST).
//   기존 코드는 Vercel UTC 기준이라 KST 00:00 ~ 09:00 사이에 어제 seed 노출 (audit P0 #4).
export function buildTodayFortune() {
  const seed = getKstParts().day;
  const index = seed % DAILY_HEADLINES.length;

  return {
    headline: DAILY_HEADLINES[index],
    summary: DAILY_SUMMARIES[index],
    luckyColor: DAILY_COLORS[index],
    luckyTime: `${(seed % 8) + 9}:00`,
    sections: DAILY_SIGNS.map((label, offset) => ({
      title: label,
      body: DAILY_SUMMARIES[(index + offset) % DAILY_SUMMARIES.length],
    })),
  };
}

export const ZODIAC_FORTUNES: ZodiacFortune[] = [
  { slug: 'rat', label: '쥐띠', years: '1996, 1984, 1972, 1960', summary: '작은 흐름을 먼저 읽어야 손실을 줄일 수 있는 날입니다.', todayFocus: '재물과 일정 정리', action: '급한 결정보다 체크리스트를 먼저 보세요.' },
  { slug: 'ox', label: '소띠', years: '1997, 1985, 1973, 1961', summary: '느리더라도 꾸준히 이어가는 힘이 강하게 작동합니다.', todayFocus: '직장과 성과 관리', action: '미뤄둔 정리를 끝내면 마음이 훨씬 편해집니다.' },
  { slug: 'tiger', label: '호랑이띠', years: '1998, 1986, 1974, 1962', summary: '주도권을 잡을 기회가 오지만 말의 온도 조절이 중요합니다.', todayFocus: '관계와 협업', action: '강한 표현보다 선명한 제안이 더 효과적입니다.' },
  { slug: 'rabbit', label: '토끼띠', years: '1999, 1987, 1975, 1963', summary: '감각이 좋은 날이라 취향과 직감이 꽤 잘 맞습니다.', todayFocus: '연애와 소통', action: '먼저 다가가되 속도를 과하게 높이지 마세요.' },
  { slug: 'dragon', label: '용띠', years: '2000, 1988, 1976, 1964', summary: '큰 그림을 볼수록 오히려 오늘 해야 할 일이 선명해집니다.', todayFocus: '새로운 기회', action: '들어온 제안을 흘려보내지 말고 메모해두세요.' },
  { slug: 'snake', label: '뱀띠', years: '2001, 1989, 1977, 1965', summary: '관찰력이 강해지는 날이지만 해석만 길어지지 않게 주의가 필요합니다.', todayFocus: '심리와 관계 거리감', action: '생각만 하지 말고 짧은 확인 메시지를 보내보세요.' },
  { slug: 'horse', label: '말띠', years: '2002, 1990, 1978, 1966', summary: '활동량이 늘어날수록 운도 같이 붙는 활기 구간입니다.', todayFocus: '일과 표현력', action: '먼저 제안하고 먼저 움직이는 쪽이 유리합니다.' },
  { slug: 'goat', label: '양띠', years: '2003, 1991, 1979, 1967', summary: '무리한 확장보다 주변 균형을 맞출 때 안정감이 생깁니다.', todayFocus: '감정과 휴식', action: '해야 할 일과 쉬어야 할 시간을 같이 정해두세요.' },
  { slug: 'monkey', label: '원숭이띠', years: '2004, 1992, 1980, 1968', summary: '센스와 순발력이 강하게 살아나는 날이라 대응이 빠릅니다.', todayFocus: '거래와 커뮤니케이션', action: '가벼운 대화 속에서도 중요한 힌트를 챙기세요.' },
  {
    slug: 'rooster',
    label: '닭띠',
    years: '2005, 1993, 1981, 1969',
    summary: '기준이 선명해질수록 오히려 마음이 가벼워지는 날입니다.',
    todayFocus: '기준 정리와 선택',
    action: '완벽을 기다리기보다 80점에서 먼저 실행하세요.',
    // 2026-05-24 — 닭띠 연생별 풀이 파일럿(5연생). 천간 오행의 결을 살려 톤만 다르게.
    byYear: {
      1957: {
        ganji: '丁酉',
        ganjiKo: '정유',
        element: '화 기운',
        summary: '따뜻하게 밝히는 화 기운이 닭띠의 또렷함과 어울리는 해예요.',
        detail:
          '같은 닭띠라도 1957년생은 따뜻하게 밝히는 화 기운이 함께 흐르는 편이에요. 기준을 또렷이 세우는 닭띠의 성향에 사람을 데우는 다정함이 더해져, 곁에 온기를 나누고 분위기를 밝히는 자리에서 마음이 한결 편안해집니다. 오래 쌓아 온 경험을 말로 풀어 나눌 때 그 빛이 가장 잘 드러나고, 주변에서도 자연스럽게 곁을 찾게 됩니다. 다만 마음이 한번 달아오르면 빠르게 타오르기 쉬워, 감정이 앞설 때 한 박자 쉬어 가면 흐름이 더 부드러워집니다.',
        action:
          '오늘은 먼저 안부를 건네거나 따뜻한 말 한마디를 전해 보세요. 중요한 결정은 서두르기보다 하룻밤 두고 보면 한결 단단해집니다.',
      },
      1969: {
        ganji: '己酉',
        ganjiKo: '기유',
        element: '토 기운',
        summary: '차분히 담아내는 토 기운이 닭띠의 꼼꼼함을 받쳐 주는 해예요.',
        detail:
          '1969년생은 안정감 있게 담아내는 토 기운이 닭띠의 정돈하는 성향과 잘 맞는 편이에요. 주변을 두루 살피고 기반을 다지는 흐름이 강해, 한 번에 크게 벌이기보다 천천히 쌓아 가는 일에서 마음의 안정을 얻기 쉽습니다. 사람들 사이에서 중심을 잡아 주는 역할이 자연스럽게 어울리고, 그 믿음직함이 오래갈수록 빛납니다. 다만 모든 것을 혼자 떠안으려 하면 어깨가 무거워지니, 맡길 부분과 내 몫을 나눠 두면 한결 가볍습니다.',
        action:
          '오늘은 책상이나 일정처럼 가까운 것부터 하나 정리해 보세요. 부담되는 일은 믿을 만한 사람과 나눠 맡기면 흐름이 수월해집니다.',
      },
      1981: {
        ganji: '辛酉',
        ganjiKo: '신유',
        element: '금 기운',
        summary: '단단하게 마무리하는 금 기운이 닭띠의 선명함과 겹치는 해예요.',
        detail:
          '1981년생은 단단함과 결단을 뜻하는 금 기운이 닭띠 본래의 또렷함과 겹쳐, 기준이 분명해지는 흐름이 강한 편이에요. 핵심을 골라 군더더기 없이 매듭짓는 일에서 큰 만족감을 느끼고, 맡은 자리에서 야무지다는 평을 듣기 쉽습니다. 한번 방향을 정하면 미루지 않고 빠르게 정리해 나가는 추진력이 강점입니다. 다만 기준이 날카로워질 때는 말투가 단호해지기 쉬우니, 부드러운 한 겹을 얹어 두면 관계가 한결 편안해집니다.',
        action:
          '오늘은 미뤄 둔 일 하나를 골라 깔끔하게 끝맺어 보세요. 의견을 전할 때는 결론 앞에 상대를 헤아리는 한마디를 먼저 두면 좋습니다.',
      },
      1993: {
        ganji: '癸酉',
        ganjiKo: '계유',
        element: '수 기운',
        summary: '깊이 흐르는 수 기운이 닭띠의 또렷함에 여유를 더하는 해예요.',
        detail:
          '1993년생은 흐름과 깊이를 뜻하는 수 기운이 함께해, 닭띠의 또렷한 기준에 부드러운 유연함이 더해지는 편이에요. 상황을 천천히 읽고 속을 헤아리는 힘이 좋아, 서두르기보다 흐름을 살필 때 길이 더 잘 보입니다. 새로운 정보를 빠르게 흡수해 자기 식으로 정리하는 데 강점이 있어, 배우고 익히는 자리에서 빛납니다. 다만 생각이 길어지면 행동이 늦어지기 쉬우니, 작은 한 걸음으로 매듭을 지어 두면 마음이 가벼워집니다.',
        action:
          '오늘은 고민하던 일을 글로 한번 적어 정리해 보세요. 충분히 살폈다면 작은 것부터 바로 실행해 흐름을 만들면 좋습니다.',
      },
      2005: {
        ganji: '乙酉',
        ganjiKo: '을유',
        element: '목 기운',
        summary: '부드럽게 자라나는 목 기운이 닭띠의 또렷함을 살려 주는 해예요.',
        detail:
          '2005년생은 자라남과 시작을 뜻하는 목 기운이 함께해, 닭띠의 또렷한 성향에 새로운 시도를 더하기 좋은 편이에요. 호기심을 따라 한 걸음씩 영역을 넓혀 가는 흐름이 잘 어울리고, 배우고 부딪치며 빠르게 성장하기 쉽습니다. 주변의 변화에 유연하게 적응하는 힘이 있어, 낯선 환경에서도 자기 자리를 곧잘 찾아 갑니다. 다만 마음이 여러 갈래로 뻗을 때는 에너지가 흩어지기 쉬우니, 지금 가장 끌리는 한 가지에 먼저 집중하면 흐름이 또렷해집니다.',
        action:
          '오늘은 관심 가던 일 하나를 작게라도 시작해 보세요. 여러 가지가 끌린다면 우선순위 하나만 정해 거기에 먼저 힘을 모으면 좋습니다.',
      },
    },
  },
  { slug: 'dog', label: '개띠', years: '2006, 1994, 1982, 1970', summary: '주변 사람의 신뢰를 얻기 쉬운 날이라 관계운이 부드럽습니다.', todayFocus: '관계 회복', action: '오래 미뤄둔 답장을 오늘 정리해보세요.' },
  { slug: 'pig', label: '돼지띠', years: '2007, 1995, 1983, 1971', summary: '편안함 안에 기회가 숨어 있는 날이라 조용한 흐름이 좋습니다.', todayFocus: '소비와 휴식', action: '마음이 가는 쪽을 너무 계산적으로만 재지 마세요.' },
];

export const STAR_SIGN_FORTUNES: StarSignFortune[] = [
  { slug: 'aries', label: '양자리', dateRange: '3.21 - 4.19', summary: '직진성이 살아나는 날이지만 말의 세기를 조절하는 편이 좋습니다.', todayFocus: '시작과 추진력', action: '먼저 시작하되 확인을 한 번 더 거치세요.' },
  { slug: 'taurus', label: '황소자리', dateRange: '4.20 - 5.20', summary: '느긋한 리듬 속에서 안정감을 챙길수록 결과가 좋아집니다.', todayFocus: '돈과 루틴', action: '지출을 정리하면 하루가 더 단단해집니다.' },
  { slug: 'gemini', label: '쌍둥이자리', dateRange: '5.21 - 6.21', summary: '말과 정보가 많이 오가는 날이라 선택지를 정리하는 힘이 필요합니다.', todayFocus: '연락과 이동', action: '중요한 메시지는 오전에 먼저 보내는 편이 좋습니다.' },
  { slug: 'cancer', label: '게자리', dateRange: '6.22 - 7.22', summary: '감정이 예민해지는 날이라 주변 분위기를 잘 읽게 됩니다.', todayFocus: '관계와 공감', action: '서운함이 생기면 바로 단정하지 말고 질문부터 해보세요.' },
  { slug: 'leo', label: '사자자리', dateRange: '7.23 - 8.22', summary: '주목받는 흐름이 들어오지만 에너지를 한곳에 모을수록 좋습니다.', todayFocus: '표현과 존재감', action: '내가 원하는 것을 한 문장으로 분명히 말해보세요.' },
  { slug: 'virgo', label: '처녀자리', dateRange: '8.23 - 9.23', summary: '정리 능력이 살아나는 날이라 미뤄둔 일들을 빠르게 정돈할 수 있습니다.', todayFocus: '업무와 건강', action: '완료 기준을 먼저 정하면 불필요한 소모가 줄어듭니다.' },
  { slug: 'libra', label: '천칭자리', dateRange: '9.24 - 10.22', summary: '균형을 맞추는 감각이 좋아서 협의와 조율에 강합니다.', todayFocus: '관계 조율', action: '둘 다 만족할 수 있는 중간 지점을 먼저 제안해보세요.' },
  { slug: 'scorpio', label: '전갈자리', dateRange: '10.23 - 11.22', summary: '몰입이 깊어지는 날이라 중요한 일 하나를 깊게 파기 좋습니다.', todayFocus: '집중과 심리', action: '감정이 흔들릴수록 기록으로 정리해보세요.' },
  { slug: 'sagittarius', label: '사수자리', dateRange: '11.23 - 12.24', summary: '확장성과 호기심이 살아나는 날이라 새로운 자극이 잘 들어옵니다.', todayFocus: '새로운 제안', action: '작아 보여도 흥미로운 제안은 메모해두세요.' },
  { slug: 'capricorn', label: '염소자리', dateRange: '12.25 - 1.19', summary: '성과를 정리하고 숫자로 보는 힘이 좋아지는 날입니다.', todayFocus: '성과와 계획', action: '오늘은 해야 할 일보다 끝낸 일을 먼저 체크해보세요.' },
  { slug: 'aquarius', label: '물병자리', dateRange: '1.20 - 2.18', summary: '새로운 관점이 떠오르기 쉬워서 답답했던 문제를 풀 실마리가 보입니다.', todayFocus: '아이디어와 관계 거리감', action: '평소와 다른 방식으로 접근해보는 것이 좋습니다.' },
  { slug: 'pisces', label: '물고기자리', dateRange: '2.19 - 3.20', summary: '감정과 직감이 잘 맞아떨어지지만 경계도 함께 세워야 합니다.', todayFocus: '감정 정리', action: '좋은 감정은 표현하고, 불편한 감정은 바로 쌓아두지 마세요.' },
];

export const DREAM_ENTRIES: DreamEntry[] = [
  { slug: 'teeth-falling', title: '이가 빠지는 꿈', summary: '불안과 변화, 말하지 못한 스트레스가 꿈으로 올라오는 대표적인 장면입니다.', meaning: '관계나 일에서 통제력을 잃을까 걱정하는 마음이 반영될 수 있습니다.', action: '최근 긴장된 이슈를 적어보고 현실에서 조정할 수 있는 부분을 먼저 정리해보세요.' },
  { slug: 'snake-dream', title: '뱀이 나오는 꿈', summary: '재물, 욕망, 경계심이 동시에 섞여 나오는 상징적 장면으로 자주 해석됩니다.', meaning: '기회가 다가오거나 경계해야 할 사람이 있다는 무의식적 신호일 수 있습니다.', action: '좋은 제안과 불편한 제안을 구분해볼 기준을 세워보세요.' },
  { slug: 'water-dream', title: '물 꿈', summary: '감정 흐름과 컨디션, 관계 온도를 상징하는 경우가 많습니다.', meaning: '물이 맑으면 정리와 회복, 탁하면 피로와 혼란을 반영할 가능성이 큽니다.', action: '최근 감정 상태를 돌아보고 과하게 쌓인 피로를 먼저 정리하세요.' },
  { slug: 'flying-dream', title: '하늘을 나는 꿈', summary: '해방감, 도전 욕구, 현실을 벗어나고 싶은 마음이 반영되곤 합니다.', meaning: '상황이 답답할수록 마음은 더 크게 확장하려는 방향으로 움직일 수 있습니다.', action: '지금 가장 답답한 한 가지를 현실적으로 바꿀 수 있는 방법을 적어보세요.' },
  { slug: 'pregnancy-dream', title: '임신 꿈', summary: '새로운 시작, 아이디어, 책임감의 증가를 상징적으로 담는 경우가 많습니다.', meaning: '무언가를 키우고 준비해야 하는 시기가 가까워졌다는 무의식의 표현일 수 있습니다.', action: '지금 키우고 싶은 계획 하나를 구체적으로 적어보세요.' },
  { slug: 'money-dream', title: '돈 줍는 꿈', summary: '기회, 인정 욕구, 보상 심리가 반영되기 쉬운 장면입니다.', meaning: '작은 성과를 놓치지 말라는 신호이거나, 재물에 대한 기대가 올라간 상태일 수 있습니다.', action: '오늘 챙길 수 있는 작은 이익이나 절약 포인트를 찾아보세요.' },
  { slug: 'falling-dream', title: '떨어지는 꿈', summary: '불안, 압박, 통제력 저하가 몸과 마음에 쌓일 때 자주 등장합니다.', meaning: '결과를 예측하기 어려운 상황이 많아질수록 이런 형태로 나타나기 쉽습니다.', action: '당장 바꿀 수 없는 일보다 바로 조정 가능한 루틴부터 정리하세요.' },
  { slug: 'dead-relative-dream', title: '돌아가신 가족 꿈', summary: '그리움, 미해결 감정, 중요한 조언을 찾고 싶은 심리가 반영될 수 있습니다.', meaning: '감정적 안정이 필요하거나 오래된 기억을 다시 정리할 시기일 수 있습니다.', action: '떠오른 감정과 메시지를 메모해두고 너무 단정적으로 해석하지는 마세요.' },
];
