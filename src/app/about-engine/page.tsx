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
  title: '달빛인생 풀이 안내 | 쉬운 사주 도움말',
  description:
    '달빛인생이 출생 정보와 시간, 장소를 어떻게 확인하고 쉬운 사주풀이로 이어주는지 정리한 안내입니다.',
  keywords: [
    '쉬운 사주풀이',
    '출생 시간 사주',
    '출생지 사주',
    '오늘 운세',
    '달빛인생 풀이 안내',
  ],
  alternates: { canonical: '/about-engine' },
  openGraph: {
    title: '달빛인생 풀이 안내',
    description:
      '어려운 말보다 사용자가 바로 이해할 수 있는 풀이를 먼저 보여주는 달빛인생의 안내입니다.',
    url: 'https://ganji-saju.vercel.app/about-engine',
    siteName: '달빛인생',
    locale: 'ko_KR',
    type: 'article',
  },
};

const ENGINE_BADGES = [
  '쉬운 사주풀이 안내',
  '출생 시간 · 출생지 확인',
  '큰 흐름 · 올해 흐름',
  '세부 단서는 필요할 때만',
] as const;

const PAGE_SECTIONS = [
  { href: '#why-not-just-ai', label: '왜 결과가 다를까' },
  { href: '#time-precision', label: '시간과 장소' },
  { href: '#decision-trace', label: '세부 단서' },
  { href: '#report-ux', label: '결과 화면' },
  { href: '#metadata', label: '저장과 다시 보기' },
  { href: '#faq', label: '자주 묻는 질문' },
] as const;

const ENGINE_PRINCIPLES = [
  {
    title: '출생 정보를 먼저 확인합니다',
    body:
      '생년월일, 시간, 출생지를 먼저 확인한 뒤 풀이를 시작합니다. 대화 중에 그때그때 말을 맞추는 방식이 아니라, 입력한 정보를 바탕으로 같은 흐름을 이어갑니다.',
  },
  {
    title: 'AI는 말을 쉽게 바꾸는 역할입니다',
    body:
      '선생의 말투는 어려운 풀이를 읽기 쉬운 문장으로 풀어주는 역할입니다. 남선생과 여선생은 표현의 느낌이 다를 수 있지만, 핵심 흐름은 같은 정보에서 출발합니다.',
  },
  {
    title: '세부 단서는 궁금할 때만 봅니다',
    body:
      '좋은 사주풀이는 어려운 말이 많다고 좋은 것이 아닙니다. 먼저 오늘 필요한 답을 보여주고, 더 궁금한 분만 세부 단서를 펼쳐볼 수 있게 둡니다.',
  },
] as const;

const COMPARISON_ROWS = [
  [
    '출생 정보',
    '대화 내용에 맞춰 그럴듯한 말을 만들 수 있습니다.',
    '입력한 생년월일, 시간, 장소를 먼저 확인하고 풀이를 이어갑니다.',
  ],
  [
    '풀이 흐름',
    '말투가 자연스러워도 왜 그런 결론인지 알기 어려울 수 있습니다.',
    '한 줄 요약, 분야별 조언, 오늘 할 일을 먼저 보여줍니다.',
  ],
  [
    '시간 처리',
    '입력된 시각을 그대로 소비하는 경우가 많습니다.',
    '출생지와 시간 경계를 함께 보고, 모르는 정보는 모른다고 표시합니다.',
  ],
  [
    '세부 단서',
    '긴 설명 안에 근거가 섞여 읽기 어려울 수 있습니다.',
    '본문과 세부 단서를 분리해, 필요한 사람만 더 볼 수 있게 합니다.',
  ],
] as const;

const TIME_RULES = [
  {
    label: '표준시',
    body: '보통 알고 있는 출생 시간을 그대로 쓰는 방식입니다. 대부분의 사용자는 이 정보만으로도 기본 풀이를 볼 수 있습니다.',
  },
  {
    label: '진태양시',
    body: '태어난 지역에 따라 실제 해가 뜨고 지는 시간을 조금 더 맞춰 보는 방식입니다. 경계 시간에 태어난 분에게만 특히 중요합니다.',
  },
  {
    label: '자정 근처 시간',
    body: '밤 11시 이후처럼 날짜가 넘어가는 경계에서는 풀이가 달라질 수 있습니다. 이런 경우는 결과 화면에서 조심해서 안내합니다.',
  },
] as const;

