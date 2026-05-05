import type { Metadata } from 'next';
import Link from 'next/link';
import { SafetyNotice } from '@/components/common/safety-notice';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { DIALOGUE_GUARDRAILS, DIALOGUE_PRESETS } from '@/content/moonlight';
import { DialogueChatPanel } from '@/components/dialogue/dialogue-chat-panel';
import { GangiCharacter } from '@/components/gangi/gangi-ui';
import {
  DIALOGUE_EXPERTS,
  normalizeDialogueExpertId,
} from '@/lib/dialogue-experts';

export const metadata: Metadata = {
  title: '대화',
  description: '달빛인생께 자주 여쭙는 질문과 안전한 대화 원칙을 확인하세요.',
  alternates: { canonical: '/dialogue' },
};

const CATEGORY_COLORS: Record<string, string> = {
  '재물':      'border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
  '가족':      'border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 text-[var(--app-jade)]',
  '이동':      'border-[var(--app-sky)]/25 bg-[var(--app-sky)]/10 text-[var(--app-sky)]',
  '마음':      'border-[var(--app-plum)]/25 bg-[var(--app-plum)]/10 text-[var(--app-plum)]',
  '건강·생활': 'border-[var(--app-coral)]/25 bg-[var(--app-coral)]/10 text-[var(--app-coral)]',
  '생활':      'border-[var(--app-coral)]/25 bg-[var(--app-coral)]/10 text-[var(--app-coral)]',
};

export default async function DialoguePage({
  searchParams,
}: {
  searchParams: Promise<{
    question?: string;
    sourceSessionId?: string;
    concern?: string;
    from?: string;
    autoStart?: string;
    expert?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedExpertId = normalizeDialogueExpertId(params.expert) ?? 'dragon';
  const usageItems = [
    ['처음 3회', '무료'],
    ['이후 3회 묶음', '코인 3개'],
    ['MY 프로필', '풀이 입력 없이 자동 적용'],
  ] as const;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="gangi-subpage space-y-6">
        <SectionSurface surface="hero" size="md">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeader
              eyebrow="달빛인생과 대화"
              title="궁금한 것만 바로 물어보세요"
              titleClassName="text-3xl sm:text-4xl"
              description="로그인되어 있고 MY 프로필에 생년월일이 저장되어 있으면, 상담에서 깊은 사주풀이를 다시 입력하지 않아도 됩니다. 질문만 남기면 저장된 내 정보 기준으로 이어갑니다."
              descriptionClassName="text-[var(--app-copy)]"
              actions={
                <ActionCluster>
                  <Link
                    href="#dialogue-input"
                    className="gangi-primary-button"
                  >
                    바로 질문하기
                  </Link>
                  <Link
                    href="/my/profile"
                    className="gangi-secondary-button"
                  >
                    내 정보 확인하기
                  </Link>
                </ActionCluster>
              }
            />
            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              {['재물', '가족', '이동', '마음', '생활'].map((cat) => (
                <span
                  key={cat}
                  className={`rounded-full border px-3 py-1 text-xs ${CATEGORY_COLORS[cat] ?? 'border-[var(--app-line)] text-[var(--app-copy-muted)]'}`}
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </SectionSurface>

        <section className="gangi-card-panel p-5">
          <SectionHeader
            eyebrow="12간지 전문 분야"
            title="무엇을 물어볼지 먼저 고르세요"
            titleClassName="text-2xl"
            description="이제 대화를 맡는 선생을 따로 고르지 않습니다. 선택한 12간지 분야에 맞춰 AI가 전문적으로 답합니다."
            descriptionClassName="text-[var(--app-copy)]"
          />
          <div className="mt-5 flex flex-col gap-2.5">
            {DIALOGUE_EXPERTS.map((expert) => (
              <Link
                key={expert.id}
                href={`/dialogue?expert=${expert.id}#dialogue-chat`}
                className="gangi-list-link"
                data-active={selectedExpertId === expert.id}
              >
                <GangiCharacter zodiac={expert.id} />
                <span className="gangi-list-copy">
                  <strong>
                    {expert.animal}띠 · {expert.label}
                  </strong>
                  <em>{expert.description}</em>
                </span>
                <span className="gangi-list-price">
                  {selectedExpertId === expert.id ? '선택됨' : '선택'}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="dialogue-chat" className="scroll-mt-24">
          <DialogueChatPanel
            presets={DIALOGUE_PRESETS.map((p) => ({
              category: p.category,
              question: p.question,
            }))}
            initialQuestion={params.question}
            sourceSessionId={params.sourceSessionId}
            concernId={params.concern}
            entrySource={params.from}
            autoStart={params.autoStart === '1'}
            initialExpertId={selectedExpertId}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="자주 여쭙는 이야기"
              title="질문이 막막하실 때는, 먼저 이런 결로 시작하셔도 좋습니다"
              titleClassName="text-3xl"
              description="대화는 크게 재물, 가족, 이동, 마음, 생활 같은 생활 질문에서 시작하고, 필요하면 풀이와 관계 리포트로 자연스럽게 이어집니다."
              descriptionClassName="text-[var(--app-copy)]"
            />

            <ProductGrid columns={2} className="mt-6">
              {DIALOGUE_PRESETS.map((preset, index) => {
                const badgeCls =
                  CATEGORY_COLORS[preset.category] ??
                  'border-[var(--app-line)] text-[var(--app-copy-muted)]';

                return (
                  <FeatureCard
                    key={preset.question}
                    surface="soft"
                    eyebrow={
                      <div className="flex items-center gap-2">
                        <span className=" text-xs text-[var(--app-gold)]/65">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] tracking-[0.12em] ${badgeCls}`}
                        >
                          {preset.category}
                        </span>
                      </div>
                    }
                    title={preset.question}
                    titleClassName="text-xl"
                    description={preset.previewAnswer}
                    footer={
                      <p className="text-xs leading-6 text-[var(--app-copy-soft)]">
                        {preset.followUp}
                      </p>
                    }
                  />
                );
              })}
            </ProductGrid>
          </SectionSurface>

          <div className="flex flex-col gap-4">
            <SupportRail
              surface="panel"
              eyebrow="대화 원칙"
              title="이런 결로 답해드립니다"
              description="길흉을 단정하기보다, 이미 계산된 구조를 생활 언어로 다시 정리하고 다음 질문이 생기도록 돕는 쪽에 더 가깝습니다."
            >
              <div className="space-y-3">
                {DIALOGUE_GUARDRAILS.map((rail) => (
                  <div
                    key={rail.title}
                    className="rounded-[1.15rem] border border-[var(--app-gold)]/14 bg-[var(--app-surface-muted)] px-4 py-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-gold)]/60" />
                      <div>
                        <div className="text-sm font-medium text-[var(--app-ivory)]">{rail.title}</div>
                        <p className="mt-1.5 text-sm leading-7 text-[var(--app-copy-muted)]">{rail.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SupportRail>

            <SectionSurface surface="panel">
              <SectionHeader
                eyebrow="이용 방식"
                title="대화는 가볍게 시작하고, 풀이가 있으면 더 깊어집니다"
                titleClassName="text-2xl"
              />
              <ProductGrid columns={2} className="mt-5">
                {usageItems.map(([label, value]) => (
                  <FeatureCard
                    key={label}
                    surface="soft"
                    eyebrow={label}
                    description={<span className="text-base font-medium text-[var(--app-ivory)]">{value}</span>}
                  />
                ))}
              </ProductGrid>
            </SectionSurface>
          </div>
        </section>

        <section>
          <SafetyNotice variant="crisis" />
        </section>
      </AppPage>
    </AppShell>
  );
}
