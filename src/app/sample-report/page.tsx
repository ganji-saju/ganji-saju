import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SafetyNotice } from "@/components/common/safety-notice";
import { TrackedLink } from "@/components/common/tracked-link";
import { SpecialistMentorGrid } from "@/components/counselor/specialist-mentor-grid";
import { DecisionTracePanel } from "@/components/report/decision-trace-panel";
import { ReportKeepsakeSection } from "@/components/report/report-keepsake-section";
import { ActionCluster } from "@/components/layout/action-cluster";
import { BulletList } from "@/components/layout/bullet-list";
import { EvidenceStrip } from "@/components/layout/evidence-strip";
import { FeatureCard } from "@/components/layout/feature-card";
import { ProductGrid } from "@/components/layout/product-grid";
import { SectionHeader } from "@/components/layout/section-header";
import { SectionSurface } from "@/components/layout/section-surface";
import { SupportRail } from "@/components/layout/support-rail";
import SiteHeader from "@/features/shared-navigation/site-header";
import { AppPage, AppShell, PageHero } from "@/shared/layout/app-shell";
import {
  QUESTION_ENTRY_POINTS,
  REPORT_PREVIEW_VALUE_POINTS,
  TASTE_PRODUCTS,
  TRUST_SIGNALS,
} from "@/content/moonlight";
import {
  SAMPLE_DECISION_TRACE,
  SAMPLE_PREVIEW_GUIDE,
  SAMPLE_REPORT_HERO,
  SAMPLE_REPORT_SCOPE,
  SAMPLE_REPORT_TEASERS,
  SAMPLE_SUBJECT,
  SAMPLE_SUMMARY,
  SAMPLE_TOC,
} from "./sample-report.data";

