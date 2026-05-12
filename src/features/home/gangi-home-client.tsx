import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppPage as MoonlightPage } from '@/components/moonlight/AppPage';
import { FlowEntryList, type FlowEntryItem } from '@/components/moonlight/FlowEntryList';
import { FusionHero } from '@/components/moonlight/FusionHero';
import { LightSection } from '@/components/moonlight/LightSection';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import type { GangiHomeBanner } from '@/content/gangi-market';
import SiteHeader from '@/features/shared-navigation/site-header';
import { HOME_FEATURE_CARDS } from '@/config/home/homeFeatureCards';
import { HOME_PRODUCT_COPY } from '@/config/home/homeCopy';
import { HOME_ROUTES } from '@/config/home/homeNavigation';
import { HomeAnalyticsBoundary } from '@/features/home/home-analytics-boundary';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import { AppShell } from '@/shared/layout/app-shell';

const ZODIAC_FLOW_GLYPHS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

function trackedLinkProps({
  event,
  section,
  target,
  featureId,
  serviceId,
}: {
  event: string;
  section: string;
  target: string;
  featureId?: string;
  serviceId?: string;
}) {
  return {
    'data-analytics-event': event,
    'data-analytics-section': section,
    'data-analytics-target': target,
    'data-analytics-feature-id': featureId,
    'data-analytics-service-id': serviceId,
  };
}

function getTodayBanner(banners: readonly GangiHomeBanner[]) {
  return banners.find((banner) => banner.kicker === '오늘의 한 줄') ?? banners[0] ?? null;
}

async function getHomeLoginState() {
  if (!hasSupabaseServerEnv) return false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return Boolean(user);
  } catch {
    return false;
  }
}

function buildFlowItems(): readonly FlowEntryItem[] {
  const sajuPersonality = HOME_FEATURE_CARDS.find((item) => item.id === 'saju-personality');
  const personalityCompatibility = HOME_FEATURE_CARDS.find(
    (item) => item.id === 'personality-compatibility'
  );

  return [
    {
      id: 'saju-personality',
      title: '01 나의 결 보기',
      description: '사주×성향으로 내 선택 습관을 봅니다.',
      href: sajuPersonality?.href ?? HOME_ROUTES.sajuPersonality,
      badge: '성향사주',
      meta: '성향사주 시작',
      analyticsEvent: 'home_primary_feature_clicked',
      analyticsSection: 'flow_entry',
      analyticsTarget: 'saju_personality',
      analyticsFeatureId: 'saju-personality',
    },
    {
      id: 'personality-compatibility',
      title: '02 관계의 결 보기',
      description: '두 사람의 사주와 성향이 어디서 닮고 어긋나는지 봅니다.',
      href: personalityCompatibility?.href ?? HOME_ROUTES.personalityCompatibility,
      badge: '성향궁합',
      meta: '성향궁합 시작',
      analyticsEvent: 'home_primary_feature_clicked',
      analyticsSection: 'flow_entry',
      analyticsTarget: 'personality_compatibility',
      analyticsFeatureId: 'personality-compatibility',
    },
    {
      id: 'today-flow',
      title: '03 오늘의 결 보기',
      description: '오늘운세, 타로, 띠, 별자리로 가볍게 시작합니다.',
      href: HOME_ROUTES.todayFortune,
      badge: '오늘운세',
      meta: '오늘 흐름 보기',
      analyticsEvent: 'home_free_service_clicked',
      analyticsSection: 'flow_entry',
      analyticsTarget: 'today_fortune',
      analyticsServiceId: 'today-fortune',
    },
  ];
}

function HomeLink({
  href,
  children,
  variant = 'primary',
  event,
  section,
  target,
  featureId,
  serviceId,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'text';
  event: string;
  section: string;
  target: string;
  featureId?: string;
  serviceId?: string;
}) {
  const className =
    variant === 'primary'
      ? 'gyeol-button'
      : variant === 'secondary'
        ? 'gyeol-button gyeol-button-secondary'
        : 'inline-flex min-h-11 items-center text-sm font-bold text-[var(--gyeol-color-text)] underline-offset-4 hover:underline';

  return (
    <Link
      href={href}
      className={className}
      {...trackedLinkProps({ event, section, target, featureId, serviceId })}
    >
      {children}
    </Link>
  );
}

