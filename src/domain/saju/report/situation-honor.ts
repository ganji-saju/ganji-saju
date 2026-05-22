// 2026-05-16 PR #150 (B1) — 사주 풀이 본문에 사용자 상황 호명 강화.
// 기존 OpenAI prompt 에만 phrase 가 들어가던 것을 fallback narrative 본문에도
// 명시적으로 노출. 미입력 사용자 vs 입력 사용자 본문 차이를 사용자가 눈으로 확인 가능하게.

import type { UserSituation } from '@/lib/saju/types';

const RELATIONSHIP_HONOR: Record<NonNullable<UserSituation['relationshipStatus']>, string> = {
  single: '솔로이신',
  dating: '연애 중이신',
  married: '기혼이신',
  separated: '이별·정리 중이신',
};

const OCCUPATION_HONOR: Record<NonNullable<UserSituation['occupation']>, string> = {
  employee: '직장인이신',
  'self-employed': '자영업·프리랜서이신',
  student: '학생이신',
  homemaker: '가정 살림을 하시는',
  'job-seeking': '구직 중이신',
  other: '',
};

const CONCERN_TOPIC: Record<NonNullable<UserSituation['currentConcern']>, string> = {
  business: '사업·이직',
  romance: '결혼·연애',
  family: '자녀·가족',
  health: '건강·멘탈',
  wealth: '재물·투자',
  other: '',
};

/**
 * headline 앞에 붙는 한 줄 prefix.
 * - "직장인 김영민님, " (occupation + name)
 * - "연애 중이신 분께, " (relationship only)
 * - "" (모두 미입력)
 *
 * occupation > relationshipStatus 우선순위. name 있으면 이름, 없으면 "분께".
 */
export function buildHonorificPrefix(input: {
  situation: UserSituation | null | undefined;
  userName?: string | null;
}): string {
  const situation = input.situation;
  if (!situation) return '';
  const name = input.userName?.trim() ?? '';

  // 호칭 동사 (occupation 우선, 없으면 relationship).
  let honor: string | null = null;
  if (situation.occupation && OCCUPATION_HONOR[situation.occupation]) {
    honor = OCCUPATION_HONOR[situation.occupation];
  } else if (situation.relationshipStatus) {
    honor = RELATIONSHIP_HONOR[situation.relationshipStatus];
  }
  if (!honor) return '';

  if (name) {
    return `${honor} ${name}님, `;
  }
  return `${honor} 분께, `;
}

/**
 * narrative body 끝에 추가될 situation-action 한 줄.
 * 사용자 입력 concern + yongsin 정보를 엮어 "현재 [사업·이직] 고민은 [용신] 의 흐름이 도움이 됩니다" 같은 문장 생성.
 *
 * @param input.situation 사용자 상황
 * @param input.yongsinPrimary 풀이의 primary 용신 (없으면 일반 문구)
 * @returns 한 문장 또는 null (situation 미입력)
 */
export function buildSituationActionLine(input: {
  situation: UserSituation | null | undefined;
  yongsinPrimary?: string | null;
}): string | null {
  const situation = input.situation;
  if (!situation) return null;
  const concern = situation.currentConcern;
  const concernNote = situation.concernNote?.trim() ?? '';

  // concern 주제 결정.
  let topic: string | null = null;
  if (concern === 'other' && concernNote) {
    topic = concernNote.slice(0, 20);
  } else if (concern && CONCERN_TOPIC[concern]) {
    topic = CONCERN_TOPIC[concern];
  }
  if (!topic) return null;

  const yong = input.yongsinPrimary?.trim();
  if (yong) {
    return `현재 ${topic} 고민은 사주의 보완 흐름인 ${yong}을(를) 통해 풀어가는 편이 자연스럽습니다.`;
  }
  return `현재 ${topic} 고민은 위 격국·일간 특성을 본인 상황에 비추어 해석하시면 도움이 됩니다.`;
}

/**
 * 사주 narrative 의 closing line. situation 있으면 호명 강조 + situation-action 통합.
 * - 입력 사용자: "사주의 핵심은 [용신] · [고민 주제] 흐름과 함께 풀어가실 때 잘 작동합니다."
 * - 미입력: null
 */
export function buildSituationClosing(input: {
  situation: UserSituation | null | undefined;
  userName?: string | null;
}): string | null {
  if (!input.situation) return null;
  // 2026-05-20 V2-5 PR V — 호명 1회 규칙 (spec §3 룰 6) 준수:
  //   closing 의 `${name}님` 재호명 제거. 호명은 headline 의 honorificPrefix 에서
  //   1회만 등장 — 같은 본문에 ${name}님 이 두 번 노출되던 어색함 해소.
  return '이 풀이는 입력하신 현재 상황을 함께 반영했어요.';
}
