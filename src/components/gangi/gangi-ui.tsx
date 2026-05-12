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
  { zodiac: 'rat', name: '자(子)쥐', topic: '오늘의 흐름', desc: '빠른 선택과 기회 포착을 봅니다', href: '/dialogue/rat', price: '대화' },
  { zodiac: 'ox', name: '축(丑)소', topic: '안정과 루틴', desc: '돈, 안정, 장기 선택을 봅니다', href: '/dialogue/ox', price: '대화' },
  { zodiac: 'tiger', name: '인(寅)호랑이', topic: '커리어', desc: '도전과 실행력을 봅니다', href: '/dialogue/tiger', price: '대화' },
  { zodiac: 'rabbit', name: '묘(卯)토끼', topic: '연애와 말투', desc: '관계 회복과 표현을 봅니다', href: '/dialogue/rabbit', price: '대화' },
  { zodiac: 'dragon', name: '진(辰)용', topic: '큰 흐름', desc: '대운과 올해 방향을 봅니다', href: '/dialogue/dragon', price: '대화' },
  { zodiac: 'snake', name: '사(巳)뱀', topic: '속마음', desc: '심리와 관계 분석을 봅니다', href: '/dialogue/snake', price: '대화' },
  { zodiac: 'horse', name: '오(午)말', topic: '연락과 표현', desc: '연락, 표현, 이동을 봅니다', href: '/dialogue/horse', price: '대화' },
  { zodiac: 'sheep', name: '미(未)양', topic: '가족과 회복', desc: '마음 안정과 가까운 관계를 봅니다', href: '/dialogue/sheep', price: '대화' },
  { zodiac: 'monkey', name: '신(申)원숭이', topic: '전략', desc: '문제 해결과 협상을 봅니다', href: '/dialogue/monkey', price: '대화' },
  { zodiac: 'rooster', name: '유(酉)닭', topic: '정리와 계획', desc: '좋은 날과 실행 순서를 봅니다', href: '/dialogue/rooster', price: '대화' },
  { zodiac: 'dog', name: '술(戌)개', topic: '신뢰', desc: '약속과 장기 관계를 봅니다', href: '/dialogue/dog', price: '대화' },
  { zodiac: 'pig', name: '해(亥)돼지', topic: '복과 재충전', desc: '여유, 마무리, 작은 복을 봅니다', href: '/dialogue/pig', price: '대화' },
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

export function GangiLoadingOverlay({
  title = '풀이를 준비하고 있어요',
  description = '생년월일과 오늘 흐름을 맞춰보는 중입니다.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="gangi-loading-overlay" role="status" aria-live="polite">
      <div className="gangi-loading-card">
        <div className="gangi-loading-moon" aria-hidden="true">
          <span />
          <i />
        </div>
        <div className="gangi-loading-copy">
          <p>{title}</p>
          <span>{description}</span>
        </div>
        <div className="gangi-loading-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