export const metadata: Metadata = {
  title: "샘플 리포트",
  description:
    "달빛인생의 프리미엄 명리 리포트가 어떤 깊이와 판단 단서로 이어지는지 결제 전에 먼저 확인해보세요.",
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

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <SectionSurface as="article" surface="panel">
            <div className="app-starfield" />
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
                  <TrackedLink
                    href="/about-engine"
                    eventName="sample_report_engine_click"
                    eventParams={{ from: "sample_report_hero" }}
                    className="gangi-secondary-button"
                  >
                    풀이 기준 보기
                  </TrackedLink>
                </ActionCluster>
              }
            />

            <p className="app-body-copy mt-6 max-w-3xl">
              이 미리보기는 계산 정확도 시연보다, 실제로 받게 될 결과물이 어느 정도 깊이와 밀도로
              남는지 먼저 보여드리는 브로셔형 예시입니다.
            </p>

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

          <SupportRail
            eyebrow="이 미리보기에서 먼저 보는 것"
            title="결과의 깊이를 먼저 짧게 훑어보실 수 있습니다"
            description="달빛인생 리포트는 한 줄 요약에서 끝나지 않고, 판단 단서와 소장 가치까지 함께 남깁니다."
          >
            <BulletList items={SAMPLE_PREVIEW_GUIDE} />
            <div className="mt-5 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-7 text-[var(--app-copy-soft)]">
              실제 리포트는 입력하신 출생 정보와 계산 기준에 따라 달라지며, 이 페이지는
              결과물의 깊이와 위계를 먼저 확인하실 수 있도록 준비한 미리보기입니다.
            </div>
          </SupportRail>
        </section>

        <SectionSurface surface="panel">
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <SectionHeader
                eyebrow="결제 전 확인"
                title="샘플에서는 긴 설명보다 네 가지를 먼저 확인합니다"
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
                  상품 기준 보기
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
            description="깊은 사주풀이라는 상위 브랜드는 유지하되, 샘플에서는 연애, 돈, 일, 가족, 올해 흐름처럼 실제 질문을 먼저 보여줍니다."
            descriptionClassName="text-[var(--app-copy)]"
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
            description="처음부터 긴 본문을 펼치기보다, 핵심 요약과 조심할 패턴, 유리한 선택 방식을 먼저 보게 되는 흐름입니다."
            descriptionClassName="text-[var(--app-copy)]"
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

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="풀이 구성"
            title="한 권의 풀이가 어떻게 펼쳐지는지, 14개 대섹션으로 압축해 보여드립니다"
            titleClassName="text-3xl"
            description="샘플 풀이는 한 줄 총평에서 시작해 원국, 운의 흐름, 실행 전략, 판단 단서까지 한 번의 해석으로 이어지도록 설계했습니다."
            descriptionClassName="text-[var(--app-copy)]"
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="space-y-4">
              <p className="app-body-copy">
                실제 결과 화면에서는 모든 항목을 한 번에 길게 밀어내기보다, 먼저 핵심을 짚고
                필요할 때 더 깊은 층으로 들어가도록 위계를 나눕니다.
              </p>
              <EvidenceStrip items={SAMPLE_REPORT_SCOPE} />
            </div>

            <ol className="grid gap-3 md:grid-cols-2">
              {SAMPLE_TOC.map((item, index) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy)]"
                >
                  <span className=" text-sm text-[var(--app-gold)]/75">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </SectionSurface>

        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <SectionSurface as="article" surface="panel">
            <SectionHeader
              eyebrow="판단 단서 미리보기"
              title="왜 이렇게 보았는지, 필요한 때만 펼쳐볼 수 있습니다"
              titleClassName="text-3xl"
              description="달빛인생은 중심 결론을 먼저 보여주고, 더 알고 싶을 때만 판단 단서를 따로 펼쳐볼 수 있게 남깁니다."
              descriptionClassName="text-[var(--app-copy)]"
            />
            <div className="mt-6">
              <DecisionTracePanel
                metadata={{
                  decisionTrace: SAMPLE_DECISION_TRACE,
                }}
                timeRule="표준시 기준"
                compact
              />
            </div>
          </SectionSurface>

          <SectionSurface as="article" surface="panel">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="고전과 생활 언어"
              title="원전 인용과 현대 해석은 같은 층으로 섞지 않습니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="한자와 고전 원문은 맥락을 보여주는 층으로, 생활 언어 해석은 실행에 옮기기 위한 층으로 나누어 제시합니다."
              descriptionClassName="text-[var(--app-copy)]"
            />
            <blockquote className="mt-5 rounded-[20px] border border-[var(--app-gold)]/16 bg-[var(--app-gold)]/8 px-5 py-5 text-base leading-8 text-[var(--app-gold-text)]">
              用神은 부족한 오행을 기계적으로 채우는 표기가 아니라, 격국과 계절, 강약의
              균형을 함께 보고 판단하는 보완 축입니다.
            </blockquote>
            <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
              실제 리포트에서는 <span className="">甲木 · 用神 · 格局</span> 같은
              표기를 별도 역할로 보여주고, 고전 원문은 해석문과 섞지 않고 분리해 제시합니다.
            </p>
          </SectionSurface>
        </section>

        <ReportKeepsakeSection />

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="맛보기에서 풀이까지"
            title="처음부터 큰 리포트가 부담스러우면 작은 풀이로 먼저 확인합니다"
            titleClassName="text-3xl"
            description="오늘운 상세, 월간 달력, 연애 질문, 올해 핵심 3줄은 풀이 전 단계의 부담 없는 체험 상품으로 배치합니다."
            descriptionClassName="text-[var(--app-copy)]"
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

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="달빛인생의 신뢰 장치"
            title="보관, 판단 단서, 안전한 표현을 결과물 안에 남깁니다"
            titleClassName="text-3xl"
            description="공포성 단정이나 과장된 적중률 대신, 사용자가 다시 확인할 수 있는 기준을 리포트 안에 남기는 방식입니다."
            descriptionClassName="text-[var(--app-copy)]"
          />
          <ProductGrid columns={3} className="mt-6">
            {TRUST_SIGNALS.map((signal) => (
              <FeatureCard
                key={signal.title}
                surface="soft"
                title={signal.title}
                titleClassName="text-xl"
                description={signal.body}
              />
            ))}
          </ProductGrid>
        </SectionSurface>

        <SectionSurface surface="hero">
          <SectionHeader
            eyebrow="다음 단계"
            title="샘플 구조가 마음에 드셨다면, 이제 선생님의 풀이를 직접 만들어보셔도 좋습니다"
            titleClassName="text-3xl"
            description="실제 결과는 입력하신 출생 정보, 시간 기준, 판단 단서에 따라 개별적으로 계산됩니다. 어떤 질문을 먼저 풀고 싶은지에 따라 전문 선생과 리포트의 방향도 함께 고르실 수 있습니다."
            descriptionClassName="text-[var(--app-copy)]"
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
                  프리미엄 기준 보기
                </Link>
              </ActionCluster>
            }
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <EvidenceStrip
              items={[
                {
                  title: "개별 계산",
                  body: "실제 리포트는 출생 정보와 시간 기준에 따라 새로 계산되며, 이 샘플 문구를 그대로 복사하지 않습니다.",
                },
                {
                  title: "전환 전 확인",
                  body: "샘플 리포트와 멤버십 기준을 먼저 확인한 뒤, 필요한 경우 대화형 상담으로 이어볼 수 있습니다.",
                },
              ]}
            />

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
