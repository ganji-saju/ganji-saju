// 2026-05-20 V2-5 PR Y — 사주 술어 → 일상어 변환 helper 사전화.
//
// 진단서 §3 룰 7: "명리 술어 사용 시 한 단락에 한 번만 + 일상어 풀이 함께".
// 기존 ad-hoc 매핑 (build-narrative.ts, build-yearly-report.ts 등 산재) 을 단일
// helper 로 통합. 신규 코드는 이 helper 사용 권장. 기존 ad-hoc 매핑은 점진 마이그.
//
// 사용 예:
//   toPlainKorean('정인격')                  → '정인격(배움·도움·후원 중심)'
//   toPlainKorean('정인격', { format: 'replace' }) → '배움·도움·후원 중심'
//   toPlainKorean('신약')                    → '에너지가 차분한 편'
//   toPlainKorean('대운')                    → '10년 큰 흐름'

import { MYEONGRI_GLOSSARY } from './terminology';

/**
 * 강약 (신강/신약/중화) 일상어 매핑.
 *   MYEONGRI_GLOSSARY 미등록 — 별도.
 */
const STRENGTH_PLAIN: Record<string, string> = {
  신강: '에너지가 강한 편',
  신약: '에너지가 차분한 편',
  중화: '에너지가 균형 잡힌 편',
};

/**
 * 운 (대운/세운/월운) 일상어 매핑.
 *   "기간의 흐름" 의미를 사용자 친숙 단위로.
 */
const LUCK_PLAIN: Record<string, string> = {
  대운: '10년 큰 흐름',
  세운: '올해 흐름',
  월운: '이번 달 흐름',
  일진: '오늘 흐름',
};

/**
 * 사주 핵심 구조 (일주/월주/연주/시주) 일상어 매핑.
 */
const PILLAR_PLAIN: Record<string, string> = {
  일주: '본인의 본질',
  월주: '환경과 사회성',
  연주: '뿌리와 근본',
  시주: '미래의 방향',
};

/**
 * 사주 술어 → 일상어 풀이.
 *
 * @param term 명리 술어 (예: '정인격', '신약', '대운', '정인', '도화살')
 * @param options.format
 *   - 'inline' (기본): "정인격(배움·도움·후원 중심)" 병기 — 한 단락 1회 노출용
 *   - 'replace': "배움·도움·후원 중심" 풀이만 — 두 번째 등장부터 권장
 *   - 'plain-only': "에너지가 차분한 편" 같이 술어 단독 표기 (강약/운 등)
 * @param options.fallback 매핑 미존재 시 반환 (기본: term 그대로)
 */
export function toPlainKorean(
  term: string,
  options: {
    format?: 'inline' | 'replace' | 'plain-only';
    fallback?: string;
  } = {}
): string {
  const format = options.format ?? 'inline';
  const fallback = options.fallback ?? term;

  // 1) MYEONGRI_GLOSSARY (격국/십성/신살/12운성/관계/오행/보조) — plainCue 활용.
  const entry = MYEONGRI_GLOSSARY[term];
  if (entry) {
    if (format === 'replace' || format === 'plain-only') return entry.plainCue;
    return `${term}(${entry.plainCue})`;
  }

  // 2) 강약 (신강/신약/중화) — STRENGTH_PLAIN
  const strengthPlain = STRENGTH_PLAIN[term];
  if (strengthPlain) {
    if (format === 'plain-only' || format === 'replace') return strengthPlain;
    return `${term}(${strengthPlain})`;
  }

  // 3) 운 (대운/세운/월운/일진) — LUCK_PLAIN
  const luckPlain = LUCK_PLAIN[term];
  if (luckPlain) {
    if (format === 'plain-only' || format === 'replace') return luckPlain;
    return `${term}(${luckPlain})`;
  }

  // 4) 사주 구조 (일주/월주/연주/시주) — PILLAR_PLAIN
  const pillarPlain = PILLAR_PLAIN[term];
  if (pillarPlain) {
    if (format === 'plain-only' || format === 'replace') return pillarPlain;
    return `${term}(${pillarPlain})`;
  }

  // 5) 미등록 — fallback
  return fallback;
}

/**
 * 강약 단독 변환 (자주 사용 패턴 — 본문 첫 문장 등).
 *   예: '신약' → '에너지가 차분한 편'
 *   미등록 시 빈 문자열 (caller 가 호명 prefix 등에서 사용).
 */
export function strengthToPlain(level: string | null | undefined): string {
  if (!level) return '';
  return STRENGTH_PLAIN[level] ?? '';
}

/**
 * 운 단독 변환.
 *   예: '대운' → '10년 큰 흐름'
 */
export function luckToPlain(label: string | null | undefined): string {
  if (!label) return '';
  return LUCK_PLAIN[label] ?? '';
}

/**
 * 매핑 존재 여부 (사주 술어 검출용).
 *   build-narrative 등에서 *명리 술어 카운트* 시 활용 가능.
 */
export function isMyeongriTerm(term: string): boolean {
  return Boolean(
    MYEONGRI_GLOSSARY[term] ||
    STRENGTH_PLAIN[term] ||
    LUCK_PLAIN[term] ||
    PILLAR_PLAIN[term]
  );
}
