// 2026-05-14: handoff 보드 `banners` 의 7가지 배너 variant 를 단일
// 컴포넌트로 통합. 기존 페이지들은 inline pink-soft hero / ink-dark CTA 등
// 비슷한 패턴을 반복하므로, 이 컴포넌트로 점진적으로 마이그레이션 가능.
//
// production 라우트는 무수정 — 새로 추가되는 화면이 사용. 기존 inline
// 배너도 같은 시각을 보장.
import type { ReactNode } from 'react';
import Link from 'next/link';

export type GangiBannerKind =
  | 'hero' // 1. Hero gradient — 핵심 프로모션 (pink solid gradient + 한자 deco)
  | 'soft' // 2. Soft event banner — 부드러운 안내 (pink-soft + ZodiacChip 위치)
  | 'cosmic' // 3. Cosmic / dark banner — 별자리·우주 콘텐츠 (ink + 별 패턴)
  | 'inline' // 4. Inline upsell — 본문 사이 작은 풀이 안내
  | 'sticky' // 5. Sticky bottom — 하단 고정형 (caller 가 position 처리)
  | 'success' // 6. Success / 완료 안내 (jade)
  | 'warning'; // 7. Warning / 조심 안내 (coral)

interface GangiBannerProps {
  kind: GangiBannerKind;
  /** 좌상단 eyebrow (대문자 caption) */
  eyebrow?: string;
  /** 메인 타이틀 */
  title: ReactNode;
  /** 보조 설명 */
  description?: ReactNode;
  /** 우/하단 CTA 라벨 */
  ctaLabel?: string;
  /** CTA 클릭 시 이동할 href. 외부 링크면 그대로 anchor. */
  href?: string;
  /** kind='soft'/'inline' 의 좌측 아이콘/뱃지/ZodiacChip */
  leading?: ReactNode;
  /** 가격 칩 (예: 9,900원). kind='inline' 에서 주로 사용 */
  pricePill?: string;
  /** 추가 클래스명 (caller 가 layout 보조 시) */
  className?: string;
}

