// 2026-05-21 — 총평 _easy 도출용 신규 컨텐츠 맵. 엔진/glossary 에 없는 부분만 정의.
//   - GANGUK_EASY: 강약(신강/중화/신약)을 일상어 label+detail 로. (엔진은 level 만 보유)
//   - KYEOKGUK_CAREER_FIT: 격국(채택 십성)→직군. (MYEONGRI_GLOSSARY 에 career_fit 없음)
//   - padToThree: sixtyGapja.strengths(2)/watchPoints(1) 를 3개로 보강.
import type { StrengthLevel, TenGodCode } from '@/domain/saju/engine/saju-data-v1';

/**
 * 강약 → 일상어 label+detail. spec §2 ganguk_easy.
 * 본문 노출 금지 명리어(신강/신약/강약)를 *라벨에 쓰지 않는다*.
 */
export const GANGUK_EASY: Record<StrengthLevel, { label: string; detail: string }> = {
  신강: {
    label: '자기 축이 단단한 결',
    detail:
      '본인 페이스가 또렷하고 주관이 분명한 편이에요. 단, 주변과 속도를 맞추는 연습이 같이 필요합니다.',
  },
  중화: {
    label: '균형이 잡힌 결',
    detail:
      '한쪽으로 치우치지 않고 상황에 맞춰 힘을 쓰는 편이에요. 큰 흔들림 없이 흐르는 구조입니다.',
  },
  신약: {
    label: '자기 축이 다소 약한 결',
    detail:
      '본인 페이스가 외부 영향에 흔들리기 쉬운 구조예요. 단, 흐름을 잘 읽는 강점도 같이 옵니다.',
  },
};

/**
 * 격국(채택 십성) → 어울리는 직군 6종.
 * MYEONGRI_GLOSSARY 에 career_fit 이 없어 신규 정의. spec §2 kyeokguk_easy.career_fit.
 */
export const KYEOKGUK_CAREER_FIT: Record<TenGodCode, string[]> = {
  식신: ['분석', '기획', '상담', '교육', '돌봄', '연구'],
  상관: ['창작', '기획', '강연', '디자인', '마케팅', '방송'],
  정재: ['관리', '회계', '운영', '실무', '제조', '품질'],
  편재: ['영업', '유통', '사업', '투자', '중개', '무역'],
  정관: ['행정', '공공', '관리', '법무', '인사', '조직'],
  편관: ['수사', '의료', '군경', '위기관리', '엔지니어링', '추진'],
  정인: ['교육', '연구', '돌봄', '상담', '학술', '행정'],
  편인: ['연구', '기획', '데이터', '전문기술', '의료', '예술'],
  비견: ['독립', '전문직', '프리랜서', '창업', '운동', '현장'],
  겁재: ['영업', '경쟁', '스타트업', '현장', '중개', '추진'],
};

/**
 * 1차 목록을 보강 후보로 채워 정확히 3개로(부족하면 가능한 만큼). 중복·공백 제거.
 * spec §2 key_strengths_easy / key_weaknesses_easy = 3개.
 */
export function padToThree(primary: string[], fillers: string[]): string[] {
  const out: string[] = [];
  for (const item of [...primary, ...fillers]) {
    const trimmed = item?.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    if (out.length === 3) break;
  }
  return out;
}
