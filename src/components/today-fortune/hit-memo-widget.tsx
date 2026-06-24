'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getTodayConcern } from '@/lib/today-fortune/concerns';
import type { StoredHitMemoSession } from '@/lib/today-fortune/hit-memo';
import type { FortuneFeedbackAccuracyLabel } from '@/lib/fortune-feedback';

interface HitMemoWidgetProps {
  session: StoredHitMemoSession;
  onSubmit: (accuracyLabel: FortuneFeedbackAccuracyLabel) => Promise<void>;
}

const OPTIONS: Array<{
  label: string;
  accuracyLabel: FortuneFeedbackAccuracyLabel;
}> = [
  { label: '① 맞았다', accuracyLabel: 'correct' },
  { label: '② 비슷했다', accuracyLabel: 'partial' },
  { label: '③ 빗나갔다', accuracyLabel: 'miss' },
];

export function HitMemoWidget({ session, onSubmit }: HitMemoWidgetProps) {
  const [loading, setLoading] = useState<FortuneFeedbackAccuracyLabel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const concern = getTodayConcern(session.concernId);

  async function handleSubmit(accuracyLabel: FortuneFeedbackAccuracyLabel) {
    setLoading(accuracyLabel);
    try {
      await onSubmit(accuracyLabel);
      setSubmitted(true);
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="app-panel border-[var(--app-gold)]/20 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 px-3 py-1 text-sm text-[var(--app-gold-text)]">
          Hit Memo
        </span>
        <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-sm text-[var(--app-copy-soft)]">
          {concern.label} · {concern.hanja}
        </span>
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-[var(--app-ivory)]">
        어제 풀이는 어떠셨나요?
      </h3>
      <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">
        “{session.headline}” 결과가 실제 하루 흐름과 얼마나 맞았는지 알려주시면, 다음 해석을 더 정확하게 다듬는 데 반영하겠습니다.
      </p>
      {submitted ? (
        <div className="mt-4 rounded-[1rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-base text-emerald-100">
          답을 남겨주셔서 감사합니다. 다음 풀이에서 최근 반응을 함께 참고하겠습니다.
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {OPTIONS.map((option) => (
            <Button
              key={option.accuracyLabel}
              type="button"
              variant="outline"
              disabled={loading !== null}
              onClick={() => void handleSubmit(option.accuracyLabel)}
            >
              {loading === option.accuracyLabel ? '저장 중...' : option.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
