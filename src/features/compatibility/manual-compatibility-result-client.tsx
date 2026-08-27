'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GangiIntro, GangiMiniCard, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { COMPATIBILITY_RELATIONSHIPS, type CompatibilityRelationshipSlug } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  isManualCompatibilityPayload,
  MANUAL_COMPATIBILITY_SESSION_KEY,
  type ManualCompatibilityPayload,
} from '@/features/compatibility/manual-compatibility-storage';
import { CompatibilityResultView } from '@/features/compatibility/compatibility-result-view';
import { buildCompatibilityCoupleKey, buildCompatibilityInterpretation } from '@/lib/compatibility';
import { buildCoupleFit } from '@/lib/compatibility/couple-fit';
import type { CoupleTimingReport } from '@/lib/compatibility/couple-timing';
import { buildCompatibilityShareSlug } from '@/lib/compatibility/share-slug';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ShareActions } from '@/features/saju-detail/share-actions';
import { buildKakaoShare } from '@/lib/kakao/share';
import { getCanonicalUrl } from '@/lib/site';

interface ManualCompatibilityResultClientProps {
  relationship?: string;
  hasLoveQuestionPurchase?: boolean;
  deepLlmEnabled?: boolean;
}

function resolveRelationship(value: string | undefined): CompatibilityRelationshipSlug {
  return COMPATIBILITY_RELATIONSHIPS.some((item) => item.slug === value)
    ? (value as CompatibilityRelationshipSlug)
    : 'lover';
}

function MissingManualState({ relationship }: { relationship: CompatibilityRelationshipSlug }) {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="궁합" backHref="/compatibility/input" />
        <GangiIntro
          eyebrow="입력 필요"
          title={
            <>
              두 사람 정보를
              <br />
              다시 넣어주세요
            </>
          }
          description="이 브라우저에 남아 있는 궁합 입력 정보가 없습니다. 새로 입력하면 바로 결과를 볼 수 있습니다."
        />
        <section className="px-4 pb-8 sm:px-0">
          <div className="gangi-pink-panel p-4">
            <GangiMiniCard
              label="바로 시작"
              title="저장 없이도 궁합을 볼 수 있어요"
              desc="내 정보와 상대 정보를 함께 넣으면 결과가 바로 만들어집니다."
            />
            <div className="mt-4 grid gap-2">
              <Link href={`/compatibility/input?relationship=${relationship}`} className="gangi-primary-button">
                두 사람 정보 입력하기
              </Link>
              <Link href="/compatibility" className="gangi-secondary-button">
                궁합 메뉴로
              </Link>
            </div>
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}

