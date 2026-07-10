'use client';

// /start 허브 클라이언트 본체.
// - 의도 없는 진입(?next 없음): UnifiedIntake(intent=null) → 입력 완료 시 IntakeChoice 선택화면 → 카드 클릭 시 해당 상품 제출.
// - 상품 딥링크(?next=saju | ?next=today): 선택화면을 건너뛰고 입력 완료 즉시 해당 상품으로 제출/라우팅.
// useSearchParams() 는 상위 page.tsx 의 <Suspense> 경계로 감싸 정적 프리렌더 유지(saju-new-client.tsx 패턴).
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { UnifiedIntake } from '@/features/unified-intake/unified-intake';
import { IntakeChoice } from '@/features/unified-intake/intake-choice';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import { parseIntakeIntent, type IntakeIntent } from '@/features/unified-intake/intake-intent';
import { submitSajuFromProfile } from '@/features/unified-intake/submit-saju';
import { submitTodayFromProfile } from '@/features/unified-intake/submit-today';
import { trackMoonlightEvent } from '@/lib/analytics';

export default function StartClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = parseIntakeIntent(searchParams.get('next'));

  const [resolved, setResolved] = useState<UnifiedBirthProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 선택된 상품으로 제출 → 결과 href push. 성공 시 busy 를 되돌리지 않아
  // 페이지 전환 완료까지 재제출을 막는다(saju-intake-page.tsx didNavigate 가드와 동일 패턴).
  async function submitFor(intent: IntakeIntent, profile: UnifiedBirthProfile) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const href =
        intent === 'saju'
          ? await submitSajuFromProfile(profile, { from: 'start' })
          : await submitTodayFromProfile(profile, { from: 'start' });
      router.push(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : '결과를 준비하지 못했습니다. 다시 시도해 주세요.');
      setBusy(false);
    }
  }

  // 입력 완료 콜백:
  // - ?next 딥링크가 있으면 선택화면을 건너뛰고 곧바로 그 상품으로 제출.
  // - ?next 가 없으면 기존 동작 유지: 프로필을 state 에 저장 → IntakeChoice 렌더.
  function handleResolve(profile: UnifiedBirthProfile) {
    if (next) {
      void submitFor(next, profile);
      return;
    }
    setResolved(profile);
  }

  // 선택화면에서 카드 클릭(?next 없는 경로 전용).
  function pick(intent: IntakeIntent) {
    if (!resolved) return;
    void submitFor(intent, resolved);
  }

  const showChoice = next === null && resolved !== null;

  return (
    <AppShell footer={false} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="mx-auto w-full max-w-[560px] px-4 py-8">
        {showChoice ? (
          <div className="grid gap-4">
            <IntakeChoice profile={resolved!} onPick={pick} busy={busy} />
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
                {next === 'saju'
                  ? '입력하시면 바로 사주 풀이를 보여드려요.'
                  : next === 'today'
                    ? '입력하시면 바로 오늘의 운세를 보여드려요.'
                    : '오늘의 운세와 내 사주를 한 번의 입력으로 바로 볼 수 있어요.'}
              </p>
            </div>
            <UnifiedIntake
              intent={next}
              submitting={busy}
              onResolve={handleResolve}
              // Task6b — 인입 퍼널 회귀 수정: 폼 최초 상호작용 시 birth_form_started 복원.
              onStarted={() => trackMoonlightEvent('birth_form_started', { from: 'start' })}
            />
            {error ? (
              <p role="alert" className="text-[14.4px] font-medium text-[var(--app-coral,#e11d48)]">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </AppPage>
    </AppShell>
  );
}
