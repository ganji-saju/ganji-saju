import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SafetyNotice } from "@/components/common/safety-notice";
import { TrackedLink } from "@/components/common/tracked-link";
import { SpecialistMentorGrid } from "@/components/counselor/specialist-mentor-grid";
import { ReportKeepsakeSection } from "@/components/report/report-keepsake-section";
import { ActionCluster } from "@/components/layout/action-cluster";
import { BulletList } from "@/components/layout/bullet-list";
import { FeatureCard } from "@/components/layout/feature-card";
import { ProductGrid } from "@/components/layout/product-grid";
import { SectionHeader } from "@/components/layout/section-header";
import { SectionSurface } from "@/components/layout/section-surface";
import SiteHeader from "@/features/shared-navigation/site-header";
import { AppPage, AppShell, PageHero } from "@/shared/layout/app-shell";
import {
  QUESTION_ENTRY_POINTS,
  REPORT_PREVIEW_VALUE_POINTS,
  TASTE_PRODUCTS,
} from "@/content/moonlight";
import {
  SAMPLE_REPORT_HERO,
  SAMPLE_REPORT_TEASERS,
  SAMPLE_SUBJECT,
  SAMPLE_SUMMARY,
} from "./sample-report.data";

export const metadata: Metadata = {
  title: "샘플 리포트",
  description:
    "달빛인생의 사주풀이가 어떤 결과 화면으로 이어지는지 결제 전에 먼저 확인해보세요.",
  alternates: {
    canonical: "/sample-report",
  },
};

export default function SampleReportPage() {
  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="sample"
              className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              {SAMPLE_REPORT_HERO.eyebrow}
            </Badge>,
            <Badge
              key="mock"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              가상 인물 예시
            </Badge>,
          ]}
          title={SAMPLE_REPORT_HERO.title}
          description={SAMPLE_REPORT_HERO.description}
        />

        <SectionSurface as="article" surface="panel">
            <SectionHeader
              eyebrow="샘플 대상"
              title={`${SAMPLE_SUBJECT.label} ${SAMPLE_SUBJECT.name}의 풀이 예시입니다`}
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description={
                <>
                  {SAMPLE_SUBJECT.birth} · {SAMPLE_SUBJECT.place}
                  <br />
                  {SAMPLE_SUBJECT.note}
                </>
              }
              descriptionClassName="text-[var(--app-copy)]"
              actions={
                <ActionCluster>
                  <TrackedLink
                    href="/saju/new"
                    eventName="sample_report_start_click"
                    eventParams={{ from: "sample_report_hero" }}
                    className="gangi-primary-button"
                  >
                    내 깊은 사주풀이 만들기
                  </TrackedLink>
                </ActionCluster>
              }
            />

            <ProductGrid columns={3} className="mt-6">
              {SAMPLE_REPORT_TEASERS.map((item) => (
                <FeatureCard
                  key={item.label}
                  surface="soft"
                  eyebrow={item.label}
                  description={item.body}
                />
              ))}
            </ProductGrid>
        </SectionSurface>

        <SectionSurface surface="panel">
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <SectionHeader
                eyebrow="결제 전 확인"
                title="샘플에서 바로 확인할 네 가지"
                titleClassName="text-3xl"
                description="결과 예시 한 장, 어떤 질문에 답하는지, 소장하면 무엇이 남는지, 대화 상담으로 어떻게 이어지는지를 먼저 보실 수 있습니다."
                descriptionClassName="text-[var(--app-copy)]"
              />
              <ActionCluster className="mt-6">
                <TrackedLink
                  href="/saju/new"
                  eventName="sample_report_start_click"
                  eventParams={{ from: "sample_report_preview_value" }}
                  className="gangi-primary-button"
                >
                  질문으로 시작하기
                </TrackedLink>
                <Link href="/membership" className="gangi-secondary-button">
                  상품 보기
                </Link>
              </ActionCluster>
            </div>
            <ProductGrid columns={2} className="gap-3">
              {REPORT_PREVIEW_VALUE_POINTS.map((item) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  title={item.title}
                  titleClassName="text-xl"
                  description={item.body}
                />
              ))}
            </ProductGrid>
          </div>
        </SectionSurface>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="어떤 질문에 답하나요"
            title="사용자는 상품명이 아니라, 자기 문제의 이름으로 들어옵니다"
            titleClassName="text-3xl"
          />
          <ProductGrid columns={3} className="mt-6">
            {QUESTION_ENTRY_POINTS.map((entry) => (
              <FeatureCard
                key={entry.slug}
                surface="soft"
                eyebrow={entry.label}
                title={entry.question}
                titleClassName="text-xl"
                description={entry.reportAnswer}
              />
            ))}
          </ProductGrid>
        </SectionSurface>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="1분 미리보기"
            title="리포트 첫 1분 안에 무엇을 확인하게 되는지 먼저 보여드립니다"
            titleClassName="text-3xl"
          />

          <ProductGrid columns={2} className="mt-6">
            <FeatureCard surface="soft" eyebrow="이 사주의 핵심 한 줄" description={SAMPLE_SUMMARY.oneLine} />
            <FeatureCard surface="soft" eyebrow="유리한 선택 방식" description={SAMPLE_SUMMARY.favorableChoice} />
            <FeatureCard
              surface="soft"
              eyebrow="올해 가장 강한 주제 3개"
              children={<BulletList items={SAMPLE_SUMMARY.strongTopics} />}
            />
            <FeatureCard
              surface="soft"
              eyebrow="조심해야 할 패턴 3개"
              children={<BulletList items={SAMPLE_SUMMARY.cautionPatterns} />}
            />
          </ProductGrid>
        </SectionSurface>

        <ReportKeepsakeSection />

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="맛보기에서 풀이까지"
            title="처음부터 큰 리포트가 부담스러우면 작은 풀이로 먼저 확인합니다"
            titleClassName="text-3xl"
          />
          <ProductGrid columns={4} className="mt-6">
            {TASTE_PRODUCTS.map((product) => (
              <FeatureCard
                key={product.slug}
                surface="soft"
                eyebrow={product.price}
                title={product.title}
                titleClassName="text-xl"
                description={product.result}
              />
            ))}
          </ProductGrid>
        </SectionSurface>

        <SectionSurface surface="hero">
          <SectionHeader
            eyebrow="다음 단계"
            title="샘플 구조가 마음에 드셨다면, 이제 선생님의 풀이를 직접 만들어보셔도 좋습니다"
            titleClassName="text-3xl"
            actions={
              <ActionCluster>
                <Link
                  href="/saju/new"
                  className="gangi-primary-button"
                >
                  내 깊은 사주풀이 만들기
                </Link>
                <Link
                  href="/membership"
                  className="gangi-secondary-button"
                >
                  상품 보기
                </Link>
              </ActionCluster>
            }
          />

          <div className="mt-6">
            <div className="rounded-[24px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5 sm:px-6 sm:py-6">
              <SpecialistMentorGrid
                showHeader={false}
                className="text-left"
              />
            </div>
          </div>
        </SectionSurface>

        <SafetyNotice className="mb-2" />
      </AppPage>
    </AppShell>
  );
}
