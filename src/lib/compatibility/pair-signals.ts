// 2026-10-11 — 궁합 근거 확장(점검 C #4). 궁합 AI 는 점수·요약·4축 문장만 받아 "왜 우리가"를 풀지 못했다.
//   두 사람 사이의 관계 근거를 계산한다: 서로의 십성 역할, 일간 천간합, 배우자 자리끼리의 합충, 자리 사이 교차 합충,
//   필요한 기운 보완, (연인·부부) 전통적 배우자 별 해당, 두 사람의 지금 대운과 올해 흐름. 결정론 — 사건 예고 없음.
import { getTenGodHangul } from '@/domain/saju/engine/orrery-adapter';
import type { SajuDataV1, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { analyzeLuckGanji, PALACE, relationOf, type BranchRelationKind, type PillarKey } from '@/domain/saju/report/monthly-signals';
import { getLuckyElementsFromSajuData } from '@/lib/saju/elements';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import type { Stem } from '@/lib/saju/types';

type Data = SajuDataV1 | SajuDataV2;

const ROLE: Record<TenGodCode, string> = {
  비견: '나란히 걷는 동료·친구 같은 존재',
  겁재: '자극을 주며 경쟁도 하는 존재',
  식신: '편하게 챙겨 주고 싶어지는 존재',
  상관: '말과 표현을 끌어내는 자극적인 존재',
  편재: '함께 움직이며 새 경험을 주는 존재',
  정재: '생활을 함께 꾸리고 아끼고 싶은 존재',
  편관: '강하게 끌리면서도 긴장을 주는 존재',
  정관: '믿고 기대며 책임감을 느끼게 하는 존재',
  편인: '생각을 깊게 하게 만드는 존재',
  정인: '보살핌과 안정감을 주는 존재',
};

// 일간 천간합(갑기·을경·병신·정임·무계).
const STEM_HAP: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };

const RELATION_WORD: Record<BranchRelationKind, string> = {
  육합: '맞물려 힘을 보태는', 삼합: '한 방향으로 뭉치는', 방합: '같은 기운으로 모이는',
  충: '서로 다른 요구가 부딪히기 쉬운', 형: '긴장이 생기기 쉬운', 원진: '서운함이 쌓이기 쉬운', 해: '작게 어긋나기 쉬운', 파: '계획이 한 번 흔들렸다 다시 맞춰지는',
};

export interface PairSignals {
  /** 쉬운 문장 요약 — AI 입력·기본 문구 공용. */
  lines: string[];
}

function pillarsOf(data: Data) {
  return (['year', 'month', 'day', 'hour'] as PillarKey[]).flatMap((key) => {
    const pillar = key === 'hour' && !data.input.hourKnown ? null : data.pillars[key];
    return pillar ? [{ key, branch: pillar.branch }] : [];
  });
}

export function computePairSignals(input: {
  self: Data;
  partner: Data;
  selfName: string;
  partnerName: string;
  /** 연인·부부(배우자 별을 볼 관계)인지. */
  romantic: boolean;
  currentYearGanji: string | null;
}): PairSignals {
  const { self, partner, selfName, partnerName } = input;
  const selfStem = self.dayMaster.stem as Stem;
  const partnerStem = partner.dayMaster.stem as Stem;
  const partnerToMe = getTenGodHangul(selfStem, partnerStem);
  const meToPartner = getTenGodHangul(partnerStem, selfStem);
  const lines: string[] = [
    `${selfName}님에게 ${partnerName}님은 ${partnerToMe}(${ROLE[partnerToMe]})로, ${partnerName}님에게 ${selfName}님은 ${meToPartner}(${ROLE[meToPartner]})로 느껴지기 쉽습니다.`,
  ];

  if (STEM_HAP[selfStem] === partnerStem) {
    lines.push('두 사람의 일간이 천간합을 이뤄, 처음부터 서로에게 자연스럽게 끌리고 묶이려는 힘이 있습니다.');
  }

  const dayRelation = relationOf(self.pillars.day.branch, partner.pillars.day.branch);
  if (dayRelation) {
    lines.push(`배우자·가까운 사람을 보는 자리(태어난 날 지지)끼리 ${RELATION_WORD[dayRelation]} 관계(${dayRelation})라, 생활을 함께할수록 이 성격이 드러나기 쉽습니다.`);
  }

  const cross: Array<{ a: PillarKey; b: PillarKey; kind: BranchRelationKind }> = [];
  for (const a of pillarsOf(self)) {
    for (const b of pillarsOf(partner)) {
      if (a.key === 'day' && b.key === 'day') continue;
      const kind = relationOf(a.branch, b.branch);
      if (kind) cross.push({ a: a.key, b: b.key, kind });
    }
  }
  const order: BranchRelationKind[] = ['충', '육합', '삼합', '형', '원진', '방합', '해', '파'];
  for (const c of cross.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind)).slice(0, 2)) {
    lines.push(`${selfName}님의 ${PALACE[c.a]} 자리와 ${partnerName}님의 ${PALACE[c.b]} 자리가 ${RELATION_WORD[c.kind]} 관계(${c.kind})입니다.`);
  }

  const selfNeeds = getLuckyElementsFromSajuData(self);
  const partnerNeeds = getLuckyElementsFromSajuData(partner);
  if (selfNeeds.includes(partner.fiveElements.dominant)) lines.push(`${partnerName}님이 넉넉히 가진 ${partner.fiveElements.dominant} 기운은 ${selfName}님에게 필요한 기운이라, 곁에 있을 때 균형을 잡아 주기 쉽습니다.`);
  if (partnerNeeds.includes(self.fiveElements.dominant)) lines.push(`${selfName}님이 넉넉히 가진 ${self.fiveElements.dominant} 기운은 ${partnerName}님에게 필요한 기운이라, ${partnerName}님 쪽에서 든든함을 느끼기 쉽습니다.`);

  if (input.romantic) {
    const spouseStar = (gender: 'male' | 'female' | null, god: TenGodCode) =>
      gender === 'male' ? god === '정재' || god === '편재' : gender === 'female' ? god === '정관' || god === '편관' : false;
    if (spouseStar(self.input.gender, partnerToMe)) lines.push(`전통적으로 보면 ${partnerName}님은 ${selfName}님의 배우자 별에 해당하는 기운이라, 관계를 생활 속 약속으로 이어 가기 자연스러운 조합입니다.`);
    if (spouseStar(partner.input.gender, meToPartner)) lines.push(`${partnerName}님 쪽에서도 ${selfName}님이 배우자 별에 해당하는 기운입니다.`);
  }

  const luck = (data: Data, name: string) => {
    const major = data.currentLuck?.currentMajorLuck?.ganzi;
    const year = input.currentYearGanji
      ? analyzeLuckGanji({ ganji: input.currentYearGanji, dayMasterStem: data.dayMaster.stem as Stem, pillars: data.pillars, yongsin: data.yongsin }).yongsinFit
      : null;
    const fit = year ? { support: '힘을 쓰기 좋은 해', burden: '속도를 조절하면 좋은 해', mixed: '일을 골라서 쓰면 좋은 해', neutral: '하던 흐름을 이어가기 좋은 해' }[year] : null;
    return `${name}님은 지금 ${major ? `${koreanizeGanzi(major)} 대운` : '대운 미산정'}${fit ? `, 올해는 ${fit}` : ''}`;
  };
  lines.push(`${luck(self, selfName)}이고, ${luck(partner, partnerName)}입니다. 서로의 속도가 다를 수 있다는 점을 앞으로의 계획에 반영해 보세요.`);

  return { lines };
}
