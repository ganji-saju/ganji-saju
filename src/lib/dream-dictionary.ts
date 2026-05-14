// 2026-05-14: 꿈해몽 사전. /api/dream/search 가 여기서 데이터를 가져온다.
// 추후 DB 로 이관해도 같은 인터페이스로 호환되도록 순수 데이터 모듈로 유지.

export interface DreamMeaning {
  keyword: string;
  hanja: string;
  category: 'animal' | 'person' | 'food' | 'nature' | 'object' | 'action';
  summary: string;
  situations: Array<{ label: string; meaning: string }>;
  related: string[];
}

export const DREAM_DICTIONARY: Record<string, DreamMeaning> = {
  이빨: {
    keyword: '이빨',
    hanja: '齒',
    category: 'object',
    summary:
      '이빨이 빠지는 꿈은 흔히 변화의 시기를 알리는 신호로 해석됩니다. 가까운 가족·친구와의 관계 변화, 일에서의 전환점, 혹은 건강 관리 신호로 보는 경우가 많아요.',
    situations: [
      { label: '윗니가 빠지면', meaning: '손윗사람과의 거리감·이별 암시' },
      { label: '아랫니가 빠지면', meaning: '손아랫사람·후배·자녀 관련 변화' },
      { label: '피가 함께 나면', meaning: '재물 손실 가능성. 큰 지출 주의' },
      { label: '아프지 않으면', meaning: '오히려 좋은 변화의 신호' },
    ],
    related: ['치아', '입', '얼굴', '머리카락', '병원', '거울', '피', '죽음'],
  },
  뱀: {
    keyword: '뱀',
    hanja: '蛇',
    category: 'animal',
    summary:
      '뱀이 등장하는 꿈은 재물·변화·다산의 상징으로 자주 해석됩니다. 다만 색·크기·행동에 따라 의미가 크게 갈리니 세부 상황을 함께 보세요.',
    situations: [
      { label: '흰 뱀을 보면', meaning: '큰 재물·임신·성공 신호' },
      { label: '뱀에게 물리면', meaning: '걱정거리 해소·발전의 전환점' },
      { label: '여러 마리가 나오면', meaning: '재물·인간관계 확장' },
      { label: '뱀이 도망가면', meaning: '기회를 놓칠 수 있음, 주의' },
    ],
    related: ['용', '구렁이', '도마뱀', '독', '땅', '물'],
  },
  물: {
    keyword: '물',
    hanja: '水',
    category: 'nature',
    summary:
      '물 꿈은 감정과 무의식, 흐름을 상징합니다. 맑은지 흐린지, 잠기는지 떠오르는지에 따라 길흉이 달라져요.',
    situations: [
      { label: '맑은 물을 보면', meaning: '재물·기회·정화' },
      { label: '흐린 물에 잠기면', meaning: '걱정·감정 정체 주의' },
      { label: '바다에서 헤엄치면', meaning: '큰 도전·확장의 시기' },
      { label: '비가 내리면', meaning: '재물·풍요의 신호' },
    ],
    related: ['바다', '강', '비', '눈물', '얼음', '수영'],
  },
  돈: {
    keyword: '돈',
    hanja: '財',
    category: 'object',
    summary:
      '돈을 줍는 꿈은 반대로 손해의 암시일 수도 있어요. 돈의 출처·상태·기분을 함께 살피면 더 정확합니다.',
    situations: [
      { label: '큰 돈을 줍는다', meaning: '뜻밖의 지출·손실 가능성' },
      { label: '돈을 잃으면', meaning: '오히려 들어올 재물의 길조' },
      { label: '동전이 많으면', meaning: '작은 수익의 누적' },
      { label: '지폐가 새 것이면', meaning: '새 일의 시작' },
    ],
    related: ['지갑', '카드', '금', '시장', '은행', '도둑'],
  },
  죽음: {
    keyword: '죽음',
    hanja: '死',
    category: 'action',
    summary:
      '죽음 꿈은 끝이 아니라 큰 전환을 뜻하는 경우가 대부분입니다. 오래 묵은 흐름이 끝나고 새 흐름이 들어올 자리를 만든다는 신호로 자주 풀이됩니다.',
    situations: [
      { label: '내가 죽으면', meaning: '한 단계 큰 변화·재출발' },
      { label: '가까운 사람이 죽으면', meaning: '그 사람과의 관계가 한 단계 깊어짐' },
      { label: '시신을 보면', meaning: '오래된 일의 정리, 재물 정리' },
      { label: '장례를 치르면', meaning: '큰 매듭이 정리되고 새 일이 시작' },
    ],
    related: ['이별', '병원', '관', '울음', '검은 옷'],
  },
  불: {
    keyword: '불',
    hanja: '火',
    category: 'nature',
    summary:
      '불꿈은 활력·재물·변화를 상징합니다. 불이 크게 타오르면 길조, 꺼져가거나 무서운 불이면 손실을 주의하라는 신호로 자주 해석됩니다.',
    situations: [
      { label: '집에 불이 나면', meaning: '큰 재물·기회의 확장' },
      { label: '내가 불을 끄면', meaning: '걱정거리·갈등 해소' },
      { label: '불이 꺼져가면', meaning: '의욕 저하·재물 소진 주의' },
      { label: '불꽃놀이를 보면', meaning: '기쁜 소식·잔치' },
    ],
    related: ['연기', '재', '태양', '폭발', '집'],
  },
  시험: {
    keyword: '시험',
    hanja: '試',
    category: 'action',
    summary:
      '시험 꿈은 현실의 평가·자기 점검을 상징합니다. 결과가 좋든 나쁘든, 내가 지금 무엇을 검증받고 싶은지를 보여줍니다.',
    situations: [
      { label: '시험을 잘 보면', meaning: '평가·승인이 가까이 옴' },
      { label: '시험을 못 보면', meaning: '준비가 더 필요한 시기' },
      { label: '문제가 안 보이면', meaning: '판단 흐림·정보 부족 신호' },
      { label: '시험장을 못 찾으면', meaning: '방향 재설정이 필요' },
    ],
    related: ['학교', '책', '연필', '시계', '면접'],
  },
  우는: {
    keyword: '우는',
    hanja: '泣',
    category: 'action',
    summary:
      '우는 꿈은 묶여 있던 감정의 해소와 정화를 뜻합니다. 시원하게 울면 그만큼 마음이 정리되는 신호입니다.',
    situations: [
      { label: '소리내어 울면', meaning: '응어리 해소·기쁜 일의 전조' },
      { label: '눈물만 흐르면', meaning: '오래된 슬픔의 정리' },
      { label: '가족과 함께 울면', meaning: '가족 화해·관계 회복' },
    ],
    related: ['눈물', '슬픔', '이별', '병원'],
  },
};

