/**
 * AI 생성 풀이 고지 배지 노출 여부를 결정하는 순수 함수.
 * 'openai' 또는 'cache' 일 때만 true — 실제 LLM 텍스트가 사용자에게 노출된 경우.
 * 'fallback' 또는 미설정(결정론 경로)은 false → 배지 없음.
 */
export function shouldShowAiDisclosure(aiSource: string | undefined): boolean {
  return aiSource === 'openai' || aiSource === 'cache';
}
