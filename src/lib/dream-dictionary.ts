// 2026-05-14: 꿈해몽 사전. /api/dream/search 가 여기서 데이터를 가져온다.
// 추후 DB 로 이관해도 같은 인터페이스로 호환되도록 순수 데이터 모듈로 유지.
// 2026-05-24 꿈해몽 풍부화 phase 1 — 구조 강화(fortune/action/detailSlug) + 파일럿 확충(33→60).
//   민속·상징 해석 톤 유지: 단정/예언/치료 표현 금지, 한자 본문 노출 지양.

export type DreamFortune = '길몽' | '흉몽' | '중립';

export interface DreamMeaning {
  keyword: string;
  hanja: string;
  category: 'animal' | 'person' | 'food' | 'nature' | 'object' | 'action';
  /** 길몽/흉몽/중립 — 민속 해석상 보편적 길흉 분류. 단정이 아닌 경향 안내. */
  fortune?: DreamFortune;
  summary: string;
  situations: Array<{ label: string; meaning: string }>;
  related: string[];
  /** 꿈을 떠올린 직후 가볍게 해볼 행동 한 문장. */
  action?: string;
  /** DREAM_CONTENT(dream/dream-content.ts) 에 풍부 상세가 있으면 그 slug. /dream-interpretation/{slug} 로 연결. */
  detailSlug?: string;
}

