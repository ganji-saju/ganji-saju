// 2026-05-21 — 분포 검증용 50 테스트 케이스. phase-1-task.md §8.
//   makeCase 로 4기둥에서 cheongan/jiji/allEightChars/ilgan 자동 도출 → 8글자 일관성 보장.
//   고/중/저 점수 스펙트럼을 의도적으로 분산(분포 평균 65~70 목표). 다양성 §8-3 8항목 충족.
import type { SajuData } from './types';

export interface TestCase {
  id: string;
  description: string;
  saju: SajuData;
  expectedRange?: [number, number];
  notes?: string;
}

type Pillar = { gan: string; ji: string };
type Pillars = { yeonju: Pillar; wolju: Pillar; ilju: Pillar; siju: Pillar };
type Meta = {
  kyeokguk: string;
  yongsin: string;
  yongsin_secondary?: string;
  ganguk: '신강' | '신약' | '중화';
  gilsinList?: string[];
  hyungsalList?: string[];
  hasGongmang?: boolean;
};

function makeCase(
  id: string,
  description: string,
  p: Pillars,
  meta: Meta,
  expectedRange?: [number, number],
  notes?: string
): TestCase {
  const cheongan = [p.yeonju.gan, p.wolju.gan, p.ilju.gan, p.siju.gan];
  const jiji = [p.yeonju.ji, p.wolju.ji, p.ilju.ji, p.siju.ji];
  const allEightChars = [
    p.yeonju.gan, p.yeonju.ji, p.wolju.gan, p.wolju.ji,
    p.ilju.gan, p.ilju.ji, p.siju.gan, p.siju.ji,
  ];
  return {
    id,
    description,
    expectedRange,
    notes,
    saju: {
      ...p,
      cheongan,
      jiji,
      allEightChars,
      ilgan: p.ilju.gan,
      kyeokguk: meta.kyeokguk,
      yongsin: meta.yongsin,
      yongsin_secondary: meta.yongsin_secondary,
      ganguk: meta.ganguk,
      gilsinList: meta.gilsinList ?? [],
      hyungsalList: meta.hyungsalList ?? [],
      hasGongmang: meta.hasGongmang ?? false,
    },
  };
}

