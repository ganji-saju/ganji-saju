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
import { buildCompatibilityInterpretation } from '@/lib/compatibility';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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

  if (!isLoaded) {
    return (
      <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
        <AppPage className="gangi-subpage space-y-5">
          <div className="gangi-card-panel m-4 p-4 text-sm font-medium text-[var(--app-copy-muted)] sm:m-0">
            입력하신 궁합 정보를 확인하고 있습니다.
          </div>
        </AppPage>
      </AppShell>
    );
  }

  if (!payload || !compatibility) {
    return <MissingManualState relationship={requestedRelationship} />;
  }

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
          hasLoveQuestionPurchase={hasLoveQuestionPurchase}
          selfBirthInput={payload.selfBirthInput}
          partnerBirthInput={payload.partnerBirthInput}
          deepLlmEnabled={deepLlmEnabled}
        />
      </AppPage>
    </AppShell>
  );
}
