import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { EvidenceStrip } from '@/components/layout/evidence-strip';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ENGINE_METHOD_ENTRIES } from '@/lib/engine-method-pages';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '달빛인생 풀이 기준 | AI 사주 기준',
  description:
    '달빛인생이 사주풀이를 어떻게 더 안정적으로 보여주는지, 진태양시·격국·용신·대운 기준을 쉽게 정리한 안내입니다.',
  keywords: [
    'AI 사주',
    '사주 계산 기준',
    '진태양시 사주',
    '격국 해석',
    '용신 계산',
    '대운 세운',
    '달빛인생 풀이 기준',
  ],
  alternates: { canonical: '/about-engine' },
  openGraph: {
    title: '달빛인생 풀이 기준',
    description:
      '명식 계산을 먼저 고정하고, AI는 계산된 구조를 설명하는 역할만 한다는 달빛인생의 기준을 정리했습니다.',
    url: 'https://ganji-saju.vercel.app/about-engine',
    siteName: '달빛인생',
    locale: 'ko_KR',
    type: 'article',
  },
};

const ENGINE_BADGES = [
  'AI 사주 계산 기준',
  '진태양시 · 절기 · 자시 규칙',
  '격국 · 용신 · 대운 해석',
  '판단 단서 · 음양력 대조 · 재열람',
] as const;

const PAGE_SECTIONS = [
  { href: '#why-not-just-ai', label: '왜 AI만으로 보지 않나' },
  { href: '#time-precision', label: '출생시각·출생지 정밀도' },
  { href: '#decision-trace', label: '왜 그렇게 보았나' },
  { href: '#report-ux', label: '리포트에서 무엇이 보이나' },
  { href: '#metadata', label: '저장과 재확인' },
  { href: '#faq', label: '자주 묻는 질문' },
] as const;

const ENGINE_PRINCIPLES = [
  {
    title: '명식 계산을 먼저 고정합니다',
    body:
      '달빛인생은 출생 정보로 명식과 운의 구조를 먼저 계산합니다. 격국, 용신, 대운처럼 결과를 크게 바꾸는 항목은 AI가 대화 중에 새로 추측하지 않도록 분리합니다.',
  },
  {
    title: 'AI는 설명 레이어로만 사용합니다',
    body:
      '선생의 말투는 이미 계산된 구조를 이해하기 쉬운 문장으로 풀어내는 역할만 합니다. 그래서 여선생과 남선생은 표현의 결만 다르고, 계산 기준은 같습니다.',
  },
  {
    title: '판단 단서는 필요할 때 확인할 수 있어야 합니다',
    body:
      '좋은 사주 리포트는 길이보다 납득이 중요합니다. 달빛인생은 강약, 격국 후보, 용신 후보, 공식 음양력 대조, 참고 해석 여부를 필요한 때 확인할 수 있게 둡니다.',
  },
] as const;

const COMPARISON_ROWS = [
  [
    '명식 계산',
    '대화 문맥만으로 간지나 오행을 추측할 수 있습니다.',
    '출생 정보로 먼저 명식과 운의 구조를 계산합니다.',
  ],
  [
    '격국·용신',
    '프롬프트 길이와 모델 스타일에 따라 설명이 흔들릴 수 있습니다.',
    '월령, 투출, 강약, 계절성을 같이 보고 풀이 기준을 흔들리지 않게 잡습니다.',
  ],
  [
    '시간 처리',
    '입력된 시각을 그대로 소비하는 경우가 많습니다.',
    '출생지, 진태양시, 야자시, 조자시를 분리해 적용합니다.',
  ],
  [
    '풀이 단서',
    '긴 문장은 많아도 왜 그렇게 읽었는지 숨겨질 수 있습니다.',
    '판단 단서, 공식 음양력 대조, 참고 해석 여부를 함께 보여줍니다.',
  ],
] as const;

const TIME_RULES = [
  {
    label: '표준시',
    body: '기본적인 출생 시각 기준입니다. 출생지 보정이 필요하지 않을 때 가장 먼저 씁니다.',
  },
  {
    label: '진태양시',
    body: '출생지 경도를 반영해 분 단위 시간을 보정합니다. 절기와 시주 경계가 가까운 경우 더 정밀한 기준이 됩니다.',
  },
  {
    label: '야자시 / 조자시',
    body: '자시를 어느 날에 붙여 읽을지에 대한 규칙입니다. 경계 시간에 따라 일주나 시주 해석이 달라질 수 있어 선택 기준을 분리해 둡니다.',
  },
] as const;