// ── A. 기본 15 (10천간 일간 × 강약, 5오행 분산 중심) ──────────────────────────
export const TEST_CASES_A_BASE: TestCase[] = [
  makeCase('A-001', '갑목 일간 + 중화 + 식신격', { yeonju: { gan: '경', ji: '오' }, wolju: { gan: '병', ji: '자' }, ilju: { gan: '갑', ji: '진' }, siju: { gan: '기', ji: '유' } }, { kyeokguk: '식신격', yongsin: '수', ganguk: '중화' }),
  makeCase('A-002', '을목 일간 + 신약 + 정인격', { yeonju: { gan: '계', ji: '해' }, wolju: { gan: '경', ji: '신' }, ilju: { gan: '을', ji: '사' }, siju: { gan: '무', ji: '인' } }, { kyeokguk: '정인격', yongsin: '수', ganguk: '신약' }),
  makeCase('A-003', '병화 일간 + 신강 + 편재격', { yeonju: { gan: '갑', ji: '인' }, wolju: { gan: '정', ji: '사' }, ilju: { gan: '병', ji: '오' }, siju: { gan: '경', ji: '신' } }, { kyeokguk: '편재격', yongsin: '수', ganguk: '신강', hyungsalList: ['양인살'] }),
  makeCase('A-004', '정화 일간 + 중화 + 정관격', { yeonju: { gan: '임', ji: '자' }, wolju: { gan: '계', ji: '축' }, ilju: { gan: '정', ji: '유' }, siju: { gan: '갑', ji: '진' } }, { kyeokguk: '정관격', yongsin: '목', ganguk: '중화' }),
  makeCase('A-005', '무토 일간 + 신강 + 식신격', { yeonju: { gan: '병', ji: '오' }, wolju: { gan: '무', ji: '술' }, ilju: { gan: '무', ji: '진' }, siju: { gan: '경', ji: '신' } }, { kyeokguk: '식신격', yongsin: '목', ganguk: '신강', hyungsalList: ['괴강살'] }),
  makeCase('A-006', '기토 일간 + 신약 + 정재격', { yeonju: { gan: '을', ji: '묘' }, wolju: { gan: '갑', ji: '인' }, ilju: { gan: '기', ji: '해' }, siju: { gan: '병', ji: '자' } }, { kyeokguk: '정재격', yongsin: '화', ganguk: '신약' }),
  makeCase('A-007', '경금 일간 + 중화 + 정인격', { yeonju: { gan: '무', ji: '술' }, wolju: { gan: '기', ji: '미' }, ilju: { gan: '경', ji: '인' }, siju: { gan: '정', ji: '해' } }, { kyeokguk: '정인격', yongsin: '토', ganguk: '중화' }),
  makeCase('A-008', '신금 일간 + 신약 + 식신격', { yeonju: { gan: '정', ji: '사' }, wolju: { gan: '병', ji: '오' }, ilju: { gan: '신', ji: '묘' }, siju: { gan: '무', ji: '자' } }, { kyeokguk: '식신격', yongsin: '토', ganguk: '신약', hyungsalList: ['겁살'] }),
  makeCase('A-009', '임수 일간 + 신강 + 편관격', { yeonju: { gan: '경', ji: '신' }, wolju: { gan: '신', ji: '유' }, ilju: { gan: '임', ji: '자' }, siju: { gan: '갑', ji: '진' } }, { kyeokguk: '편관격', yongsin: '화', ganguk: '신강', hyungsalList: ['양인살'] }),
  makeCase('A-010', '계수 일간 + 신약 + 정관격', { yeonju: { gan: '무', ji: '술' }, wolju: { gan: '기', ji: '미' }, ilju: { gan: '계', ji: '미' }, siju: { gan: '무', ji: '오' } }, { kyeokguk: '정관격', yongsin: '금', ganguk: '신약' }),
  makeCase('A-011', '갑목 일간 + 신강 + 건록 (목 과다)', { yeonju: { gan: '을', ji: '묘' }, wolju: { gan: '갑', ji: '인' }, ilju: { gan: '갑', ji: '인' }, siju: { gan: '을', ji: '묘' } }, { kyeokguk: '비견격', yongsin: '금', ganguk: '신강' }),
  makeCase('A-012', '병화 일간 + 중화 + 상관격', { yeonju: { gan: '기', ji: '축' }, wolju: { gan: '경', ji: '진' }, ilju: { gan: '병', ji: '인' }, siju: { gan: '정', ji: '유' } }, { kyeokguk: '상관격', yongsin: '목', ganguk: '중화', gilsinList: ['문창귀인'] }),
  makeCase('A-013', '경금 일간 + 신강 + 정재격', { yeonju: { gan: '신', ji: '유' }, wolju: { gan: '무', ji: '술' }, ilju: { gan: '경', ji: '신' }, siju: { gan: '을', ji: '묘' } }, { kyeokguk: '정재격', yongsin: '화', ganguk: '신강', hyungsalList: ['괴강살'] }),
  makeCase('A-014', '임수 일간 + 중화 + 정인격', { yeonju: { gan: '경', ji: '신' }, wolju: { gan: '병', ji: '오' }, ilju: { gan: '임', ji: '진' }, siju: { gan: '기', ji: '해' } }, { kyeokguk: '정인격', yongsin: '금', ganguk: '중화', gilsinList: ['천을귀인'] }),
  makeCase('A-015', '정화 일간 + 신약 + 편인격', { yeonju: { gan: '갑', ji: '인' }, wolju: { gan: '을', ji: '묘' }, ilju: { gan: '정', ji: '해' }, siju: { gan: '임', ji: '자' } }, { kyeokguk: '편인격', yongsin: '화', ganguk: '신약' }),
];

