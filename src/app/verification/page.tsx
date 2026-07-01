import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { ActionCluster } from '@/components/layout/action-cluster';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import SiteHeader from '@/features/shared-navigation/site-header';
import { Badge } from '@/components/ui/badge';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';
import {
  DEFAULT_CLASSICS_AUDIT_CONCEPT,
  getClassicsVerificationAudit,
  type ClassicEvidenceAuditItem,
  type ClassicGateCheck,
  type ClassicHoldAudit,
  type ClassicWorkAudit,
} from '@/server/verification/classics-audit';
import { getSajuVerificationAudit, type SajuVerificationCheck } from '@/server/verification/saju-audit';
import { getLifetimeVerificationAudit } from '@/server/verification/lifetime-audit';
import { getYearlyVerificationAudit } from '@/server/verification/yearly-audit';
import { getTodayFortuneVerificationAudit } from '@/server/verification/today-fortune-audit';
import {
  getProfileLinkageVerificationAudit,
  type ProfileLinkageServiceAudit,
} from '@/server/verification/profile-linkage-audit';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import { getVerificationAccessStatus } from '@/lib/verification-access';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface VerificationPageProps {
  searchParams: Promise<{
    concept?: string;
    slug?: string;
    topic?: string;
    concern?: string;
    targetYear?: string;
    counselor?: string;
  }>;
}

export const metadata: Metadata = {
  title: '검증 대시보드',
  description: '고전 원문 적재와 사주 계산 단서를 확인하는 내부 검증 화면입니다.',
  robots: {
    index: false,
    follow: false,
  },
};

function statusTone(ok: boolean) {
  return ok
    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
    : 'border-amber-300/35 bg-amber-400/10 text-amber-100';
}

function StatusBadge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <Badge className={cn('border px-3 py-1', statusTone(ok))}>
      {children}
    </Badge>
  );
}

function JsonLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="gangi-secondary-button"
    >
      진단 원문
    </Link>
  );
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) return '없음';
  return value.slice(0, 19).replace('T', ' ');
}

