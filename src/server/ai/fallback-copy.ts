// 2026-08-31 — LLM fallback 사유별 **사용자 문구** 단일 출처.
//
//   왜 분리했나: 8/31 한도 초과 장애 때 사용자에게 나간 문구가
//   "AI 답변을 가져오지 못했어요. **잠시 후 다시 질문해 주세요.**" 였다.
//   한도 초과는 기다린다고 풀리지 않는다 — 운영자가 결제해야 한다.
//   즉 문구가 **거짓 안내**였고, 사용자는 될 때까지 재시도하다 떠난다.
//
//   그래서 사유마다 "재시도가 도움이 되는가(retryHelps)" 를 먼저 정하고,
//   문구는 그 판정을 따라 쓴다. 새 사유를 추가할 땐 이 표에 함께 넣어야 한다.
//
//   ⚠️ 벤더명·우리 결제 상태는 절대 노출하지 않는다(2026-08-11 결정 유지).
//      "OpenAI 계정의 한도가 초과되어…" 같은 문구는 서비스 신뢰를 깎는다.
//      진단은 응답 본문의 fallbackReason 과 서버 로그로 유지된다.
import type { AiFallbackReason } from './openai-text';

export interface AiFallbackCopy {
  /** 사용자에게 보여줄 문구. */
  message: string;
  /** 지금 다시 시도하면 결과가 달라질 수 있는가. false 면 "잠시 후 다시" 를 쓰면 안 된다. */
  retryHelps: boolean;
}

const COPY: Record<AiFallbackReason, AiFallbackCopy> = {
  // env 미설정 — 운영자가 키를 넣기 전엔 몇 번을 눌러도 같다.
  ai_not_configured: {
    message: 'AI 답변 기능이 아직 준비되지 않았어요. 준비되는 대로 이용하실 수 있습니다.',
    retryHelps: false,
  },
  // 사용량·결제 한도 — 운영자 조치가 있어야 풀린다.
  quota_exceeded: {
    message:
      '지금은 AI 답변을 만들 수 없어요. 서비스 쪽 문제라 다시 질문해도 같은 결과예요. 복구되면 바로 이용하실 수 있습니다.',
    retryHelps: false,
  },
  // 빈 응답 · 일시적 오류 — 재시도가 실제로 도움이 된다.
  empty_ai_response: {
    message: 'AI 답변을 가져오지 못했어요. 잠시 후 다시 질문해 주세요.',
    retryHelps: true,
  },
  openai_error: {
    message: 'AI 답변을 가져오지 못했어요. 잠시 후 다시 질문해 주세요.',
    retryHelps: true,
  },
};

export function aiFallbackCopy(reason: AiFallbackReason | null | undefined): AiFallbackCopy {
  return COPY[reason ?? 'openai_error'] ?? COPY.openai_error;
}

export const AI_FALLBACK_REASONS = Object.keys(COPY) as AiFallbackReason[];
