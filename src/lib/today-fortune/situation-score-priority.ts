// 2026-05-16 PR #149 (Part C) — 사용자 상황 기반 today-fortune 영역 점수 재정렬.
// overall 은 항상 맨 앞 유지. 그 뒤 love/wealth/career/relationship/condition 순서를
// 사용자 입력 (relationshipStatus / occupation / currentConcern) 에 따라 재정렬.

import type { TodayScoreItem } from './types';
import type { UserSituation } from '@/lib/saju/types';

type ReorderableKey = Exclude<TodayScoreItem['key'], 'overall'>;

const BASE_ORDER: ReorderableKey[] = ['love', 'wealth', 'career', 'relationship', 'condition'];

/**
 * 사용자 상황 → 우선순위 가중치 (높을수록 위로).
 * - occupation employee/self-employed/job-seeking → career +3
 * - occupation student → career +2 (학업도 직장에 매핑)
 * - relationship dating/separated/married → love +3 / relationship +1
 * - relationship single → love +1
 * - concern business → career +4 (가장 강한 신호 — 본인이 직접 고민으로 명시)
 * - concern romance → love +4
 * - concern family → relationship +4
 * - concern health → condition +4
 * - concern wealth → wealth +4
 */
function buildPriorityScores(situation: UserSituation | null | undefined): Record<ReorderableKey, number> {
  const scores: Record<ReorderableKey, number> = {
    love: 0,
    wealth: 0,
    career: 0,
    relationship: 0,
    condition: 0,
  };
  if (!situation) return scores;

  switch (situation.occupation) {
    case 'employee':
    case 'self-employed':
    case 'job-seeking':
      scores.career += 3;
      break;
    case 'student':
      scores.career += 2;
      break;
    default:
      break;
  }

  switch (situation.relationshipStatus) {
    case 'dating':
    case 'separated':
    case 'married':
      scores.love += 3;
      scores.relationship += 1;
      break;
    case 'single':
      scores.love += 1;
      break;
    default:
      break;
  }

  switch (situation.currentConcern) {
    case 'business':
      scores.career += 4;
      break;
    case 'romance':
      scores.love += 4;
      break;
    case 'family':
      scores.relationship += 4;
      break;
    case 'health':
      scores.condition += 4;
      break;
    case 'wealth':
      scores.wealth += 4;
      break;
    default:
      break;
  }

  return scores;
}

/**
 * scores 배열을 받아 사용자 상황 기반 재정렬한 배열 반환.
 * - overall 은 맨 앞 유지 (총운은 항상 첫 카드)
 * - 그 외는 priority score 내림차순 + 동률은 BASE_ORDER 유지로 안정 정렬
 */
export function reorderTodayScoresBySituation(
  scores: TodayScoreItem[],
  situation: UserSituation | null | undefined
): TodayScoreItem[] {
  if (!situation) return scores;

  const priorities = buildPriorityScores(situation);
  const overall = scores.find((s) => s.key === 'overall');
  const rest = scores.filter((s) => s.key !== 'overall');

  const sorted = [...rest].sort((a, b) => {
    const pa = priorities[a.key as ReorderableKey] ?? 0;
    const pb = priorities[b.key as ReorderableKey] ?? 0;
    if (pa !== pb) return pb - pa;
    // 동률 안정 정렬 — BASE_ORDER index 가 작은 쪽이 먼저.
    return (
      BASE_ORDER.indexOf(a.key as ReorderableKey) -
      BASE_ORDER.indexOf(b.key as ReorderableKey)
    );
  });

  return overall ? [overall, ...sorted] : sorted;
}

/**
 * 사용자 상황을 한국어 한 줄 perspective 로 변환.
 * "직장인 + 사업·이직 고민" → "직장인 / 사업·이직 고민 관점에서 오늘"
 * 미입력 또는 일부만 입력해도 자연스럽게.
 */
export function buildPerspectiveLine(situation: UserSituation | null | undefined): string | null {
  if (!situation) return null;
  const parts: string[] = [];

  const OCC: Record<string, string> = {
    employee: '직장인',
    'self-employed': '자영업·프리랜서',
    student: '학생',
    homemaker: '주부',
    'job-seeking': '구직 중',
    other: '',
  };
  const REL: Record<string, string> = {
    single: '솔로',
    dating: '연애 중',
    married: '기혼',
    separated: '이별·정리 중',
  };
  const CON: Record<string, string> = {
    business: '사업·이직 고민',
    romance: '결혼·연애 고민',
    family: '자녀·가족 고민',
    health: '건강·멘탈 고민',
    wealth: '재물·투자 고민',
    other: '',
  };

  if (situation.occupation && OCC[situation.occupation]) {
    parts.push(OCC[situation.occupation]!);
  }
  if (situation.relationshipStatus && REL[situation.relationshipStatus]) {
    parts.push(REL[situation.relationshipStatus]!);
  }
  if (situation.currentConcern) {
    if (situation.currentConcern === 'other' && situation.concernNote?.trim()) {
      parts.push(situation.concernNote.trim().slice(0, 18) + ' 고민');
    } else if (CON[situation.currentConcern]) {
      parts.push(CON[situation.currentConcern]!);
    }
  }

  if (parts.length === 0) return null;
  return `${parts.join(' · ')} 관점에서`;
}
