// 오늘운세 무료 LLM 풀이 게이팅. 미설정/'0' → 결정론(현 동작). '1' → LLM.
export function isTodayFortuneLlmEnabled(): boolean {
  return process.env.OPENAI_TODAY_FORTUNE?.trim() === '1';
}
