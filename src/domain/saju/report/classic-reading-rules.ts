import type { SajuDataV1, SajuPillar, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import type { Stem } from '@/lib/saju/types';

export type ClassicReadingScope = 'natal' | 'daily' | 'yearly';

export interface ClassicReadingRule {
  id: string;
  concept: string;
  workSlug: 'ditian-sui' | 'qiongtong-baojian' | 'sanming-tonghui';
  sourceUrl: string;
  sourceTitle: string;
  originalAnchor: string;
  meaning: string;
  matchedFacts: string[];
  limits: string[];
  application: string;
}

type Chart = SajuDataV1 | SajuDataV2;
type RuleSource = Pick<ClassicReadingRule, 'id' | 'concept' | 'workSlug' | 'sourceUrl' | 'sourceTitle' | 'originalAnchor'>;
type RuleDefinition = Omit<ClassicReadingRule, 'matchedFacts' | 'application'> & {
  match: (facts: NatalFacts) => string[] | null;
  application: string | ((facts: NatalFacts) => string);
};
interface NatalFacts {
  data: Chart;
  hasGod: (god: TenGodCode) => boolean;
  godFacts: (...gods: TenGodCode[]) => string[];
  stemFacts: (stem: Stem) => string[];
  basis: string[];
}

// Verified against the named Wikisource revisions on 2026-09-18. The short
// classical anchors retain the transcription's script and punctuation. They
// are not modern translations or claims that a prediction has been validated.
// Underlying works: public-domain classics; Wikisource transcription terms:
// https://creativecommons.org/licenses/by-sa/4.0/ (see each linked page footer).
// 滴天髓's linked transcription is titled 滴天髓輯要, not 任鐵樵's 闡微 edition.
const fixedSource = (page: string, revision: number, section: string) =>
  `https://zh.wikisource.org/w/index.php?oldid=${revision}&title=${encodeURIComponent(page)}#${encodeURIComponent(section)}`;
// Pin the transcluded chapter itself: pinning the root page would still render
// changing chapter transclusions and would not preserve this quoted text.
const DITIAN = fixedSource('滴天髓/06', 844363, '');
const QIONGTONG = (section: string) => fixedSource('穷通宝鉴', 2294674, section);
const SANMING = fixedSource('三命通會_(四庫全書本)/卷12', 761707, '四言獨歩');
const WEALTH: TenGodCode[] = ['정재', '편재'];
const RESOURCE: TenGodCode[] = ['정인', '편인'];
const OUTPUT: TenGodCode[] = ['식신', '상관'];
const presentGods = (facts: NatalFacts, gods: TenGodCode[]) => gods.filter(facts.hasGod);

function natalFacts(data: Chart): NatalFacts {
  // Do not use aggregate counts: an older snapshot can retain a hidden hour
  // pillar/count even after the user marks the birth time as unknown.
  const pillars: Array<[string, SajuPillar]> = [
    ['연주', data.pillars.year], ['월주', data.pillars.month], ['일주', data.pillars.day],
  ];
  if (data.input.hourKnown && data.pillars.hour) pillars.push(['시주', data.pillars.hour]);
  const godLocations = new Map<TenGodCode, string[]>();
  for (const [label, pillar] of pillars) {
    const add = (god: TenGodCode | null, location: string) => {
      if (god) godLocations.set(god, [...(godLocations.get(god) ?? []), `${location} ${god}`]);
    };
    add(pillar.stemTenGod, `${label} 천간`);
    for (const hidden of pillar.hiddenStems) add(hidden.tenGod, `${label} 지장간`);
  }
  return {
    data,
    hasGod: (god) => godLocations.has(god),
    godFacts: (...gods) => gods.flatMap((god) => godLocations.get(god)?.slice(0, 1) ?? []),
    stemFacts: (stem) => pillars.filter(([, pillar]) => pillar.stem === stem)
      .map(([label]) => `${label} 천간 ${koreanizeGanzi(stem)}`),
    basis: [
      `일간 ${koreanizeGanzi(data.dayMaster.stem)}${data.dayMaster.element}`,
      `월지 ${koreanizeGanzi(data.pillars.month.branch)}`,
      ...(data.strength ? [`계산된 강약 ${data.strength.level}`] : []),
    ],
  };
}

// Specific day/month combinations precede broader interpretive safeguards.
// Presence is only an entry condition. It does not establish 旺, 通根, 制化,
// a special pattern, actual income, relationship status or a life event.
const RULES: readonly RuleDefinition[] = [
  {
    id: 'qt-early-spring-jia-warmth', concept: '조후', workSlug: 'qiongtong-baojian',
    sourceUrl: QIONGTONG('三春甲木'), sourceTitle: '궁통보감 · 삼춘갑목',
    originalAnchor: '初春犹有余寒，当以火温暖',
    meaning: '편집 해설: 초봄의 갑목을 설명하는 구절입니다. 목과 화의 개수만 비교하지 않고 태어난 절기의 차가운 조건과 화의 작용을 함께 살핍니다.',
    match: (facts) => facts.data.dayMaster.stem === '甲' && facts.data.pillars.month.branch === '寅'
      && facts.stemFacts('丙').length > 0
      ? [...facts.basis, ...facts.stemFacts('丙')] : null,
    limits: ['인월 갑목과 드러난 병화까지만 확인했습니다. 화의 충분한 세력이나 전체 용신의 확정 근거는 아닙니다.', '봄의 다른 달이나 다른 일간에 그대로 넓혀 적용하지 않습니다.'],
    application: '편집 적용: 준비한 생각을 밖으로 표현하는 조건을 살펴보는 질문으로 연결할 수 있습니다. 먼저 작은 결과를 보여주었을 때 도움이 되었는지 실제 경험으로 확인하며, 표현력이 뛰어나다는 사실을 단정하지 않습니다.',
  },
  {
    id: 'qt-summer-bing-ren-moderation', concept: '조후', workSlug: 'qiongtong-baojian',
    sourceUrl: QIONGTONG('三夏丙火'), sourceTitle: '궁통보감 · 삼하병화',
    originalAnchor: '丙火用壬，生旺坐实方好，忌壬水太多',
    meaning: '편집 해설: 여름 병화에 임수를 논하면서도 임수의 뿌리와 많고 적음을 함께 따집니다. 필요한 기운이라는 이유만으로 많을수록 좋다고 읽지 않습니다.',
    match: (facts) => facts.data.dayMaster.stem === '丙'
      && ['巳', '午', '未'].includes(facts.data.pillars.month.branch)
      && facts.data.strength?.level === '신강' && facts.stemFacts('壬').length > 0
      ? [...facts.basis, ...facts.stemFacts('壬')] : null,
    limits: ['계산된 신강과 천간 임수의 존재는 확인했지만, 임수의 통근·합화나 원문에서 요구하는 세력까지 판정하지 않았습니다.', '특수격 성립이나 물·색상·방향의 효능을 이 구절만으로 정하지 않습니다.'],
    application: '편집 적용: 속도를 내는 일과 검토하는 일을 어떻게 나눌지 질문할 수 있습니다. 이미 충분히 검토하는 사람에게 검토를 더하라고 일률적으로 권하지 않고, 현재 일의 병목이 실행인지 점검인지 먼저 확인합니다.',
  },
  {
    id: 'qt-winter-gui-bing-support', concept: '조후', workSlug: 'qiongtong-baojian',
    sourceUrl: QIONGTONG('三冬癸水'), sourceTitle: '궁통보감 · 삼동계수',
    originalAnchor: '凡冬月用丙，须丙火得地方妙',
    meaning: '편집 해설: 겨울 계수에서 병화가 보이는 것과 병화가 실제로 힘을 얻는 조건을 구분하는 구절입니다. 필요한 글자 하나가 있다는 이유만으로 좋은 결과를 약속하지 않습니다.',
    match: (facts) => facts.data.dayMaster.stem === '癸' && facts.data.pillars.month.branch === '子'
      && facts.stemFacts('丙').length > 0
      ? [...facts.basis, ...facts.stemFacts('丙')] : null,
    limits: ['원문의 겨울 계수 중 자월에만 좁혀 적용했습니다. 병화가 지지에서 힘을 얻는지와 방해 조건은 별도 확인이 필요합니다.', '조후는 전통 해석의 계절 조건이며 실제 체온·질병이나 출생지의 날씨를 진단하는 자료가 아닙니다.'],
    application: '편집 적용: 자원이나 기회가 있다는 설명에 머물지 않고 그것을 실제로 쓸 시간·도움·환경이 갖추어졌는지 확인하는 질문으로 옮길 수 있습니다. 보유한 자원과 활용 가능한 자원을 나누는 현대적 편집 예시입니다.',
  },
  {
    id: 'dt-shangguan-zhengguan-context', concept: '강약', workSlug: 'ditian-sui',
    sourceUrl: DITIAN, sourceTitle: '적천수 집요 · 격국론',
    originalAnchor: '傷官見官果難辨，可見不可見。',
    meaning: '편집 해설: 상관과 정관이 함께 보여도 일간의 강약과 재성·인성의 개입을 살펴야 한다는 문맥입니다. 같은 조합을 언제나 갈등이나 불행으로 해석하지 않습니다.',
    match: (facts) => {
      if (!facts.hasGod('상관') || !facts.hasGod('정관')) return null;
      const mediators = facts.data.strength?.level === '신약' ? presentGods(facts, RESOURCE)
        : facts.data.strength?.level === '신강' ? presentGods(facts, WEALTH) : [];
      return mediators.length ? [...facts.basis, ...facts.godFacts('상관', '정관', ...mediators)] : null;
    },
    limits: ['원문은 상관의 왕쇠와 재성·인성이 실제로 작용하는 조건도 따집니다. 십성의 존재만으로 원문의 모든 조건이 성립했다고 보지 않습니다.', '상관을 상대를 해치는 성격으로, 정관을 실제 배우자로 단정하지 않습니다. 관계 상태와 상대 정보는 주어지지 않았습니다.'],
    application: '편집 적용: 관계에서는 솔직한 표현과 합의한 기준이 부딪힐 때를 질문할 수 있습니다. 신약에 인성이 함께 보이면 설명과 도움을 받을 여유를, 신강에 재성이 함께 보이면 제안이 현실적인 약속으로 이어지는지를 확인하는 대화 예시로 사용합니다.',
  },
  {
    id: 'dt-wealth-types-and-output', concept: '격국', workSlug: 'ditian-sui',
    sourceUrl: DITIAN, sourceTitle: '적천수 집요 · 격국론',
    originalAnchor: '財官印綬分偏正，兼論食傷格局定。',
    meaning: '편집 해설: 재성·관성·인성의 정편을 구별하고 식신·상관도 함께 보라는 구절입니다. 재성을 하나의 재물운 점수로 합쳐 부유함을 판단하는 근거로 쓰지 않습니다.',
    match: (facts) => {
      const outputs = presentGods(facts, OUTPUT);
      return facts.data.strength && facts.hasGod('정재') && facts.hasGod('편재') && outputs.length
        ? [...facts.basis, ...facts.godFacts('정재', '편재', ...outputs)] : null;
    },
    limits: ['정재·편재와 식상의 존재를 확인한 규칙입니다. 생재의 흐름이나 격국이 완성되었다는 판정은 아닙니다.', '고정 수입·사업·자산 보유 여부는 입력되지 않았으며, 재성의 존재나 강약은 금액·성공 확률이 아닙니다.'],
    application: '편집 적용: 돈을 다루는 질문을 정재의 반복 관리, 편재의 새로운 기회 검토, 식상의 결과물 만들기로 나누어 살펴봅니다. 수입 형태가 확인되면 유지할 일과 시험할 일을 구분하고, 비용·일정·실제 수요를 기준으로 선택하도록 설명합니다.',
  },
  {
    id: 'sm-pressure-and-resource', concept: '강약', workSlug: 'sanming-tonghui',
    sourceUrl: SANMING, sourceTitle: '삼명통회 사고전서본 · 권12 · 사언독보',
    // The existing ingestion collapses full-width whitespace to ASCII spaces.
    originalAnchor: '煞不離印 印不離煞 煞印相生',
    meaning: '편집 해설: 편관과 인성을 함께 살피는 사언독보의 구절입니다. 편관이라는 부담 요소만 읽지 않고 그것을 받쳐 주는 인성의 조건도 검토하는 관점으로 제한해 사용합니다.',
    match: (facts) => {
      const resources = presentGods(facts, RESOURCE);
      return facts.data.strength?.level === '신약' && facts.hasGod('편관') && resources.length
        ? [...facts.basis, ...facts.godFacts('편관', ...resources)] : null;
    },
    limits: ['신약·편관·인성의 존재는 확인했지만 살인상생격의 성립이나 상생의 유효성을 확정하지 않았습니다.', '이어지는 원문의 공명 예측을 취업·합격·승진 보장으로 옮기지 않습니다. 신약은 능력이 약하다는 뜻이 아닙니다.'],
    application: '편집 적용: 더 어려운 역할을 맡을지 고민한다면 책임의 크기와 함께 배울 시간, 참고 자료, 질문할 사람, 결정 권한을 확인하는 질문으로 연결합니다. 현재 직업을 추정하거나 특정 직종에 적합하다고 단정하지 않습니다.',
  },
  {
    id: 'dt-mixed-authority-is-conditional', concept: '격국', workSlug: 'ditian-sui',
    sourceUrl: DITIAN, sourceTitle: '적천수 집요 · 격국론',
    originalAnchor: '官煞相混來問我，有可有不可。',
    meaning: '편집 해설: 정관과 편관이 함께 있다고 일괄적으로 좋고 나쁨을 정하지 말라는 구절입니다. 본문은 어느 쪽에 뿌리와 세력이 있고 어떻게 연결되는지를 추가로 따집니다.',
    match: (facts) => facts.data.strength && facts.hasGod('정관') && facts.hasGod('편관')
      ? [...facts.basis, ...facts.godFacts('정관', '편관')] : null,
    limits: ['동시 존재는 관살혼잡의 부정적 결과를 확정하는 충분조건이 아닙니다. 통근·제화·거류는 이 규칙에서 판정하지 않습니다.', '여러 관성을 여러 배우자나 복잡한 사생활로 바꾸어 추정하지 않습니다.'],
    application: '편집 적용: 일이나 관계에서 안정적으로 지킬 기준과 예외 상황의 요구를 따로 적어 보는 질문을 제안할 수 있습니다. 실제 요구가 충돌하는지 확인한 뒤 우선순위와 책임 범위를 합의하는 사례로만 풀어냅니다.',
  },
  {
    id: 'sm-month-before-fixed-pattern', concept: '격국', workSlug: 'sanming-tonghui',
    sourceUrl: SANMING, sourceTitle: '삼명통회 사고전서본 · 권12 · 사언독보',
    originalAnchor: '輕重較量 先觀月令 論格推詳',
    meaning: '편집 해설: 격국을 읽기 전에 월령을 살피고 자세히 따져야 한다는 순서입니다. 이름이 붙은 격국 하나로 평생의 직업이나 성격을 고정하는 근거가 아닙니다.',
    match: (facts) => {
      const pattern = facts.data.pattern;
      const monthGod = facts.data.pillars.month.hiddenStems.find((stem) => stem.tenGod)?.tenGod;
      return pattern?.confidence === '낮음' && pattern.tenGod && monthGod
        ? [...facts.basis, `월지 지장간 ${monthGod}`, `격국 참고 후보 ${pattern.tenGod}, 신뢰도 낮음`] : null;
    },
    limits: ['낮은 신뢰도는 엔진의 계산 상태이며 원전이 그 명식의 격국을 승인했다는 뜻이 아닙니다.', '격국 후보에 필요한 투출·통근과 후보 간 비교를 이 규칙에서 새로 계산하지 않습니다.'],
    application: '편집 적용: 격국을 확정된 정체성 대신 참고 후보로 소개합니다. 일·돈·관계의 선택은 확인된 여러 십성과 실제 생활 조건을 함께 설명하며, 한 이름에서 직업·배우자·인생 사건을 곧바로 도출하지 않습니다.',
  },
  {
    id: 'sm-balance-before-good-bad', concept: '강약', workSlug: 'sanming-tonghui',
    sourceUrl: fixedSource('三命通會_(四庫全書本)/卷12', 761707, '元理賦'),
    sourceTitle: '삼명통회 사고전서본 · 권12 · 원리부',
    originalAnchor: '五行不可太盛八字須得中和',
    meaning: '편집 해설: 오행이 지나치게 치우치는 것과 중화를 구분하는 원리부의 구절입니다. 바로 앞에서는 같은 생극 관계도 어느 쪽이 과한지에 따라 달라진다고 설명합니다. 한 기운이 많다는 사실을 곧바로 장점이나 단점으로 고정하지 않는 해석 원칙입니다.',
    match: (facts) => [...facts.basis, ...(!facts.data.strength ? ['강약 미산정'] : [])],
    limits: ['중화라는 전통 원칙이 오행 개수를 똑같이 맞추라는 뜻은 아닙니다. 이 규칙은 새로운 강약·용신 판정이나 점수를 만들지 않습니다.', '엔진의 강약 구분은 원전의 검증이나 개인의 능력·건강·성공을 평가한 결과가 아닙니다.'],
    application: ({ data }) => {
      const context = `${koreanizeGanzi(data.dayMaster.stem)}${data.dayMaster.element} 일간과 ${koreanizeGanzi(data.pillars.month.branch)}월을 바탕으로`;
      const choice = data.strength?.level === '신강'
        ? '계산된 신강을 더 많이 밀어붙여도 된다는 뜻으로 쓰지 않습니다. 역할을 늘리려는 상황이라면 다른 사람의 검토를 받는 단계와 맡기지 않아도 될 책임을 나누어 확인합니다.'
        : data.strength?.level === '신약'
          ? '계산된 신약을 능력 부족으로 쓰지 않습니다. 큰 책임을 맡으려는 상황이라면 책임의 양과 실제로 받을 도움·준비 시간을 함께 확인합니다.'
          : data.strength?.level === '중화'
            ? '계산된 중화를 모든 일이 순조롭다는 뜻으로 쓰지 않습니다. 같은 일에서도 여유가 있는 조건과 부담이 몰리는 조건을 나누어 선택을 설명합니다.'
            : '강약이 아직 계산되지 않았으므로 강하다거나 약하다는 결론을 보류합니다. 확인된 기둥의 사실과 아직 없는 계산 정보를 구분해서 설명합니다.';
      return `편집 적용: ${context} ${choice} 이는 실제 상황을 확인하기 위한 편집 질문입니다.`;
    },
  },
];

/** Metadata only; allows source/DB verification without fabricating a matching chart. */
export const CLASSIC_READING_RULE_SOURCES: readonly RuleSource[] = RULES.map(
  ({ id, concept, workSlug, sourceUrl, sourceTitle, originalAnchor }) =>
    ({ id, concept, workSlug, sourceUrl, sourceTitle, originalAnchor }),
);

/** Selects source-backed reading perspectives, never recalculating engine facts. */
export function selectClassicReadingRules(
  data: Chart,
  scope: ClassicReadingScope = 'natal',
): ClassicReadingRule[] {
  const facts = natalFacts(data);
  const selected: ClassicReadingRule[] = [];
  for (const { match, application, ...rule } of RULES) {
    const matchedFacts = match(facts);
    if (!matchedFacts) continue;
    selected.push({
      ...rule,
      application: typeof application === 'function' ? application(facts) : application,
      matchedFacts,
      limits: [
        ...rule.limits,
        '원문은 전통 해석의 출처이며, 편집 해설과 생활 예시는 원문 번역이나 예측 정확도의 실증 근거가 아닙니다.',
        ...(!data.input.hourKnown ? ['출생시각 미상으로 시주와 그 안의 십성을 제외했습니다. 확인되지 않은 시주에 따라 해석이 달라질 수 있습니다.'] : []),
        ...(scope === 'natal' ? [] : [scope === 'daily'
          ? '이 근거는 원국 해석에만 적용합니다. 오늘 일진과의 작용이나 오늘 생길 일을 증명하는 인용이 아닙니다.'
          : '이 근거는 원국 해석에만 적용합니다. 특정 연도의 세운·대운 변화나 그해의 사건을 증명하는 인용이 아닙니다.']),
      ],
    });
    if (selected.length === 4) break;
  }
  return selected;
}
