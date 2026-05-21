// 2026-05-22 — Phase 2+3 스펙 §10: 평생 활용 3가지 (총평 LLM lifetime_keys).
//   모바일 가로 스크롤 / 데스크탑 세로 스택. scrollbar-none(globals.css).
export interface LifetimeKey {
  title: string;
  subtitle: string;
  body: string;
}

interface LifetimeKeysCarouselProps {
  keys: LifetimeKey[];
  className?: string;
}

const KEY_CARD_COLORS = [
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', badge: '강한 환경' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', badge: '약한 자리' },
  { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100', badge: '핵심 활용법' },
] as const;

export function LifetimeKeysCarousel({ keys, className = '' }: LifetimeKeysCarouselProps) {
  if (!keys || keys.length === 0) return null;
  return (
    <div className={className}>
      <h3 className="mb-3 px-1 text-base font-bold text-gray-900">🎯 평생 활용 핵심 3가지</h3>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-none sm:flex-col sm:overflow-visible">
        {keys.map((key, i) => {
          const colors = KEY_CARD_COLORS[i % KEY_CARD_COLORS.length];
          return (
            <div
              key={i}
              className={`w-72 flex-none snap-start rounded-xl border p-4 sm:w-full ${colors.bg} ${colors.border}`}
            >
              <span className={`rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold ${colors.text}`}>
                {colors.badge}
              </span>
              <p className={`mt-2 text-base font-bold ${colors.text}`}>{key.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{key.subtitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-700" style={{ wordBreak: 'keep-all' }}>
                {key.body}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
