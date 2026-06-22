// 2026-05-20 V2-5 PR R — 챕터별 사용자 피드백 카드 (옵션 A: 별점 + Yes/No).
//
// 풀이 카드 하단에 통합. 별점 5개 + "이 풀이 도움됐어요?" Yes/No.
// 로그인 필수 (비로그인 시 안내 메시지 + 로그인 링크).
'use client';

import { useState } from 'react';

interface Props {
  readingId: string;
  chapterId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** 카드 제목 (예: "타고난 성향") — UI 보조 정보 */
  chapterTitle?: string;
  /** 비로그인 사용자에게 보여줄 로그인 페이지 href. */
  loginHref?: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'auth-required';

export function ChapterFeedbackCard({
  readingId,
  chapterId,
  chapterTitle,
  loginHref = '/login',
}: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  // 2026-05-20 V2-5 PR U — 자유 코멘트 (옵션 B 확장).
  const [comment, setComment] = useState<string>('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [state, setState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submitFeedback(
    nextRating: number | null,
    nextHelpful: boolean | null,
    nextComment: string | null = null
  ) {
    // 빈 응답이면 저장 안 함 (DB CHECK 제약과 일치).
    if (nextRating === null && nextHelpful === null) return;

    setState('saving');
    setErrorMsg(null);

    try {
      const response = await fetch('/api/saju/chapter-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readingId,
          chapterId,
          rating: nextRating,
          helpfulBool: nextHelpful,
          comment: nextComment?.trim() || null,
        }),
      });

      if (response.status === 401) {
        setState('auth-required');
        return;
      }

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setState('error');
        setErrorMsg(data?.error ?? '피드백 저장에 실패했어요.');
        return;
      }

      setState('saved');
    } catch {
      setState('error');
      setErrorMsg('네트워크 오류로 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  function handleRatingClick(value: number) {
    const nextRating = rating === value ? null : value;
    setRating(nextRating);
    void submitFeedback(nextRating, helpful, comment);
  }

  function handleHelpfulClick(value: boolean) {
    const nextHelpful = helpful === value ? null : value;
    setHelpful(nextHelpful);
    void submitFeedback(rating, nextHelpful, comment);
  }

  function handleCommentSubmit() {
    // 별점 또는 helpful 응답이 먼저 있어야 코멘트 저장 가능 (DB CHECK 제약).
    if (rating === null && helpful === null) {
      setState('error');
      setErrorMsg('별점 또는 도움됨 응답을 먼저 남겨주세요.');
      return;
    }
    void submitFeedback(rating, helpful, comment);
  }

  if (state === 'auth-required') {
    return (
      <div
        className="mt-3 rounded-[12px] border border-[var(--app-line)] bg-white p-3 text-[12.5px] text-[var(--app-copy-soft)]"
        role="status"
      >
        피드백은{' '}
        <a href={loginHref} className="font-bold text-[var(--app-pink-strong)] underline">
          로그인
        </a>{' '}
        후 남길 수 있어요.
      </div>
    );
  }

  const titleSuffix = chapterTitle ? ` (${chapterTitle})` : '';

  return (
    <div
      className="mt-3 rounded-[12px] border border-[var(--app-line)] bg-white p-3.5"
      aria-label={`챕터 ${chapterId}${titleSuffix} 피드백`}
    >
      <div className="text-[12.5px] font-bold text-[var(--app-ink)]">
        이 풀이가 잘 맞았나요?
      </div>

      {/* 별점 5개 */}
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = rating !== null && value <= rating;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value}점`}
              onClick={() => handleRatingClick(value)}
              disabled={state === 'saving'}
              className="text-[20px] leading-none transition-transform active:scale-95 disabled:opacity-50"
              style={{ color: filled ? '#F4B632' : 'var(--app-line)' }}
            >
              {filled ? '★' : '☆'}
            </button>
          );
        })}
        {rating !== null && (
          <span className="ml-1.5 text-[13px] text-[var(--app-copy-soft)]">{rating}/5</span>
        )}
      </div>

      {/* Yes/No 버튼 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[13px] text-[var(--app-copy-soft)]">도움됐어요?</span>
        <button
          type="button"
          onClick={() => handleHelpfulClick(true)}
          disabled={state === 'saving'}
          aria-pressed={helpful === true}
          className="rounded-full border px-3 py-1 text-[13px] font-bold transition-colors disabled:opacity-50"
          style={{
            borderColor: helpful === true ? 'var(--app-pink-strong)' : 'var(--app-line)',
            background: helpful === true ? 'var(--app-pink-soft)' : 'white',
            color: helpful === true ? 'var(--app-pink-strong)' : 'var(--app-copy-soft)',
          }}
        >
          네 👍
        </button>
        <button
          type="button"
          onClick={() => handleHelpfulClick(false)}
          disabled={state === 'saving'}
          aria-pressed={helpful === false}
          className="rounded-full border px-3 py-1 text-[13px] font-bold transition-colors disabled:opacity-50"
          style={{
            borderColor: helpful === false ? 'var(--app-pink-strong)' : 'var(--app-line)',
            background: helpful === false ? 'var(--app-pink-soft)' : 'white',
            color: helpful === false ? 'var(--app-pink-strong)' : 'var(--app-copy-soft)',
          }}
        >
          아쉬워요
        </button>
      </div>

      {/* 자유 코멘트 (옵션 B 확장 — 별점/helpful 응답 후 활성화) */}
      {(rating !== null || helpful !== null) && (
        <div className="mt-3">
          {!showCommentInput ? (
            <button
              type="button"
              onClick={() => setShowCommentInput(true)}
              className="text-[13px] font-bold text-[var(--app-pink-strong)] underline underline-offset-2"
            >
              + 자세한 의견 남기기 (선택)
            </button>
          ) : (
            <div>
              <label
                htmlFor={`feedback-comment-${chapterId}`}
                className="text-[13px] font-bold text-[var(--app-copy-soft)]"
              >
                자세한 의견 (선택, 200자 이내)
              </label>
              <textarea
                id={`feedback-comment-${chapterId}`}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 200))}
                rows={2}
                maxLength={200}
                placeholder="어떤 부분이 좋았거나 아쉬웠나요?"
                className="mt-1 w-full resize-none rounded-[8px] border border-[var(--app-line)] bg-white p-2 text-[12.5px] text-[var(--app-ink)] placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink-strong)] focus:outline-none"
                disabled={state === 'saving'}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[13px] text-[var(--app-copy-soft)]">
                  {comment.length}/200
                </span>
                <button
                  type="button"
                  onClick={handleCommentSubmit}
                  disabled={state === 'saving' || comment.trim().length === 0}
                  className="rounded-full bg-[var(--app-pink-strong)] px-3 py-1 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  의견 보내기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 상태 메시지 */}
      {state === 'saved' && (
        <div className="mt-2.5 text-[13px] text-[var(--app-jade,#3F8796)]" role="status">
          ✓ 피드백 저장됨 — 풀이 개선에 활용됩니다
        </div>
      )}
      {state === 'error' && errorMsg && (
        <div className="mt-2.5 text-[13px] text-[var(--app-coral,#E05298)]" role="alert">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
