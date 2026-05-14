import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export const GANGI_ZODIAC = [
  { key: 'rat', name: '쥐', glyph: '🐭', colors: ['#7e7c8a', '#a8a4b6'] },
  { key: 'ox', name: '소', glyph: '🐮', colors: ['#8d6e52', '#bc9d7a'] },
  { key: 'tiger', name: '호랑이', glyph: '🐯', colors: ['#e08648', '#f6b26b'] },
  { key: 'rabbit', name: '토끼', glyph: '🐰', colors: ['#c8a3c8', '#e6cce6'] },
  { key: 'dragon', name: '용', glyph: '🐲', colors: ['#3f7a8c', '#6db0c4'] },
  { key: 'snake', name: '뱀', glyph: '🐍', colors: ['#5b8a5b', '#94c094'] },
  { key: 'horse', name: '말', glyph: '🐴', colors: ['#c46a5a', '#e89a8a'] },
  { key: 'sheep', name: '양', glyph: '🐑', colors: ['#d6b27d', '#ecd2a5'] },
  { key: 'monkey', name: '원숭이', glyph: '🐵', colors: ['#8a6a3a', '#b69666'] },
  { key: 'rooster', name: '닭', glyph: '🐔', colors: ['#d49a3a', '#f0c570'] },
  { key: 'dog', name: '개', glyph: '🐶', colors: ['#7a6555', '#a89380'] },
  { key: 'pig', name: '돼지', glyph: '🐷', colors: ['#d68aa8', '#eeb8cc'] },
] as const;

export type GangiZodiacKey = (typeof GANGI_ZODIAC)[number]['key'];

export const GANGI_TEACHERS = [
  { zodiac: 'rat', name: '엠지쥐선생', topic: '성향 놀이', desc: '말투와 관계 방식을 가볍게 봅니다', href: '/guide?teacher=mg-ji', price: '준비 중' },
  { zodiac: 'ox', name: '오늘소선생', topic: '오늘 루틴', desc: '오늘 할 행동을 생활 조언으로 봅니다', href: '/today-fortune?concern=general', price: '무료' },
  { zodiac: 'tiger', name: '명리호선생', topic: '깊은 사주', desc: '반복되는 선택과 흐름을 정리합니다', href: '/myeongri', price: '990원~' },
  { zodiac: 'rabbit', name: '타로토선생', topic: '타로', desc: '지금 마음을 카드 한 장으로 봅니다', href: '/tarot/daily', price: '무료' },
  { zodiac: 'dragon', name: '사주용선생', topic: '사주 종합', desc: '내 흐름을 생년월일 기준으로 봅니다', href: '/saju/new', price: '550원~' },
  { zodiac: 'snake', name: '꿈뱀선생', topic: '꿈해몽', desc: '꿈에 남은 장면을 마음 신호로 봅니다', href: '/guide?teacher=dream-baem', price: '준비 중' },
  { zodiac: 'horse', name: '이동말선생', topic: '이동운', desc: '이직, 이사, 여행 타이밍을 봅니다', href: '/guide?teacher=move-mal', price: '준비 중' },
  { zodiac: 'sheep', name: '궁합양선생', topic: '궁합', desc: '상대와의 거리감과 속도를 봅니다', href: '/compatibility/input', price: '990원~' },
  { zodiac: 'monkey', name: '관상원선생', topic: '관상', desc: '인상과 분위기 풀이를 준비 중입니다', href: '/guide?teacher=face-won', price: '준비 중' },
  { zodiac: 'rooster', name: '재물닭선생', topic: '재물운', desc: '돈이 새는 지점과 습관을 봅니다', href: '/saju/new?focus=money&product=money-pattern', price: '990원~' },
  { zodiac: 'dog', name: '손금멍선생', topic: '손금', desc: '손바닥 단서 풀이를 준비 중입니다', href: '/guide?teacher=palm-meong', price: '준비 중' },
  { zodiac: 'pig', name: '복돼지선생', topic: '행운', desc: '출석, 쿠폰, 작은 행운을 준비 중입니다', href: '/guide?teacher=luck-dwaeji', price: '준비 중' },
] as const;

export function GangiCharacter({
  zodiac,
  size = 'md',
  className = '',
}: {
  zodiac: GangiZodiacKey;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const data = GANGI_ZODIAC.find((item) => item.key === zodiac) ?? GANGI_ZODIAC[0];
  const [from, to] = data.colors;

  return (
    <span
      className={`gangi-character ${className}`}
      data-size={size}
      title={`${data.name} 캐릭터`}
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="gangi-character-face">{data.glyph}</span>
    </span>
  );
}

export function GangiPageHeader({ title, backHref = '/' }: { title: string; backHref?: string }) {
  return (
    <div className="gangi-sub-header">
      <Link href={backHref} className="gangi-sub-back" aria-label="뒤로">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div>{title}</div>
      <span aria-hidden="true" />
    </div>
  );
}

export function GangiIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="gangi-sub-intro">
      {eyebrow ? <p className="gangi-sub-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p className="gangi-sub-desc">{description}</p> : null}
      {children}
    </section>
  );
}