function ClassicWorkRows({ works }: { works: ClassicWorkAudit[] }) {
  if (works.length === 0) {
    return <p className="app-body-copy mt-4 text-base">live 대상 고전 상태를 불러오지 못했습니다.</p>;
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="min-w-[920px] text-left text-base">
        <thead className="text-sm uppercase tracking-[0.18em] text-[var(--app-copy-soft)]">
          <tr>
            <th className="py-3 pr-4">작품</th>
            <th className="py-3 pr-4">상태</th>
            <th className="py-3 pr-4">본문</th>
            <th className="py-3 pr-4">태그</th>
            <th className="py-3 pr-4">풀이</th>
            <th className="py-3 pr-4">누락</th>
            <th className="py-3 pr-4">출처</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--app-line)]">
          {works.map((work) => (
            <tr key={work.sourceWorkRef} className="align-top">
              <td className="py-4 pr-4">
                <div className="font-semibold text-[var(--app-ivory)]">{work.title ?? work.sourceWorkRef}</div>
                <div className="mt-1 break-all text-sm text-[var(--app-copy-soft)]">{work.sourceWorkRef}</div>
              </td>
              <td className="py-4 pr-4">
                <StatusBadge ok={work.ok}>{work.ok ? 'OK' : work.reason}</StatusBadge>
                <div className="mt-2 text-sm text-[var(--app-copy-soft)]">
                  {work.release} · {work.verification} · {work.completeness}
                </div>
              </td>
              <td className="py-4 pr-4 text-[var(--app-copy)]">
                {work.sectionCount.toLocaleString()} sections / {work.passageCount.toLocaleString()} passages
              </td>
              <td className="py-4 pr-4 text-[var(--app-copy)]">{work.conceptTagCount.toLocaleString()}</td>
              <td className="py-4 pr-4 text-[var(--app-copy)]">{work.uiSummaryCount.toLocaleString()}</td>
              <td className="py-4 pr-4">
                <StatusBadge ok={work.requiredFieldMissingCount === 0}>
                  {work.requiredFieldMissingCount.toLocaleString()}
                </StatusBadge>
              </td>
              <td className="py-4 pr-4">
                {work.sourceUrl ? (
                  <Link
                    href={work.sourceUrl}
                    className="break-all text-[var(--app-gold-text)] underline-offset-4 hover:underline"
                  >
                    {work.sourceName ?? work.sourceUrl}
                  </Link>
                ) : (
                  <span className="text-[var(--app-copy-soft)]">없음</span>
                )}
                <div className="mt-1 text-sm text-[var(--app-copy-soft)]">{work.license ?? 'license 없음'}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GateChecks({ checks }: { checks: ClassicGateCheck[] }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {checks.map((check) => (
        <div key={check.key} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
          <StatusBadge ok={check.ok}>{check.ok ? '통과' : '확인 필요'}</StatusBadge>
          <div className="mt-3 font-semibold text-[var(--app-ivory)]">{check.label}</div>
          <p className="mt-2 text-base text-[var(--app-copy-muted)]">{check.detail}</p>
        </div>
      ))}
    </div>
  );
}

function EvidenceSample({ item }: { item: ClassicEvidenceAuditItem }) {
  return (
    <article className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge ok={item.hasRequestedConceptTag}>태그 {item.hasRequestedConceptTag ? '일치' : '불일치'}</StatusBadge>
        <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
          rank {item.rankScore}
        </Badge>
      </div>
      <div className="mt-4 text-base font-semibold text-[var(--app-ivory)]">
        {item.workTitleKo} · {item.sectionPath} · #{item.passageNo}
      </div>
      {item.commentaryKo ? (
        <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">{item.commentaryKo}</p>
      ) : null}
      <details className="group mt-4">
        <summary className="cursor-pointer list-none rounded-xl border border-[var(--app-line)] px-4 py-3 text-base font-semibold text-[var(--app-copy)]">
          원문 보기
        </summary>
        <blockquote lang="zh-Hant" className="mt-3 break-words text-base leading-8 text-[var(--app-gold-text)]">
          {item.originalTextZh}
        </blockquote>
      </details>
      <div className="mt-4 grid gap-2 text-sm text-[var(--app-copy-soft)]">
        <div className="break-all">source_ref: {item.sourceRef}</div>
        <div className="break-all">line_ref: {item.sourceLineRef ?? '없음'}</div>
        <div className="break-all">hash: {item.provenanceHash ?? '없음'}</div>
        <div>license: {item.license ?? '없음'}</div>
        <div>
          tags: {item.conceptTags.map((tag) => `${tag.nameKo}/${tag.slug}`).join(', ') || '없음'}
        </div>
      </div>
    </article>
  );
}

function HoldRows({ holds }: { holds: ClassicHoldAudit[] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {holds.map((hold) => (
        <div key={hold.sourceWorkRef} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
          <StatusBadge ok={hold.ok}>{hold.ok ? 'hold' : '확인 필요'}</StatusBadge>
          <div className="mt-3 break-all text-base font-semibold text-[var(--app-ivory)]">
            {hold.title ?? hold.sourceWorkRef}
          </div>
          <p className="mt-2 break-all text-sm text-[var(--app-copy-soft)]">{hold.sourceWorkRef}</p>
          <p className="mt-2 text-sm text-[var(--app-copy-muted)]">
            {hold.release} · {hold.verification} · referenceOnly={String(hold.referenceOnly)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SajuChecks({ checks }: { checks?: SajuVerificationCheck[] }) {
  if (!checks) return null;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {checks.map((check) => (
        <div key={check.key} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
          <StatusBadge ok={check.ok}>{check.ok ? '통과' : '확인 필요'}</StatusBadge>
          <div className="mt-3 font-semibold text-[var(--app-ivory)]">{check.label}</div>
          <p className="mt-2 text-base leading-6 text-[var(--app-copy-muted)]">{check.detail}</p>
        </div>
      ))}
    </div>
  );
}

function YearlyChecks({
  checks,
}: {
  checks?: Array<{ key: string; label: string; ok: boolean; detail: string }>;
}) {
  if (!checks) return null;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {checks.map((check) => (
        <div key={check.key} className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
          <StatusBadge ok={check.ok}>{check.ok ? '통과' : '확인 필요'}</StatusBadge>
          <div className="mt-3 font-semibold text-[var(--app-ivory)]">{check.label}</div>
          <p className="mt-2 text-base leading-6 text-[var(--app-copy-muted)]">{check.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ProfileLinkageRows({ services }: { services: ProfileLinkageServiceAudit[] }) {
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-2">
      {services.map((service) => (
        <article
          key={service.key}
          className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge ok={service.status === 'ready'}>
              {service.status === 'ready'
                ? '연동됨'
                : service.status === 'partial'
                  ? '부분 연동'
                  : '독립 기능'}
            </StatusBadge>
            <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy-muted)]">
              {service.label}
            </Badge>
          </div>
          <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">{service.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy)]">
              self {service.usesSelfProfile ? 'yes' : 'no'}
            </Badge>
            <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy)]">
              family {service.usesFamilyProfiles ? 'yes' : 'no'}
            </Badge>
            <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy)]">
              schema {service.usesSharedBirthSchema ? 'shared' : 'local'}
            </Badge>
            <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy)]">
              engine {service.usesSajuEngine ? 'saju' : 'none'}
            </Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--app-copy-soft)]">{service.continuity}</p>
        </article>
      ))}
    </div>
  );
}

export default async function VerificationPage({ searchParams }: VerificationPageProps) {
  const access = await getVerificationAccessStatus();

  if (access.status === 'unauthenticated') {
    redirect(`/login?next=${encodeURIComponent('/verification')}`);
  }

  if (access.status === 'forbidden') {
    notFound();
  }

  const params = await searchParams;
  const concept = params.concept?.trim() || DEFAULT_CLASSICS_AUDIT_CONCEPT;
  const slug = params.slug?.trim() || '1982-1-29-8-male';
  const topic = params.topic?.trim() || 'today';
  const concern = normalizeConcernId(params.concern?.trim());
  const targetYear = Number.parseInt(params.targetYear?.trim() || '2026', 10);
  const normalizedTargetYear =
    Number.isInteger(targetYear) && targetYear >= 1900 && targetYear <= 2100 ? targetYear : 2026;
  const counselor = params.counselor === 'male' ? 'male' : 'female';
  const [classicsAudit, todayFortuneAudit, sajuAudit, lifetimeAudit, yearlyAudit, profileLinkageAudit] = await Promise.all([
    getClassicsVerificationAudit({ concept, limit: 5 }),
    getTodayFortuneVerificationAudit({ slug, concernId: concern, counselorId: counselor }),
    getSajuVerificationAudit({ slug, topic }),
    getLifetimeVerificationAudit({ slug, targetYear: normalizedTargetYear, counselorId: counselor }),
    getYearlyVerificationAudit({ slug, targetYear: normalizedTargetYear, counselorId: counselor }),
    Promise.resolve(getProfileLinkageVerificationAudit()),
  ]);
  const classicsApiHref = `/api/verification/classics?concept=${encodeURIComponent(concept)}&limit=5`;
  const todayFortuneApiHref = `/api/verification/today-fortune?slug=${encodeURIComponent(slug)}&concern=${encodeURIComponent(concern)}&counselor=${counselor}`;
  const sajuApiHref = `/api/verification/saju?slug=${encodeURIComponent(slug)}&topic=${encodeURIComponent(topic)}`;
  const lifetimeApiHref = `/api/verification/lifetime?slug=${encodeURIComponent(slug)}&targetYear=${normalizedTargetYear}&counselor=${counselor}`;
  const yearlyApiHref = `/api/verification/yearly?slug=${encodeURIComponent(slug)}&targetYear=${normalizedTargetYear}&counselor=${counselor}`;
  const profileLinkageApiHref = '/api/verification/profile-linkage';

  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <PageHero
          badges={
            <>
              <StatusBadge ok={classicsAudit.status === 'ready'}>고전 {classicsAudit.status}</StatusBadge>
              <StatusBadge ok={todayFortuneAudit.status === 'ready'}>오늘운세 {todayFortuneAudit.status}</StatusBadge>
              <StatusBadge ok={sajuAudit.status === 'ready'}>사주 {sajuAudit.status}</StatusBadge>
              <StatusBadge ok={lifetimeAudit.status === 'ready'}>평생 {lifetimeAudit.status}</StatusBadge>
              <StatusBadge ok={yearlyAudit.status === 'ready'}>연간 {yearlyAudit.status}</StatusBadge>
              <StatusBadge ok={profileLinkageAudit.status === 'ready'}>연동지도 {profileLinkageAudit.status}</StatusBadge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                검색 제외
              </Badge>
            </>
          }
          title="검증 대시보드"
          description="원문 DB 적재, evidence API 게이트, 사주 계산 중간값을 한 화면에서 확인합니다. 이 화면은 실제 데이터가 들어왔는지와, 해석 문장이 어떤 계산값에서 나왔는지를 추적하기 위한 내부 점검용입니다."
        />

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="검증 항목"
            title="필터를 바꾸면 같은 대시보드 안에서 다시 점검합니다"
            description="내부 운영 화면이지만 입력 필터와 상태 배지를 위에서 먼저 보여, 어떤 대상을 보고 있는지 한눈에 확인할 수 있게 정리했습니다."
            titleClassName="text-4xl"
            actions={
              <ActionCluster>
                <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                  slug · topic · concern · year · counselor
                </Badge>
              </ActionCluster>
            }
          />

          <form action="/verification" className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_0.9fr_0.9fr_0.8fr_0.8fr_auto]">
            <label className="grid gap-2 text-base text-[var(--app-copy)]">
              고전 개념
              <input
                name="concept"
                defaultValue={concept}
                className="rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-[var(--app-ivory)] outline-none focus:border-[var(--app-gold)]/45"
              />
            </label>
            <label className="grid gap-2 text-base text-[var(--app-copy)]">
              사주 slug 또는 reading id
              <input
                name="slug"
                defaultValue={slug}
                className="rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-[var(--app-ivory)] outline-none focus:border-[var(--app-gold)]/45"
              />
            </label>
            <label className="grid gap-2 text-base text-[var(--app-copy)]">
              topic
              <select
                name="topic"
                defaultValue={topic}
                className="rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-[var(--app-ivory)] outline-none focus:border-[var(--app-gold)]/45"
              >
                <option value="today">today</option>
                <option value="love">love</option>
                <option value="wealth">wealth</option>
                <option value="career">career</option>
                <option value="relationship">relationship</option>
              </select>
            </label>
            <label className="grid gap-2 text-base text-[var(--app-copy)]">
              concern
              <select
                name="concern"
                defaultValue={concern}
                className="rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-[var(--app-ivory)] outline-none focus:border-[var(--app-gold)]/45"
              >
                <option value="general">general</option>
                <option value="love_contact">love_contact</option>
                <option value="money_spend">money_spend</option>
                <option value="work_meeting">work_meeting</option>
                <option value="relationship_conflict">relationship_conflict</option>
                <option value="energy_health">energy_health</option>
              </select>
            </label>
            <label className="grid gap-2 text-base text-[var(--app-copy)]">
              연도
              <input
                name="targetYear"
                defaultValue={normalizedTargetYear}
                className="rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-[var(--app-ivory)] outline-none focus:border-[var(--app-gold)]/45"
              />
            </label>
            <label className="grid gap-2 text-base text-[var(--app-copy)]">
              counselor
              <select
                name="counselor"
                defaultValue={counselor}
                className="rounded-xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-[var(--app-ivory)] outline-none focus:border-[var(--app-gold)]/45"
              >
                <option value="female">female</option>
                <option value="male">male</option>
              </select>
            </label>
            <button
              type="submit"
              className="self-end rounded-xl border border-[var(--app-gold)]/35 bg-[var(--app-gold)]/14 px-5 py-3 text-base font-semibold text-[var(--app-gold-text)] transition-colors hover:bg-[var(--app-gold)]/20"
            >
              새로고침
            </button>
          </form>
        </SectionSurface>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="프로필 연동 지도"
            title="어떤 서비스가 내 기본정보를 실제로 쓰는지 한눈에 확인"
            titleClassName="text-4xl"
            actions={<JsonLink href={profileLinkageApiHref} />}
          />
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">linked</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {profileLinkageAudit.overview.linkedServiceCount}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">partial</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {profileLinkageAudit.overview.partialServiceCount}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">independent</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {profileLinkageAudit.overview.independentServiceCount}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">key checks</div>
              <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                {profileLinkageAudit.checks.filter((check) => check.ok).length}/{profileLinkageAudit.checks.length} 통과
              </div>
            </div>
          </div>

          <YearlyChecks checks={profileLinkageAudit.checks} />
          <ProfileLinkageRows services={profileLinkageAudit.services} />

          {profileLinkageAudit.warnings.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
              {profileLinkageAudit.warnings.join(' ')}
            </div>
          ) : null}
        </SectionSurface>

        <section className="app-panel p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">고전 원문 DB</div>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                3종 live 적재와 API 게이트
              </h2>
            </div>
            <JsonLink href={classicsApiHref} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">live works</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">{classicsAudit.overview.liveWorkCount}/3</div>
            </div>
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">passages</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {classicsAudit.overview.livePassageCount.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">concept tags</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {classicsAudit.overview.liveConceptTagCount.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">hold refs</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {classicsAudit.overview.holdReferenceCount}/{classicsAudit.expectedHoldRefs.length}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <div className="app-caption">latest ingest</div>
              <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                {formatMaybeDate(classicsAudit.overview.latestIngestRunAt)}
              </div>
            </div>
          </div>
          {classicsAudit.errors.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
              {classicsAudit.errors.join(' ')}
            </div>
          ) : null}
          <ClassicWorkRows works={classicsAudit.works} />
          <GateChecks checks={classicsAudit.gateChecks} />
        </section>

        <section className="app-panel p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">오늘운세 운영 검증</div>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                무료 결과 / 10전 심화 / safety / analytics 준비 상태
              </h2>
            </div>
            <JsonLink href={todayFortuneApiHref} />
          </div>

          {todayFortuneAudit.status === 'ready' ? (
            <>
              <div className="mt-5 grid gap-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">concern</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {todayFortuneAudit.concernLabel} · {todayFortuneAudit.concernHanja}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    {todayFortuneAudit.concernId}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">reading</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {todayFortuneAudit.readingSource}
                  </div>
                  <p className="mt-1 break-all text-sm text-[var(--app-copy-soft)]">
                    {todayFortuneAudit.readingId}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">free result</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    score {todayFortuneAudit.freeResultSummary.scoreCount}개
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    follow-up {todayFortuneAudit.freeResultSummary.followUpQuestions.length}개
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">premium result</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {todayFortuneAudit.premiumResultSummary.productCode}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    {todayFortuneAudit.premiumResultSummary.coinCost}전 · scenario {todayFortuneAudit.premiumResultSummary.scenarioCount}개
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">analytics</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {todayFortuneAudit.analytics.registeredEvents.length}개 등록
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    missing {todayFortuneAudit.analytics.missingEvents.length}개
                  </p>
                </div>
              </div>

              <YearlyChecks checks={todayFortuneAudit.checks} />

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">free result preview</div>
                  <div className="mt-3 text-base font-semibold text-[var(--app-ivory)]">
                    {todayFortuneAudit.freeResultSummary.headline}
                  </div>
                  <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">
                    {todayFortuneAudit.freeResultSummary.bodyPreview}
                  </p>
                  <div className="mt-3 text-sm text-[var(--app-copy-soft)]">
                    단서: {todayFortuneAudit.freeResultSummary.reasonSnippet}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">premium structure</div>
                  <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                    <div className="flex justify-between gap-3">
                      <span>favorable</span>
                      <span>{todayFortuneAudit.premiumResultSummary.favorableWindowCount}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>caution</span>
                      <span>{todayFortuneAudit.premiumResultSummary.cautionWindowCount}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>avoid / recommended</span>
                      <span>
                        {todayFortuneAudit.premiumResultSummary.avoidActionCount} / {todayFortuneAudit.premiumResultSummary.recommendedActionCount}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>evidence lines</span>
                      <span>{todayFortuneAudit.premiumResultSummary.evidenceLineCount}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-copy-soft)]">
                    {todayFortuneAudit.premiumResultSummary.safetyNote}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">analytics dimension</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {todayFortuneAudit.analytics.dimensions.map((dimension) => (
                      <Badge
                        key={dimension}
                        className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy)]"
                      >
                        {dimension}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-copy-soft)]">
                    free result → unlock → payment → follow-up dialogue까지 같은 세션 축으로 넘겨집니다.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4 lg:col-span-2">
                  <div className="app-caption">registered events</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {todayFortuneAudit.analytics.registeredEvents.map((eventName) => (
                      <Badge
                        key={eventName}
                        className="border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] text-[var(--app-copy)]"
                      >
                        {eventName}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">unknown time preview</div>
                  <div className="mt-3 text-base font-semibold text-[var(--app-ivory)]">
                    {todayFortuneAudit.unknownBirthTimePreview?.headline ?? '없음'}
                  </div>
                  <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">
                    {todayFortuneAudit.unknownBirthTimePreview?.reasonSnippet ?? 'unknownBirthTime 샘플 없음'}
                  </p>
                </div>
              </div>

              {todayFortuneAudit.warnings.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
                  {todayFortuneAudit.warnings.join(' ')}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
              {todayFortuneAudit.errors.join(' ')}
            </div>
          )}
        </section>

        <section className="app-panel p-6">
          <div className="app-caption">evidence sample</div>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
            “{classicsAudit.concept}” API가 반환한 실제 passage
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {classicsAudit.evidenceSamples.map((item) => (
              <EvidenceSample key={item.passageId} item={item} />
            ))}
          </div>
        </section>

        <section className="app-panel p-6">
          <div className="app-caption">public hold</div>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
            보류 대상이 화면 API에서 빠지는지 확인
          </h2>
          <HoldRows holds={classicsAudit.holds} />
        </section>

        <section className="app-panel p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">사주 계산 추적</div>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {sajuAudit.status === 'ready' ? `${sajuAudit.calculation.dayMaster.stem} 일간 계산 로그` : '계산 로그 없음'}
              </h2>
            </div>
            <JsonLink href={sajuApiHref} />
          </div>

          {sajuAudit.status === 'ready' ? (
            <>
              <div className="mt-5 grid gap-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">engine</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {sajuAudit.metadata.source}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">{sajuAudit.metadata.engineVersion}</p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">pillars</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {[
                      sajuAudit.calculation.pillars.year.ganzi,
                      sajuAudit.calculation.pillars.month.ganzi,
                      sajuAudit.calculation.pillars.day.ganzi,
                      sajuAudit.calculation.pillars.hour?.ganzi ?? '시주 없음',
                    ].join(' · ')}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">strength</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {sajuAudit.calculation.strength?.level ?? '없음'} · {sajuAudit.calculation.strength?.score ?? '-'}점
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">location</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {sajuAudit.calculation.birthTimeCorrection
                      ? `${sajuAudit.input.birthLocation?.label ?? '출생지'} ${sajuAudit.calculation.birthTimeCorrection.offsetMinutes}분`
                      : '보정 없음'}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">classic concept</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">{sajuAudit.conceptForClassics}</div>
                </div>
              </div>
              <SajuChecks checks={sajuAudit.checks} />
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">오행 점수</div>
                  <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                    {Object.entries(sajuAudit.calculation.fiveElements.byElement).map(([element, value]) => (
                      <div key={element} className="flex justify-between gap-3">
                        <span>{element}</span>
                        <span>{value.score}점 · {value.percentage}% · {value.state}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">격국 단서</div>
                  <div className="mt-3 text-base leading-7 text-[var(--app-copy)]">
                    <p>{sajuAudit.calculation.pattern?.rationale.join(' ') ?? '격국 단서 없음'}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">화면 문장</div>
                  <div className="mt-3 text-base leading-7 text-[var(--app-copy)]">
                    <p className="font-semibold text-[var(--app-ivory)]">{sajuAudit.report.headline}</p>
                    <p className="mt-3">{sajuAudit.report.summaryHighlights.join(' ')}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4 lg:col-span-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="app-caption">용신 계산표</div>
                      <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                        최종 {sajuAudit.calculation.yongsin?.primary.label ?? '없음'} · 신뢰도 {sajuAudit.calculation.yongsin?.confidence ?? '없음'}
                      </div>
                    </div>
                    <div className="text-sm leading-6 text-[var(--app-copy-soft)]">
                      조후/억부/오행보정 후보를 함께 비교합니다.
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-base">
                      <thead className="text-sm uppercase tracking-[0.16em] text-[var(--app-copy-soft)]">
                        <tr>
                          <th className="whitespace-nowrap py-2 pr-4">순위</th>
                          <th className="whitespace-nowrap py-2 pr-4">방식</th>
                          <th className="whitespace-nowrap py-2 pr-4">후보</th>
                          <th className="whitespace-nowrap py-2 pr-4">점수</th>
                          <th className="min-w-80 py-2">단서</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--app-line)] text-[var(--app-copy)]">
                        {(sajuAudit.calculation.yongsin?.candidates ?? []).map((candidate) => (
                          <tr key={`${candidate.method}-${candidate.primary.label}-${candidate.score}`}>
                            <td className="whitespace-nowrap py-3 pr-4">
                              {candidate.role === 'primary' ? '1순위' : candidate.role === 'support' ? '보조' : '참고'}
                            </td>
                            <td className="whitespace-nowrap py-3 pr-4">{candidate.method}</td>
                            <td className="whitespace-nowrap py-3 pr-4">
                              {candidate.primary.label}
                              {candidate.secondary.length > 0 ? ` / ${candidate.secondary.map((item) => item.label).join(' · ')}` : ''}
                            </td>
                            <td className="whitespace-nowrap py-3 pr-4">{candidate.score}</td>
                            <td className="py-3 leading-7">{candidate.rationale.join(' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 grid gap-3 text-base leading-7 text-[var(--app-copy)] lg:grid-cols-2">
                    <p>{sajuAudit.calculation.yongsin?.plainSummary ?? '용신 쉬운 풀이 없음'}</p>
                    <p>{sajuAudit.calculation.yongsin?.technicalSummary ?? '용신 세부 단서 없음'}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
              {sajuAudit.errors.join(' ')}
            </div>
          )}
        </section>

        <section className="app-panel p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">깊은 사주풀이 운영 검증</div>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                깊은 사주풀이 본문 / 올해 전략서 / 말투 분리 상태
              </h2>
            </div>
            <JsonLink href={lifetimeApiHref} />
          </div>

          {lifetimeAudit.status === 'ready' ? (
            <>
              <div className="mt-5 grid gap-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">source</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {lifetimeAudit.generation.source}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    {lifetimeAudit.generation.fallbackReason ?? 'fallback 없음'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">generation</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {lifetimeAudit.generation.generationMs}ms
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    {lifetimeAudit.generation.model ?? '모델 없음'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">target</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {lifetimeAudit.targetYear} · {lifetimeAudit.counselorId}
                  </div>
                  <p className="mt-1 break-all text-sm text-[var(--app-copy-soft)]">
                    readingId {lifetimeAudit.readingId}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">keywords</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {lifetimeAudit.interpretationSummary.keywordCount}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    remember rules {lifetimeAudit.interpretationSummary.rememberRuleCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">appendix</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {lifetimeAudit.interpretationSummary.yearlyAppendixYear}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">yearly appendix attached</p>
                </div>
              </div>

              <YearlyChecks checks={lifetimeAudit.checks} />

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">lifetime API</div>
                  <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                    <div className="flex justify-between gap-3">
                      <span>resolvedReadingId</span>
                      <span className="break-all text-right">{lifetimeAudit.resolvedReadingId}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>readingSource</span>
                      <span>{lifetimeAudit.readingSource}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>promptVersion</span>
                      <span>{lifetimeAudit.promptVersion}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">interpretation summary</div>
                  <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                    <div className="flex justify-between gap-3">
                      <span>reportLength</span>
                      <span>{lifetimeAudit.interpretationSummary.reportLength}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>appendix year</span>
                      <span>{lifetimeAudit.interpretationSummary.yearlyAppendixYear}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-base leading-7 text-[var(--app-copy-muted)]">
                    {lifetimeAudit.interpretationSummary.openingPreview}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">stage result</div>
                  <div className="mt-4 grid gap-3">
                    {lifetimeAudit.generation.stageResults.map((stage) => (
                      <div key={stage.key} className="rounded-2xl border border-[var(--app-line)] bg-[rgba(8,10,18,0.28)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-[var(--app-ivory)]">{stage.key}</div>
                          <StatusBadge ok={stage.source === 'openai'}>{stage.source}</StatusBadge>
                        </div>
                        <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                          <div>duration: {stage.durationMs}ms</div>
                          <div>fallback: {stage.fallbackReason ?? '없음'}</div>
                          <div className="break-words text-[var(--app-copy-soft)]">
                            {stage.errorMessage ?? '오류 없음'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {lifetimeAudit.warnings.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
                  {lifetimeAudit.warnings.join(' ')}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
              {lifetimeAudit.errors.join(' ')}
            </div>
          )}
        </section>

        <section className="app-panel p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">연간 리포트 운영 검증</div>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--app-ivory)]">
                {normalizedTargetYear} 신년 리포트 API / 캐시 / 생성 상태
              </h2>
            </div>
            <JsonLink href={yearlyApiHref} />
          </div>

          {yearlyAudit.status === 'ready' ? (
            <>
              <div className="mt-5 grid gap-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">source</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {yearlyAudit.generation.source}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    {yearlyAudit.generation.fallbackReason ?? 'fallback 없음'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">cache</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {yearlyAudit.cache.cached ? 'hit' : 'miss'}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    {yearlyAudit.cache.cacheKeyType} · {yearlyAudit.cache.cacheable ? 'server cache on' : 'server cache off'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">generation</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {yearlyAudit.generation.generationMs}ms
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    {yearlyAudit.generation.model ?? '모델 없음'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">target</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {yearlyAudit.targetYear} · {yearlyAudit.counselorId}
                  </div>
                  <p className="mt-1 break-all text-sm text-[var(--app-copy-soft)]">
                    readingId {yearlyAudit.readingId}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">schema</div>
                  <div className="mt-2 text-base font-semibold text-[var(--app-ivory)]">
                    {yearlyAudit.schema.latestMigration}
                  </div>
                  <p className="mt-1 text-sm text-[var(--app-copy-soft)]">
                    slug column {yearlyAudit.schema.readingSlugColumn ? 'yes' : 'no'}
                  </p>
                </div>
              </div>

              <YearlyChecks checks={yearlyAudit.checks} />

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">yearly API</div>
                  <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                    <div className="flex justify-between gap-3">
                      <span>resolvedReadingId</span>
                      <span className="break-all text-right">{yearlyAudit.resolvedReadingId}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>readingSource</span>
                      <span>{yearlyAudit.readingSource}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>promptVersion</span>
                      <span>{yearlyAudit.promptVersion}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>updatedAt</span>
                      <span>{formatMaybeDate(yearlyAudit.cache.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">cache detail</div>
                  <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">
                    {yearlyAudit.cache.cacheKeyDetail}
                  </p>
                  <div className="mt-3 text-sm text-[var(--app-copy-soft)]">
                    cache hit 여부, slug 지원 여부, migration 반영 상태를 함께 봅니다.
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                  <div className="app-caption">interpretation summary</div>
                  <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                    <div className="flex justify-between gap-3">
                      <span>keywords</span>
                      <span>{yearlyAudit.interpretationSummary.keywordCount}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>monthlyFlows</span>
                      <span>{yearlyAudit.interpretationSummary.monthlyCount}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>reportLength</span>
                      <span>{yearlyAudit.interpretationSummary.reportLength}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-base leading-7 text-[var(--app-copy-muted)]">
                    {yearlyAudit.interpretationSummary.openingPreview}
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4 lg:col-span-3">
                  <div className="app-caption">stage results</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {yearlyAudit.generation.stageResults.map((stage) => (
                      <div key={stage.key} className="rounded-2xl border border-[var(--app-line)] bg-[rgba(8,10,18,0.28)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-[var(--app-ivory)]">{stage.key}</div>
                          <StatusBadge ok={stage.source === 'openai'}>
                            {stage.source}
                          </StatusBadge>
                        </div>
                        <div className="mt-3 grid gap-2 text-base text-[var(--app-copy)]">
                          <div>duration: {stage.durationMs}ms</div>
                          <div>fallback: {stage.fallbackReason ?? '없음'}</div>
                          <div className="break-words text-[var(--app-copy-soft)]">
                            {stage.errorMessage ?? '오류 없음'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {yearlyAudit.warnings.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
                  {yearlyAudit.warnings.join(' ')}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-base text-amber-100">
              {yearlyAudit.errors.join(' ')}
            </div>
          )}
        </section>
      </AppPage>
    </AppShell>
  );
}
