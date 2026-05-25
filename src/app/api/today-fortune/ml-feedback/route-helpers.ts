export interface FeedbackSaveErrorResponse {
  status: number;
  body: { ok: false; error: string };
  /** 서버 로그용 raw 오류. 클라이언트 body 에는 포함하지 않는다. */
  logError: string;
}

const GENERIC_SAVE_ERROR = '피드백 저장에 실패했어요. 잠시 후 다시 시도해 주세요.';

// 내부 DB/PostgREST 오류(스키마 캐시·RLS·제약 위반 등)는 사용자에게 노출하지 않는다.
// raw 오류는 logError 로만 돌려 호출부가 서버 로그에 남기고, 클라이언트에는 고정 안내만 반환.
export function feedbackSaveErrorResponse(rawError: string | undefined): FeedbackSaveErrorResponse {
  return {
    status: 500,
    body: { ok: false, error: GENERIC_SAVE_ERROR },
    logError: rawError ?? '(no error message)',
  };
}
