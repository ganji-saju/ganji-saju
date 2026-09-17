// 2026-08-25 전면 개편 — 사주 결과 단일 페이지화. 구 /saju/[slug]/nature(성향 탭) 본문 이동:
//   일주 캐릭터 + 핵심 장점 + 생활 힌트 2x2. 구 라우트는 앵커 리다이렉트.

import type { ReadingRecord } from '@/lib/saju/readings';
import { DayPillarCharacterCard } from '@/components/saju/day-pillar-character-card';

export function NatureSection({
  sajuData,
  grounding,
}: {
  sajuData: ReadingRecord['sajuData'];
  grounding: ReadingRecord['grounding'];
}) {
  const personalizationContext = grounding?.personalizationContext ?? null;
  const sixtyGapjaProfile = personalizationContext?.sixtyGapja ?? null;
  const dayGanziKorean = personalizationContext?.dayGanziCode ?? '';
  const dayGanziHanja = personalizationContext?.dayGanziHanja ?? sajuData.pillars.day.ganzi;
  const pattern = sajuData.pattern;
  const strength = sajuData.strength;
  const cards = [
    {
      label: '역할의 근거', title: '같은 일주도 무엇이 다를까요?',
      desc: pattern
        ? `${pattern.name}을 함께 읽습니다. 월지에서 어떤 역할이 중심이 되는지 본 것으로, 일주 성향만 같다고 직업이나 관계 방식까지 같다고 보지는 않습니다.${pattern.confidence === '낮음' ? ' 이 격국은 참고 후보이므로 하나의 역할로 단정하지 않습니다.' : ''}`
        : '격국 정보가 충분하지 않아 특정 역할에 잘 맞는다고 좁히지 않습니다.',
    },
    {
      label: '부담의 근거', title: '같은 강점도 언제 부담이 될까요?',
      desc: strength?.level === '신약'
        ? '본인 기운을 돕는 조건이 중요한 사주로 읽습니다. 같은 일을 맡아도 도움을 받을 수 있는지, 한꺼번에 요구가 몰리는지에 따라 체감이 달라질 수 있어요.'
        : strength?.level === '신강'
          ? '본인 기운이 강한 사주로 읽습니다. 익숙한 방식이 통할 때와 다른 사람의 속도에 맞춰야 할 때를 나누어 보면, 추진력이 부담으로 바뀌는 지점을 찾기 쉬워요.'
          : '강약 하나로 능력을 평가하지 않습니다. 같은 활동에서도 맡을 범위와 쉬어갈 여유에 따라 실제 부담이 어떻게 달라지는지 비교해보세요.',
    },
  ];

  return (
    <div className="space-y-5">
      {/* 일주 캐릭터 — grounding.sixtyGapja 가 있을 때만 노출. */}
      <DayPillarCharacterCard
        profile={sixtyGapjaProfile}
        dayGanziHanja={dayGanziHanja}
        dayGanziKorean={dayGanziKorean}
      />

      {/* 일주 카드와 중복되는 강점 나열 대신 원국의 다른 조건을 설명 */}
      <section>
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          해석의 조건
        </div>
        <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
          일주 성향을 함께 읽는 근거
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
            >
              <div className="text-[12.6px] font-bold text-[var(--app-pink-strong)]">
                {card.label}
              </div>
              <div className="mt-1 text-[15.5px] font-extrabold leading-snug text-[var(--app-ink)]">
                {card.title}
              </div>
              <p className="mt-1.5 text-[13.8px] leading-[1.55] text-[var(--app-copy-muted)]">
                {card.desc}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
