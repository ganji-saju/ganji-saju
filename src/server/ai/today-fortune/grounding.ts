// Task 2 — 오늘운세 LLM facts grounding 빌더 (순수 결정론, LLM 호출 없음).
//
// `buildTodayFortuneGrounding` 은 기존 결정론 결과(`TodayFortuneFreeResult`)와
// saju 데이터에서 LLM 프롬프트에 필요한 구조적 사실을 추출한다.
// 한자 간지 → 한글 음 변환은 기존 `toKoreanGanzi` 재사용.
//
// naming-policy: `weakElement`/`strongElement` 은 "X 기운" 형태.
// 한자 0, 명리 전문용어 0 (평문 한국어).
import type { TodayFortuneFreeResult, TodayScoreItem } from '@/lib/today-fortune/types';
import type { SajuDataV1, SajuDataV2 } from '@/domain/saju/engine';
import { toKoreanGanzi } from '@/lib/saju/ganzi-korean';

export interface TodayFortuneGrounding {
  name: string;
  todayGanzi: string;       // 일진 간지 (한자 아님, 한글 음 — 예: '갑자')
  iljinScore: number | null;
  iljinGrade: string | null;
  weakElement: string;       // '목 기운' 형태
  strongElement: string;
  topAreas: Array<{ key: string; label: string; score: number }>;
  triggeredCaseSummaries: string[]; // 발동 케이스 한 줄 의미(전체)
  concernLabel: string;
  situation: string | null;  // 프로필 상황 한 줄
}

/**
 * 결정론 결과 + saju 데이터 + 외부에서 이미 계산된 caseSummaries 로부터
 * LLM 프롬프트용 grounding DTO 를 만든다 (순수 함수 — 부작용 없음).
 */
export function buildTodayFortuneGrounding(args: {
  result: TodayFortuneFreeResult;
  sajuData: SajuDataV1 | SajuDataV2;
  caseSummaries: string[];
  situation: string | null;
}): TodayFortuneGrounding {
  const { result, sajuData, caseSummaries, situation } = args;

  // 일진 간지: result.sajuChart?.todayGanzi(한자) → 한글 음.
  // sajuChart 가 없을 때 fallback 으로 sajuData 의 오늘 pillar 를 직접 사용할 수 없으므로
  // 빈 문자열 대신 '알 수 없음' 을 쓰지 않고 빈 string 을 반환한다
  // (LLM 프롬프트 빌더에서 null check 후 생략).
  const rawGanzi = result.sajuChart?.todayGanzi ?? '';
  const todayGanzi = rawGanzi ? toKoreanGanzi(rawGanzi) : '';

  // 오행: sajuData.fiveElements.weakest / .dominant → "X 기운" 형태.
  const weakElement = `${sajuData.fiveElements.weakest} 기운`;
  const strongElement = `${sajuData.fiveElements.dominant} 기운`;

  // 일진 점수/등급.
  const iljinScore = result.iljinScore?.totalScore ?? null;
  const iljinGrade = result.iljinScore?.grade ?? null;

  // 상위 3 영역: scores 를 score 내림차순 정렬 후 상위 3개.
  const topAreas: Array<{ key: string; label: string; score: number }> = [...result.scores]
    .sort((a: TodayScoreItem, b: TodayScoreItem) => b.score - a.score)
    .slice(0, 3)
    .map(({ key, label, score }) => ({ key, label, score }));

  return {
    name: result.userName ?? '',
    todayGanzi,
    iljinScore,
    iljinGrade,
    weakElement,
    strongElement,
    topAreas,
    triggeredCaseSummaries: caseSummaries,
    concernLabel: result.concernLabel,
    situation,
  };
}