function TodayLine({ banner }: { banner: GangiHomeBanner | null }) {
  return (
    <LightSection
      eyebrow="Today Line"
      title="오늘의 한 줄"
      description="가볍게 먼저 보고, 필요하면 더 깊은 풀이로 이어가세요."
      surface="soft"
      actions={
        <HomeLink
          href={banner?.href ?? HOME_ROUTES.todayFortune}
          event="home_free_service_clicked"
          section="today_line"
          target="today_fortune"
          serviceId="today-fortune"
        >
          무료 오늘운세 보기
        </HomeLink>
      }
    >
      <div className="space-y-3">
        <p className="text-xl font-bold leading-8 text-[var(--gyeol-color-text)]">
          {banner?.title ?? '오늘, 작은 결정이 하루의 방향을 바꾸는 날'}
        </p>
        <p className="text-sm leading-6 text-[var(--gyeol-color-muted)]">
          {banner?.description ?? '크게 벌리기보다 지금 필요한 한 가지를 먼저 골라보세요.'}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <HomeLink
            href={HOME_ROUTES.tarotDaily}
            variant="secondary"
            event="home_free_service_clicked"
            section="today_line"
            target="tarot_daily"
            serviceId="tarot-daily"
          >
            타로 한 장 보기
          </HomeLink>
          <HomeLink
            href={HOME_ROUTES.zodiac}
            variant="secondary"
            event="home_free_service_clicked"
            section="today_line"
            target="zodiac"
            serviceId="zodiac"
          >
            띠운세 보기
          </HomeLink>
          <HomeLink
            href={HOME_ROUTES.starSign}
            variant="secondary"
            event="home_free_service_clicked"
            section="today_line"
            target="star_sign"
            serviceId="star-sign"
          >
            별자리 보기
          </HomeLink>
        </div>
      </div>
    </LightSection>
  );
}

function ContinueSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <LightSection
      eyebrow="Continue"
      title={isLoggedIn ? '보관함에서 이어보기' : '로그인하면 흐름이 이어집니다'}
      description={
        isLoggedIn
          ? '최근 리포트와 구매한 깊이보기를 보관함에서 다시 열 수 있습니다.'
          : '사주와 성향 리포트를 저장하고, 다음 방문에도 같은 흐름에서 이어볼 수 있습니다.'
      }
      actions={
        isLoggedIn ? (
          <HomeLink
            href={HOME_ROUTES.archive}
            event="home_archive_clicked"
            section="continue"
            target="archive"
            serviceId="archive"
          >
            보관함 보기
          </HomeLink>
        ) : (
          <HomeLink
            href="/login?next=%2F"
            event="home_archive_clicked"
            section="continue"
            target="login"
            serviceId="archive"
          >
            로그인하고 저장하기
          </HomeLink>
        )
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <HomeLink
          href={HOME_ROUTES.sajuNew}
          variant="secondary"
          event="home_theme_service_clicked"
          section="continue"
          target="saju_new"
          serviceId="saju-reading"
        >
          기본 사주풀이
        </HomeLink>
        <HomeLink
          href={HOME_ROUTES.compatibility}
          variant="secondary"
          event="home_theme_service_clicked"
          section="continue"
          target="compatibility"
          serviceId="compatibility"
        >
          기본 궁합
        </HomeLink>
      </div>
    </LightSection>
  );
}

function ZodiacDialogueCta() {
  return (
    <LightSection
      eyebrow="Zodiac Dialogue"
      title="12간지 캐릭터와 대화하기"
      description="자축인묘 12간지 캐릭터가 사주와 성향의 결을 풀어줍니다."
      actions={
        <HomeLink
          href={HOME_ROUTES.dialogue}
          event="home_ai_dialogue_clicked"
          section="zodiac_dialogue"
          target="dialogue"
          serviceId="dialogue"
        >
          12간지 대화방 열기
        </HomeLink>
      }
    >
      <div className="flex flex-wrap gap-1.5" aria-label="12간지 캐릭터 흐름">
        {ZODIAC_FLOW_GLYPHS.map((glyph) => (
          <span
            key={glyph}
            className="grid size-9 place-items-center rounded-full border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] text-sm font-bold text-[var(--gyeol-text)]"
            aria-hidden="true"
          >
            {glyph}
          </span>
        ))}
      </div>
    </LightSection>
  );
}

