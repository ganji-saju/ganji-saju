// 2026-05-19 Phase 7c — 상담사 카드에 'AI 풀이 vs 사람 상담' 구분 배지 추가.
//   현재 4분은 모두 AI 사주 리포트 진입점이라 'AI 풀이' 배지로 표시.
//   사람 1:1 상담사 예약은 출시 예정 — footer 에 별도 안내 + 환불 정책 link.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import {
  SPECIALIST_MENTORS,
  type SpecialistMentorMode,
} from '@/content/specialist-mentors';

interface SpecialistMentorGridProps {
  title?: string;
  description?: string;
  className?: string;
  showHeader?: boolean;
}

function ModeBadge({ mode }: { mode: SpecialistMentorMode }) {
  if (mode === 'ai-report') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
          color: 'var(--app-pink-strong)',
        }}
      >
        AI 풀이
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
      style={{
        background: 'rgba(17, 17, 20, 0.06)',
        borderColor: 'rgba(17, 17, 20, 0.18)',
        color: 'var(--app-copy)',
      }}
    >
      사람 상담 · 출시 예정
    </span>
  );
}

export function SpecialistMentorGrid({
  title,
  description,
  className,
  showHeader = true,
}: SpecialistMentorGridProps) {
  return (
    <div className={className}>
      {showHeader && title ? (
        <SectionHeader
          eyebrow="전문 선생"
          title={title}
          description={description}
          titleClassName="text-3xl"
        />
      ) : null}

      <ProductGrid columns={2} className={showHeader && title ? 'mt-5' : ''}>
        {SPECIALIST_MENTORS.map((mentor) => (
          <FeatureCard
            key={mentor.slug}
            surface="soft"
            eyebrow={
              <span className="flex items-center gap-2 text-sm tracking-[0.22em] text-[var(--app-gold)]/72">
                <span>{mentor.hanja}</span>
                <ModeBadge mode={mentor.mode} />
              </span>
            }
            title={mentor.title}
            titleClassName="text-2xl"
            description={
              <>
                <div className="text-base font-medium text-[var(--app-gold-text)]">
                  {mentor.specialty}
                </div>
                <p className="mt-2 text-base leading-7 text-[var(--app-copy)]">{mentor.description}</p>
              </>
            }
            badge={
              <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-[12.6px] text-[var(--app-copy-muted)]">
                {mentor.statusLabel}
              </span>
            }
            footer={
              <Link
                href={mentor.href}
                className="inline-flex items-center gap-2 text-base font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
              >
                {mentor.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
          </FeatureCard>
        ))}
      </ProductGrid>

      {/* Phase 7c — AI/사람 구분 명시 + 환불·취소 정책 link */}
      <div className="mt-5 rounded-[14px] border border-[var(--app-line)] bg-white p-4 text-[14.4px] leading-[1.7] text-[var(--app-copy)]">
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          상담 안내
        </div>
        <ul className="mt-2 grid gap-1.5">
          <li>
            <span className="font-extrabold text-[var(--app-ink)]">AI 풀이:</span> 위 전문 선생은
            모두 사주 데이터 기반 AI 리포트로 진입합니다. 1:1 사람 상담사가 아닙니다.
          </li>
          <li>
            <span className="font-extrabold text-[var(--app-ink)]">사람 상담사 예약:</span>{' '}
            화상·전화·대면 상담은 출시 예정입니다. 정식 오픈 시 가격·시간·예약 방식을 별도로
            안내드립니다.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/refund-policy"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-3 text-[13.8px] font-extrabold text-[var(--app-copy)] hover:bg-[var(--app-pink-soft)]"
          >
            환불 / 취소 정책
          </Link>
          <Link
            href="/appointment-policy"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-3 text-[13.8px] font-extrabold text-[var(--app-copy)] hover:bg-[var(--app-pink-soft)]"
          >
            예약 상담 정책 (예정)
          </Link>
        </div>
      </div>
    </div>
  );
}