export function GangiBanner({
  kind,
  eyebrow,
  title,
  description,
  ctaLabel,
  href,
  leading,
  pricePill,
  className,
}: GangiBannerProps) {
  const content = (
    <BannerBody
      kind={kind}
      eyebrow={eyebrow}
      title={title}
      description={description}
      ctaLabel={ctaLabel}
      leading={leading}
      pricePill={pricePill}
    />
  );

  if (href) {
    if (href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:')) {
      return (
        <a href={href} className={composeBannerClass(kind, className)} style={getBannerStyle(kind)}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={composeBannerClass(kind, className)} style={getBannerStyle(kind)}>
        {content}
      </Link>
    );
  }

  return (
    <div className={composeBannerClass(kind, className)} style={getBannerStyle(kind)}>
      {content}
    </div>
  );
}

function composeBannerClass(kind: GangiBannerKind, extra?: string) {
  return [
    'relative block overflow-hidden rounded-[18px] transition-transform',
    kind === 'hero' || kind === 'cosmic' ? 'text-white' : 'text-[var(--app-ink)]',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

function getBannerStyle(kind: GangiBannerKind): React.CSSProperties {
  switch (kind) {
    case 'hero':
      return {
        padding: 22,
        background:
          'linear-gradient(135deg, var(--app-pink) 0%, var(--app-pink-strong) 100%)',
        boxShadow: '0 22px 50px -28px rgba(216,27,114,0.42)',
        textDecoration: 'none',
      };
    case 'soft':
      return {
        padding: 18,
        background: 'var(--app-pink-soft)',
        border: '1px solid var(--app-pink-line)',
        textDecoration: 'none',
      };
    case 'cosmic':
      return {
        padding: 20,
        background: 'linear-gradient(135deg, #1a0a2e 0%, #2e1156 100%)',
        boxShadow: '0 22px 50px -28px rgba(46,17,86,0.42)',
        textDecoration: 'none',
      };
    case 'inline':
      return {
        padding: 16,
        background: '#fff',
        border: '1px solid var(--app-pink-line)',
        textDecoration: 'none',
      };
    case 'sticky':
      return {
        padding: 14,
        background: '#fff',
        border: '1px solid var(--app-line)',
        boxShadow: '0 -8px 24px rgba(17,17,20,0.08)',
      };
    case 'success':
      return {
        padding: 16,
        background: '#e8f5ee',
        border: '1px solid rgba(45,135,88,0.22)',
        color: 'var(--app-jade)',
      };
    case 'warning':
      return {
        padding: 16,
        background: '#fdecec',
        border: '1px solid rgba(198,69,69,0.22)',
        color: 'var(--app-coral)',
      };
  }
}

function BannerBody({
  kind,
  eyebrow,
  title,
  description,
  ctaLabel,
  leading,
  pricePill,
}: Omit<GangiBannerProps, 'href' | 'className'>) {
  // §HERO — 큰 한자 decorative + inline CTA chip
  if (kind === 'hero') {
    return (
      <>
        {eyebrow ? (
          <div className="text-[13.8px] font-extrabold uppercase tracking-[0.06em] text-white/85">
            {eyebrow}
          </div>
        ) : null}
        <div
          className="mt-1.5 text-[23px] font-extrabold leading-[1.35] tracking-tight"
          style={{ wordBreak: 'keep-all' }}
        >
          {title}
        </div>
        {description ? (
          <p className="mt-2 text-[14.4px] leading-[1.65] text-white/85">{description}</p>
        ) : null}
        {ctaLabel ? (
          <span className="mt-3.5 inline-flex h-9 items-center rounded-full bg-white/20 px-3.5 text-[15px] font-extrabold backdrop-blur-sm">
            {ctaLabel} →
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-2 leading-none opacity-10"
          style={{ fontFamily: 'var(--font-han)', fontSize: 149.5, fontWeight: 700 }}
        >
          運
        </span>
      </>
    );
  }

  // §COSMIC — 별 패턴 + 좌측 거대 심볼 + 본문
  if (kind === 'cosmic') {
    return (
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 40%, #fff 0.5px, transparent 1px), radial-gradient(circle at 75% 30%, #fff 1px, transparent 1.5px), radial-gradient(circle at 60% 70%, #fff 0.5px, transparent 1px)',
            backgroundSize: '50px 50px, 80px 80px, 40px 40px',
          }}
        />
        <div className="relative flex items-center gap-3.5">
          {leading ? (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 text-[27.6px] font-light">
              {leading}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="text-[13.8px] font-extrabold uppercase tracking-[0.08em] text-white/70">
                {eyebrow}
              </div>
            ) : null}
            <div
              className="mt-0.5 text-[17.3px] font-extrabold leading-[1.4] tracking-tight"
              style={{ wordBreak: 'keep-all' }}
            >
              {title}
            </div>
            {description ? (
              <div className="mt-0.5 text-[15px] text-white/70">{description}</div>
            ) : null}
          </div>
          {ctaLabel ? (
            <span className="shrink-0 text-[15px] font-extrabold text-white/85">
              {ctaLabel} →
            </span>
          ) : null}
        </div>
      </>
    );
  }

  // §SOFT, INLINE, STICKY, SUCCESS, WARNING — 공통 row layout
  return (
    <div className="flex items-center gap-3.5">
      {pricePill ? (
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[14.4px] font-extrabold text-white"
          style={{ background: 'var(--app-pink)' }}
          aria-hidden="true"
        >
          {pricePill}
        </div>
      ) : null}
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div
            className="text-[13.8px] font-extrabold uppercase tracking-[0.06em]"
            style={{
              color:
                kind === 'success'
                  ? 'var(--app-jade)'
                  : kind === 'warning'
                    ? 'var(--app-coral)'
                    : 'var(--app-pink-strong)',
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          className="mt-0.5 text-[16.7px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 text-[15px] leading-[1.55] text-[var(--app-copy-muted)]">
            {description}
          </div>
        ) : null}
      </div>
      {ctaLabel ? (
        <span
          className="shrink-0 text-[15px] font-extrabold"
          style={{ color: 'var(--app-pink-strong)' }}
          aria-hidden="true"
        >
          {ctaLabel} ›
        </span>
      ) : null}
    </div>
  );
}