const DECISION_STEPS = [
  '양력과 음력, 태어난 계절 흐름을 확인합니다',
  '출생지와 시간을 함께 보고 경계 구간을 점검합니다',
  '반복되는 성향과 관계 패턴을 먼저 살핍니다',
  '부족하거나 넘치는 기운을 생활 조언으로 바꿉니다',
  '큰 흐름, 올해 흐름, 이번 달 흐름을 현재 질문과 연결합니다',
  '의견이 갈릴 수 있는 세부 해석은 본문에서 분리합니다',
] as const;

const REPORT_VISIBLE_ITEMS = [
  '한 줄 총평',
  '돈 · 일 · 관계 · 생활 리듬 카드',
  '오늘 조심할 패턴',
  '올해와 이번 달의 큰 흐름',
  '출생 시간과 출생지 확인 여부',
  '더 궁금할 때만 보는 세부 단서',
] as const;

const SAFETY_RULES = [
  '의료, 법률, 투자, 위기 상황은 사주풀이와 분리합니다.',
  '길흉을 공포스럽게 단정하지 않습니다.',
  '태어난 시간이 불명확하면 시간에 민감한 해석은 조심해서 보여줍니다.',
  '대화 중에도 새 결론을 함부로 만들어내지 않고 기존 풀이 흐름을 이어갑니다.',
  '확신하기 어려운 부분은 참고용으로 낮춰 보여줍니다.',
] as const;

