'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { UnifiedIntake } from '@/features/unified-intake/unified-intake';
import { IntakeChoice } from '@/features/unified-intake/intake-choice';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import type { IntakeIntent } from '@/features/unified-intake/intake-intent';
import { submitSajuFromProfile } from '@/features/unified-intake/submit-saju';
import { submitTodayFromProfile } from '@/features/unified-intake/submit-today';
import { trackMoonlightEvent } from '@/lib/analytics';

export default function StartPage() {
  const router = useRouter();
  const [resolved, setResolved] = useState<UnifiedBirthProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(intent: IntakeIntent) {
    if (!resolved || busy) return;
    setBusy(true);
    setError('');

    try {
      const href =
        intent === 'saju'
          ? await submitSajuFromProfile(resolved)
          : await submitTodayFromProfile(resolved);
      router.push(href);
      // busy 는 의도적으로 되돌리지 않음 — 페이지 전환 완료까지 선택 버튼을 잠가
      // 중복 제출을 막는다(saju-intake-page.tsx didNavigate 가드와 동일 패턴).
    } catch (err) {
      setError(err instanceof Error ? err.message : '결과를 준비하지 못했습니다. 다시 시도해 주세요.');
      setBusy(false);
    }
  }

  return (
    <AppShell footer={false} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="mx-auto w-full max-w-[560px] px-4 py-8">
        {resolved ? (
          <div className="grid gap-4">
            <IntakeChoice profile={resolved} onPick={pick} busy={busy} />
            {error ? (
              <p role="alert" className="text-[14.4px] font-medium text-[var(--app-coral,#e11d48)]">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5">
            <div>
              <h1 className="text-[22.4px] font-extrabold tracking-tight text-[var(--app-ink)]">
                생년월일을 입력해 주세요
              </h1>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
                오늘의 운세와 내 사주를 한 번의 입력으로 바로 볼 수 있어요.
              </p>
            </div>
            <UnifiedIntake
              intent={null}
              onResolve={setResolved}
              // Task6b — 인입 퍼널 회귀 수정: 폼 최초 상호작용 시 birth_form_started 복원.
              onStarted={() => trackMoonlightEvent('birth_form_started', { from: 'start' })}
            />
          </div>
        )}
      </AppPage>
    </AppShell>
  );
}
