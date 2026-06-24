'use client';

import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { ConcernId } from '@/lib/today-fortune/types';

interface FollowUpQuestionChipsProps {
  questions: string[];
  sourceSessionId: string;
  concernId: ConcernId;
}

export function FollowUpQuestionChips({
  questions,
  sourceSessionId,
  concernId,
}: FollowUpQuestionChipsProps) {
  const router = useRouter();

  return (
    <section className="rounded-[1.6rem] border border-[var(--app-pink-line)] bg-[linear-gradient(180deg,#fff4fa_0%,#ffffff_100%)] p-5 shadow-[0_16px_38px_rgba(216,27,114,0.08)]">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--app-pink)] text-white shadow-[0_12px_28px_rgba(216,27,114,0.2)]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-base font-normal leading-5 text-[var(--app-pink-strong)]">대화방으로 바로 이어가기</div>
          <h3 className="mt-1 text-2xl font-normal leading-8 text-[var(--app-ink)]">
            지금 결과를 놓고 바로 물어보세요
          </h3>
          <p className="mt-2 text-base font-normal leading-6 text-[var(--app-copy)]">
            아래 질문을 누르면 대화방으로 이동해 이 결과를 바탕으로 이어서 묻습니다.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => {
              trackMoonlightEvent('followup_question_clicked', {
                from: 'today-fortune',
                concern: concernId,
                sourceSessionId,
                question,
              });
              // 2026-05-16 — autoStart=1 제거. 사용자가 직접 전송 버튼을 누르도록 함.
              // (사용자 컨트롤 유지 — 클릭 즉시 발송되는 게 부담스럽다는 피드백 반영.)
              router.push(
                `/dialogue?question=${encodeURIComponent(question)}&sourceSessionId=${encodeURIComponent(sourceSessionId)}&concern=${encodeURIComponent(concernId)}&from=today-fortune`
              );
            }}
            className="w-full rounded-[1rem] border border-[rgba(216,27,114,0.16)] bg-white px-4 py-3.5 text-left text-[0.95rem] font-normal leading-6 text-[var(--app-ink)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--app-pink)] hover:bg-[var(--app-pink-soft)]"
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}
