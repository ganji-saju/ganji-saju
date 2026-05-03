'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Heart,
  MessageCircleHeart,
  Sparkles,
  Star,
  SunMedium,
  WalletCards,
} from 'lucide-react';
import {
  ACTIVE_DALBIT_TEACHERS,
  COMING_SOON_DALBIT_TEACHERS,
  DALBIT_TEACHERS,
  TASTE_PRODUCTS,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppShell } from '@/shared/layout/app-shell';

const FREE_ENTRY_CARDS = [
  {
    title: '무료 오늘운세',
    body: '오늘 조심할 것, 마음가짐, 바로 해볼 행동을 짧게 봅니다.',
    href: '/today-fortune?concern=general',
    cta: '오늘운세 보기',
    icon: SunMedium,
    event: 'home_free_today_click',
  },
  {
    title: '무료 오늘타로',
    body: '지금 고민을 고르고 카드 한 장으로 마음의 방향을 확인합니다.',
    href: '/tarot/daily',
    cta: '타로 뽑기',
    icon: Sparkles,
    event: 'home_free_tarot_click',
  },
] as const;

const ACTIVE_TEACHERS = ACTIVE_DALBIT_TEACHERS;
const COMING_SOON_TEACHERS = COMING_SOON_DALBIT_TEACHERS;
const TEACHER_BY_SLUG = new Map(DALBIT_TEACHERS.map((teacher) => [teacher.slug, teacher]));

const BRAND_POINTS = ['흰 배경', '블랙 텍스트', '핑크 포인트', '모바일 먼저', '짧고 쉬운 풀이'];

export default function HomePage() {
  useEffect(() => {
    trackMoonlightEvent('home_view', { brand: 'dalbit-insaeng' });
  }, []);

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-0">
      <section className="dalbit-home-hero">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-14">
          <div className="space-y-7">
            <div className="inline-flex rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-4 py-2 text-sm font-bold text-[var(--app-pink-strong)]">
              달빛인생 · 무료 운세와 타로부터 시작
            </div>

            <div className="space-y-4">
              <h1 className="dalbit-home-title">
                오늘 뭐가 제일 궁금하세요?
              </h1>
              <p className="dalbit-home-lead">
                사주를 어렵게 공부하지 않아도 괜찮습니다. 오늘의 운세, 지금 마음,
                연애와 돈의 고민을 먼저 고르고 짧게 확인하세요.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {BRAND_POINTS.map((point) => (
                <span key={point} className="dalbit-mini-badge">
                  {point}
                </span>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {FREE_ENTRY_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="dalbit-free-card group"
                    onClick={() => trackMoonlightEvent(card.event, { from: 'home_hero' })}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="dalbit-icon-bubble">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 text-[var(--app-pink)] transition-transform group-hover:translate-x-1" />
                    </div>
                    <h2 className="mt-5 text-2xl font-black tracking-tight text-[var(--app-ink)]">
                      {card.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--app-copy)]">
                      {card.body}
                    </p>
                    <div className="mt-5 text-sm font-extrabold text-[var(--app-pink-strong)]">
                      {card.cta}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="dalbit-phone-panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--app-pink-strong)]">
                  Today Pick
                </div>
                <div className="mt-1 text-2xl font-black text-[var(--app-ink)]">
                  오늘은 크게 밀기보다
                  <br />
                  마음을 먼저 정리하는 날
                </div>
              </div>
              <div className="dalbit-character-face">辰</div>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                ['마음', '서두르는 말은 한 박자 늦추기'],
                ['돈', '작은 지출부터 확인하기'],
                ['관계', '답답해도 먼저 안부 묻기'],
              ].map(([label, body]) => (
                <div key={label} className="dalbit-advice-row">
                  <span>{label}</span>
                  <strong>{body}</strong>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.2rem] bg-black p-4 text-white">
              <div className="flex items-center gap-2 text-sm font-bold text-pink-200">
                <MessageCircleHeart className="h-4 w-4" />
                오늘의 한마디
              </div>
              <p className="mt-3 text-base leading-7">
                지금 필요한 건 큰 결론보다, 내 마음을 덜 흔들리게 하는 작은 선택입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="dalbit-section">
          <div className="dalbit-section-heading">
            <h2>어떤 선생에게 먼저 물어볼까요?</h2>
            <p>메뉴 이름보다 담당 선생과 질문이 먼저 보이도록 정리했습니다.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ACTIVE_TEACHERS.map((teacher) => (
              <Link
                key={teacher.slug}
                href={teacher.href}
                className="dalbit-teacher-card group"
                onClick={() =>
                  trackMoonlightEvent('home_service_menu_click', {
                    from: 'home_teacher_menu',
                    menu: teacher.serviceTitle,
                    teacher: teacher.teacherName,
                  })
                }
              >
                <div className="dalbit-teacher-orb">{teacher.zodiac}</div>
                <div>
                  <div className="dalbit-teacher-kicker">{teacher.teacherName}</div>
                  <h3>{teacher.serviceTitle}</h3>
                  <p>{teacher.question}</p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-[var(--app-pink)] transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {COMING_SOON_TEACHERS.map((teacher) => (
              <Link
                key={teacher.slug}
                href={teacher.href}
                className="dalbit-teacher-card dalbit-teacher-card-muted"
                onClick={() =>
                  trackMoonlightEvent('home_service_menu_click', {
                    from: 'home_teacher_coming_soon',
                    menu: teacher.serviceTitle,
                    teacher: teacher.teacherName,
                    status: teacher.status,
                  })
                }
              >
                <div className="dalbit-teacher-orb">{teacher.zodiac}</div>
                <div>
                  <div className="dalbit-teacher-kicker">준비 중 · {teacher.teacherName}</div>
                  <h3>{teacher.serviceTitle}</h3>
                  <p>{teacher.shortLabel}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="dalbit-section">
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div className="dalbit-section-heading">
              <h2>더 궁금할 때만 가볍게 열어보세요</h2>
              <p>
                홈에서 결제를 먼저 압박하지 않습니다. 무료 결과를 보고 더 궁금한 질문만
                550원/990원 단위로 이어보는 구조입니다.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {TASTE_PRODUCTS.slice(0, 3).map((product) => {
                const teacher = TEACHER_BY_SLUG.get(product.teacherSlug);
                return (
                  <Link
                    key={product.slug}
                    href={product.href}
                    className="dalbit-price-card"
                    onClick={() =>
                      trackMoonlightEvent('home_taste_product_click', {
                        from: 'home_taste_products',
                        product: product.title,
                        teacher: teacher?.teacherName,
                      })
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-[var(--app-pink-strong)]">
                        {product.price}
                      </span>
                      <WalletCards className="h-4 w-4 text-[var(--app-pink)]" />
                    </div>
                    <h3>{product.title}</h3>
                    <p>{product.result}</p>
                    {teacher ? (
                      <div className="dalbit-product-teacher">
                        <span>{teacher.zodiac}</span>
                        {teacher.teacherName}
                      </div>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="dalbit-brand-note">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-[var(--app-pink-strong)]">
              <Star className="h-4 w-4" />
              달빛인생 개편 원칙
            </div>
            <h2>어려운 명리 설명보다, 오늘 내 삶에 닿는 풀이를 먼저 보여드립니다.</h2>
            <p>
              기존의 긴 리포트형 문법은 뒤로 낮추고, 무료 오늘운세와 타로, 고민별 소액
              풀이, 캐릭터형 메뉴를 중심으로 다시 정리합니다.
            </p>
          </div>
          <Link href="/saju/new" className="moon-cta-primary">
            <Heart className="h-4 w-4" />
            내 사주 보기
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