export const DREAM_CATEGORY_LABEL: Record<DreamMeaning['category'], string> = {
  animal: '동물',
  person: '사람',
  food: '음식',
  nature: '자연',
  object: '사물',
  action: '행동',
};

const FALLBACK_MEANING: DreamMeaning = {
  keyword: '검색어',
  hanja: '夢',
  category: 'object',
  summary:
    '입력한 단어에 대한 풀이가 아직 사전에 등록되지 않았어요. 인기 꿈 카테고리에서 비슷한 단어를 골라보거나, 다른 단어로 검색해 보세요.',
  situations: [
    { label: '맑은 꿈이면', meaning: '긍정적 신호로 해석' },
    { label: '뒤숭숭한 꿈이면', meaning: '마음 정리를 권하는 신호' },
    { label: '반복되는 꿈이면', meaning: '내가 지금 가장 신경 쓰는 일' },
  ],
  related: ['뱀', '이빨', '물', '돈'],
};

export function searchDream(query: string): {
  match: DreamMeaning;
  suggestions: string[];
  exact: boolean;
} {
  const trimmed = (query ?? '').trim();
  if (!trimmed) {
    return {
      match: DREAM_DICTIONARY.이빨,
      suggestions: [],
      exact: true,
    };
  }

  // 1) 정확 매치
  const exactKey = Object.keys(DREAM_DICTIONARY).find(
    (key) => key === trimmed
  );
  if (exactKey) {
    return { match: DREAM_DICTIONARY[exactKey], suggestions: [], exact: true };
  }

  // 2) 부분 매치 — 검색어가 키워드를 포함하거나 키워드가 검색어를 포함
  const partial = Object.keys(DREAM_DICTIONARY).filter(
    (key) => trimmed.includes(key) || key.includes(trimmed)
  );
  if (partial.length > 0) {
    return {
      match: DREAM_DICTIONARY[partial[0]],
      suggestions: partial.slice(1, 4),
      exact: false,
    };
  }

  // 3) related 태그 매치
  for (const [key, entry] of Object.entries(DREAM_DICTIONARY)) {
    if (entry.related.some((tag) => tag.includes(trimmed) || trimmed.includes(tag))) {
      return {
        match: { ...DREAM_DICTIONARY[key] },
        suggestions: [],
        exact: false,
      };
    }
  }

  return {
    match: { ...FALLBACK_MEANING, keyword: trimmed },
    suggestions: ['뱀', '이빨', '물', '돈'],
    exact: false,
  };
}

export function listDreamCategories() {
  const counts = new Map<DreamMeaning['category'], number>();
  for (const entry of Object.values(DREAM_DICTIONARY)) {
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  return (Object.keys(DREAM_CATEGORY_LABEL) as Array<DreamMeaning['category']>).map(
    (key) => ({
      key,
      label: DREAM_CATEGORY_LABEL[key],
      count: counts.get(key) ?? 0,
    })
  );
}