export function ManualCompatibilityResultClient({
  relationship,
  hasLoveQuestionPurchase = false,
  deepLlmEnabled = false,
}: ManualCompatibilityResultClientProps) {
  const [payload, setPayload] = useState<ManualCompatibilityPayload | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // ① per-couple: 서버 페이지는 수동 입력의 생년월일을 모르므로, 클라이언트가 커플 키로
  //   접근 여부를 확인한다. 플래그 OFF 면 서버가 넘긴 grandfather(love-question) 값을 그대로 쓴다.
  const [perCoupleAccess, setPerCoupleAccess] = useState(false);
  const requestedRelationship = resolveRelationship(relationship);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(MANUAL_COMPATIBILITY_SESSION_KEY);
    let parsed: unknown = null;

    try {
      parsed = stored ? JSON.parse(stored) : null;
    } catch {
      parsed = null;
    }

    if (isManualCompatibilityPayload(parsed)) {
      setPayload(parsed);
    }

    setIsLoaded(true);
  }, []);

  const effectiveRelationship = payload?.relationship ?? requestedRelationship;
  const selected =
    COMPATIBILITY_RELATIONSHIPS.find((item) => item.slug === effectiveRelationship) ??
    COMPATIBILITY_RELATIONSHIPS[0];
  const compatibility = useMemo(() => {
    if (!payload) return null;

    return buildCompatibilityInterpretation(payload.relationship, {
      name: payload.selfName,
      birthInput: payload.selfBirthInput,
    }, {
      name: payload.partnerName,
      birthInput: payload.partnerBirthInput,
    });
  }, [payload]);

  const coupleKey = useMemo(
    () =>
      payload
        ? buildCompatibilityCoupleKey(payload.selfBirthInput, payload.partnerBirthInput)
        : null,
    [payload]
  );

  // 2026-08-26 🔴 사용자 제보: "3,300원 궁합을 결제했는데 무료와 같은 내용이 나온다."
  //   원인이 여기였다 — **파는 스위치와 여는 스위치가 달랐다.**
  //   결제 CTA 는 플래그와 무관하게 compat-reading(커플 1회권)을 팔고 있는데,
  //   이 접근 확인만 COMPAT_PER_COUPLE_PRICING 뒤에 숨어 있었다. 그 플래그가 꺼진 환경
  //   (= 스테이징. 프로덕션에만 등록돼 있었다)에서는 방금 산 커플권을 **아예 조회하지 않고**
  //   판매 중단된 전역권(love-question)만 보므로, 결제해도 유료 §8 이 그대로 잠긴다.
  //   플래그는 원래 '가격 표시'용이었고 가격은 이미 커플권 단일로 정리됐다(전역권 판매 중단).
  //   권한 조회는 조건 없이 돈다 — 서버 라우트가 grandfather 까지 포함해 판정한다.
  useEffect(() => {
    if (!coupleKey) return;
    let cancelled = false;
    fetch('/api/compatibility/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupleKey }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (!cancelled && result?.ok && result.access === true) setPerCoupleAccess(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coupleKey]);

  // per-couple 접근(서버 라우트 판정, grandfather 포함) 또는 서버가 넘긴 전역권 값.
  const effectiveAccess = perCoupleAccess || hasLoveQuestionPurchase;

  // 용도별 적합성(§9)은 signals 산술이라 가볍다 — 여기서 바로 만든다.
  const coupleFit = useMemo(
    () => (compatibility && effectiveAccess
      ? buildCoupleFit(compatibility, payload?.selfName ?? '', payload?.partnerName ?? '')
      : []),
    [compatibility, effectiveAccess, payload?.selfName, payload?.partnerName]
  );

  // 시간축(§10)은 두 사람 12개월 명식이라 ~320ms — **클라이언트 번들에 넣지 않는다.**
  //   수동 입력은 생년월일이 이 브라우저에만 있어 서버 페이지가 미리 계산할 수 없으므로
  //   전용 라우트로 받아 온다(그 라우트도 구매 여부를 다시 판정한다).
  const [coupleTiming, setCoupleTiming] = useState<CoupleTimingReport | null>(null);
  useEffect(() => {
    if (!effectiveAccess || !payload) return;
    let cancelled = false;
    fetch('/api/compatibility/timing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        self: { name: payload.selfName, birthInput: payload.selfBirthInput },
        partner: { name: payload.partnerName, birthInput: payload.partnerBirthInput },
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.ok && data.timing) setCoupleTiming(data.timing as CoupleTimingReport);
      })
      .catch(() => {
        // 실패해도 나머지 풀이는 그대로 보여준다 — 없는 값을 지어내지 않고 블록만 비운다.
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveAccess, payload]);

  if (!isLoaded) {
    return (
      <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
        <AppPage className="gangi-subpage space-y-5">
          <div className="gangi-card-panel m-4 p-4 text-base font-medium text-[var(--app-copy-muted)] sm:m-0">
            입력하신 궁합 정보를 확인하고 있습니다.
          </div>
        </AppPage>
      </AppShell>
    );
  }

  if (!payload || !compatibility) {
    return <MissingManualState relationship={requestedRelationship} />;
  }

  // 2026-07-03 — 직접입력 궁합도 공개 스냅샷으로 공유(기존엔 sessionStorage 라 공유 불가).
  const shareSlug = buildCompatibilityShareSlug(
    selected.slug,
    payload.selfBirthInput,
    payload.partnerBirthInput
  );
  const sharePath = `/compatibility/share/${shareSlug}?${new URLSearchParams({
    a: payload.selfName,
    b: payload.partnerName,
  }).toString()}`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <CompatibilityResultView
          selected={selected}
          compatibility={compatibility}
          selfName={payload.selfName}
          partnerName={payload.partnerName}
          selfBirthSummary={payload.selfBirthSummary}
          partnerBirthSummary={payload.partnerBirthSummary}
          retakeHref={`/compatibility/input?relationship=${selected.slug}`}
          hasLoveQuestionPurchase={effectiveAccess}
          selfBirthInput={payload.selfBirthInput}
          partnerBirthInput={payload.partnerBirthInput}
          deepLlmEnabled={deepLlmEnabled}
          coupleFit={coupleFit}
          coupleTiming={coupleTiming}
          compatibilityCoupleKey={coupleKey ?? undefined}
        />

        {/* 친구에게 공유 — 공개 스냅샷(/compatibility/share/[slug]) */}
        <section className="px-1">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">친구에게 공유</h2>
          <ShareActions
            text={`${payload.selfName} × ${payload.partnerName} 궁합 — ${compatibility.label}`}
            url={getCanonicalUrl(sharePath)}
            className="mt-2.5"
            kakao={buildKakaoShare({
              title: `${payload.selfName} × ${payload.partnerName} 궁합`,
              description: compatibility.summary,
              path: sharePath,
              buttonTitle: '궁합 결과 보기',
            })}
          />
        </section>
      </AppPage>
    </AppShell>
  );
}
