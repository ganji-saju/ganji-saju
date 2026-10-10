// 2026-10-10 — 평생 풀이 "결혼·배우자·자녀"(점검 B #2). 시중 평생 사주의 핵심 항목인데 없거나 얕았다.
//   근거: 배우자 자리(태어난 날 지지) 십성·다른 자리와의 합충, 배우자 별(남성 재성/여성 관성), 자녀 자리(태어난 시)와
//   자녀 별(남성 관성/여성 식상), 관계 조건이 맞물리는 대운 구간. 결정론.
//   원칙: 결혼·출산·이별을 예고하지 않는다. 시기는 "조건이 맞물리는 구간"으로만. 배우자 수·성별 고정관념 금지.
//   12운성 이름(병·사 등)은 질병·죽음으로 오해받아 쓰지 않는다.
import { getBranchPrimaryTenGod, getTenGodHangul } from '@/domain/saju/engine/orrery-adapter';
import type { SajuDataV1, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { Stem } from '@/lib/saju/types';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import { PALACE, relationOf, type PillarKey } from './monthly-signals';

export interface LifetimeMarriageFamilySection {
  headline: string;
  spousePalace: string;
  spouseStar: string | null;
  childrenPalace: string;
  timing: string;
  windows: Array<{ ages: string; reason: string }>;
  /** AI 가 실패했을 때 쓰는 완결 문단. */
  summary: string;
}

const SPOUSE_PALACE: Record<TenGodCode, string> = {
  비견: '친구처럼 대등한 동반자 관계가 편안한 편이라, 서로의 영역을 존중하는 약속이 관계를 오래 지켜 줍니다.',
  겁재: '가까운 사이에서도 주도권과 몫이 드러나기 쉬워, 돈과 역할을 나누는 기준을 미리 맞춰 두면 다툼이 줄어듭니다.',
  식신: '함께 먹고 쉬고 즐기는 생활의 편안함이 중요한 편이라, 일상을 나누는 시간이 관계의 바탕이 됩니다.',
  상관: '표현과 자유를 중요하게 여기는 편이라, 솔직함은 살리되 서운한 말은 한 번 고르고 꺼내는 연습이 도움이 됩니다.',
  편재: '활동적이고 교류가 넓은 관계에 끌리기 쉬워, 함께 보내는 시간과 각자의 바깥 활동 사이 균형이 중요합니다.',
  정재: '성실함과 생활의 안정을 중요하게 보는 편이라, 약속을 지키는 작은 꾸준함이 신뢰를 쌓습니다.',
  편관: '강하게 끌리면서도 긴장이 함께 오기 쉬운 자리라, 압박으로 맞추기보다 서로의 속도를 말로 확인하는 편이 좋습니다.',
  정관: '책임감과 신뢰, 관계의 형식을 중요하게 여기는 편이라, 서로에게 기대하는 역할을 분명히 말해 두면 편안해집니다.',
  편인: '혼자만의 시간과 생각할 여유가 필요한 편이라, 거리를 두고 싶을 때 이유를 짧게 전하는 습관이 관계를 지켜 줍니다.',
  정인: '보살피고 기대는 마음이 깊은 편이라, 한쪽만 돌보지 않도록 주고받는 균형을 살펴보는 것이 좋습니다.',
};

const CHILD_PALACE: Record<TenGodCode, string> = {
  비견: '아랫사람이나 자녀와는 친구처럼 대등하게 지내는 방식이 잘 맞습니다.',
  겁재: '아랫사람이나 자녀와 의견이 부딪힐 때 각자의 몫을 인정해 주면 관계가 편해집니다.',
  식신: '아랫사람이나 자녀를 먹이고 챙기며 함께 즐기는 데서 보람을 느끼기 쉽습니다.',
  상관: '아랫사람이나 자녀에게 표현이 풍부한 대신 잔소리가 길어지지 않게 조절하는 것이 좋습니다.',
  편재: '아랫사람이나 자녀와 바깥 활동·경험을 함께할 때 관계가 가까워지기 쉽습니다.',
  정재: '아랫사람이나 자녀에게 생활 습관과 약속을 꼼꼼히 챙겨 주는 편입니다.',
  편관: '아랫사람이나 자녀에게 기대가 커질수록 엄격해지기 쉬워, 칭찬의 비율을 의식하면 좋습니다.',
  정관: '아랫사람이나 자녀에게 규칙과 본보기를 보여 주는 역할을 자연스럽게 맡기 쉽습니다.',
  편인: '아랫사람이나 자녀와는 각자의 시간을 존중하는 거리가 편안한 편입니다.',
  정인: '아랫사람이나 자녀를 가르치고 보살피는 마음이 깊은 편입니다.',
};

const RELATION_PHRASE: Record<string, string> = {
  육합: '맞물려 힘을 보태는', 삼합: '한 방향으로 뭉치는', 방합: '같은 기운으로 모이는',
  충: '서로 다른 요구가 부딪히기 쉬운', 형: '긴장이 생기기 쉬운', 원진: '서운함이 쌓이기 쉬운', 해: '작게 어긋나기 쉬운', 파: '계획이 한 번 흔들렸다 다시 맞춰지는',
};

const sum = (byType: Record<TenGodCode, number> | undefined, gods: TenGodCode[]) => gods.reduce((total, god) => total + (byType?.[god] ?? 0), 0);

export function buildMarriageFamily(
  sajuData: SajuDataV1 | SajuDataV2,
  gender: 'male' | 'female' | null | undefined,
): LifetimeMarriageFamilySection {
  const dayMaster = sajuData.dayMaster.stem as Stem;
  const day = sajuData.pillars.day;
  const hour = sajuData.input.hourKnown ? sajuData.pillars.hour : null;
  const palaceGod = getBranchPrimaryTenGod(dayMaster, day.branch);
  const others = (['year', 'month', 'hour'] as PillarKey[]).flatMap((key) => {
    const pillar = key === 'hour' ? hour : sajuData.pillars[key];
    const kind = pillar ? relationOf(day.branch, pillar.branch) : null;
    return kind ? [{ key, kind }] : [];
  });
  const spousePalace = [
    `배우자·연인을 보는 자리(태어난 날 지지)에 ${palaceGod}의 기운이 있습니다. ${SPOUSE_PALACE[palaceGod]}`,
    ...others.slice(0, 1).map((r) => `이 자리는 ${PALACE[r.key]} 자리와 ${RELATION_PHRASE[r.kind]} 관계(${r.kind})라, 연애·결혼 이야기에서 그 영역의 사정이 함께 움직이기 쉽습니다.`),
  ].join(' ');

  const starGods: TenGodCode[] | null = gender === 'male' ? ['정재', '편재'] : gender === 'female' ? ['정관', '편관'] : null;
  const starName = gender === 'male' ? '재성(재물의 별)' : '관성(책임의 별)';
  const starScore = starGods ? sum(sajuData.tenGods?.byType, starGods) : 0;
  const total = sajuData.tenGods ? Object.values(sajuData.tenGods.byType).reduce((a, b) => a + b, 0) : 0;
  const share = total ? starScore / total : 0;
  const spouseStar = starGods
    ? share === 0
      ? `전통적으로 배우자를 보는 ${starName}이 타고난 사주에 드러나 있지 않습니다. 인연이 없다는 뜻이 아니라, 관계의 조건을 스스로 정하고 만들어 가는 비중이 큰 사주로 읽습니다.`
      : share >= 0.3
        ? `전통적으로 배우자를 보는 ${starName}이 타고난 사주에 넉넉한 편이라, 관계에 대한 관심과 기회는 많은 대신 선택 기준을 분명히 세우는 것이 중요합니다.`
        : `전통적으로 배우자를 보는 ${starName}이 타고난 사주에 알맞게 자리하고 있어, 관계를 생활 안에서 자연스럽게 키워 가기 좋은 편입니다.`
    : null;

  const childGods: TenGodCode[] = gender === 'male' ? ['정관', '편관'] : ['식신', '상관'];
  const childScore = sum(sajuData.tenGods?.byType, childGods);
  const childrenPalace = hour
    ? `자녀·아랫사람을 보는 자리(태어난 시 지지)로 보면, ${CHILD_PALACE[getBranchPrimaryTenGod(dayMaster, hour.branch)]} ${childScore > 0
      ? '자녀와 아랫사람을 뜻하는 기운도 사주에 있어, 돌보고 이끄는 역할이 삶의 한 축이 되기 쉽습니다.'
      : '자녀와 아랫사람을 뜻하는 기운이 두드러지지 않아, 그 역할은 정해진 몫이라기보다 스스로 선택해 만들어 가는 영역입니다.'}`
    : '태어난 시간을 몰라 자녀·아랫사람을 보는 자리는 풀이에서 제외했습니다.';

  const windows = (sajuData.majorLuck ?? [])
    .filter((cycle) => cycle.startAge !== null && cycle.startAge >= 18 && cycle.startAge <= 55)
    .flatMap((cycle) => {
      const [stem, branch] = Array.from(cycle.ganzi) as [Stem, string];
      const god = getTenGodHangul(dayMaster, stem);
      const relation = relationOf(branch, day.branch);
      const starHit = starGods?.includes(god);
      const joinHit = relation === '육합' || relation === '삼합';
      if (!starHit && !joinHit) return [];
      const ages = `${cycle.startAge}~${cycle.endAge ?? cycle.startAge! + 9}세`;
      const reason = [
        starHit ? `배우자를 뜻하는 ${god}의 기운이 들어오는 ${koreanizeGanzi(cycle.ganzi)} 대운` : `${koreanizeGanzi(cycle.ganzi)} 대운`,
        joinHit ? `배우자·연인 자리와 ${RELATION_PHRASE[relation!]} 흐름` : null,
      ].filter(Boolean).join(', ');
      return [{ ages, reason }];
    })
    .slice(0, 3);
  const timing = windows.length
    ? `관계의 조건이 맞물리는 시기는 ${windows.map((w) => `${w.ages}(${w.reason})`).join(', ')}입니다. 만남이나 결정 이야기가 자연스러워질 수 있는 때라는 뜻이며, 결혼이나 특정 사건을 예고하지 않습니다.`
    : '대운 흐름에서 관계 조건이 뚜렷하게 맞물리는 구간이 따로 드러나지 않아, 시기보다 내가 원하는 관계의 기준을 먼저 세우는 편이 맞는 사주입니다.';

  const summary = [spousePalace, spouseStar, timing, childrenPalace].filter(Boolean).join(' ');
  return {
    headline: '배우자 자리와 자녀 자리로 본 가까운 관계',
    spousePalace,
    spouseStar,
    childrenPalace,
    timing,
    windows,
    summary,
  };
}
