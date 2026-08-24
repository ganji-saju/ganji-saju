'use client';

// Task5 — /saju/new 를 3스텝 스와이프 위저드(saju-intake-page.tsx)에서
// UnifiedIntake(intent=saju) 1화면으로 교체. 제출은 submitSajuFromProfile 이 담당하며
// /start 허브(src/app/start/page.tsx)의 submit 가드 패턴(성공 시 submitting 유지, 실패 시만 복귀)을 그대로 따른다.
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import LegalLinks from '@/components/legal-links';
import { GangiIntro, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ZodiacWheelLoading } from '@/components/saju/zodiac-wheel-loading';
import { UnifiedIntake } from '@/features/unified-intake/unified-intake';
import { submitSajuFromProfile } from '@/features/unified-intake/submit-saju';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import type { TasteProductId } from '@/lib/payments/catalog';
import { trackMoonlightEvent } from '@/lib/analytics';

// 구 위저드가 지원하던 /saju/new?product=/?plan= 유료 퍼널 딥링크 화이트리스트.
// (money-pattern/work-flow/monthly-calendar/year-core add-on, life-standard lifetime)
const CHECKOUT_PRODUCTS = new Set<TasteProductId>([
  'monthly-calendar',
  'year-core',
  'money-pattern',
  'work-flow',
]);

function parseCheckoutProduct(value: string | null): TasteProductId | null {
  return value && CHECKOUT_PRODUCTS.has(value as TasteProductId) ? (value as TasteProductId) : null;
}

export default function SajuNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleResolve(profile: UnifiedBirthProfile) {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    // 구 위저드 buildPostSubmitHref 의 유료 퍼널 라우팅 보존:
    // ?plan=lifetime(또는 product=life-standard) → 평생권 체크아웃, ?product=<add-on> → add-on 체크아웃.
    const productParam = searchParams.get('product');
    const planParam = searchParams.get('plan');
    const product = parseCheckoutProduct(productParam);
    const plan = planParam === 'lifetime' || productParam === 'life-standard' ? 'lifetime' : null;

    try {
      const href = await submitSajuFromProfile(profile, { product, plan, from: 'saju-new' });
      router.push(href);
      // submitting 은 의도적으로 되돌리지 않음 — 페이지 전환 완료까지 폼을 잠가
      // 중복 제출을 막는다(구 saju-intake-page.tsx didNavigate 가드, /start 허브와 동일 패턴).
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '사주 결과를 생성하지 못했습니다. 다시 시도해 주세요.'
      );
      setSubmitting(false);
    }
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      {submitting ? (
        <ZodiacWheelLoading
          title="사주를 풀어드리고 있어요"
          description="네 기둥(年月日時)을 정리하고 오늘 흐름과 맞춰보는 중입니다."
        />
      ) : null}
      <AppPage className="gangi-subpage saju-intake-page space-y-4 sm:space-y-6">
        <GangiPageHeader title="사주 입력" />
        <GangiIntro
          title={
            <>
              사주를 보려면
              <br />
              이 정도면 충분해요
            </>
          }
          description="생년월일, 성별, 태어난 시간만 먼저 알려주세요."
        />

        <UnifiedIntake
          intent="saju"
          submitting={submitting}
          onResolve={handleResolve}
          // Task6b — 인입 퍼널 회귀 수정: 폼 최초 상호작용 시 birth_form_started 복원.
          onStarted={() => trackMoonlightEvent('birth_form_started', { from: 'saju-new', layout: 'single' })}
        />

        {error ? (
          <p role="alert" className="text-[14.4px] font-medium text-[var(--app-coral,#e11d48)]">
            {error}
          </p>
        ) : null}

        {/* 구 위저드(saju-intake-page.tsx)의 법정 고지 disclosure 를 비차단 footer 로 이식.
            제출 자체를 막지 않고, 제출 시 이용약관/개인정보처리방침에 동의한 것으로 안내만 한다. */}
        <p className="text-center text-[12.1px] leading-relaxed text-[var(--app-copy-soft)]">
          시작 시 <LegalLinks className="text-[var(--app-pink-strong)]" />과 AI 모델 전송에 동의합니다.
        </p>
      </AppPage>
    </AppShell>
  );
}