function PricingTeaser() {
  return (
    <LightSection
      eyebrow="Pricing"
      title="무료로 먼저 보고, 필요한 풀이만 열기"
      description={`무료 미리보기 · ${HOME_PRODUCT_COPY.sajuPersonalityMini.price.toLocaleString(
        'ko-KR'
      )}원 깊이보기 · 멤버십으로 자주 보는 흐름까지 비교할 수 있습니다.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <HomeLink
            href={HOME_ROUTES.pricing}
            event="home_pricing_clicked"
            section="pricing"
            target="pricing"
            serviceId="pricing"
          >
            가격 안내 보기
          </HomeLink>
          <HomeLink
            href={HOME_ROUTES.membership}
            variant="secondary"
            event="home_pricing_clicked"
            section="pricing"
            target="membership"
            serviceId="pricing"
          >
            멤버십 보기
          </HomeLink>
        </div>
      }
    />
  );
}

export async function GangiHomeClient({
  initialBanners,
}: {
  initialBanners: readonly GangiHomeBanner[];
}) {
  const todayBanner = getTodayBanner(initialBanners);
  const isLoggedIn = await getHomeLoginState();

  return (
    <AppShell header={<SiteHeader />} className="dalbit-market-shell">
      <HomeAnalyticsBoundary />
      <MoonlightPage className="home-redesign home-moonlight-flow" size="lg">
          <FusionHero
            title="사주 네 기둥과 16유형 성향이 만나는 곳."
            description="나의 결과 관계의 결을 달빛처럼 천천히 읽어보세요."
            actions={
              <>
                <HomeLink
                  href={HOME_ROUTES.sajuPersonality}
                  event="home_hero_primary_clicked"
                  section="hero"
                  target="saju_personality"
                  featureId="saju-personality"
                >
                  내 성향사주 보기
                </HomeLink>
                <HomeLink
                  href={HOME_ROUTES.personalityCompatibility}
                  variant="secondary"
                  event="home_hero_secondary_clicked"
                  section="hero"
                  target="personality_compatibility"
                  featureId="personality-compatibility"
                >
                  우리 성향궁합 보기
                </HomeLink>
              </>
            }
            aside={
              <p className="text-sm leading-6 text-[var(--gyeol-color-muted)]">
                年 月 日 時의 네 기둥 위에 I/E, S/N, T/F, J/P의 네 축을 얹어
                오늘의 선택을 더 선명하게 봅니다.
              </p>
            }
          />

          <LightSection
            eyebrow="Choose Flow"
            title="지금 보고 싶은 결을 고르세요"
            description="카드보다 먼저 흐름을 고르고, 필요한 곳에서만 깊이 들어갑니다."
            surface="plain"
          >
            <FlowEntryList items={buildFlowItems()} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--gyeol-color-muted)]">
              <HomeLink
                href={HOME_ROUTES.todayFortune}
                variant="text"
                event="home_free_service_clicked"
                section="legacy_links"
                target="today_fortune"
                serviceId="today-fortune"
              >
                오늘운세
              </HomeLink>
              <HomeLink
                href={HOME_ROUTES.tarotDaily}
                variant="text"
                event="home_free_service_clicked"
                section="legacy_links"
                target="tarot_daily"
                serviceId="tarot-daily"
              >
                타로
              </HomeLink>
              <HomeLink
                href={HOME_ROUTES.sajuNew}
                variant="text"
                event="home_theme_service_clicked"
                section="legacy_links"
                target="saju_new"
                serviceId="saju-reading"
              >
                사주
              </HomeLink>
              <HomeLink
                href={HOME_ROUTES.compatibility}
                variant="text"
                event="home_theme_service_clicked"
                section="legacy_links"
                target="compatibility"
                serviceId="compatibility"
              >
                궁합
              </HomeLink>
            </div>
          </LightSection>

          <TodayLine banner={todayBanner} />
          <ContinueSection isLoggedIn={isLoggedIn} />
          <ZodiacDialogueCta />
          <PricingTeaser />
        <SafetyNotice />
      </MoonlightPage>
    </AppShell>
  );
}
