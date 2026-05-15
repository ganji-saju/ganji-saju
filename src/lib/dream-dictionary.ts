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
  // 2026-05-15 — 사전 11 → 36 단어 확장. 사용자 검색 적중률 회복.
  임신: {
    keyword: '임신', hanja: '孕', category: 'person',
    summary: '임신 꿈은 새로운 시작·잠재 가능성의 상징. 실제 임신과 무관하게 새 프로젝트·재물·기회의 잉태를 의미합니다.',
    situations: [
      { label: '내가 임신하면', meaning: '큰 일의 시작·태교 같은 준비 기간' },
      { label: '남이 임신하면', meaning: '주변에 좋은 소식·도움이 찾아옴' },
      { label: '쌍둥이 임신이면', meaning: '여러 기회·이중 결실' },
    ],
    related: ['아기', '태아', '출산', '결혼'],
  },
  아기: {
    keyword: '아기', hanja: '兒', category: 'person',
    summary: '아기 꿈은 새로운 시작·순수·돌봄을 상징합니다. 안고 있으면 길조, 우는 모습이면 책임감 부담 신호.',
    situations: [
      { label: '아기를 안으면', meaning: '재물·기회·새 시작' },
      { label: '아기가 울면', meaning: '책임감·근심의 신호' },
      { label: '아기에게 먹이면', meaning: '풍요·돌봄의 기쁨' },
    ],
    related: ['임신', '엄마', '아빠', '가족'],
  },
  결혼: {
    keyword: '결혼', hanja: '婚', category: 'action',
    summary: '결혼 꿈은 큰 약속·관계의 변화를 상징. 실제 결혼과 무관하게 새 계약·동업·인생 전환을 뜻합니다.',
    situations: [
      { label: '내 결혼식이면', meaning: '큰 결정·전환의 시기' },
      { label: '낯선 사람과 결혼하면', meaning: '예상치 못한 인연·기회' },
      { label: '결혼식이 미뤄지면', meaning: '계획 재검토 필요' },
    ],
    related: ['약혼', '예식', '연인', '드레스'],
  },
  자동차: {
    keyword: '자동차', hanja: '車', category: 'object',
    summary: '자동차 꿈은 인생의 방향·진행·통제를 상징합니다. 운전 상태가 곧 지금 내 삶의 컨디션입니다.',
    situations: [
      { label: '내가 운전하면', meaning: '주도권·자율적 진행' },
      { label: '사고가 나면', meaning: '계획 차질·건강 주의' },
      { label: '새 차를 사면', meaning: '새 시작·재물 확장' },
      { label: '차가 고장 나면', meaning: '진행 정체·회복 필요' },
    ],
    related: ['도로', '여행', '사고', '바퀴'],
  },
  비행기: {
    keyword: '비행기', hanja: '機', category: 'object',
    summary: '비행기 꿈은 도약·새 환경·해외 운을 상징. 이륙은 시작, 착륙은 정착, 추락은 큰 변화의 신호.',
    situations: [
      { label: '비행기를 타면', meaning: '큰 도약·해외 기회' },
      { label: '비행기 추락이면', meaning: '큰 변화·정리의 시기' },
      { label: '공항이 보이면', meaning: '여행·이주·전환점' },
    ],
    related: ['공항', '여행', '하늘', '구름'],
  },
  학교: {
    keyword: '학교', hanja: '校', category: 'object',
    summary: '학교 꿈은 배움·평가·인간관계의 상징입니다. 현재 진행 중인 일의 학습 곡선과 연결됩니다.',
    situations: [
      { label: '학교에 가면', meaning: '새 배움·자기 점검 시기' },
      { label: '시험 보러 가면', meaning: '평가 임박·준비 필요' },
      { label: '친구와 만나면', meaning: '오래된 인연·추억 정리' },
    ],
    related: ['시험', '책', '선생님', '친구'],
  },
  집: {
    keyword: '집', hanja: '家', category: 'object',
    summary: '집 꿈은 안식·정체성·재물의 상징. 새 집을 보면 재물 확장, 무너지는 집이면 정리·재건의 시기.',
    situations: [
      { label: '새 집으로 이사하면', meaning: '큰 전환·재물 확장' },
      { label: '집이 무너지면', meaning: '오래된 것의 정리·재건' },
      { label: '집 안이 환하면', meaning: '가정 평안·재물 안정' },
    ],
    related: ['이사', '문', '방', '거실'],
  },
  비: {
    keyword: '비', hanja: '雨', category: 'nature',
    summary: '비 꿈은 축복·정화·재물을 상징하지만, 폭우면 감정 격동·곤란의 신호이기도 합니다.',
    situations: [
      { label: '부슬비를 맞으면', meaning: '잔잔한 재물·평온' },
      { label: '폭우가 쏟아지면', meaning: '감정 격동·곤란 주의' },
      { label: '우산을 쓰면', meaning: '도움·보호받음' },
    ],
    related: ['우산', '눈', '하늘', '천둥'],
  },
  바람: {
    keyword: '바람', hanja: '風', category: 'nature',
    summary: '바람 꿈은 변화·이동·소식의 상징. 산들바람은 좋은 소식, 강풍은 큰 변화의 예고.',
    situations: [
      { label: '시원한 바람이면', meaning: '좋은 소식·기분 전환' },
      { label: '강풍이 불면', meaning: '큰 변화·일정 변동' },
    ],
    related: ['하늘', '구름', '폭풍', '여행'],
  },
  새: {
    keyword: '새', hanja: '鳥', category: 'animal',
    summary: '새 꿈은 자유·소식·메신저의 상징입니다. 색·크기·행동에 따라 의미가 갈립니다.',
    situations: [
      { label: '새가 날아오면', meaning: '좋은 소식·기회' },
      { label: '새를 잡으면', meaning: '욕망 성취·재물' },
      { label: '죽은 새를 보면', meaning: '소식 단절·실망' },
    ],
    related: ['독수리', '비둘기', '닭', '까치', '봉황'],
  },
  개: {
    keyword: '개', hanja: '犬', category: 'animal',
    summary: '개 꿈은 충성·우정·보호의 상징. 친근하면 인덕, 사납게 짖거나 물면 갈등·구설 주의.',
    situations: [
      { label: '개가 꼬리치면', meaning: '인덕·도움·우정' },
      { label: '개에게 물리면', meaning: '구설·작은 갈등' },
      { label: '강아지를 키우면', meaning: '새 인연·돌봄' },
    ],
    related: ['고양이', '동물', '주인', '집'],
  },
  고양이: {
    keyword: '고양이', hanja: '猫', category: 'animal',
    summary: '고양이 꿈은 이성·매력·은밀한 변화의 상징. 안기면 좋은 인연, 사납게 굴면 시기·질투 조심.',
    situations: [
      { label: '고양이가 안기면', meaning: '좋은 인연·이성운' },
      { label: '고양이에게 할퀴이면', meaning: '시기·질투·작은 마찰' },
      { label: '새끼고양이를 키우면', meaning: '돌봄·새 시작' },
    ],
    related: ['개', '동물', '이성'],
  },
  꽃: {
    keyword: '꽃', hanja: '花', category: 'nature',
    summary: '꽃 꿈은 사랑·결실·아름다움의 상징. 활짝 핀 꽃은 길조, 시들면 끝맺음·정리.',
    situations: [
      { label: '활짝 핀 꽃을 보면', meaning: '사랑·결실·기쁜 소식' },
      { label: '꽃을 받으면', meaning: '좋은 인연·관계 발전' },
      { label: '꽃이 시들면', meaning: '한 흐름의 마무리' },
    ],
    related: ['장미', '벚꽃', '국화', '식물'],
  },
  거울: {
    keyword: '거울', hanja: '鏡', category: 'object',
    summary: '거울 꿈은 자기 인식·진실·반영의 상징. 깨진 거울이면 자기 점검 필요, 맑은 거울이면 직관 명료.',
    situations: [
      { label: '맑은 거울에 비치면', meaning: '직관·자기 이해 깊어짐' },
      { label: '거울이 깨지면', meaning: '자기 비판·관계 재고' },
      { label: '얼굴이 달라 보이면', meaning: '큰 내적 변화의 신호' },
    ],
    related: ['얼굴', '눈', '머리카락'],
  },
  옷: {
    keyword: '옷', hanja: '衣', category: 'object',
    summary: '옷 꿈은 사회적 역할·자기 표현·체면의 상징. 새 옷은 새 역할·기회, 더러운 옷은 평판 주의.',
    situations: [
      { label: '새 옷을 입으면', meaning: '새 역할·승진·기회' },
      { label: '옷이 더러우면', meaning: '평판·구설 주의' },
      { label: '옷을 잃으면', meaning: '체면 손상 우려' },
    ],
    related: ['신발', '드레스', '양복', '거울'],
  },
  화재: {
    keyword: '화재', hanja: '災', category: 'nature',
    summary: '화재 꿈은 불 꿈의 한 갈래로 큰 변화·재물 확장의 상징. 다만 무서운 불이면 손실 주의.',
    situations: [
      { label: '집이 다 타면', meaning: '큰 재물·전환의 시기' },
      { label: '불을 끄면', meaning: '걱정 해소' },
      { label: '연기만 나면', meaning: '소문·이야기 주의' },
    ],
    related: ['불', '연기', '집', '소방차'],
  },
  도둑: {
    keyword: '도둑', hanja: '盗', category: 'person',
    summary: '도둑 꿈은 손실·잃음의 표면적 의미와 달리 실제로는 들어올 재물의 길조로 자주 풀이됩니다.',
    situations: [
      { label: '도둑이 들면', meaning: '재물 들어옴·복권운' },
      { label: '도둑을 잡으면', meaning: '근심 해소·승리' },
      { label: '도둑을 놓치면', meaning: '기회 일부 놓침' },
    ],
    related: ['돈', '지갑', '경찰'],
  },
  여행: {
    keyword: '여행', hanja: '旅', category: 'action',
    summary: '여행 꿈은 인생의 전환·새 경험·도전을 상징합니다. 즐거운 여행은 길조, 길을 잃으면 방향 재설정 필요.',
    situations: [
      { label: '즐거운 여행이면', meaning: '새 도전·확장의 시기' },
      { label: '길을 잃으면', meaning: '방향 재설정·고민 필요' },
      { label: '집으로 돌아오면', meaning: '안정·정착의 시기' },
    ],
    related: ['공항', '자동차', '기차', '비행기'],
  },
  병원: {
    keyword: '병원', hanja: '院', category: 'object',
    summary: '병원 꿈은 회복·치유·돌봄의 상징. 본인이 환자면 자기 점검 필요, 의사면 도와줄 입장의 신호.',
    situations: [
      { label: '병원에 입원하면', meaning: '휴식·자기 돌봄 필요' },
      { label: '의사가 되면', meaning: '주변을 도울 자리' },
      { label: '문병을 가면', meaning: '관계 회복·인덕' },
    ],
    related: ['의사', '약', '주사', '죽음'],
  },
  싸움: {
    keyword: '싸움', hanja: '爭', category: 'action',
    summary: '싸움 꿈은 내적 갈등·해소되지 않은 감정의 표출. 이기면 응어리 풀림, 지면 양보·인정의 시간.',
    situations: [
      { label: '싸움에서 이기면', meaning: '갈등 해결·승리' },
      { label: '싸움에서 지면', meaning: '양보·자기 이해 필요' },
      { label: '말다툼만 하면', meaning: '오해 풀 기회' },
    ],
    related: ['전쟁', '복수', '화'],
  },
  음식: {
    keyword: '음식', hanja: '食', category: 'food',
    summary: '음식 꿈은 풍요·식복·건강의 상징. 맛있게 먹으면 길조, 음식이 상했으면 건강·재물 주의.',
    situations: [
      { label: '맛있게 먹으면', meaning: '식복·풍요·기쁜 일' },
      { label: '음식이 상했으면', meaning: '건강·재물 주의' },
      { label: '잔치에 참석하면', meaning: '인덕·축하받을 일' },
    ],
    related: ['밥', '국', '잔치', '식당'],
  },
  알: {
    keyword: '알', hanja: '卵', category: 'food',
    summary: '알 꿈은 잠재된 가능성·태아·재물의 잉태를 상징. 깨지면 큰 변화, 부화하면 결실의 시기.',
    situations: [
      { label: '알을 보면', meaning: '잠재 가능성·새 시작' },
      { label: '알이 부화하면', meaning: '결실·새 기회' },
      { label: '깨진 알이면', meaning: '큰 변화·정리' },
    ],
    related: ['닭', '뱀', '병아리'],
  },
  바다: {
    keyword: '바다', hanja: '海', category: 'nature',
    summary: '바다 꿈은 큰 변화·무한한 가능성·감정의 깊이를 상징. 잔잔하면 마음 안정, 거칠면 감정 격동.',
    situations: [
      { label: '잔잔한 바다면', meaning: '마음 안정·평온' },
      { label: '파도가 거칠면', meaning: '감정 격동·시련 임박' },
      { label: '바다에서 헤엄치면', meaning: '큰 도전·확장' },
    ],
    related: ['물', '파도', '배', '섬'],
  },
  눈오는: {
    keyword: '눈오는', hanja: '雪', category: 'nature',
    summary: '눈 오는 꿈은 깨끗한 시작·정화·새로운 흐름의 상징. 첫눈은 새 인연, 폭설은 정체·고립.',
    situations: [
      { label: '함박눈이 내리면', meaning: '맑은 시작·기쁜 소식' },
      { label: '눈사람을 만들면', meaning: '소박한 즐거움·동심' },
      { label: '눈이 녹으면', meaning: '얼었던 일이 풀림' },
    ],
    related: ['겨울', '얼음', '비'],
  },
  용: {
    keyword: '용', hanja: '龍', category: 'animal',
    summary: '용 꿈은 최고의 길조 — 출세·재물·명예·임신의 강한 신호. 용을 타거나 본 꿈은 인생 전환의 큰 시점.',
    situations: [
      { label: '용을 타면', meaning: '큰 출세·승진·명예' },
      { label: '용이 승천하면', meaning: '인생 큰 도약' },
      { label: '용을 만나면', meaning: '귀인·강한 인덕' },
    ],
    related: ['뱀', '봉황', '구름', '하늘'],
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
