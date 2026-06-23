// 2026-05-15 PR 2 — 운세톡톡 벤치마크 (간지사주_무료일진운세_적용방안.md 3-5, 3-6):
// 행운 패키지 12종 + 로또 번호 오행색 시각화 카드.
//
// 운세톡톡은 5종(색·숫자·방향·성씨·로또) 제공. 간지사주는 12종 (운세톡톡 5종 + 차별화 7종
// 시간·음식·향·보석·동물·음악·피해야할것). 핵심 시각화는 로또 번호 6개를 오행 색상 원으로 표시.
import type { TodayLuckyPackage } from '@/lib/today-fortune/types';

interface Props {
  luckyPackage: TodayLuckyPackage;
}

const ELEMENT_HAN: Record<'목' | '화' | '토' | '금' | '수', string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

interface RowProps {
  icon: string;
  label: string;
  items: string[];
  accent?: string;
}

function LuckyRow({ icon, label, items, accent }: RowProps) {
  if (items.length === 0) return null;
  return (
    <li className="flex items-start gap-3 border-b border-[var(--app-line)] py-2.5 last:border-b-0">
      <span aria-hidden="true" className="mt-0.5 text-[18.4px] leading-none">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]"
        >
          {label}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={`${item}-${idx}`}
              className="rounded-full border px-2.5 py-0.5 text-[13.2px] font-bold"
              style={{
                borderColor: accent ? `${accent}33` : 'var(--app-line)',
                background: accent ? `${accent}10` : 'white',
                color: accent ?? 'var(--app-ink)',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

export function TodayLuckyPackageCard({ luckyPackage }: Props) {
  const lucky = luckyPackage.luckyElement;
  const unlucky = luckyPackage.unluckyElement;

  return (
    <section
      className="rounded-[18px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
      aria-label="오늘의 행운 패키지"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            🍀 오늘의 행운 패키지
          </div>
          <h2
            className="mt-0.5 text-[17.8px] font-extrabold text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            행운 오행 ·{' '}
            <span style={{ color: 'var(--app-pink-strong)' }}>
              {lucky}({ELEMENT_HAN[lucky]})
            </span>{' '}
            기운
          </h2>
        </div>
        {unlucky ? (
          <span
            className="rounded-full border px-2 py-0.5 text-[11.5px] font-extrabold"
            style={{
              borderColor: 'rgba(220,79,79,0.32)',
              background: 'rgba(220,79,79,0.08)',
              color: 'var(--app-coral)',
            }}
            title="오늘 부담스러운 오행"
          >
            피해야 할 · {unlucky}({ELEMENT_HAN[unlucky]})
          </span>
        ) : null}
      </div>

      {/* ★ 로또 번호 6개 오행색 원 — 운세톡톡 핵심 시각화 차용 + 차별화 */}
      {luckyPackage.lottoNumbers.length > 0 ? (
        <div className="mt-3.5">
          <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
            🎰 추천 로또 번호 (오행 색상)
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {luckyPackage.lottoNumbers.map((circle, idx) => (
              <div
                key={`${circle.number}-${idx}`}
                className="grid h-[40px] w-[40px] place-items-center rounded-full text-[16.1px] font-extrabold text-white"
                style={{
                  background: circle.color,
                  boxShadow: '0 3px 8px rgba(0,0,0,0.18)',
                }}
                title={`${circle.element}(${ELEMENT_HAN[circle.element]})`}
              >
                {circle.number}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[15px] leading-[1.5] text-[var(--app-copy-soft)]">
            * 재미 요소입니다. 큰 금액 베팅은 권하지 않습니다.
          </p>
        </div>
      ) : null}

      {/* 행운 12종 리스트 */}
      <ul className="mt-3 grid">
        <LuckyRow
          icon="🎨"
          label="행운의 색상"
          items={luckyPackage.colors}
          accent="var(--app-pink-strong)"
        />
        <LuckyRow
          icon="🔢"
          label="행운의 숫자"
          items={luckyPackage.numbers.map(String)}
          accent="var(--app-amber)"
        />
        <LuckyRow
          icon="🧭"
          label="행운의 방향"
          items={luckyPackage.directions}
          accent="var(--app-jade)"
        />
        <LuckyRow
          icon="⏰"
          label="행운의 시간대"
          items={luckyPackage.timeWindows}
          accent="var(--app-indigo)"
        />
        <LuckyRow
          icon="🍽️"
          label="행운의 음식"
          items={luckyPackage.foods}
          accent="var(--app-coral)"
        />
        <LuckyRow
          icon="🌸"
          label="행운의 향기"
          items={luckyPackage.aromas}
          accent="var(--app-plum)"
        />
        <LuckyRow
          icon="💎"
          label="행운의 보석"
          items={luckyPackage.gemstones}
          accent="var(--app-sky)"
        />
        <LuckyRow
          icon="🎵"
          label="행운의 음악 장르"
          items={luckyPackage.musicGenres}
          accent="var(--app-indigo)"
        />
        <LuckyRow
          icon="👤"
          label="행운의 성씨 자음"
          items={luckyPackage.surnameInitials}
          accent="var(--app-copy)"
        />
        <LuckyRow
          icon="🐾"
          label="궁합 좋은 띠 (오늘 일진 三合)"
          items={luckyPackage.zodiacFriends}
          accent="var(--app-jade)"
        />
      </ul>

      {/* 피해야 할 것 */}
      {luckyPackage.avoidColors.length > 0 ||
      luckyPackage.avoidDirections.length > 0 ||
      luckyPackage.avoidTimeWindows.length > 0 ||
      luckyPackage.avoidZodiacs.length > 0 ? (
        <div
          className="mt-4 rounded-[12px] border p-3"
          style={{
            borderColor: 'rgba(220,79,79,0.22)',
            background: 'rgba(220,79,79,0.05)',
          }}
        >
          <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
            ⚠️ 오늘 피하면 좋은 것
          </div>
          <ul className="mt-1.5 grid gap-1.5">
            {luckyPackage.avoidColors.length > 0 ? (
              <li className="flex items-start gap-2 text-[15px] leading-[1.5] text-[var(--app-copy)]">
                <span className="font-extrabold text-[var(--app-coral)]">색</span>
                <span style={{ wordBreak: 'keep-all' }}>{luckyPackage.avoidColors.join(' · ')}</span>
              </li>
            ) : null}
            {luckyPackage.avoidDirections.length > 0 ? (
              <li className="flex items-start gap-2 text-[15px] leading-[1.5] text-[var(--app-copy)]">
                <span className="font-extrabold text-[var(--app-coral)]">방향</span>
                <span style={{ wordBreak: 'keep-all' }}>{luckyPackage.avoidDirections.join(' · ')}</span>
              </li>
            ) : null}
            {luckyPackage.avoidTimeWindows.length > 0 ? (
              <li className="flex items-start gap-2 text-[15px] leading-[1.5] text-[var(--app-copy)]">
                <span className="font-extrabold text-[var(--app-coral)]">시간</span>
                <span style={{ wordBreak: 'keep-all' }}>{luckyPackage.avoidTimeWindows.join(' · ')}</span>
              </li>
            ) : null}
            {luckyPackage.avoidZodiacs.length > 0 ? (
              <li className="flex items-start gap-2 text-[15px] leading-[1.5] text-[var(--app-copy)]">
                <span className="font-extrabold text-[var(--app-coral)]">띠</span>
                <span style={{ wordBreak: 'keep-all' }}>{luckyPackage.avoidZodiacs.join(' · ')}</span>
              </li>
            ) : null}
          </ul>
          <p className="mt-2 text-[15px] leading-[1.5] text-[var(--app-copy-soft)]">
            * 오늘 일진 정보입니다. 절대 금기는 아니고, 신중함의 신호로만 받아주세요.
          </p>
        </div>
      ) : null}
    </section>
  );
}
