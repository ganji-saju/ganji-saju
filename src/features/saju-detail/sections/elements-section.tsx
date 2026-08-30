// 2026-08-25 전면 개편 — 사주 결과 단일 페이지화. 구 /saju/[slug]/elements(오행 탭) 본문 이동:
//   도넛 분포 + 균형 메모. 구 라우트는 앵커 리다이렉트.

import { ELEMENT_INFO } from '@/lib/saju/elements';
import type { Element } from '@/lib/saju/types';
import type { ReadingRecord } from '@/lib/saju/readings';

const ELEMENT_ORDER: Element[] = ['목', '화', '토', '금', '수'];

const ELEMENT_HAN: Record<Element, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

const ELEMENT_SUPPORT_GUIDE: Record<
  Element,
  { label: string; support: string; habits: string[] }
> = {
  목: {
    label: '새로 시작하고 추진하는 힘',
    support: '막혀 있던 흐름을 다시 자라게 하는 축이 필요합니다.',
    habits: ['아침에 먼저 움직이는 약속 만들기', '할 일을 한 줄로 먼저 적기', '식물이나 나무 결이 있는 공간 가까이 두기'],
  },
  화: {
    label: '마음을 꺼내고 활력을 더하는 힘',
    support: '안에 쌓인 생각을 밖으로 꺼내고 분위기를 데우는 축이 더 필요합니다.',
    habits: ['결정 전 감정을 먼저 한 문장으로 말하기', '몸을 따뜻하게 깨우는 산책 넣기', '붉은 계열 포인트를 작은 소품으로 쓰기'],
  },
  토: {
    label: '흔들리지 않게 중심을 잡는 힘',
    support: '흐름을 한곳에 모으고 안정적으로 붙잡는 축을 보완해주면 좋습니다.',
    habits: ['일주일 루틴을 두세 개만 고정하기', '식사와 수면 시간을 흔들리지 않게 잡기', '책상과 서랍을 짧게라도 자주 정리하기'],
  },
  금: {
    label: '결단하고 매듭짓는 힘',
    support: '정리하고 마무리하는 축이 더해질수록 전체 리듬이 또렷해집니다.',
    habits: ['흰색·은색 소품을 가까이 두기', '서쪽 방향에서 잠깐 숨 고르기', '정리와 마감 시간을 하루 안에 따로 빼두기'],
  },
  수: {
    label: '깊이 사고하고 유연하게 흐르는 힘',
    support: '급하게 몰아가기보다 여지를 남기고 깊게 읽는 축을 채워주면 균형이 좋아집니다.',
    habits: ['하루에 조용한 혼자 시간 확보하기', '물을 자주 마시며 속도를 늦추기', '밤에 생각을 정리할 메모 습관 두기'],
  },
};

function buildDonutGradient(sajuData: ReadingRecord['sajuData']): string {
  const byElement = sajuData.fiveElements.byElement;
  const ordered = ELEMENT_ORDER.map((el) => ({
    el,
    pct: byElement[el]?.percentage ?? 0,
    color: ELEMENT_INFO[el].color,
  })).sort((a, b) => b.pct - a.pct);

  let acc = 0;
  const stops = ordered
    .filter((item) => item.pct > 0)
    .map((item) => {
      const start = acc * 3.6;
      acc += item.pct;
      const end = acc * 3.6;
      return `${item.color} ${start}deg ${end}deg`;
    });

  if (stops.length === 0) return 'var(--app-line)';
  return `conic-gradient(${stops.join(', ')})`;
}

