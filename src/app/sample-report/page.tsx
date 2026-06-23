// Redesign 2026-05-17 — PageHero / SectionSurface / SectionHeader / FeatureCard / ProductGrid /
// ActionCluster / BulletList layout component → inline + design token + Tailwind utility (PR #193
// credits/success CenteredCard + PR #198 saju/today-detail + PR #206 zodiac 와 동일 방향).
// 비즈니스 데이터 (SAMPLE_REPORT_HERO / SAMPLE_REPORT_TEASERS / SAMPLE_SUBJECT / SAMPLE_SUMMARY /
// QUESTION_ENTRY_POINTS / REPORT_PREVIEW_VALUE_POINTS / TASTE_PRODUCTS) 무수정 — UI 만 교체.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SafetyNotice } from '@/components/common/safety-notice';
import { TrackedLink } from '@/components/common/tracked-link';
import { SpecialistMentorGrid } from '@/components/counselor/specialist-mentor-grid';
import { ReportKeepsakeSection } from '@/components/report/report-keepsake-section';
import { ReviewList } from '@/components/review/review-list';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import {
  QUESTION_ENTRY_POINTS,
  REPORT_PREVIEW_VALUE_POINTS,
  TASTE_PRODUCTS,
} from '@/content/moonlight';
import {
  SAMPLE_REPORT_HERO,
  SAMPLE_REPORT_TEASERS,
  SAMPLE_SUBJECT,
  SAMPLE_SUMMARY,
} from './sample-report.data';

export const metadata: Metadata = {
  title: '샘플 리포트',
  description:
    '간지사주의 사주풀이가 어떤 결과 화면으로 이어지는지 결제 전에 먼저 확인해보세요.',
  alternates: {
    canonical: '/sample-report',
  },
};

// 공통 inline style — white panel card.
const PANEL_STYLE = {
  border: '1px solid rgba(17, 17, 20, 0.08)',
  borderRadius: '1.25rem',
  background: '#ffffff',
  padding: '1.4rem 1.15rem',
  boxShadow: '0 16px 38px -28px rgba(17, 17, 20, 0.32)',
} as const;

const KICKER_STYLE = {
  color: 'var(--app-pink-strong)',
  fontSize: '0.76rem',
  fontWeight: 760,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
} as const;

const SOFT_FEATURE_STYLE = {
  border: '1px solid var(--app-pink-line)',
  borderRadius: '0.95rem',
  background: 'var(--app-pink-soft)',
  padding: '0.95rem',
} as const;

const PRIMARY_BUTTON_STYLE = {
  background: 'var(--app-pink)',
  color: '#ffffff',
  boxShadow: '0 12px 28px rgba(216, 27, 114, 0.32)',
} as const;

const SECONDARY_BUTTON_STYLE = {
  border: '1px solid var(--app-line)',
  background: '#ffffff',
  color: 'var(--app-ink)',
  boxShadow: '0 12px 28px -24px rgba(17, 17, 20, 0.32)',
} as const;