export const DREAM_DICTIONARY: Record<string, DreamMeaning> = {
  이빨: {
    keyword: '이빨',
    hanja: '齒',
    category: 'object',
    fortune: '중립',
    summary:
      '이빨이 빠지는 꿈은 흔히 변화의 시기를 알리는 신호로 보기도 합니다. 가까운 사람과의 관계 변화나 일에서의 전환점이 가까웠을 때 자주 떠오른다는 해석이 있어요. 단정적인 흉몽으로 받아들이지 않으셔도 괜찮습니다.',
    situations: [
      { label: '윗니가 빠지면', meaning: '손윗사람과의 거리감·이별 암시' },
      { label: '아랫니가 빠지면', meaning: '손아랫사람·후배·자녀 관련 변화' },
      { label: '피가 함께 나면', meaning: '재물 손실 가능성. 큰 지출 주의' },
      { label: '아프지 않으면', meaning: '오히려 좋은 변화의 신호' },
    ],
    related: ['치아', '입', '얼굴', '머리카락', '병원', '거울', '피', '죽음'],
    action: '최근 말하지 못하고 삼킨 이야기를 한 줄로 적어보면 마음이 가벼워집니다.',
    detailSlug: 'teeth-falling',
  },
  뱀: {
    keyword: '뱀',
    hanja: '蛇',
    category: 'animal',
    fortune: '길몽',
    summary:
      '뱀이 등장하는 꿈은 재물·변화·다산의 상징으로 자주 풀이됩니다. 다만 색·크기·행동에 따라 의미가 크게 갈린다는 해석이 있으니 세부 상황을 함께 보세요.',
    situations: [
      { label: '흰 뱀을 보면', meaning: '큰 재물·임신·성공 신호' },
      { label: '뱀에게 물리면', meaning: '걱정거리 해소·발전의 전환점' },
      { label: '여러 마리가 나오면', meaning: '재물·인간관계 확장' },
      { label: '뱀이 도망가면', meaning: '기회를 놓칠 수 있음, 주의' },
    ],
    related: ['용', '구렁이', '도마뱀', '독', '땅', '물'],
    action: '요즘 끌리지만 망설여지는 제안 하나를 떠올려 좋은 점·걱정되는 점을 나눠 적어보세요.',
    detailSlug: 'snake-dream',
  },
  물: {
    keyword: '물',
    hanja: '水',
    category: 'nature',
    fortune: '중립',
    summary:
      '물 꿈은 감정과 마음의 흐름을 상징한다고 봅니다. 맑은지 흐린지, 잠기는지 떠오르는지에 따라 길흉이 달라진다는 해석이 있어요.',
    situations: [
      { label: '맑은 물을 보면', meaning: '재물·기회·정화' },
      { label: '흐린 물에 잠기면', meaning: '걱정·감정 정체 주의' },
      { label: '바다에서 헤엄치면', meaning: '큰 도전·확장의 시기' },
      { label: '비가 내리면', meaning: '재물·풍요의 신호' },
    ],
    related: ['바다', '강', '비', '눈물', '얼음', '수영'],
    action: '오늘은 충분히 자고 카페인을 줄이며 마음의 온도를 한 박자 가라앉혀 보세요.',
    detailSlug: 'water-dream',
  },
  돈: {
    keyword: '돈',
    hanja: '財',
    category: 'object',
    fortune: '중립',
    summary:
      '돈을 줍는 꿈은 반대로 손해의 암시로 보기도 합니다. 돈의 출처·상태·기분을 함께 살피면 더 풍부하게 읽을 수 있다는 해석이 있어요.',
    situations: [
      { label: '큰 돈을 줍는다', meaning: '뜻밖의 지출·손실 가능성' },
      { label: '돈을 잃으면', meaning: '오히려 들어올 재물의 길조' },
      { label: '동전이 많으면', meaning: '작은 수익의 누적' },
      { label: '지폐가 새 것이면', meaning: '새 일의 시작' },
    ],
    related: ['지갑', '카드', '금', '시장', '은행', '도둑'],
    action: '큰 지출·투자 결정은 하루 미뤄두고, 오늘 챙길 수 있는 작은 절약 하나를 찾아보세요.',
    detailSlug: 'money-dream',
  },
  죽음: {
    keyword: '죽음',
    hanja: '死',
    category: 'action',
    fortune: '길몽',
    summary:
      '죽음 꿈은 끝이 아니라 큰 전환을 뜻하는 경우가 많다고 봅니다. 오래 묵은 흐름이 끝나고 새 흐름이 들어올 자리를 만든다는 신호로 자주 풀이돼요.',
    situations: [
      { label: '내가 죽으면', meaning: '한 단계 큰 변화·재출발' },
      { label: '가까운 사람이 죽으면', meaning: '그 사람과의 관계가 한 단계 깊어짐' },
      { label: '시신을 보면', meaning: '오래된 일의 정리, 재물 정리' },
      { label: '장례를 치르면', meaning: '큰 매듭이 정리되고 새 일이 시작' },
    ],
    related: ['이별', '병원', '관', '울음', '조상'],
    action: '마무리하고 싶은 오래된 일 하나를 골라 첫 정리부터 가볍게 시작해보세요.',
  },
  불: {
    keyword: '불',
    hanja: '火',
    category: 'nature',
    fortune: '길몽',
    summary:
      '불 꿈은 활력·재물·변화를 상징한다고 봅니다. 불이 크게 타오르면 길조, 꺼져가거나 무서운 불이면 손실을 살피라는 신호로 자주 풀이돼요.',
    situations: [
      { label: '집에 불이 나면', meaning: '큰 재물·기회의 확장' },
      { label: '내가 불을 끄면', meaning: '걱정거리·갈등 해소' },
      { label: '불이 꺼져가면', meaning: '의욕 저하·재물 소진 주의' },
      { label: '불꽃놀이를 보면', meaning: '기쁜 소식·잔치' },
    ],
    related: ['연기', '재', '태양', '화재', '집'],
    action: '요즘 키우고 싶은 일 하나에 오늘 작은 불씨 같은 첫걸음을 더해보세요.',
  },
  시험: {
    keyword: '시험',
    hanja: '試',
    category: 'action',
    fortune: '중립',
    summary:
      '시험 꿈은 현실의 평가·자기 점검을 상징한다고 봅니다. 결과가 좋든 나쁘든, 지금 무엇을 검증받고 싶은지를 비춰주는 장면이라는 해석이 있어요.',
    situations: [
      { label: '시험을 잘 보면', meaning: '평가·승인이 가까이 옴' },
      { label: '시험을 못 보면', meaning: '준비가 더 필요한 시기' },
      { label: '문제가 안 보이면', meaning: '판단 흐림·정보 부족 신호' },
      { label: '시험장을 못 찾으면', meaning: '방향 재설정이 필요' },
    ],
    related: ['학교', '책', '연필', '시계', '면접'],
    action: '지금 평가받고 있다고 느끼는 일 하나를 골라 다음 한 단계만 정해보세요.',
  },
  우는: {
    keyword: '우는',
    hanja: '泣',
    category: 'action',
    fortune: '길몽',
    summary:
      '우는 꿈은 묶여 있던 감정의 해소와 정화를 뜻한다고 봅니다. 시원하게 울면 그만큼 마음이 정리되는 신호라는 해석이 있어요.',
    situations: [
      { label: '소리내어 울면', meaning: '응어리 해소·기쁜 일의 전조' },
      { label: '눈물만 흐르면', meaning: '오래된 슬픔의 정리' },
      { label: '가족과 함께 울면', meaning: '가족 화해·관계 회복' },
    ],
    related: ['눈물', '슬픔', '이별', '병원'],
    action: '오늘은 마음을 누르지 말고, 편한 사람에게 짧은 안부를 건네보세요.',
  },
  // 2026-05-15 — 사전 11 → 36 단어 확장. 사용자 검색 적중률 회복.
  임신: {
    keyword: '임신', hanja: '孕', category: 'person',
    fortune: '길몽',
    summary: '임신 꿈은 새로운 시작·잠재 가능성의 상징으로 봅니다. 실제 임신과 무관하게 새 일·기회의 잉태를 뜻한다는 해석이 있어요.',
    situations: [
      { label: '내가 임신하면', meaning: '큰 일의 시작·준비의 시기' },
      { label: '남이 임신하면', meaning: '주변에 좋은 소식·도움이 찾아옴' },
      { label: '쌍둥이 임신이면', meaning: '여러 기회·이중 결실' },
    ],
    related: ['아기', '태아', '출산', '결혼'],
    action: '지금 키우고 있는 계획 하나와, 다음 30일 안에 할 일 한 가지를 적어보세요.',
    detailSlug: 'pregnancy-dream',
  },
  아기: {
    keyword: '아기', hanja: '兒', category: 'person',
    fortune: '길몽',
    summary: '아기 꿈은 새로운 시작·순수·돌봄을 상징한다고 봅니다. 안고 있으면 길조, 우는 모습이면 책임감을 살피라는 신호로 보기도 해요.',
    situations: [
      { label: '아기를 안으면', meaning: '재물·기회·새 시작' },
      { label: '아기가 울면', meaning: '책임감·근심의 신호' },
      { label: '아기에게 먹이면', meaning: '풍요·돌봄의 기쁨' },
    ],
    related: ['임신', '엄마', '아빠', '가족'],
    action: '돌보고 있는 일·사람 가운데 가장 마음 쓰이는 하나를 떠올려보세요.',
  },
  결혼: {
    keyword: '결혼', hanja: '婚', category: 'action',
    fortune: '길몽',
    summary: '결혼 꿈은 큰 약속·관계의 변화를 상징한다고 봅니다. 실제 결혼과 무관하게 새 계약·동업·인생 전환을 뜻한다는 해석이 있어요.',
    situations: [
      { label: '내 결혼식이면', meaning: '큰 결정·전환의 시기' },
      { label: '낯선 사람과 결혼하면', meaning: '예상치 못한 인연·기회' },
      { label: '결혼식이 미뤄지면', meaning: '계획 재검토 필요' },
    ],
    related: ['약혼', '예식', '연인', '드레스'],
    action: '앞두고 있는 큰 결정 하나를 한 문장으로 적어 마음을 정리해보세요.',
  },
  자동차: {
    keyword: '자동차', hanja: '車', category: 'object',
    fortune: '중립',
    summary: '자동차 꿈은 인생의 방향·진행·통제를 상징한다고 봅니다. 운전 상태가 곧 지금 내 마음의 컨디션을 비춘다는 해석이 있어요.',
    situations: [
      { label: '내가 운전하면', meaning: '주도권·자율적 진행' },
      { label: '사고가 나면', meaning: '계획 차질·건강 주의' },
      { label: '새 차를 사면', meaning: '새 시작·재물 확장' },
      { label: '차가 고장 나면', meaning: '진행 정체·회복 필요' },
    ],
    related: ['도로', '여행', '사고', '바퀴'],
    action: '지금 가장 속도를 내고 싶은 일과, 잠시 쉬어 가도 될 일을 따로 나눠보세요.',
  },
  비행기: {
    keyword: '비행기', hanja: '機', category: 'object',
    fortune: '길몽',
    summary: '비행기 꿈은 도약·새 환경·먼 길의 운을 상징한다고 봅니다. 이륙은 시작, 착륙은 정착, 추락은 큰 변화의 신호로 보기도 해요.',
    situations: [
      { label: '비행기를 타면', meaning: '큰 도약·새 기회' },
      { label: '비행기 추락이면', meaning: '큰 변화·정리의 시기' },
      { label: '공항이 보이면', meaning: '여행·이주·전환점' },
    ],
    related: ['공항', '여행', '하늘', '구름'],
    action: '미뤄둔 도전 하나를 30분 안에 시작할 수 있는 작은 크기로 줄여보세요.',
  },
  학교: {
    keyword: '학교', hanja: '校', category: 'object',
    fortune: '중립',
    summary: '학교 꿈은 배움·평가·인간관계를 상징한다고 봅니다. 지금 진행 중인 일의 배우는 과정과 연결된다는 해석이 있어요.',
    situations: [
      { label: '학교에 가면', meaning: '새 배움·자기 점검 시기' },
      { label: '시험 보러 가면', meaning: '평가 임박·준비 필요' },
      { label: '친구와 만나면', meaning: '오래된 인연·추억 정리' },
    ],
    related: ['시험', '책', '선생님', '친구'],
    action: '요즘 새로 배우고 있는 것 하나를 떠올려 다음 한 걸음을 적어보세요.',
  },
  집: {
    keyword: '집', hanja: '家', category: 'object',
    fortune: '길몽',
    summary: '집 꿈은 안식·나다움·재물을 상징한다고 봅니다. 새 집을 보면 확장, 무너지는 집이면 정리·재건의 시기로 보기도 해요.',
    situations: [
      { label: '새 집으로 이사하면', meaning: '큰 전환·재물 확장' },
      { label: '집이 무너지면', meaning: '오래된 것의 정리·재건' },
      { label: '집 안이 환하면', meaning: '가정 평안·재물 안정' },
    ],
    related: ['이사', '문', '방', '거실'],
    action: '머무는 공간 한 곳을 가볍게 정돈하며 마음의 안정을 챙겨보세요.',
  },
  비: {
    keyword: '비', hanja: '雨', category: 'nature',
    fortune: '중립',
    summary: '비 꿈은 축복·정화·재물을 상징한다고 보지만, 폭우면 감정 격동·곤란을 살피라는 신호로 보기도 해요.',
    situations: [
      { label: '부슬비를 맞으면', meaning: '잔잔한 재물·평온' },
      { label: '폭우가 쏟아지면', meaning: '감정 격동·곤란 주의' },
      { label: '우산을 쓰면', meaning: '도움·보호받음' },
    ],
    related: ['우산', '눈오는', '하늘', '천둥'],
    action: '마음이 무거우면 10분 가벼운 산책으로 한 박자 가라앉혀 보세요.',
  },
  바람: {
    keyword: '바람', hanja: '風', category: 'nature',
    fortune: '중립',
    summary: '바람 꿈은 변화·이동·소식을 상징한다고 봅니다. 산들바람은 좋은 소식, 강풍은 큰 변화의 예고로 보기도 해요.',
    situations: [
      { label: '시원한 바람이면', meaning: '좋은 소식·기분 전환' },
      { label: '강풍이 불면', meaning: '큰 변화·일정 변동' },
    ],
    related: ['하늘', '구름', '폭풍', '여행'],
    action: '다가올 변화에 대비해 일정 가운데 여유 한 칸을 미리 비워두세요.',
  },
  새: {
    keyword: '새', hanja: '鳥', category: 'animal',
    fortune: '길몽',
    summary: '새 꿈은 자유·소식·기쁜 전갈을 상징한다고 봅니다. 색·크기·행동에 따라 의미가 갈린다는 해석이 있어요.',
    situations: [
      { label: '새가 날아오면', meaning: '좋은 소식·기회' },
      { label: '새를 잡으면', meaning: '바라던 일의 성취·재물' },
      { label: '죽은 새를 보면', meaning: '소식 단절·실망' },
    ],
    related: ['독수리', '비둘기', '닭', '까치', '봉황'],
    action: '기다리던 소식이 있다면 오늘 먼저 가볍게 안부를 건네보세요.',
  },
  개: {
    keyword: '개', hanja: '犬', category: 'animal',
    fortune: '중립',
    summary: '개 꿈은 충성·우정·보호를 상징한다고 봅니다. 친근하면 인덕, 사납게 짖거나 물면 구설을 살피라는 신호로 보기도 해요.',
    situations: [
      { label: '개가 꼬리치면', meaning: '인덕·도움·우정' },
      { label: '개에게 물리면', meaning: '구설·작은 갈등' },
      { label: '강아지를 키우면', meaning: '새 인연·돌봄' },
    ],
    related: ['고양이', '호랑이', '주인', '집'],
    action: '곁을 지켜준 사람 한 명에게 짧은 고마움을 전해보세요.',
  },
  고양이: {
    keyword: '고양이', hanja: '猫', category: 'animal',
    fortune: '중립',
    summary: '고양이 꿈은 매력·인연·은밀한 변화를 상징한다고 봅니다. 안기면 좋은 인연, 사납게 굴면 시기·질투를 살피라는 해석이 있어요.',
    situations: [
      { label: '고양이가 안기면', meaning: '좋은 인연·이성운' },
      { label: '고양이에게 할퀴이면', meaning: '시기·질투·작은 마찰' },
      { label: '새끼고양이를 키우면', meaning: '돌봄·새 시작' },
    ],
    related: ['개', '호랑이', '연예인'],
    action: '관계에서 거리감이 느껴지면 한 박자 천천히 다가가 보세요.',
  },
  꽃: {
    keyword: '꽃', hanja: '花', category: 'nature',
    fortune: '길몽',
    summary: '꽃 꿈은 사랑·결실·아름다움을 상징한다고 봅니다. 활짝 핀 꽃은 길조, 시들면 한 흐름의 마무리로 보기도 해요.',
    situations: [
      { label: '활짝 핀 꽃을 보면', meaning: '사랑·결실·기쁜 소식' },
      { label: '꽃을 받으면', meaning: '좋은 인연·관계 발전' },
      { label: '꽃이 시들면', meaning: '한 흐름의 마무리' },
    ],
    related: ['장미', '벚꽃', '국화', '나무'],
    action: '곧 피어날 일에 대한 기대를 한 줄로 적어 마음에 담아보세요.',
  },
  거울: {
    keyword: '거울', hanja: '鏡', category: 'object',
    fortune: '중립',
    summary: '거울 꿈은 나를 비춰 보는 마음·진실을 상징한다고 봅니다. 깨진 거울이면 자기 점검, 맑은 거울이면 직관이 또렷한 시기로 보기도 해요.',
    situations: [
      { label: '맑은 거울에 비치면', meaning: '직관·자기 이해 깊어짐' },
      { label: '거울이 깨지면', meaning: '자기 비판·관계 재고' },
      { label: '얼굴이 달라 보이면', meaning: '큰 내적 변화의 신호' },
    ],
    related: ['얼굴', '눈', '머리카락'],
    action: '오늘 하루 내 모습을 가만히 돌아보는 짧은 시간을 가져보세요.',
  },
  옷: {
    keyword: '옷', hanja: '衣', category: 'object',
    fortune: '중립',
    summary: '옷 꿈은 사회적 역할·자기 표현을 상징한다고 봅니다. 새 옷은 새 역할·기회, 더러운 옷은 평판을 살피라는 신호로 보기도 해요.',
    situations: [
      { label: '새 옷을 입으면', meaning: '새 역할·승진·기회' },
      { label: '옷이 더러우면', meaning: '평판·구설 주의' },
      { label: '옷을 잃으면', meaning: '체면 손상 우려' },
    ],
    related: ['신발', '드레스', '양복', '거울'],
    action: '내가 맡고 싶은 새 역할 하나를 떠올려 그에 어울리는 준비를 시작해보세요.',
  },
  화재: {
    keyword: '화재', hanja: '災', category: 'nature',
    fortune: '길몽',
    summary: '화재 꿈은 불 꿈의 한 갈래로 큰 변화·재물 확장을 상징한다고 봅니다. 다만 무서운 불이면 손실을 살피라는 신호로 보기도 해요.',
    situations: [
      { label: '집이 다 타면', meaning: '큰 재물·전환의 시기' },
      { label: '불을 끄면', meaning: '걱정 해소' },
      { label: '연기만 나면', meaning: '소문·이야기 주의' },
    ],
    related: ['불', '연기', '집', '소방차'],
    action: '크게 바뀔 수 있는 일 하나를 떠올려 기회 쪽과 대비 쪽을 함께 적어보세요.',
  },
  도둑: {
    keyword: '도둑', hanja: '盗', category: 'person',
    fortune: '길몽',
    summary: '도둑 꿈은 잃음이라는 겉뜻과 달리 실제로는 들어올 재물의 길조로 자주 풀이됩니다. 단정적인 흉몽으로 보지 않아도 괜찮다는 해석이 있어요.',
    situations: [
      { label: '도둑이 들면', meaning: '재물 들어옴·뜻밖의 이익' },
      { label: '도둑을 잡으면', meaning: '근심 해소·승리' },
      { label: '도둑을 놓치면', meaning: '기회 일부 놓침' },
    ],
    related: ['돈', '지갑', '경찰'],
    action: '들어올 기회를 놓치지 않게, 챙겨야 할 일 하나를 메모해두세요.',
  },
  여행: {
    keyword: '여행', hanja: '旅', category: 'action',
    fortune: '길몽',
    summary: '여행 꿈은 인생의 전환·새 경험·도전을 상징한다고 봅니다. 즐거운 여행은 길조, 길을 잃으면 방향을 다시 살피라는 신호로 보기도 해요.',
    situations: [
      { label: '즐거운 여행이면', meaning: '새 도전·확장의 시기' },
      { label: '길을 잃으면', meaning: '방향 재설정·고민 필요' },
      { label: '집으로 돌아오면', meaning: '안정·정착의 시기' },
    ],
    related: ['공항', '자동차', '길잃음', '비행기'],
    action: '평소 가지 않던 동선 한 가지를 오늘 일정에 가볍게 더해보세요.',
  },
  병원: {
    keyword: '병원', hanja: '院', category: 'object',
    fortune: '중립',
    summary: '병원 꿈은 회복·보살핌·돌봄을 상징한다고 봅니다. 본인이 환자면 자기 돌봄을, 의사면 누군가를 도울 자리를 비춘다는 해석이 있어요.',
    situations: [
      { label: '병원에 입원하면', meaning: '휴식·자기 돌봄 필요' },
      { label: '의사가 되면', meaning: '주변을 도울 자리' },
      { label: '문병을 가면', meaning: '관계 회복·인덕' },
    ],
    related: ['의사', '약', '주사', '죽음'],
    action: '오늘은 식사·수면 시간을 평소보다 조금 일찍 챙겨 자신을 보살펴 보세요.',
  },
  싸움: {
    keyword: '싸움', hanja: '爭', category: 'action',
    fortune: '중립',
    summary: '싸움 꿈은 마음속 갈등·풀리지 않은 감정의 표출로 봅니다. 이기면 응어리가 풀리고, 지면 양보·이해의 시간이라는 해석이 있어요.',
    situations: [
      { label: '싸움에서 이기면', meaning: '갈등 해결·승리' },
      { label: '싸움에서 지면', meaning: '양보·자기 이해 필요' },
      { label: '말다툼만 하면', meaning: '오해 풀 기회' },
    ],
    related: ['전쟁', '복수', '쫓김'],
    action: '마음에 걸리는 사람이 있다면 먼저 가벼운 한마디로 오해를 풀어보세요.',
  },
  음식: {
    keyword: '음식', hanja: '食', category: 'food',
    fortune: '길몽',
    summary: '음식 꿈은 풍요·식복·건강을 상징한다고 봅니다. 맛있게 먹으면 길조, 음식이 상했으면 건강·재물을 살피라는 신호로 보기도 해요.',
    situations: [
      { label: '맛있게 먹으면', meaning: '식복·풍요·기쁜 일' },
      { label: '음식이 상했으면', meaning: '건강·재물 주의' },
      { label: '잔치에 참석하면', meaning: '인덕·축하받을 일' },
    ],
    related: ['밥', '국', '잔치', '물고기'],
    action: '오늘은 끼니를 든든히 챙기며 몸과 마음의 기운을 채워보세요.',
  },
  알: {
    keyword: '알', hanja: '卵', category: 'food',
    fortune: '길몽',
    summary: '알 꿈은 잠재된 가능성·새 생명·재물의 잉태를 상징한다고 봅니다. 깨지면 큰 변화, 부화하면 결실의 시기로 보기도 해요.',
    situations: [
      { label: '알을 보면', meaning: '잠재 가능성·새 시작' },
      { label: '알이 부화하면', meaning: '결실·새 기회' },
      { label: '깨진 알이면', meaning: '큰 변화·정리' },
    ],
    related: ['닭', '뱀', '병아리'],
    action: '아직 품고 있는 작은 계획 하나를 떠올려 다음 단계를 정해보세요.',
  },
  바다: {
    keyword: '바다', hanja: '海', category: 'nature',
    fortune: '중립',
    summary: '바다 꿈은 큰 변화·넓은 가능성·감정의 깊이를 상징한다고 봅니다. 잔잔하면 마음의 안정, 거칠면 감정의 격동으로 보기도 해요.',
    situations: [
      { label: '잔잔한 바다면', meaning: '마음 안정·평온' },
      { label: '파도가 거칠면', meaning: '감정 격동·시련 임박' },
      { label: '바다에서 헤엄치면', meaning: '큰 도전·확장' },
    ],
    related: ['물', '파도', '물고기', '산'],
    action: '마음이 출렁였다면 오늘은 결정을 한 박자 늦추고 충분히 쉬어보세요.',
  },
  눈오는: {
    keyword: '눈오는', hanja: '雪', category: 'nature',
    fortune: '길몽',
    summary: '눈 오는 꿈은 깨끗한 시작·정화·새로운 흐름을 상징한다고 봅니다. 첫눈은 새 인연, 폭설은 정체·고립으로 보기도 해요.',
    situations: [
      { label: '함박눈이 내리면', meaning: '맑은 시작·기쁜 소식' },
      { label: '눈사람을 만들면', meaning: '소박한 즐거움·동심' },
      { label: '눈이 녹으면', meaning: '얼었던 일이 풀림' },
    ],
    related: ['겨울', '얼음', '비'],
    action: '새로 시작하고 싶은 일 하나를 깨끗한 마음으로 적어보세요.',
  },
  용: {
    keyword: '용', hanja: '龍', category: 'animal',
    fortune: '길몽',
    summary: '용 꿈은 큰 길조로 자주 풀이됩니다 — 출세·재물·명예·새 생명의 강한 신호로 보며, 용을 타거나 본 꿈은 인생의 큰 전환점으로 보기도 해요.',
    situations: [
      { label: '용을 타면', meaning: '큰 출세·승진·명예' },
      { label: '용이 승천하면', meaning: '인생 큰 도약' },
      { label: '용을 만나면', meaning: '귀인·강한 인덕' },
    ],
    related: ['뱀', '봉황', '구름', '하늘'],
    action: '크게 도약하고 싶은 일이 있다면 오늘 그 첫 준비를 시작해보세요.',
  },

  // 2026-05-24 꿈해몽 풍부화 phase 1 — 흔한 꿈 27개 파일럿 확충(36 → 63).
  //   각 엔트리: fortune(길/흉/중립) + action(행동 가이드) + situations.
  //   detailSlug 는 DREAM_CONTENT(8개)에 풍부 상세가 있는 키워드에만 연결.
  똥: {
    keyword: '똥', hanja: '便', category: 'object',
    fortune: '길몽',
    summary: '똥 꿈은 대표적인 재물 길몽으로 자주 풀이됩니다. 몸에 묻거나 크게 보일수록 재물·이익의 신호로 본다는 해석이 있어요.',
    situations: [
      { label: '똥을 밟으면', meaning: '뜻밖의 재물·행운' },
      { label: '온몸에 묻으면', meaning: '큰 재물·이익이 따름' },
      { label: '똥을 치우면', meaning: '근심·부담의 정리' },
    ],
    related: ['돈', '화장실', '황금'],
    action: '들어올 수 있는 작은 이익 하나를 놓치지 않게 오늘 챙겨보세요.',
  },
  돼지: {
    keyword: '돼지', hanja: '豚', category: 'animal',
    fortune: '길몽',
    summary: '돼지 꿈은 재물·풍요의 대표적인 길몽으로 봅니다. 살찐 돼지나 돼지를 안는 꿈은 재물운이 따른다는 해석이 있어요.',
    situations: [
      { label: '돼지를 안으면', meaning: '재물·뜻밖의 이익' },
      { label: '돼지가 집에 들어오면', meaning: '복·재물이 들어옴' },
      { label: '돼지가 도망가면', meaning: '기회를 놓칠 수 있음, 주의' },
    ],
    related: ['돈', '복', '음식'],
    action: '들어온 기회를 흘려보내지 않게, 오늘 챙길 일 하나를 메모해두세요.',
  },
  호랑이: {
    keyword: '호랑이', hanja: '虎', category: 'animal',
    fortune: '길몽',
    summary: '호랑이 꿈은 권위·귀인·강한 기운을 상징한다고 봅니다. 호랑이를 타거나 품는 꿈은 큰 인물·태몽의 신호로 보기도 해요.',
    situations: [
      { label: '호랑이를 타면', meaning: '권위·출세의 흐름' },
      { label: '호랑이가 따라오면', meaning: '강한 귀인·도움' },
      { label: '호랑이에게 쫓기면', meaning: '부담스러운 압박, 정리 필요' },
    ],
    related: ['용', '사자', '쫓김'],
    action: '맡고 싶은 큰 역할이 있다면 한 걸음 먼저 다가가 보세요.',
  },
  물고기: {
    keyword: '물고기', hanja: '魚', category: 'animal',
    fortune: '길몽',
    summary: '물고기 꿈은 재물·기회·결실을 상징한다고 봅니다. 큰 물고기를 잡거나 많이 보일수록 좋은 흐름으로 본다는 해석이 있어요.',
    situations: [
      { label: '큰 물고기를 잡으면', meaning: '큰 재물·성취' },
      { label: '물고기가 떼로 보이면', meaning: '기회·인연의 확장' },
      { label: '물고기를 놓치면', meaning: '아쉬운 기회, 다음을 준비' },
    ],
    related: ['바다', '물', '낚시'],
    action: '눈앞의 기회 하나를 구체적인 다음 행동으로 붙잡아 보세요.',
  },
  산: {
    keyword: '산', hanja: '山', category: 'nature',
    fortune: '중립',
    summary: '산 꿈은 큰 목표·도전·기댈 언덕을 상징한다고 봅니다. 정상에 오르면 성취, 길이 험하면 인내가 필요한 시기로 보기도 해요.',
    situations: [
      { label: '산 정상에 오르면', meaning: '목표 달성·성취' },
      { label: '산을 오르는 중이면', meaning: '꾸준함이 필요한 과정' },
      { label: '산에서 길을 잃으면', meaning: '방향 점검이 필요' },
    ],
    related: ['바다', '나무', '길잃음'],
    action: '오르고 싶은 큰 목표를 작은 단계로 나눠 첫 칸을 정해보세요.',
  },
  쫓김: {
    keyword: '쫓김', hanja: '追', category: 'action',
    fortune: '중립',
    summary: '무언가에 쫓기는 꿈은 마주하기 미뤄둔 일·부담을 비춘다고 봅니다. 단정적인 흉몽이 아니라 마음의 신호로 보는 편이 안전하다는 해석이 있어요.',
    situations: [
      { label: '쫓기다 도망가면', meaning: '회피하고 싶은 부담이 있음' },
      { label: '돌아서서 맞서면', meaning: '문제를 마주할 준비가 됨' },
      { label: '숨어서 피하면', meaning: '잠시 거리를 두고 싶은 마음' },
    ],
    related: ['싸움', '호랑이', '추락'],
    action: '미뤄둔 일 가운데 가장 가벼운 하나부터 오늘 마주해보세요.',
  },
  날기: {
    keyword: '날기', hanja: '飛', category: 'action',
    fortune: '길몽',
    summary: '하늘을 나는 꿈은 해방감·도전 욕구·확장하고 싶은 마음을 비춘다고 봅니다. 답답할수록 마음이 더 크게 펼치려 한다는 해석이 있어요.',
    situations: [
      { label: '가볍게 날면', meaning: '에너지 회복·새 도전 적기' },
      { label: '낮게 날거나 떨어질 듯하면', meaning: '도전과 불안이 함께 있음' },
      { label: '누군가에게 날아가면', meaning: '그리운 관계·점검이 필요' },
    ],
    related: ['비행기', '하늘', '추락'],
    action: '미뤄둔 작은 도전 하나를 오늘 실행 가능한 크기로 줄여보세요.',
    detailSlug: 'flying-dream',
  },
  추락: {
    keyword: '추락', hanja: '墜', category: 'action',
    fortune: '중립',
    summary: '떨어지는 꿈은 불안·압박·통제력 저하가 쌓일 때 자주 떠오른다고 봅니다. 잠들 무렵 흔히 생기기도 하니 단정적으로 보지 않아도 괜찮다는 해석이 있어요.',
    situations: [
      { label: '높은 곳에서 떨어지면', meaning: '책임·기대의 무게가 큰 시기' },
      { label: '천천히 떨어지면', meaning: '길게 끄는 부담, 휴식이 필요' },
      { label: '떨어지다 깨면', meaning: '잠들 무렵 흔한 반응, 큰 의미는 아님' },
    ],
    related: ['날기', '쫓김', '이빨'],
    action: '오늘 통제할 수 있는 일과 그렇지 않은 일을 따로 적어보세요.',
    detailSlug: 'falling-dream',
  },
  조상: {
    keyword: '조상', hanja: '祖', category: 'person',
    fortune: '중립',
    summary: '돌아가신 가족·조상이 나오는 꿈은 그리움·정서적 안정이 필요한 시기에 자주 떠오른다고 봅니다. 단정적으로 보지 말고 마음의 신호로 보는 편이 안전하다는 해석이 있어요.',
    situations: [
      { label: '말을 건네면', meaning: '듣고 싶은 조언·정리할 메시지' },
      { label: '말없이 바라보면', meaning: '큰 결정 앞, 마음을 한 번 더 점검' },
      { label: '함께 어딘가 가면', meaning: '다음 단계로 넘어가는 시기' },
    ],
    related: ['죽음', '가족', '제사'],
    action: '마음에 남는 분께 짧은 메모를 적거나, 오래 미룬 가족 연락을 해보세요.',
    detailSlug: 'dead-relative-dream',
  },
  연예인: {
    keyword: '연예인', hanja: '星', category: 'person',
    fortune: '길몽',
    summary: '연예인이 나오는 꿈은 인정 욕구·동경·주목받고 싶은 마음을 비춘다고 봅니다. 좋은 분위기였다면 자신감이 올라오는 시기로 보기도 해요.',
    situations: [
      { label: '연예인과 친해지면', meaning: '인정·좋은 인연의 기대' },
      { label: '연예인이 되면', meaning: '주목받고 싶은 마음·자신감' },
      { label: '멀리서 보기만 하면', meaning: '동경하는 목표가 있음' },
    ],
    related: ['고양이', '거울', '결혼'],
    action: '닮고 싶은 모습 한 가지를 정해 오늘 작게 흉내 내보세요.',
  },
  지각: {
    keyword: '지각', hanja: '遲', category: 'action',
    fortune: '중립',
    summary: '지각하는 꿈은 준비·시간에 대한 부담을 비춘다고 봅니다. 무언가를 놓칠까 하는 마음이 올라온 시기에 자주 떠오른다는 해석이 있어요.',
    situations: [
      { label: '시험·약속에 늦으면', meaning: '준비 부담·시간 압박' },
      { label: '길이 막혀 못 가면', meaning: '뜻대로 안 되는 답답함' },
      { label: '늦었지만 도착하면', meaning: '결국 해낼 수 있다는 안도' },
    ],
    related: ['시험', '학교', '시계'],
    action: '오늘 일정 가운데 가장 급한 하나만 골라 먼저 정리해보세요.',
  },
  머리카락: {
    keyword: '머리카락', hanja: '髮', category: 'object',
    fortune: '중립',
    summary: '머리카락 꿈은 건강·자존심·생각의 정리를 상징한다고 봅니다. 풍성하면 활력, 빠지거나 자르면 정리·변화의 신호로 보기도 해요.',
    situations: [
      { label: '머리가 풍성하면', meaning: '활력·자신감' },
      { label: '머리가 빠지면', meaning: '걱정·기운 점검 필요' },
      { label: '머리를 자르면', meaning: '마음의 정리·새 출발' },
    ],
    related: ['이빨', '거울', '얼굴'],
    action: '머릿속이 복잡하면 생각을 글로 적어 한 번 정리해보세요.',
  },
  돈줍기: {
    keyword: '돈줍기', hanja: '拾', category: 'action',
    fortune: '중립',
    summary: '돈을 줍는 꿈은 보상·인정에 대한 기대가 올라온 시기를 비춘다고 봅니다. 큰돈일수록 바로 결정하기보다 한 번 점검하라는 해석이 있어요.',
    situations: [
      { label: '큰돈을 주우면', meaning: '뜻밖의 기회, 점검 후 결정' },
      { label: '동전을 주우면', meaning: '작은 이익의 누적' },
      { label: '주운 돈을 잃으면', meaning: '재정 점검이 필요' },
    ],
    related: ['돈', '지갑', '복권'],
    action: '오늘 챙길 수 있는 작은 절약·이익 한 가지를 적어보세요.',
    detailSlug: 'money-dream',
  },
  길잃음: {
    keyword: '길잃음', hanja: '迷', category: 'action',
    fortune: '중립',
    summary: '길을 잃는 꿈은 방향에 대한 고민·선택의 갈림길을 비춘다고 봅니다. 어디로 가야 할지 마음이 망설이는 시기에 자주 떠오른다는 해석이 있어요.',
    situations: [
      { label: '길을 못 찾으면', meaning: '방향 재설정이 필요' },
      { label: '낯선 곳을 헤매면', meaning: '새로운 선택 앞의 망설임' },
      { label: '결국 길을 찾으면', meaning: '고민 끝의 정리·안도' },
    ],
    related: ['여행', '산', '지도'],
    action: '지금 고민하는 선택의 기준 하나만 또렷이 정해보세요.',
  },
  뽀뽀: {
    keyword: '뽀뽀', hanja: '吻', category: 'action',
    fortune: '길몽',
    summary: '입맞춤·뽀뽀 꿈은 애정·화해·가까워지고 싶은 마음을 비춘다고 봅니다. 좋은 감정이었다면 관계가 부드러워지는 시기로 보기도 해요.',
    situations: [
      { label: '연인과 입을 맞추면', meaning: '관계의 깊어짐·애정' },
      { label: '낯선 사람과 하면', meaning: '예상 못한 인연·관심' },
      { label: '거부감이 들면', meaning: '거리를 두고 싶은 마음' },
    ],
    related: ['결혼', '연인', '연예인'],
    action: '가까워지고 싶은 사람에게 오늘 따뜻한 한마디를 건네보세요.',
  },
  전화: {
    keyword: '전화', hanja: '電', category: 'object',
    fortune: '중립',
    summary: '전화 꿈은 소식·연결·전하고 싶은 마음을 상징한다고 봅니다. 잘 통하면 소통이 풀리고, 끊기면 답답함이 남았다는 해석이 있어요.',
    situations: [
      { label: '반가운 전화를 받으면', meaning: '좋은 소식·연락의 기대' },
      { label: '전화가 안 걸리면', meaning: '소통의 답답함·오해' },
      { label: '모르는 번호면', meaning: '예상 못한 소식·인연' },
    ],
    related: ['소식', '편지', '문자'],
    action: '연락하고 싶었던 사람에게 오늘 짧은 안부를 먼저 보내보세요.',
  },
  신발: {
    keyword: '신발', hanja: '靴', category: 'object',
    fortune: '중립',
    summary: '신발 꿈은 가는 길·역할·인연을 상징한다고 봅니다. 새 신발은 새 출발, 신발을 잃으면 방향·관계의 점검이 필요하다는 해석이 있어요.',
    situations: [
      { label: '새 신발을 신으면', meaning: '새 출발·새 역할' },
      { label: '신발을 잃으면', meaning: '방향·관계 점검 필요' },
      { label: '신발이 맞지 않으면', meaning: '지금 자리와의 어긋남' },
    ],
    related: ['옷', '여행', '길잃음'],
    action: '새로 내딛고 싶은 길 하나를 떠올려 첫걸음을 정해보세요.',
  },
  비둘기: {
    keyword: '비둘기', hanja: '鳩', category: 'animal',
    fortune: '길몽',
    summary: '비둘기 꿈은 평화·반가운 소식·화해를 상징한다고 봅니다. 비둘기가 날아들면 좋은 기별이 온다는 해석이 있어요.',
    situations: [
      { label: '비둘기가 날아들면', meaning: '반가운 소식·화해' },
      { label: '비둘기에게 먹이를 주면', meaning: '인덕·베풂의 기쁨' },
      { label: '비둘기가 떠나면', meaning: '소식이 늦어질 수 있음' },
    ],
    related: ['새', '까치', '소식'],
    action: '관계를 부드럽게 만들 작은 호의 하나를 오늘 베풀어 보세요.',
  },
  나무: {
    keyword: '나무', hanja: '木', category: 'nature',
    fortune: '길몽',
    summary: '나무 꿈은 성장·뿌리·기댈 언덕을 상징한다고 봅니다. 크고 푸른 나무는 안정된 발전, 마른 나무는 회복이 필요한 시기로 보기도 해요.',
    situations: [
      { label: '큰 나무를 보면', meaning: '안정·꾸준한 성장' },
      { label: '나무에 열매가 열리면', meaning: '결실·보람의 시기' },
      { label: '나무가 마르면', meaning: '기운 회복이 필요' },
    ],
    related: ['꽃', '산', '숲'],
    action: '오래 키워온 일 하나를 떠올려 꾸준히 이어갈 한 걸음을 정해보세요.',
  },
  계단: {
    keyword: '계단', hanja: '階', category: 'object',
    fortune: '중립',
    summary: '계단 꿈은 단계·진행·오르내림을 상징한다고 봅니다. 올라가면 발전, 내려가면 정리, 멈추면 잠시 숨 고르는 시기로 보기도 해요.',
    situations: [
      { label: '계단을 오르면', meaning: '한 단계 발전·진전' },
      { label: '계단을 내려가면', meaning: '정리·돌아봄의 시기' },
      { label: '계단이 끝없으면', meaning: '조급함, 페이스 조절 필요' },
    ],
    related: ['산', '엘리베이터', '학교'],
    action: '지금 오르는 일에서 다음 한 칸만 또렷이 정해 움직여 보세요.',
  },
  거미: {
    keyword: '거미', hanja: '蛛', category: 'animal',
    fortune: '중립',
    summary: '거미 꿈은 얽힌 관계·끈기·재물의 그물을 상징한다고 봅니다. 거미줄을 치면 차근히 쌓이는 결실, 거미에 놀라면 얽힌 일의 정리로 보기도 해요.',
    situations: [
      { label: '거미줄을 치면', meaning: '차근히 쌓이는 결실' },
      { label: '거미에 놀라면', meaning: '얽힌 일·관계의 정리' },
      { label: '큰 거미를 보면', meaning: '돌봐줄 인연·재물의 신호' },
    ],
    related: ['뱀', '곤충', '돈'],
    action: '복잡하게 얽힌 일 하나를 골라 실마리 한 가닥부터 풀어보세요.',
  },
  지진: {
    keyword: '지진', hanja: '震', category: 'nature',
    fortune: '중립',
    summary: '지진 꿈은 큰 흔들림·기반의 변화를 비춘다고 봅니다. 단정적인 흉몽이 아니라, 큰 변화를 앞두고 마음이 출렁이는 신호로 보는 편이 안전하다는 해석이 있어요.',
    situations: [
      { label: '땅이 흔들리면', meaning: '큰 변화·기반의 재정비' },
      { label: '건물이 무너지면', meaning: '오래된 틀의 정리·재건' },
      { label: '흔들림이 멎으면', meaning: '혼란이 가라앉는 시기' },
    ],
    related: ['화재', '집', '추락'],
    action: '흔들릴 수 있는 일에 대비해 가장 중요한 한 가지를 먼저 챙겨두세요.',
  },
  강아지: {
    keyword: '강아지', hanja: '狗', category: 'animal',
    fortune: '길몽',
    summary: '강아지 꿈은 새 인연·반가움·돌봄을 상징한다고 봅니다. 따르는 강아지는 좋은 인연, 아픈 강아지는 보살핌이 필요한 일로 보기도 해요.',
    situations: [
      { label: '강아지가 따르면', meaning: '새 인연·인덕' },
      { label: '강아지를 키우면', meaning: '돌봄·새 시작의 기쁨' },
      { label: '강아지가 아프면', meaning: '보살펴야 할 일이 있음' },
    ],
    related: ['개', '고양이', '아기'],
    action: '돌보고 싶은 새 인연이나 일에 오늘 작은 정성을 들여보세요.',
  },
  눈물: {
    keyword: '눈물', hanja: '淚', category: 'action',
    fortune: '길몽',
    summary: '눈물 꿈은 묵은 감정의 해소·정화를 뜻한다고 봅니다. 시원하게 흘리면 마음이 정리되는 신호라는 해석이 있어요.',
    situations: [
      { label: '펑펑 울면', meaning: '응어리 해소·후련함' },
      { label: '눈물이 멈추지 않으면', meaning: '오래된 감정의 정리' },
      { label: '눈물을 참으면', meaning: '표현하지 못한 마음이 남음' },
    ],
    related: ['우는', '슬픔', '이별'],
    action: '눌러둔 감정이 있다면 오늘은 편한 사람에게 가볍게 털어놓아 보세요.',
  },
  거지: {
    keyword: '거지', hanja: '乞', category: 'person',
    fortune: '길몽',
    summary: '거지가 나오는 꿈은 겉뜻과 달리 도움·재물의 길조로 풀이되기도 합니다. 무언가를 건네면 베풂의 복으로 본다는 해석이 있어요.',
    situations: [
      { label: '거지에게 베풀면', meaning: '베풂이 돌아오는 복' },
      { label: '거지가 찾아오면', meaning: '뜻밖의 도움·인연' },
      { label: '내가 구걸하면', meaning: '도움을 청해도 좋은 시기' },
    ],
    related: ['돈', '도둑', '복'],
    action: '혼자 안고 있는 일이 있다면 오늘은 누군가에게 도움을 청해보세요.',
  },
  청소: {
    keyword: '청소', hanja: '掃', category: 'action',
    fortune: '길몽',
    summary: '청소하는 꿈은 정리·정화·새 출발을 상징한다고 봅니다. 깨끗이 치울수록 묵은 걱정이 풀리는 신호로 본다는 해석이 있어요.',
    situations: [
      { label: '집을 깨끗이 치우면', meaning: '근심 정리·새 시작' },
      { label: '쓰레기를 버리면', meaning: '묵은 부담의 정리' },
      { label: '아무리 치워도 더러우면', meaning: '풀리지 않은 일이 남음' },
    ],
    related: ['집', '똥', '옷'],
    action: '오늘은 가까운 공간 한 곳을 가볍게 정리하며 마음도 함께 비워보세요.',
  },
  시계: {
    keyword: '시계', hanja: '時', category: 'object',
    fortune: '중립',
    summary: '시계 꿈은 시기·때·흐름을 상징한다고 봅니다. 잘 가는 시계는 알맞은 때, 멈추거나 늦는 시계는 타이밍 점검이 필요한 시기로 보기도 해요.',
    situations: [
      { label: '시계가 잘 가면', meaning: '흐름이 알맞게 맞아감' },
      { label: '시계가 멈추면', meaning: '잠시 멈춰 점검할 시기' },
      { label: '시간을 자꾸 확인하면', meaning: '조급함, 한 박자 여유 필요' },
    ],
    related: ['지각', '시험', '전화'],
    action: '서두르는 일이 있다면 마감을 한 번 더 확인하고 우선순위를 정해보세요.',
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

// 2026-05-24 꿈해몽 풍부화 phase 1 — fortune 뱃지 라벨(SSOT). UI 에서 색/톤 매핑에 사용.
//   민속 해석상 보편적 길흉 분류이며 단정이 아님(검색 카드에 "민속 상징 해석" 안내 병기).
export const DREAM_FORTUNE_LABEL: Record<DreamFortune, string> = {
  길몽: '길몽',
  흉몽: '흉몽',
  중립: '중립',
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