const DECISION_STEPS = [
  '양력/음력 변환과 절기 기준 확인',
  '출생지와 시간 규칙에 따른 시각 보정',
  '월령, 투출, 강약 순서로 격국 후보 검토',
  '격국·강약·계절성을 묶어 보완 기운 확인',
  '대운·세운·월운을 현재 질문과 연결',
  '논쟁적 해석은 참고 단계로 낮춰 표시',
] as const;

const REPORT_VISIBLE_ITEMS = [
  '강약과 판단 단서',
  '격국 후보와 최종 격국',
  '용신 / 희신 / 기신',
  '대운 · 세운 · 월운 연결',
  '공식 음양력 대조 여부',
  '참고 해석 / 논쟁적 해석 표시',
] as const;

const SAFETY_RULES = [
  '의료, 법률, 투자, 위기 판단은 사주 해석과 분리합니다.',
  '길흉을 공포스럽게 단정하지 않습니다.',
  '출생시각이 불명확하면 시주 판단을 줄이고 일간·월령·현재 운 중심으로 읽습니다.',
  '대화 중에도 격국·용신을 새로 추측하지 않고 계산된 결과를 설명합니다.',
  '의심이 남는 구간은 “참고 해석”으로 낮춰 보여줍니다.',
] as const;

const FAQS = [
  {
    question: 'AI가 직접 사주를 계산하지 않는다는 뜻은 무엇인가요?',
    answer:
      '달빛인생은 출생 정보에서 명식, 강약, 격국, 용신, 대운·세운을 먼저 계산한 뒤 AI가 그 결과를 설명합니다. 대화 중에 AI가 격국이나 용신을 새로 추측하지 않도록 역할을 분리합니다.',
  },
  {
    question: '왜 분 단위 출생시각과 출생지를 같이 묻나요?',
    answer:
      '사주는 시주와 절기 경계에서 몇 분 차이로도 해석의 중심이 달라질 수 있습니다. 특히 자시 경계나 진태양시 보정이 필요한 경우 출생지 경도까지 알아야 해석이 더 안정됩니다.',
  },
  {
    question: '여선생과 남선생은 왜 해석이 비슷한가요?',
    answer:
      '두 선생은 같은 계산 결과를 보고 말투만 다르게 설명합니다. 표현의 결은 달라도 격국, 용신, 현재 운의 뼈대는 같아야 신뢰가 유지된다고 보기 때문입니다.',
  },
  {
    question: '리포트의 긴 글이 실제 명식과 연결되어 있는지 어떻게 확인하나요?',
    answer:
      '리포트 안에는 강약, 격국 후보, 용신 후보, 공식 음양력 대조, 참고 해석 여부가 함께 보입니다. 결론을 먼저 보고, 더 궁금할 때 판단 단서를 펼쳐볼 수 있습니다.',
  },
  {
    question: '사주 리포트만으로 투자나 의료 판단을 해도 되나요?',
    answer:
      '아니요. 달빛인생은 의료, 법률, 투자, 위기 상황을 사주 해석과 분리합니다. 사주는 참고용 구조 해석으로만 사용하고, 고위험 판단은 별도 전문 기준을 따라야 합니다.',
  },
] as const;

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function AboutEnginePage() {
  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        <PageHero
          badges={ENGINE_BADGES.map((item) => (
            <Badge
              key={item}
              className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              {item}
            </Badge>
          ))}
          title="달빛인생은 어떻게 사주를 계산하나요?"
          description="달빛인생은 명식과 운의 구조를 먼저 계산하고, AI는 그 결과를 이해하기 쉬운 문장으로 풀어주는 서비스입니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <SectionSurface surface="lunar">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="풀이 기준 요약"
              title="이 문서는 결과가 왜 달라질 수 있는지만 쉽게 정리합니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="명식 계산, 시간 보정, 격국·용신 판단, 다시 열람할 때의 기준을 사용자가 이해할 수 있는 말로 정리한 페이지입니다."
              descriptionClassName="text-[var(--app-copy)]"
            />

            <ProductGrid columns={3} className="mt-6">
              {ENGINE_PRINCIPLES.map((item) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  eyebrow="제품 원칙"
                  title={item.title}
                  titleClassName="text-2xl"
                  description={item.body}
                />
              ))}
            </ProductGrid>
          </SectionSurface>

          <SupportRail
            surface="muted"
            eyebrow="궁금한 항목"
            title="필요한 항목만 골라 확인하시면 됩니다"
            description="사주풀이 화면에서는 결과를 먼저 보고, 이 페이지는 출생 시간이나 음양력 기준이 궁금할 때만 확인하시면 됩니다."
          >
            <nav className="app-reading-nav">
              <div className="app-caption mb-3">섹션 이동</div>
              <div className="app-reading-nav-list">
                {PAGE_SECTIONS.map((item) => (
                  <Link key={item.href} href={item.href} className="app-reading-nav-link">
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>

            <ActionCluster>
              <Link
                href="/saju/new"
                className="moon-action-primary"
              >
                사주 시작하기
              </Link>
              <Link
                href="/sample-report"
                className="moon-action-muted"
              >
                샘플 리포트 보기
              </Link>
            </ActionCluster>

            <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-7 text-[var(--app-copy-soft)]">
              이 안내는 홈, 입력 화면, 결과 화면, 대화, 멤버십에서 같은 기준으로 이어집니다.
            </div>
          </SupportRail>
        </section>

        <div className="app-reading-layout">
          <div className="app-reading-stack">
            <SectionSurface id="why-not-just-ai" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="왜 AI만으로 보지 않나"
                title="일반 AI 사주와 달빛인생의 차이는 말투보다 풀이 기준에 있습니다"
                titleClassName="text-3xl"
                description="일반적인 대화형 AI는 설명을 잘 쓰지만, 명식 계산과 격국·용신 해석은 입력 방식과 프롬프트 길이에 따라 흔들릴 수 있습니다. 달빛인생은 계산과 설명을 분리해, 흔들리기 쉬운 부분을 먼저 고정합니다."
                descriptionClassName="app-reading-prose text-[var(--app-copy)]"
              />

              <div className="mt-6 overflow-hidden rounded-[20px] border border-[var(--app-line)]">
                <div className="grid grid-cols-[0.92fr_1fr_1fr] border-b border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] text-xs text-[var(--app-copy-soft)]">
                  <div className="px-4 py-3">구분</div>
                  <div className="px-4 py-3">일반 AI 해석</div>
                  <div className="px-4 py-3">달빛인생</div>
                </div>
                {COMPARISON_ROWS.map(([label, left, right]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[0.92fr_1fr_1fr] border-b border-[var(--app-line)] last:border-b-0"
                  >
                    <div className="px-4 py-4 text-sm font-semibold text-[var(--app-ivory)]">{label}</div>
                    <div className="px-4 py-4 text-sm leading-7 text-[var(--app-copy)]">{left}</div>
                    <div className="px-4 py-4 text-sm leading-7 text-[var(--app-copy)]">{right}</div>
                  </div>
                ))}
              </div>
            </SectionSurface>

            <SectionSurface id="time-precision" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="출생시각·출생지 정밀도"
                title="출생시각과 출생지는 왜 끝까지 묻는가"
                titleClassName="text-3xl"
                description="사주는 시주와 절기 경계에서 몇 분 차이로도 해석의 중심이 달라질 수 있습니다. 그래서 시간이 정확한 경우 분 단위 출생시각과 출생지를 함께 보고, 시간이 불확실할 때는 시주 해석을 줄여 안전한 기준으로 읽습니다."
                descriptionClassName="app-reading-prose text-[var(--app-copy)]"
              />

              <ProductGrid columns={3} className="mt-6">
                {TIME_RULES.map((item) => (
                  <FeatureCard
                    key={item.label}
                    surface="soft"
                    eyebrow={item.label}
                    description={item.body}
                  />
                ))}
              </ProductGrid>

              <EvidenceStrip
                className="mt-6"
                items={[
                  {
                    title: '정밀도 메시지',
                    body: '자시 경계나 절기 직전처럼 경계 구간에서는 분 단위 입력이 실제로 중요합니다.',
                  },
                  {
                    title: '안전한 읽기',
                    body: '시간이 불확실하면 시주 판단을 줄이고 일간·월령·현재 운 중심으로 더 보수적으로 읽습니다.',
                  },
                ]}
              />
            </SectionSurface>

            <SectionSurface id="decision-trace" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="판단 단서"
                title="왜 그렇게 보았는지 필요할 때만 펼쳐봅니다"
                titleClassName="text-3xl"
                description="달빛인생의 깊은 사주풀이는 결론을 먼저 보여주고, 더 알고 싶은 분만 판단 단서를 펼쳐볼 수 있게 구성합니다."
                descriptionClassName="app-reading-prose text-[var(--app-copy)]"
              />

              <div className="mt-6 app-reading-stack">
                {DECISION_STEPS.map((item, index) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(7,9,16,0.28)] px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-hanja mt-0.5 text-sm text-[var(--app-gold)]/60">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="text-sm leading-7 text-[var(--app-copy)]">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionSurface>

            <SectionSurface id="report-ux" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="리포트에서 무엇이 보이나"
                title="긴 설명보다 먼저, 내게 필요한 답이 보여야 합니다"
                titleClassName="text-3xl"
                description="실제 결과 화면에서는 핵심 요약, 분야별 조언, 현재 운 연결을 먼저 보고, 강약·격국·용신·공식 음양력 대조는 필요할 때 확인하도록 구성합니다."
                descriptionClassName="app-reading-prose text-[var(--app-copy)]"
              />

              <ProductGrid columns={3} className="mt-6">
                {REPORT_VISIBLE_ITEMS.map((item) => (
                  <FeatureCard key={item} surface="soft" description={item} />
                ))}
              </ProductGrid>
            </SectionSurface>

            <SectionSurface id="metadata" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="저장과 재확인"
                title="다시 열어도 같은 기준으로 확인할 수 있게 남깁니다"
                titleClassName="text-3xl"
                description="리포트는 입력값과 풀이 흐름을 내부적으로 함께 보관합니다. 화면에는 복잡한 저장 항목을 드러내지 않고, 사용자가 다시 열었을 때 같은 기준으로 확인할 수 있게 관리합니다."
                descriptionClassName="app-reading-prose text-[var(--app-copy)]"
              />

              <div className="mt-6 grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
                <div className="rounded-[20px] border border-[var(--app-line)] bg-[rgba(7,9,16,0.32)] px-5 py-5">
                  <div className="app-caption text-[var(--app-gold-soft)]">사용자에게 보이는 원칙</div>
                  <BulletList
                    items={[
                      '복잡한 내부 버전명은 일반 화면에 노출하지 않습니다.',
                      '입력한 출생 정보와 풀이 흐름은 재열람을 위해 내부 기준으로만 관리합니다.',
                      '리포트 화면에는 사용자가 이해할 수 있는 판단 단서만 보여드립니다.',
                    ]}
                  />
                </div>

                <div className="space-y-3">
                  <div className="app-caption">고전 참고자료와 안전 원칙</div>
                  <BulletList items={SAFETY_RULES} />
                </div>
              </div>
            </SectionSurface>

            <SectionSurface id="faq" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="FAQ"
                title="풀이 기준에서 가장 자주 묻는 질문"
                titleClassName="text-3xl"
              />
              <div className="mt-6 space-y-3">
                {FAQS.map((item) => (
                  <details
                    key={item.question}
                    className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
                  >
                    <summary className="font-display cursor-pointer list-none text-sm font-semibold text-[var(--app-ivory)]">
                      {item.question}
                    </summary>
                    <p className="mt-3 text-sm leading-8 text-[var(--app-copy)]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </SectionSurface>
          </div>

          <aside className="app-reading-rail">
            <SectionSurface surface="muted">
              <SectionHeader
                eyebrow="핵심 문장"
                title="좋은 해석은 말맛보다 기준에서 먼저 갈립니다"
                titleClassName="text-2xl"
                description="달빛인생은 명식, 절기, 격국, 용신, 대운의 풀이 기준을 먼저 잡고, 선생의 말투는 그 결과를 이해하기 쉽게 풀어주는 설명 레이어로만 사용합니다."
                descriptionClassName="text-[var(--app-copy)]"
              />
            </SectionSurface>

            <SupportRail
              surface="panel"
              eyebrow="바로 이어보기"
              title="궁금증을 확인했다면, 이제 실제 풀이로 돌아가세요"
              description="샘플 리포트와 실제 결과 화면에서는 이 기준이 더 쉬운 말과 생활 조언으로 이어집니다."
            >
              <ActionCluster>
                <Link
                  href="/sample-report"
                  className="moon-action-secondary"
                >
                  샘플 리포트 보기
                </Link>
                <Link
                  href="/membership"
                  className="moon-action-muted"
                >
                  멤버십 기준 보기
                </Link>
              </ActionCluster>
            </SupportRail>
          </aside>
        </div>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="다음으로 읽으면 좋은 글"
            title="기준을 읽고 나면, 보통 이 주제들로 질문이 이어집니다"
            titleClassName="text-3xl"
            description="비슷한 말만 반복되는 목록보다, 궁금한 주제별로 바로 들어갈 수 있게 정리했습니다."
            descriptionClassName="text-[var(--app-copy)]"
          />
          <ProductGrid columns={3} className="mt-6">
            {ENGINE_METHOD_ENTRIES.map((entry) => (
              <FeatureCard
                key={entry.slug}
                surface="soft"
                eyebrow={entry.eyebrow}
                title={entry.title}
                titleClassName="text-2xl"
                description={entry.summary}
                footer={
                  <Link
                    href={`/method/${entry.slug}`}
                    className="text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    풀이와 연결된 글 보기
                  </Link>
                }
              />
            ))}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