// ── B. 격국별 16 (8격국 × 2, 정격·편격 다양화) ────────────────────────────────
export const TEST_CASES_B_KYEOKGUK: TestCase[] = [
  makeCase('B-001', '식신격 (유리)', { yeonju: { gan: '계', ji: '해' }, wolju: { gan: '을', ji: '묘' }, ilju: { gan: '계', ji: '유' }, siju: { gan: '병', ji: '진' } }, { kyeokguk: '식신격', yongsin: '목', ganguk: '중화', gilsinList: ['천을귀인'] }),
  makeCase('B-002', '식신격 (손상)', { yeonju: { gan: '신', ji: '유' }, wolju: { gan: '신', ji: '유' }, ilju: { gan: '계', ji: '묘' }, siju: { gan: '경', ji: '신' } }, { kyeokguk: '식신격', yongsin: '목', ganguk: '신약', hyungsalList: ['겁살'] }),
  makeCase('B-003', '상관격 (유리)', { yeonju: { gan: '병', ji: '오' }, wolju: { gan: '기', ji: '사' }, ilju: { gan: '갑', ji: '자' }, siju: { gan: '계', ji: '유' } }, { kyeokguk: '상관격', yongsin: '수', ganguk: '중화' }),
  makeCase('B-004', '상관격 (충 다발)', { yeonju: { gan: '경', ji: '자' }, wolju: { gan: '무', ji: '오' }, ilju: { gan: '경', ji: '인' }, siju: { gan: '갑', ji: '신' } }, { kyeokguk: '상관격', yongsin: '수', ganguk: '신강', hyungsalList: ['양인살'] }),
  makeCase('B-005', '정재격 (유리)', { yeonju: { gan: '무', ji: '진' }, wolju: { gan: '계', ji: '해' }, ilju: { gan: '갑', ji: '오' }, siju: { gan: '기', ji: '사' } }, { kyeokguk: '정재격', yongsin: '수', ganguk: '중화' }),
  makeCase('B-006', '정재격 (신약)', { yeonju: { gan: '무', ji: '술' }, wolju: { gan: '기', ji: '미' }, ilju: { gan: '을', ji: '축' }, siju: { gan: '무', ji: '진' } }, { kyeokguk: '정재격', yongsin: '수', ganguk: '신약' }),
  makeCase('B-007', '편재격', { yeonju: { gan: '임', ji: '자' }, wolju: { gan: '경', ji: '인' }, ilju: { gan: '무', ji: '진' }, siju: { gan: '계', ji: '해' } }, { kyeokguk: '편재격', yongsin: '화', ganguk: '신약' }),
  makeCase('B-008', '편재격 (신강)', { yeonju: { gan: '무', ji: '진' }, wolju: { gan: '무', ji: '오' }, ilju: { gan: '무', ji: '술' }, siju: { gan: '임', ji: '자' } }, { kyeokguk: '편재격', yongsin: '목', ganguk: '신강', hyungsalList: ['괴강살'] }),
  makeCase('B-009', '정관격 (유리)', { yeonju: { gan: '갑', ji: '인' }, wolju: { gan: '정', ji: '묘' }, ilju: { gan: '경', ji: '진' }, siju: { gan: '병', ji: '자' } }, { kyeokguk: '정관격', yongsin: '토', ganguk: '중화', gilsinList: ['천을귀인', '문창귀인'] }),
  makeCase('B-010', '정관격 (신약)', { yeonju: { gan: '병', ji: '오' }, wolju: { gan: '정', ji: '사' }, ilju: { gan: '신', ji: '묘' }, siju: { gan: '병', ji: '오' } }, { kyeokguk: '정관격', yongsin: '토', ganguk: '신약', hyungsalList: ['겁살', '망신살'] }),
  makeCase('B-011', '편관격', { yeonju: { gan: '갑', ji: '인' }, wolju: { gan: '경', ji: '오' }, ilju: { gan: '갑', ji: '신' }, siju: { gan: '경', ji: '오' } }, { kyeokguk: '편관격', yongsin: '수', ganguk: '신약', hyungsalList: ['양인살'] }),
  makeCase('B-012', '편관격 (귀인)', { yeonju: { gan: '정', ji: '유' }, wolju: { gan: '계', ji: '축' }, ilju: { gan: '정', ji: '해' }, siju: { gan: '갑', ji: '진' } }, { kyeokguk: '편관격', yongsin: '목', ganguk: '중화', gilsinList: ['천덕귀인', '월덕귀인'] }),
  makeCase('B-013', '정인격 (유리)', { yeonju: { gan: '임', ji: '자' }, wolju: { gan: '경', ji: '신' }, ilju: { gan: '갑', ji: '오' }, siju: { gan: '정', ji: '묘' } }, { kyeokguk: '정인격', yongsin: '수', ganguk: '중화' }),
  makeCase('B-014', '정인격 (신강)', { yeonju: { gan: '임', ji: '자' }, wolju: { gan: '임', ji: '자' }, ilju: { gan: '갑', ji: '인' }, siju: { gan: '계', ji: '해' } }, { kyeokguk: '정인격', yongsin: '화', ganguk: '신강', hyungsalList: ['양인살'] }),
  makeCase('B-015', '편인격', { yeonju: { gan: '경', ji: '신' }, wolju: { gan: '무', ji: '술' }, ilju: { gan: '경', ji: '오' }, siju: { gan: '무', ji: '인' } }, { kyeokguk: '편인격', yongsin: '화', ganguk: '신강' }),
  makeCase('B-016', '편인격 (신약)', { yeonju: { gan: '기', ji: '미' }, wolju: { gan: '정', ji: '사' }, ilju: { gan: '기', ji: '묘' }, siju: { gan: '을', ji: '해' } }, { kyeokguk: '편인격', yongsin: '화', ganguk: '신약', gilsinList: ['학당귀인'] }),
];

