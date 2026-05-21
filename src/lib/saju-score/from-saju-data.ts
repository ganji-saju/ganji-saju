// 2026-05-21 — 엔진 SajuDataV1/V2 → 점수 SajuData 어댑터(Phase 6).
//   엔진 기둥은 한자(甲/子), 점수 엔진은 한글(갑/자) → ganzi-korean 으로 변환.
//   길신/흉살/공망은 결과 페이지 기본 데이터에 없음 → 기본값(빈 배열·false). 시주 미상 → 빈 문자.
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { toKoreanGanziStem, toKoreanGanziBranch } from '@/lib/saju/ganzi-korean';
import { computeSajuScore } from './index';
import type { SajuData, SajuScore } from './types';

type EngineSaju = SajuDataV1 | SajuDataV2;

function pillarToKorean(
  pillar: { stem?: string; branch?: string } | null | undefined
): { gan: string; ji: string } {
  if (!pillar) return { gan: '', ji: '' };
  const ganzi = `${pillar.stem ?? ''}${pillar.branch ?? ''}`;
  return { gan: toKoreanGanziStem(ganzi), ji: toKoreanGanziBranch(ganzi) };
}

/** 엔진 사주 데이터를 점수 엔진 입력으로 변환(순수). */
export function sajuDataToScoreInput(sajuData: EngineSaju): SajuData {
  const p = sajuData.pillars;
  const yeonju = pillarToKorean(p.year);
  const wolju = pillarToKorean(p.month);
  const ilju = pillarToKorean(p.day);
  const siju = pillarToKorean(p.hour);

  const cheongan = [yeonju.gan, wolju.gan, ilju.gan, siju.gan];
  const jiji = [yeonju.ji, wolju.ji, ilju.ji, siju.ji];
  const allEightChars = [
    yeonju.gan, yeonju.ji, wolju.gan, wolju.ji,
    ilju.gan, ilju.ji, siju.gan, siju.ji,
  ];

  const dayMasterElement = sajuData.dayMaster?.element ?? '토';

  return {
    yeonju,
    wolju,
    ilju,
    siju,
    cheongan,
    jiji,
    allEightChars,
    ilgan: ilju.gan,
    kyeokguk: sajuData.pattern?.name ?? '',
    yongsin: sajuData.yongsin?.primary?.value ?? dayMasterElement,
    yongsin_secondary: sajuData.yongsin?.secondary?.[0]?.value,
    ganguk: sajuData.strength?.level ?? '중화',
    gilsinList: [],
    hyungsalList: [],
    hasGongmang: false,
  };
}

/** 어댑터 + computeSajuScore 합성. 결과/프리미엄 페이지가 호출(서버, 순수·비용 0). */
export function computeSajuScoreFromData(
  sajuData: EngineSaju,
  options: { now?: Date } = {}
): SajuScore {
  return computeSajuScore(sajuDataToScoreInput(sajuData), options);
}
