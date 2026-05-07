import Link from 'next/link';
import {
  GangiIntro,
  GangiMetricBar,
  GangiMiniCard,
  GangiPageHeader,
} from '@/components/gangi/gangi-ui';
import {
  COMPATIBILITY_PREMIUM_EXPANSION,
  type CompatibilityRelationship,
} from '@/content/moonlight';
import type { CompatibilityInterpretation } from '@/lib/compatibility';

interface CompatibilityResultViewProps {
  selected: CompatibilityRelationship;
  compatibility: CompatibilityInterpretation;
  selfName: string;
  partnerName: string;
  selfBirthSummary: string;
  partnerBirthSummary: string;
  retakeHref?: string;
  hasLoveQuestionPurchase?: boolean;
}

export function CompatibilityResultView({
  selected,
  compatibility,
  selfName,
  partnerName,
  selfBirthSummary,
  partnerBirthSummary,
  retakeHref = `/compatibility/input?relationship=${selected.slug}`,
  hasLoveQuestionPurchase = false,
}: CompatibilityResultViewProps) {
  const premiumExpansion = COMPATIBILITY_PREMIUM_EXPANSION[selected.slug];

  return (
    <>
      <GangiPageHeader title="궁합 결과" backHref={retakeHref} />

      <GangiIntro
        eyebrow={hasLoveQuestionPurchase ? '연애 질문 구매함' : selected.title}
        title={compatibility.headline}
        description={`${selfName}님과 ${partnerName}님의 관계를 말투, 속도, 거리감 중심으로 정리했습니다.`}
      />

      <section className="px-4 sm:px-0">
        <div className="gangi-pink-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="gangi-sub-eyebrow mb-2">관계 점수</p>
              <h2 className="text-2xl font-bold leading-8 text-[var(--app-ink)]">
                {compatibility.label}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--app-copy-muted)]">
                {compatibility.dataNote ?? compatibility.summary}
              </p>
            </div>
            <strong className="text-3xl font-bold text-[var(--app-pink-strong)]">
              {compatibility.score}
            </strong>
          </div>
          <div className="mt-4">
            <GangiMetricBar label={compatibility.scoreLabel} value={compatibility.score} />
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-0">
        <div className="grid gap-3">
          <GangiMiniCard label="잘 맞는 지점" desc={compatibility.supportiveSummary} />
          <GangiMiniCard label="조심할 지점" desc={compatibility.cautionSummary} />
          <GangiMiniCard label="지금 살리는 방식" desc={compatibility.currentFlowSummary} />
        </div>
      </section>

      <section className="px-4 sm:px-0">
        <div className="gangi-card-panel p-4">
          <p className="gangi-sub-eyebrow mb-3">두 사람 결</p>
          <div className="grid gap-3">
            <GangiMiniCard
              label={selfName}
              title={compatibility.selfData.dayMaster.metaphor ?? '내 기본 기질'}
              desc={compatibility.selfData.dayMaster.description ?? selfBirthSummary}
            />
            <GangiMiniCard
              label={partnerName}
              title={compatibility.partnerData.dayMaster.metaphor ?? '상대 기본 기질'}
              desc={compatibility.partnerData.dayMaster.description ?? partnerBirthSummary}
            />
          </div>
          <p className="mt-4 rounded-2xl bg-[var(--app-pink-soft)] px-4 py-3 text-sm font-medium leading-6 text-[var(--app-copy)]">
            {compatibility.summary}
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-0">
        <div className="gangi-card-panel p-4">
          <p className="gangi-sub-eyebrow mb-3">실전 궁합</p>
          <div className="grid gap-3">
            {compatibility.practicalCards.map((card) => (
              <article key={card.key} className="gangi-result-card">
                <span>{card.eyebrow}</span>
                <h2>{card.title}</h2>
                <p>{card.summary}</p>
                <em>{card.practice}</em>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-0">
        <details className="gangi-card-panel p-4">
          <summary className="cursor-pointer list-none text-sm font-bold text-[var(--app-ink)]">
            궁합 기준과 참고 단서 보기
          </summary>
          <div className="mt-4 grid gap-3">
            <GangiMiniCard
              label="관계를 보는 렌즈"
              title={compatibility.relationshipLensTitle}
              desc={compatibility.relationshipLensBody}
            />
            <GangiMiniCard label="다루는 방식" desc={compatibility.practiceSummary} />
            {compatibility.evidence.map((item) => (
              <GangiMiniCard key={item.title} label={item.title} desc={item.body} />
            ))}
          </div>
        </details>
      </section>

      <section className="px-4 pb-8 sm:px-0">
        <div className="gangi-pink-panel p-4">
          <p className="gangi-sub-eyebrow mb-2">더 보고 싶다면</p>
          <h2 className="text-xl font-bold leading-7 text-[var(--app-ink)]">
            {premiumExpansion.ctaTitle}
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--app-copy-muted)]">
            {premiumExpansion.ctaBody}
          </p>
          <div className="mt-4 grid gap-2">
            {premiumExpansion.preview.slice(0, 2).map((item) => (
              <GangiMiniCard key={item.title} label={item.title} desc={item.body} />
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <Link href="/membership/checkout?plan=premium" className="gangi-primary-button">
              프리미엄으로 이어보기
            </Link>
            <Link href={retakeHref} className="gangi-secondary-button">
              다른 사람 입력하기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