// ── C. 특수 10 (종격, 양인일주, 백호일주, 극단 오행) ──────────────────────────
export const TEST_CASES_C_SPECIAL: TestCase[] = [
  makeCase('C-001', '종격 후보 (목 종왕, 신약)', { yeonju: { gan: '갑', ji: '인' }, wolju: { gan: '을', ji: '묘' }, ilju: { gan: '갑', ji: '인' }, siju: { gan: '을', ji: '묘' } }, { kyeokguk: '비견격', yongsin: '목', ganguk: '신약' }, undefined, '목 8개 종왕격'),
  makeCase('C-002', '종격 후보 (수 종왕, 신약)', { yeonju: { gan: '임', ji: '자' }, wolju: { gan: '계', ji: '해' }, ilju: { gan: '계', ji: '자' }, siju: { gan: '임', ji: '해' } }, { kyeokguk: '비견격', yongsin: '수', ganguk: '신약' }, undefined, '수 8개 종왕격'),
  makeCase('C-003', '양인일주 병오 (신강)', { yeonju: { gan: '갑', ji: '인' }, wolju: { gan: '갑', ji: '오' }, ilju: { gan: '병', ji: '오' }, siju: { gan: '경', ji: '인' } }, { kyeokguk: '편인격', yongsin: '수', ganguk: '신강', hyungsalList: ['양인살'] }),
  makeCase('C-004', '양인일주 임자 (신강)', { yeonju: { gan: '경', ji: '신' }, wolju: { gan: '임', ji: '자' }, ilju: { gan: '임', ji: '자' }, siju: { gan: '신', ji: '유' } }, { kyeokguk: '편인격', yongsin: '화', ganguk: '신강', hyungsalList: ['양인살'] }),
  makeCase('C-005', '백호일주 갑진', { yeonju: { gan: '경', ji: '오' }, wolju: { gan: '기', ji: '묘' }, ilju: { gan: '갑', ji: '진' }, siju: { gan: '정', ji: '미' } }, { kyeokguk: '정재격', yongsin: '수', ganguk: '중화', hyungsalList: ['백호살'] }),
  makeCase('C-006', '백호일주 무진 (괴강 겸)', { yeonju: { gan: '병', ji: '오' }, wolju: { gan: '갑', ji: '술' }, ilju: { gan: '무', ji: '진' }, siju: { gan: '경', ji: '신' } }, { kyeokguk: '식신격', yongsin: '수', ganguk: '신강', hyungsalList: ['백호살', '괴강살'] }),
  makeCase('C-007', '극단 오행 (화 5개, 수 0)', { yeonju: { gan: '병', ji: '오' }, wolju: { gan: '정', ji: '사' }, ilju: { gan: '병', ji: '오' }, siju: { gan: '갑', ji: '인' } }, { kyeokguk: '비견격', yongsin: '수', ganguk: '신강', hyungsalList: ['양인살'] }),
  makeCase('C-008', '극단 오행 (금 5개, 목 0)', { yeonju: { gan: '경', ji: '신' }, wolju: { gan: '신', ji: '유' }, ilju: { gan: '경', ji: '신' }, siju: { gan: '무', ji: '술' } }, { kyeokguk: '비견격', yongsin: '화', ganguk: '신강' }),
  makeCase('C-009', '극단 결핍 (3오행만, 충)', { yeonju: { gan: '갑', ji: '자' }, wolju: { gan: '경', ji: '오' }, ilju: { gan: '갑', ji: '자' }, siju: { gan: '경', ji: '오' } }, { kyeokguk: '편관격', yongsin: '목', ganguk: '신약', hyungsalList: ['겁살'], hasGongmang: true }),
  makeCase('C-010', '토 과다 (토 5개)', { yeonju: { gan: '무', ji: '진' }, wolju: { gan: '기', ji: '미' }, ilju: { gan: '무', ji: '술' }, siju: { gan: '기', ji: '축' } }, { kyeokguk: '비견격', yongsin: '목', ganguk: '신강' }, undefined, '토 8개 종왕 후보'),
];

