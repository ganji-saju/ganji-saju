import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import {
  SETTINGS_BLUEPRINT,
} from '@/content/moonlight';
import { LayoutModeControl } from '@/features/layout-preference/layout-mode-control';
import { PageHero } from '@/shared/layout/app-shell';

export default function MySettingsPage() {
  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          <Badge
            key="settings"
            className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
          >
            설정
          </Badge>,
          <Badge
            key="reading"
            className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
          >
            시니어 친화 읽기와 알림 옵션
          </Badge>,
        ]}
        title="글자, 말투, 알림을 선생님께 맞게 조정하세요"
        description="설정은 단순한 옵션 모음이 아니라 매일 다시 들어오게 만드는 사용감의 핵심입니다. 읽기 부담을 줄이고, 알림 시간과 표현 톤을 본인에게 맞게 맞출 수 있어야 합니다."
      />

      <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="알림과 위젯"
            title="실제 알림 제어는 알림 센터에서 이어집니다"
            titleClassName="text-3xl"
            description="시간대 토글, 알림 스타일, 홈 위젯 크기, 미접속 리마인더 주기를 실제 상태로 저장해 둡니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy-muted)]"
          />

          <FeatureCard
            className="mt-6"
            surface="soft"
            eyebrow="알림 센터"
            description="푸시 · 위젯 · 재방문 리마인더를 한곳에서 조정할 수 있습니다."
            footer={
              <Link
                href="/notifications"
                className="inline-flex items-center gap-2 text-sm text-[var(--app-gold-soft)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
              >
                알림 센터 열기
              </Link>
            }
          />
        </SectionSurface>

        <SupportRail
          surface="panel"
          eyebrow="레이아웃 보기"
          title="PC 보기 방식을 선생님께 맞게 바꿉니다"
          description="모바일은 하단 독 중심의 안정적인 보기로 고정하고, PC에서만 세로형 좌측 사이드바와 가로형 상단 네비를 선택할 수 있습니다."
        >
          <LayoutModeControl />
        </SupportRail>
      </section>

      <SectionSurface surface="panel" size="lg">
        <SectionHeader
          eyebrow="읽기 경험"
          title="자주 건드리는 설정은 같은 카드 밀도로 정리합니다"
          titleClassName="text-3xl"
          description="설정 화면도 기능이 많아 보이기보다, 무엇을 바꾸면 왜 달라지는지 짧게 읽히는 쪽이 더 중요합니다."
          descriptionClassName="max-w-3xl text-[var(--app-copy)]"
        />

        <ProductGrid columns={2} className="mt-6">
          {SETTINGS_BLUEPRINT.map((item) => (
            <FeatureCard key={item.title} surface="soft" eyebrow={item.title} title={item.options} description={item.reason} />
          ))}
        </ProductGrid>
      </SectionSurface>
    </div>
  );
}
