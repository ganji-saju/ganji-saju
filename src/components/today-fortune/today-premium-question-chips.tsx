// 2026-05-16 — 결제 페이지(/today-fortune/detail) 의 "깊이 들어갈 만한 질문" 카드.
// 기존: <li> 정적 텍스트로 클릭이 안 됐던 회귀 — 사용자가 Q1/Q2/Q3 눌러도 아무 일이 일어나지 않음.
// 변경: 클릭 가능한 버튼으로 대화방에 질문이 prefilled 된 상태로 이동.
//       autoStart=1 은 빼서 사용자가 직접 전송 버튼을 누르도록 함 (사용자 컨트롤 유지).
'use client';

import { useRouter } from 'next/navigation';
import { trackMoonlightEvent } from '@/lib/analytics';

interface TodayPremiumQuestionChipsProps {
  questions: string[];
  sourceSessionId: string;
  concernId: string;
}

export function TodayPremiumQuestionChips({
  questions,
  sourceSessionId,
  concernId,
}: TodayPremiumQuestionChipsProps) {
  const router = useRouter();

  if (!questions || questions.length === 0) return null;

  return (
    <article
      className="rounded-[18px] border bg-white p-4 sm:p-5"
      style={{ borderColor: 'var(--app-pink-line)' }}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        💭 깊이 들어갈 만한 질문
      </div>
      <h3
        className="mt-1 text-[15px] font-extrabold leading-tight text-[var(--app-ink)]"
        style={{ wordBreak: 'keep-all' }}
      >
        오늘 더 풀어볼 만한 질문들
      </h3>
      <p className="mt-1 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]">
        누르면 대화방에 질문이 미리 적혀요. 전송 버튼만 누르면 이어집니다.
      </p>
      <ul className="mt-3 grid gap-1.5">
        {questions.slice(0, 5).map((q, idx) => (
          <li key={`${q}-${idx}`}>
            <button
              type="button"
              onClick={() => {
                trackMoonlightEvent('followup_question_clicked', {
                  from: 'today-fortune-detail',
                  concern: concernId,
                  sourceSessionId,
                  question: q,
                });
                const params = new URLSearchParams({
                  question: q,
                  sourceSessionId,
                  concern: concernId,
                  from: 'today-fortune-detail',
                });
                router.push(`/dialogue?${params.toString()}`);
              }}
              className="w-full rounded-[12px] border px-3 py-2.5 text-left text-[12.5px] leading-[1.55] text-[var(--app-copy)] transition hover:-translate-y-0.5 hover:border-[var(--app-pink)] hover:bg-[var(--app-pink-soft)]"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
                wordBreak: 'keep-all',
              }}
            >
              <span className="mr-1.5 font-extrabold text-[var(--app-pink-strong)]">
                Q{idx + 1}.
              </span>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