// ── D. 무작위 보강 9 (다양 분포) ──────────────────────────────────────────────
export const TEST_CASES_D_RANDOM: TestCase[] = [
  makeCase('D-001', '랜덤 1', { yeonju: { gan: '정', ji: '묘' }, wolju: { gan: '임', ji: '인' }, ilju: { gan: '무', ji: '신' }, siju: { gan: '계', ji: '해' } }, { kyeokguk: '편재격', yongsin: '화', ganguk: '신약', gilsinList: ['천을귀인'] }),
  makeCase('D-002', '랜덤 2', { yeonju: { gan: '신', ji: '해' }, wolju: { gan: '경', ji: '인' }, ilju: { gan: '병', ji: '진' }, siju: { gan: '기', ji: '축' } }, { kyeokguk: '편재격', yongsin: '목', ganguk: '신약' }),
  makeCase('D-003', '랜덤 3', { yeonju: { gan: '갑', ji: '술' }, wolju: { gan: '병', ji: '인' }, ilju: { gan: '경', ji: '오' }, siju: { gan: '계', ji: '미' } }, { kyeokguk: '정관격', yongsin: '토', ganguk: '신약', hyungsalList: ['망신살'] }),
  makeCase('D-004', '랜덤 4', { yeonju: { gan: '을', ji: '사' }, wolju: { gan: '정', ji: '해' }, ilju: { gan: '신', ji: '유' }, siju: { gan: '무', ji: '자' } }, { kyeokguk: '편관격', yongsin: '토', ganguk: '중화', gilsinList: ['문창귀인'] }),
  makeCase('D-005', '랜덤 5', { yeonju: { gan: '계', ji: '축' }, wolju: { gan: '갑', ji: '인' }, ilju: { gan: '정', ji: '사' }, siju: { gan: '경', ji: '술' } }, { kyeokguk: '정인격', yongsin: '목', ganguk: '중화' }),
  makeCase('D-006', '랜덤 6', { yeonju: { gan: '임', ji: '신' }, wolju: { gan: '무', ji: '오' }, ilju: { gan: '을', ji: '유' }, siju: { gan: '병', ji: '자' } }, { kyeokguk: '편관격', yongsin: '수', ganguk: '신약', hyungsalList: ['겁살'] }),
  makeCase('D-007', '랜덤 7', { yeonju: { gan: '기', ji: '미' }, wolju: { gan: '병', ji: '인' }, ilju: { gan: '임', ji: '오' }, siju: { gan: '신', ji: '해' } }, { kyeokguk: '정재격', yongsin: '금', ganguk: '신약', gilsinList: ['천을귀인'] }),
  makeCase('D-008', '랜덤 8', { yeonju: { gan: '경', ji: '진' }, wolju: { gan: '기', ji: '묘' }, ilju: { gan: '갑', ji: '자' }, siju: { gan: '병', ji: '인' } }, { kyeokguk: '정인격', yongsin: '화', ganguk: '신강' }),
  makeCase('D-009', '랜덤 9', { yeonju: { gan: '무', ji: '오' }, wolju: { gan: '신', ji: '유' }, ilju: { gan: '계', ji: '묘' }, siju: { gan: '을', ji: '묘' } }, { kyeokguk: '식신격', yongsin: '금', ganguk: '신약', gilsinList: ['학당귀인'] }),
];

export const ALL_TEST_CASES: TestCase[] = [
  ...TEST_CASES_A_BASE,
  ...TEST_CASES_B_KYEOKGUK,
  ...TEST_CASES_C_SPECIAL,
  ...TEST_CASES_D_RANDOM,
];