export function ElementsSection({ sajuData }: { sajuData: ReadingRecord['sajuData'] }) {
  const dominant = sajuData.fiveElements.dominant;
  const weakest = sajuData.fiveElements.weakest;
  const dominantPercent = Math.round(sajuData.fiveElements.byElement[dominant]?.percentage ?? 0);
  const dominantColor = ELEMENT_INFO[dominant].color;
  // 글자에는 원색 대신 대비를 맞춘 변형을 쓴다(도넛 조각·범례 점은 원색 유지).
  const dominantTextColor = ELEMENT_INFO[dominant].textColor;
  const donutGradient = buildDonutGradient(sajuData);
  const supportGuide = ELEMENT_SUPPORT_GUIDE[weakest];

  return (
    <div className="space-y-5">
      {/* 오행 donut + 분포 */}
      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              五行 · 오행 균형
            </div>
            <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
              다섯 기운을 한눈에
            </h2>
          </div>
          <span
            className="rounded-[12px] border px-3 py-1 text-[12.6px] font-extrabold text-[var(--app-pink-strong)]"
            style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
          >
            {dominant}왕
          </span>
        </div>
        <article className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <div className="flex items-center gap-4">
            <div
              className="relative grid h-[124px] w-[124px] shrink-0 place-items-center rounded-full"
              style={{ background: donutGradient }}
            >
              <div
                className="absolute inset-3 grid place-items-center rounded-full bg-white"
                aria-hidden="true"
              >
                <div className="text-center">
                  <div
                    className="text-[29.9px] font-bold leading-none"
                    style={{ fontFamily: 'var(--font-han)', color: dominantTextColor }}
                  >
                    {ELEMENT_HAN[dominant]}
                  </div>
                  <div className="text-[11.5px] text-[var(--app-copy-soft)]">
                    {dominantPercent}%
                  </div>
                </div>
              </div>
            </div>
            <ul className="grid flex-1 gap-1.5" aria-label="오행 분포">
              {ELEMENT_ORDER.map((el) => {
                const pct = Math.round(sajuData.fiveElements.byElement[el]?.percentage ?? 0);
                return (
                  <li key={el} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: ELEMENT_INFO[el].color }}
                      aria-hidden="true"
                    />
                    <span
                      className="flex-1 text-[13.8px] font-bold text-[var(--app-copy)]"
                      style={{ fontFamily: 'var(--font-han)' }}
                    >
                      {el}({ELEMENT_HAN[el]})
                    </span>
                    <span className="text-[13.8px] font-extrabold text-[var(--app-ink)]">
                      {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p
            className="mt-3.5 rounded-[10px] px-3 py-2.5 text-[14.4px] leading-[1.55] text-[var(--app-pink-strong)]"
            style={{ background: 'var(--app-pink-soft)' }}
          >
            <strong>해석</strong> · {ELEMENT_INFO[dominant].name}의 리듬이 먼저 서고,{' '}
            {ELEMENT_INFO[weakest].name} 쪽은 상대적으로 비어 있어요. 채울 쪽을 의식하면 강한
            쪽도 더 또렷이 살아납니다.
          </p>
        </article>
      </section>

      {/* 균형 메모 */}
      <section>
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          균형 메모
        </div>
        <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
          이렇게 채우면 편해집니다
        </h2>
        <p className="mt-1.5 text-[14.4px] leading-[1.55] text-[var(--app-copy-muted)]">
          {supportGuide.support}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <article
            className="rounded-[14px] border p-3.5"
            style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
          >
            <div className="text-[12.6px] font-bold text-[var(--app-pink-strong)]">강한 쪽</div>
            <div
              className="mt-1 text-[17.3px] font-extrabold tracking-tight"
              style={{ color: dominantTextColor }}
            >
              {ELEMENT_INFO[dominant].name}
            </div>
            <p className="mt-1.5 text-[13.8px] leading-[1.55] text-[var(--app-copy-muted)]">
              {ELEMENT_INFO[dominant].traits.slice(0, 2).join(' · ')} 쪽 장점이 먼저 드러납니다.
            </p>
          </article>
          <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
            <div className="text-[12.6px] font-bold text-[var(--app-pink-strong)]">채울 쪽</div>
            <div
              className="mt-1 text-[17.3px] font-extrabold tracking-tight"
              style={{ color: ELEMENT_INFO[weakest].color }}
            >
              {supportGuide.label}
            </div>
            <p className="mt-1.5 text-[13.8px] leading-[1.55] text-[var(--app-copy-muted)]">
              {ELEMENT_INFO[weakest].name}을 채우는 쪽으로 하루 리듬을 잡아보세요.
            </p>
          </article>
          {supportGuide.habits.slice(0, 2).map((habit, index) => (
            <article
              key={habit}
              className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
            >
              <div className="text-[12.6px] font-bold text-[var(--app-pink-strong)]">
                작은 습관 {index + 1}
              </div>
              <p className="mt-1.5 text-[15px] font-bold leading-[1.5] text-[var(--app-ink)]">
                {habit}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