export default function SampleReportPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5 sm:space-y-6">
        <GangiPageHeader title="샘플 리포트" backHref="/free" />

        {/* §Hero — gold badge + sample badge + title + description */}
        <section className="px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[12.6px] font-extrabold"
              style={{
                border: '1px solid var(--app-pink-line)',
                background: 'var(--app-pink-soft)',
                color: 'var(--app-pink-strong)',
              }}
            >
              {SAMPLE_REPORT_HERO.eyebrow}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[12.6px] font-bold"
              style={{
                border: '1px solid var(--app-line)',
                background: '#ffffff',
                color: 'var(--app-copy-muted)',
              }}
            >
              가상 인물 예시
            </span>
          </div>
          <h1
            className="mt-3 text-[27.6px] font-extrabold leading-tight tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            {SAMPLE_REPORT_HERO.title}
          </h1>
          <p
            className="mt-2 text-[16.1px] leading-[1.7]"
            style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
          >
            {SAMPLE_REPORT_HERO.description}
          </p>
        </section>

        {/* §Sample subject — 샘플 대상 카드 + teasers grid */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>샘플 대상</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            {SAMPLE_SUBJECT.label} {SAMPLE_SUBJECT.name}의 풀이 예시입니다
          </h2>
          <p
            className="mt-2 text-[15px] leading-[1.7]"
            style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
          >
            {SAMPLE_SUBJECT.birth} · {SAMPLE_SUBJECT.place}
            <br />
            {SAMPLE_SUBJECT.note}
          </p>
          <TrackedLink
            href="/saju/new"
            eventName="sample_report_start_click"
            eventParams={{ from: 'sample_report_hero' }}
            className="mt-4 inline-flex h-12 items-center justify-center rounded-full px-5 text-[15.5px] font-extrabold"
            style={PRIMARY_BUTTON_STYLE}
          >
            내 깊은 사주풀이 만들기
          </TrackedLink>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {SAMPLE_REPORT_TEASERS.map((item) => (
              <div key={item.label} style={SOFT_FEATURE_STYLE}>
                <div
                  className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  {item.label}
                </div>
                <p
                  className="mt-1.5 text-[14.4px] leading-[1.65]"
                  style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </article>

        {/* §결제 전 확인 — 좌측 안내 + 우측 grid */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <div style={KICKER_STYLE}>결제 전 확인</div>
              <h2
                className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
                style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
              >
                샘플에서 바로 확인할 네 가지
              </h2>
              <p
                className="mt-2 text-[15px] leading-[1.7]"
                style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
              >
                결과 예시 한 장, 어떤 질문에 답하는지, 소장하면 무엇이 남는지, 대화 상담으로
                어떻게 이어지는지를 먼저 보실 수 있습니다.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <TrackedLink
                  href="/saju/new"
                  eventName="sample_report_start_click"
                  eventParams={{ from: 'sample_report_preview_value' }}
                  className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[15.5px] font-extrabold"
                  style={PRIMARY_BUTTON_STYLE}
                >
                  질문으로 시작하기
                </TrackedLink>
                <Link
                  href="/membership"
                  className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[15.5px] font-extrabold"
                  style={SECONDARY_BUTTON_STYLE}
                >
                  상품 보기
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {REPORT_PREVIEW_VALUE_POINTS.map((item) => (
                <div key={item.title} style={SOFT_FEATURE_STYLE}>
                  <h3
                    className="text-[17.3px] font-extrabold leading-snug tracking-tight"
                    style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="mt-1.5 text-[14.4px] leading-[1.65]"
                    style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                  >
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* §어떤 질문에 답하나요 */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>어떤 질문에 답하나요</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            사용자는 상품명이 아니라, 자기 문제의 이름으로 들어옵니다
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {QUESTION_ENTRY_POINTS.map((entry) => (
              <div key={entry.slug} style={SOFT_FEATURE_STYLE}>
                <div
                  className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  {entry.label}
                </div>
                <h3
                  className="mt-1 text-[16.1px] font-extrabold leading-snug tracking-tight"
                  style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                >
                  {entry.question}
                </h3>
                <p
                  className="mt-1.5 text-[14.4px] leading-[1.65]"
                  style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                >
                  {entry.reportAnswer}
                </p>
              </div>
            ))}
          </div>
        </article>

        {/* §1분 미리보기 */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>1분 미리보기</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            리포트 첫 1분 안에 무엇을 확인하게 되는지 먼저 보여드립니다
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div style={SOFT_FEATURE_STYLE}>
              <div
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                이 사주의 핵심 한 줄
              </div>
              <p
                className="mt-1.5 text-[14.4px] leading-[1.65]"
                style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
              >
                {SAMPLE_SUMMARY.oneLine}
              </p>
            </div>
            <div style={SOFT_FEATURE_STYLE}>
              <div
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                유리한 선택 방식
              </div>
              <p
                className="mt-1.5 text-[14.4px] leading-[1.65]"
                style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
              >
                {SAMPLE_SUMMARY.favorableChoice}
              </p>
            </div>
            <div style={SOFT_FEATURE_STYLE}>
              <div
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                올해 가장 강한 주제 3개
              </div>
              <ul className="mt-2 grid gap-1.5">
                {SAMPLE_SUMMARY.strongTopics.map((topic) => (
                  <li
                    key={topic}
                    className="relative pl-3 text-[14.4px] leading-[1.65]"
                    style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-[0.72em] block rounded-full"
                      style={{
                        width: '0.28rem',
                        height: '0.28rem',
                        background: 'var(--app-pink)',
                      }}
                    />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
            <div style={SOFT_FEATURE_STYLE}>
              <div
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                조심해야 할 패턴 3개
              </div>
              <ul className="mt-2 grid gap-1.5">
                {SAMPLE_SUMMARY.cautionPatterns.map((pattern) => (
                  <li
                    key={pattern}
                    className="relative pl-3 text-[14.4px] leading-[1.65]"
                    style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-[0.72em] block rounded-full"
                      style={{
                        width: '0.28rem',
                        height: '0.28rem',
                        background: 'var(--app-coral)',
                      }}
                    />
                    {pattern}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <ReportKeepsakeSection />

        {/* §구매자 후기 — Phase 7b. 승인된 lifetime-report 후기만 노출, 0건이면 empty state. */}
        <ReviewList
          productId="lifetime-report"
          title="실제 구매자의 후기"
          emptyTitle="첫 후기를 받고 있어요"
          emptyDescription="구매하신 분들의 솔직한 이야기를 받고 있어요. 첫 후기가 등록되면 이 자리에 표시됩니다."
        />

        {/* §맛보기에서 풀이까지 */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>맛보기에서 풀이까지</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            처음부터 큰 리포트가 부담스러우면 작은 풀이로 먼저 확인합니다
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TASTE_PRODUCTS.filter((product) => !product.compatibilityOnly).map((product) => (
              <div key={product.slug} style={SOFT_FEATURE_STYLE}>
                <div
                  className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  {product.price}
                </div>
                <h3
                  className="mt-1 text-[16.1px] font-extrabold leading-snug tracking-tight"
                  style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                >
                  {product.title}
                </h3>
                <p
                  className="mt-1.5 text-[14.4px] leading-[1.65]"
                  style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                >
                  {product.result}
                </p>
              </div>
            ))}
          </div>
        </article>

        {/* §리포트 제작 원칙 — Phase 7a. AI 사용/사람 검수/생성 시간/분량 정직 고지. */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>리포트 제작 원칙</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            결제 전에 알아두실 점을 정직하게 안내드립니다
          </h2>
          <p
            className="mt-2 text-[14.4px] leading-[1.65]"
            style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
          >
            과장 없이 실제 제공되는 형태를 그대로 표시합니다.
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div style={SOFT_FEATURE_STYLE}>
              <dt
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                생성 소요 시간
              </dt>
              <dd
                className="mt-1.5 text-[15px] font-extrabold leading-snug"
                style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
              >
                결제 후 약 1~2분 내 자동 생성
              </dd>
              <p
                className="mt-1.5 text-[13.8px] leading-[1.6]"
                style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
              >
                트래픽 상황에 따라 다소 지연될 수 있으며, 화면을 닫아도 마이페이지 보관함에서 다시 확인하실 수 있습니다.
              </p>
            </div>
            <div style={SOFT_FEATURE_STYLE}>
              <dt
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                본문 분량
              </dt>
              <dd
                className="mt-1.5 text-[15px] font-extrabold leading-snug"
                style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
              >
                14개 섹션 / 평균 A4 5~7페이지
              </dd>
              <p
                className="mt-1.5 text-[13.8px] leading-[1.6]"
                style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
              >
                목차 14개 섹션을 모두 채운 보관용 리포트로, 사주에 따라 페이지 수가 일부 변동될 수 있습니다.
              </p>
            </div>
            <div style={SOFT_FEATURE_STYLE}>
              <dt
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                AI 사용 여부
              </dt>
              <dd
                className="mt-1.5 text-[15px] font-extrabold leading-snug"
                style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
              >
                사주 데이터 기반 AI 모델이 본문 작성
              </dd>
              <p
                className="mt-1.5 text-[13.8px] leading-[1.6]"
                style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
              >
                계산된 사주 구조와 고전 규칙을 입력으로, 대규모 언어 모델이 본문을 생성합니다. 모델·프롬프트는 시기에 따라 갱신될 수 있습니다.
              </p>
            </div>
            <div style={SOFT_FEATURE_STYLE}>
              <dt
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                사람 검수 여부
              </dt>
              <dd
                className="mt-1.5 text-[15px] font-extrabold leading-snug"
                style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
              >
                현재 별도 사람 검수 단계 없음
              </dd>
              <p
                className="mt-1.5 text-[13.8px] leading-[1.6]"
                style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
              >
                자동 생성된 본문이 곧바로 제공됩니다. 부적절한 문구·왜곡된 해석은 고객센터로 신고 주시면 빠르게 조치합니다.
              </p>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href="/refund-policy"
              className="inline-flex h-10 items-center justify-center rounded-full px-4 text-[14.4px] font-extrabold"
              style={SECONDARY_BUTTON_STYLE}
            >
              환불 정책 자세히
            </Link>
            <Link
              href="/support/faq"
              className="inline-flex h-10 items-center justify-center rounded-full px-4 text-[14.4px] font-extrabold"
              style={SECONDARY_BUTTON_STYLE}
            >
              자주 묻는 질문
            </Link>
          </div>
        </article>

        {/* §다음 단계 — ink-dark hero (PR #198 패턴 같은 진한 결제 유도 카드) */}
        <article
          className="mx-[0.25rem] text-white"
          style={{
            borderRadius: '1.25rem',
            background: 'var(--app-ink)',
            padding: '1.5rem 1.2rem',
            boxShadow: '0 18px 44px rgba(15, 23, 42, 0.18)',
          }}
        >
          <div
            className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
            style={{ color: 'var(--app-pink)' }}
          >
            다음 단계
          </div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ wordBreak: 'keep-all' }}
          >
            샘플 구조가 마음에 드셨다면, 이제 선생님의 풀이를 직접 만들어보셔도 좋습니다
          </h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href="/saju/new"
              className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[15.5px] font-extrabold"
              style={PRIMARY_BUTTON_STYLE}
            >
              내 깊은 사주풀이 만들기
            </Link>
            <Link
              href="/membership"
              className="inline-flex h-12 items-center justify-center rounded-full bg-white/10 px-5 text-[15.5px] font-extrabold text-white backdrop-blur"
              style={{ border: '1px solid rgba(255, 255, 255, 0.18)' }}
            >
              상품 보기
            </Link>
          </div>

          <div
            className="mt-5 rounded-[18px] px-4 py-4 sm:px-5"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.04)',
            }}
          >
            <SpecialistMentorGrid showHeader={false} className="text-left" />
          </div>
        </article>

        <SafetyNotice className="mb-2" />
      </AppPage>
    </AppShell>
  );
}