const FAQS = [
  {
    question: 'AI가 마음대로 결과를 바꾸지 않는다는 뜻은 무엇인가요?',
    answer:
      '달빛인생은 입력한 출생 정보를 먼저 확인한 뒤 그 흐름을 바탕으로 설명합니다. 대화 중에 말투가 달라져도 핵심 풀이가 갑자기 바뀌지 않도록 분리해 둡니다.',
  },
  {
    question: '왜 분 단위 출생시각과 출생지를 같이 묻나요?',
    answer:
      '경계 시간에 태어난 경우에는 몇 분 차이로 풀이가 달라질 수 있습니다. 출생지를 함께 묻는 이유도 이런 경계 구간을 조금 더 조심해서 보기 위해서입니다.',
  },
  {
    question: '여선생과 남선생은 왜 해석이 비슷한가요?',
    answer:
      '두 선생은 같은 출생 정보를 바탕으로 설명합니다. 표현은 다를 수 있지만, 핵심 흐름이 크게 달라지면 사용자가 더 혼란스럽기 때문입니다.',
  },
  {
    question: '긴 글을 다 읽지 않아도 괜찮나요?',
    answer:
      '괜찮습니다. 달빛인생은 먼저 한 줄 요약과 분야별 조언을 보여주고, 세부 설명은 궁금할 때만 펼쳐보는 흐름을 지향합니다.',
  },
  {
    question: '사주풀이만으로 투자나 의료 결정을 해도 되나요?',
    answer:
      '아니요. 의료, 법률, 투자, 위기 상황은 반드시 전문가의 도움을 우선해야 합니다. 사주풀이는 삶의 흐름을 참고하는 용도로만 보시면 됩니다.',
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
          title="달빛인생은 왜 이렇게 풀이하나요?"
          description="어려운 사주 용어를 먼저 늘어놓기보다, 출생 정보에서 확인한 흐름을 오늘 필요한 말로 바꿔 보여주는 서비스입니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="풀이 안내 요약"
              title="결과가 왜 달라질 수 있는지만 쉽게 정리합니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="출생 시간, 출생지, 다시 열람할 때의 차이처럼 사용자가 실제로 궁금해하는 부분만 쉽게 모았습니다."
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
            description="사주풀이 화면에서는 결과를 먼저 보고, 이 페이지는 출생 시간이나 음양력 정보가 궁금할 때만 확인하시면 됩니다."
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
                className="gangi-primary-button"
              >
                사주 시작하기
              </Link>
              <Link
                href="/sample-report"
                className="gangi-secondary-button"
              >
                샘플 풀이 보기
              </Link>
            </ActionCluster>

            <div className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-7 text-[var(--app-copy-soft)]">
              이 안내는 홈, 입력 화면, 결과 화면, 대화, 상품 화면에서 같은 흐름으로 이어집니다.
            </div>
          </SupportRail>
        </section>

        <div className="app-reading-layout">
          <div className="app-reading-stack">
            <SectionSurface id="why-not-just-ai" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="왜 결과가 다를까"
                title="일반 AI 사주와 달빛인생의 차이는 말투보다 흐름에 있습니다"
                titleClassName="text-3xl"
                description="일반적인 대화형 AI는 문장을 잘 만들지만, 같은 생년월일이라도 입력 방식에 따라 설명이 달라질 수 있습니다. 달빛인생은 출생 정보를 먼저 확인하고, 그 흐름 위에서 쉽게 풀어줍니다."
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
                eyebrow="시간과 장소"
                title="출생 시간과 출생지는 왜 함께 묻나요?"
                titleClassName="text-3xl"
                description="대부분은 생년월일만으로도 큰 흐름을 볼 수 있지만, 자정 근처나 계절 경계에 태어난 분은 시간과 장소가 중요해질 수 있습니다. 모르는 정보는 무리해서 단정하지 않습니다."
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
                    title: '경계 시간 안내',
                    body: '자정 근처나 계절이 바뀌는 시기에는 분 단위 입력이 중요해질 수 있습니다.',
                  },
                  {
                    title: '안전한 읽기',
                    body: '시간이 불확실하면 시간에 민감한 해석은 조심해서 보여주고, 큰 흐름을 먼저 봅니다.',
                  },
                ]}
              />
            </SectionSurface>

            <SectionSurface id="decision-trace" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="세부 단서"
                title="왜 그렇게 보았는지는 필요할 때만 펼쳐봅니다"
                titleClassName="text-3xl"
                description="사용자에게 먼저 필요한 것은 복잡한 설명이 아니라 오늘 이해할 수 있는 답입니다. 세부 단서는 본문과 분리해 필요한 분만 확인하게 둡니다."
                descriptionClassName="app-reading-prose text-[var(--app-copy)]"
              />

              <div className="mt-6 app-reading-stack">
                {DECISION_STEPS.map((item, index) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(7,9,16,0.28)] px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className=" mt-0.5 text-sm text-[var(--app-gold)]/60">
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
                eyebrow="결과 화면"
                title="긴 설명보다 먼저, 내게 필요한 답이 보여야 합니다"
                titleClassName="text-3xl"
                description="실제 결과 화면에서는 핵심 요약, 분야별 조언, 오늘 할 일을 먼저 보여줍니다. 전문적인 세부 단서는 기본 본문에서 반복하지 않습니다."
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
                eyebrow="저장과 다시 보기"
                title="다시 열어도 같은 흐름으로 확인할 수 있게 남깁니다"
                titleClassName="text-3xl"
                description="사용자가 다시 읽을 때 같은 내용을 확인할 수 있도록 필요한 정보만 안전하게 관리합니다. 복잡한 내부 항목은 일반 화면에 드러내지 않습니다."
                descriptionClassName="app-reading-prose text-[var(--app-copy)]"
              />

              <div className="mt-6 grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
                <div className="rounded-[20px] border border-[var(--app-line)] bg-[rgba(7,9,16,0.32)] px-5 py-5">
                  <div className="app-caption text-[var(--app-gold-soft)]">사용자에게 보이는 원칙</div>
                  <BulletList
                    items={[
                      '복잡한 내부 버전명은 일반 화면에 노출하지 않습니다.',
                      '입력한 출생 정보와 풀이 흐름은 다시 보기 기능을 위해 필요한 범위에서만 관리합니다.',
                      '결과 화면에는 사용자가 이해할 수 있는 말만 먼저 보여드립니다.',
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
                title="풀이 안내에서 가장 자주 묻는 질문"
                titleClassName="text-3xl"
              />
              <div className="mt-6 space-y-3">
                {FAQS.map((item) => (
                  <details
                    key={item.question}
                    className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
                  >
                    <summary className=" cursor-pointer list-none text-sm font-semibold text-[var(--app-ivory)]">
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
                title="좋은 풀이는 어려운 말보다 납득이 먼저입니다"
                titleClassName="text-2xl"
                description="달빛인생은 사용자가 입력한 정보에서 큰 흐름을 먼저 잡고, 선생의 말투는 그 내용을 이해하기 쉽게 풀어주는 역할로 사용합니다."
                descriptionClassName="text-[var(--app-copy)]"
              />
            </SectionSurface>

            <SupportRail
              surface="panel"
              eyebrow="바로 이어보기"
              title="궁금증을 확인했다면, 이제 실제 풀이로 돌아가세요"
              description="샘플 풀이와 실제 결과 화면에서는 이 안내가 더 쉬운 말과 생활 조언으로 이어집니다."
            >
              <ActionCluster>
                <Link
                  href="/sample-report"
                  className="gangi-secondary-button"
                >
                  샘플 풀이 보기
                </Link>
                <Link
                  href="/membership"
                  className="gangi-secondary-button"
                >
                  상품 보기
                </Link>
              </ActionCluster>
            </SupportRail>
          </aside>
        </div>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="다음으로 읽으면 좋은 글"
            title="이 안내를 읽고 나면, 보통 이 주제들로 질문이 이어집니다"
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
                    이어서 보기
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