export function GangiListLink({
  href,
  zodiac,
  title,
  desc,
  price,
}: {
  href: string;
  zodiac: GangiZodiacKey;
  title: string;
  desc: string;
  price?: string;
}) {
  return (
    <Link href={href} className="gangi-list-link">
      <GangiCharacter zodiac={zodiac} />
      <span className="gangi-list-copy">
        <strong>{title}</strong>
        <em>{desc}</em>
      </span>
      {price ? <span className="gangi-list-price">{price}</span> : <ArrowRight className="h-5 w-5 text-[rgba(17,17,20,0.44)]" />}
    </Link>
  );
}

export function GangiMetricBar({
  label,
  value,
  color = 'var(--app-pink)',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="gangi-metric-bar">
      <div>
        <span>{label}</span>
        <strong style={{ color }}>{value}</strong>
      </div>
      <p>
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </p>
    </div>
  );
}

export function GangiMiniCard({
  label,
  title,
  desc,
}: {
  label: string;
  title?: ReactNode;
  desc?: ReactNode;
}) {
  return (
    <div className="gangi-mini-card">
      <span>{label}</span>
      {title ? <strong>{title}</strong> : null}
      {desc ? <p>{desc}</p> : null}
    </div>
  );
}


export function GangiSection({
  eyebrow,
  title,
  description,
  children,
  tone = 'white',
  className = '',
}: {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  tone?: 'white' | 'pink';
  className?: string;
}) {
  return (
    <section className={`gangi-section ${tone === 'pink' ? 'gangi-section-pink' : ''} ${className}` }>
      {eyebrow ? <p className="gangi-sub-eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="gangi-section-title">{title}</h2> : null}
      {description ? <p className="gangi-section-desc">{description}</p> : null}
      {children ? <div className="gangi-section-body">{children}</div> : null}
    </section>
  );
}

export function GangiActionRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`gangi-action-row ${className}`}>{children}</div>;
}

export function GangiPill({ children }: { children: ReactNode }) {
  return <span className="gangi-pill">{children}</span>;
}
export function GangiPurchaseSummary({
  title,
  price,
  description,
  opens,
}: {
  title: string;
  price: string;
  description: ReactNode;
  opens: readonly string[];
}) {
  return (
    <section className="gangi-purchase-summary">
      <p className="gangi-sub-eyebrow">구매할 풀이</p>
      <h2>{title}</h2>
      <p className="gangi-purchase-desc">{description}</p>
      <div className="gangi-purchase-price">
        <strong>{price}</strong>
        <span>결제 후 바로 열람</span>
      </div>
      <div className="gangi-mini-grid">
        {opens.slice(0, 3).map((item, index) => (
          <GangiMiniCard
            key={item}
            label={String(index + 1).padStart(2, '0')}
            desc={item}
          />
        ))}
      </div>
    </section>
  );
}

// 2026-05-14: 사주풀이 로딩 오버레이.
// PR6+ 디자인 언어: pink-soft hero + 한자 月(달빛) 배지 + 진행 단계 bullets.
// 진행 단계는 시각적 안내일 뿐 실제 비동기 진행과 동기화되지는 않는다 (UX 안정감 목적).
export function GangiLoadingOverlay({
  title = '풀이를 준비하고 있어요',
  description = '생년월일과 오늘 흐름을 맞춰보는 중입니다.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="gangi-loading-overlay" role="status" aria-live="polite">
      <div className="gangi-loading-card-v2">
        {/* 月 배지 — han 폰트 + 회전 링 */}
        <div className="gangi-loading-han-badge" aria-hidden="true">
          <span className="gangi-loading-han-glyph">月</span>
          <span className="gangi-loading-han-ring" />
        </div>

        {/* Copy */}
        <div className="gangi-loading-copy-v2">
          <div className="gangi-loading-eyebrow">잠시만요</div>
          <p>{title}</p>
          <span>{description}</span>
        </div>

        {/* 진행 단계 bullets */}
        <ul className="gangi-loading-steps" aria-hidden="true">
          <li className="gangi-loading-step is-active">
            <span className="gangi-loading-step-dot" />
            <span className="gangi-loading-step-label">사주 4기둥 정리</span>
          </li>
          <li className="gangi-loading-step is-active">
            <span className="gangi-loading-step-dot" />
            <span className="gangi-loading-step-label">오행 흐름 분석</span>
          </li>
          <li className="gangi-loading-step">
            <span className="gangi-loading-step-dot" />
            <span className="gangi-loading-step-label">오늘 운 매칭</span>
          </li>
        </ul>

        {/* shimmer bars */}
        <div className="gangi-loading-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
