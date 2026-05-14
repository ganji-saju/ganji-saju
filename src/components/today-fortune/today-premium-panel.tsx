// Redesign 2026-05-14 (PR6+ 디자인 언어 통일):
// /today-fortune/detail 의 핵심 콘텐츠 패널.
// 기존: emerald-50/rose-50/surface-muted 하드코딩 + 작은 글씨 + 빽빽한 4섹션.
// 변경: pink-soft hero + 토큰 컬러(jade/coral/amber/indigo)별 섹션 +
//       18-21px 제목 / 14px 본문 / 1.7 line-height 가독성 강화.
import type { TodayFortunePremiumResult } from '@/lib/today-fortune/types';

function trimEasySentence(value: string) {
  const cleaned = value
    .replace(/시간대별/g, '')
    .replace(/선택 시나리오/g, '고민되는 상황')
    .replace(/시나리오/g, '상황')
    .replace(/유리/g, '좋은')
    .replace(/주의/g, '조심')
    .replace(/권장/g, '추천')
    .replace(/흐름/g, '분위기')
    .replace(/기준/g, '생각할 점')
    .replace(/밀어붙이/g, '무리하게 진행하')
    .replace(/밀기보다/g, '무리하기보다')
    .replace(/밀어도 되는/g, '진행하기 좋은')
    .replace(/밀어도/g, '진행해도')
    .replace(/밀고/g, '진행하고')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const sentences = cleaned
    .split(/(?<=[.!?。])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.slice(0, 2).join(' ') || cleaned;
}

// 토큰 기반 섹션 색상 정의
const TONE_PALETTE = {
  jade: {
    bg: '#e8f5ee',
    accent: 'var(--app-jade)',
    border: 'rgba(45, 135, 88, 0.18)',
    inner: 'rgba(45, 135, 88, 0.22)',
  },
  coral: {
    bg: '#fdecec',
    accent: 'var(--app-coral)',
    border: 'rgba(198, 69, 69, 0.18)',
    inner: 'rgba(198, 69, 69, 0.22)',
  },
  amber: {
    bg: '#fdf6e7',
    accent: '#b87a14',
    border: 'rgba(184, 122, 20, 0.20)',
    inner: 'rgba(184, 122, 20, 0.24)',
  },
  indigo: {
    bg: '#eef0fb',
    accent: '#4a5cb8',
    border: 'rgba(74, 92, 184, 0.20)',
    inner: 'rgba(74, 92, 184, 0.24)',
  },
} as const;

function ToneSection({
  tone,
  eyebrow,
  children,
}: {
  tone: keyof typeof TONE_PALETTE;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const palette = TONE_PALETTE[tone];
  return (
    <article
      className="rounded-[18px] border p-4 sm:p-5"
      style={{
        background: palette.bg,
        borderColor: palette.border,
      }}
    >
      <div
        className="text-[11px] font-extrabold uppercase tracking-[0.06em]"
        style={{ color: palette.accent }}
      >
        {eyebrow}
      </div>
      <div className="mt-3 space-y-2.5">{children}</div>
    </article>
  );
}

function ToneInnerCard({
  tone,
  title,
  body,
  range,
}: {
  tone: keyof typeof TONE_PALETTE;
  title: string;
  body: string;
  range?: string;
}) {
  const palette = TONE_PALETTE[tone];
  return (
    <div
      className="rounded-[14px] border bg-white p-3.5"
      style={{ borderColor: palette.inner }}
    >
      {range ? (
        <div
          className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
          style={{ color: palette.accent }}
        >
          {range}
        </div>
      ) : null}
      <div
        className="break-keep text-[14.5px] font-extrabold leading-[1.55] text-[var(--app-ink)]"
        style={{ marginTop: range ? '0.45rem' : 0 }}
      >
        {title}
      </div>
      <p className="mt-1.5 break-keep text-[13px] leading-[1.7] text-[var(--app-copy)]">
        {body}
      </p>
    </div>
  );
}

function ActionRow({
  text,
  tone,
  index,
}: {
  text: string;
  tone: keyof typeof TONE_PALETTE;
  index: number;
}) {
  const palette = TONE_PALETTE[tone];
  return (
    <div
      className="flex items-start gap-3 rounded-[14px] border bg-white px-3.5 py-3"
      style={{ borderColor: palette.inner }}
    >
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
        style={{ background: palette.accent }}
        aria-hidden="true"
      >
        {index + 1}
      </span>
      <p className="break-keep text-[13.5px] leading-[1.7] text-[var(--app-copy)]">
        {text}
      </p>
    </div>
  );
}

export function TodayPremiumPanel({
  result,
}: {
  result: TodayFortunePremiumResult;
}) {
  const favorableWindows = result.favorableWindows.slice(0, 2);
  const cautionWindows = result.cautionWindows.slice(0, 1);
  const recommendedActions = result.recommendedActions.slice(0, 3).map(trimEasySentence);
  const avoidActions = result.avoidActions.slice(0, 3).map(trimEasySentence);
  const scenarios = result.scenarios.slice(0, 2);

  return (
    <div className="space-y-4">
      {/* §Hero — pink-soft 헤더 */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              오늘 자세히 보기
            </div>
            <h2
              className="mt-1.5 text-[20px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              오늘은 이렇게
              <br />
              움직이면 좋아요
            </h2>
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white"
            style={{
              background: 'var(--app-pink)',
              boxShadow: '0 6px 14px rgba(216,27,114,0.28)',
            }}
          >
            ✦ 1코인
          </span>
        </div>
      </article>

      {/* §시간대 — jade + coral */}
      <ToneSection tone="jade" eyebrow="좋은 시간">
        {favorableWindows.map((item) => (
          <ToneInnerCard
            key={`${item.range}-${item.title}`}
            tone="jade"
            range={item.range}
            title={trimEasySentence(item.title)}
            body={trimEasySentence(item.body)}
          />
        ))}
      </ToneSection>

      <ToneSection tone="coral" eyebrow="조심할 시간">
        {cautionWindows.map((item) => (
          <ToneInnerCard
            key={`${item.range}-${item.title}`}
            tone="coral"
            range={item.range}
            title={trimEasySentence(item.title)}
            body={trimEasySentence(item.body)}
          />
        ))}
      </ToneSection>

      {/* §행동 — amber + indigo */}
      <ToneSection tone="amber" eyebrow="오늘 해볼 것">
        {recommendedActions.map((item, index) => (
          <ActionRow key={item} text={item} tone="amber" index={index} />
        ))}
      </ToneSection>

      <ToneSection tone="indigo" eyebrow="오늘 줄일 것">
        {avoidActions.map((item, index) => (
          <ActionRow key={item} text={item} tone="indigo" index={index} />
        ))}
      </ToneSection>

      {/* §시나리오 — pink-soft */}
      <article
        className="rounded-[18px] border p-4 sm:p-5"
        style={{
          background: '#fff',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          고민될 때
        </div>
        <div className="mt-3 grid gap-2.5">
          {scenarios.map((scenario) => (
            <section
              key={scenario.title}
              className="rounded-[14px] border p-3.5"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div
                className="break-keep text-[14.5px] font-extrabold leading-[1.5] text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {trimEasySentence(scenario.title)}
              </div>
              <p className="mt-2.5 break-keep text-[13px] leading-[1.7] text-[var(--app-copy)]">
                <span className="font-extrabold text-[var(--app-pink-strong)]">
                  이렇게 해보세요.{' '}
                </span>
                {trimEasySentence(scenario.better)}
              </p>
              <p className="mt-1.5 break-keep text-[12.5px] leading-[1.65] text-[var(--app-copy-soft)]">
                <span className="font-extrabold text-[var(--app-ink)]">
                  이건 줄여요.{' '}
                </span>
                {trimEasySentence(scenario.watch)}
              </p>
            </section>
          ))}
        </div>
      </article>

      {/* §풀이 기준 — collapsible */}
      <details
        className="group rounded-[14px] border bg-white"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <summary
          className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[12.5px] font-extrabold text-[var(--app-copy-muted)]"
        >
          <span>풀이 기준 보기</span>
          <span
            className="text-[10px] transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ▼
          </span>
        </summary>
        <div className="border-t border-[var(--app-line)] px-4 py-3.5">
          <p className="text-[12px] leading-[1.7] text-[var(--app-copy-soft)]">
            오늘 분위기와 입력 정보를 함께 참고해 정리했습니다.
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.7] text-[var(--app-copy-soft)]">
            {result.safetyNote}
          </p>
        </div>
      </details>
    </div>
  );
}
