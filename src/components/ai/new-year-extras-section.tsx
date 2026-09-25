// 2026-09-26 — 2027 신년운세 부가 섹션(가족·학업·분기·기대/조심). 서버가 full 티어(신년운세·평생 구매자)에만
//   interpretation.newYear 를 내려보내므로, 이 컴포넌트는 받은 것만 그린다(여기서 권한을 판단하지 않는다).
//   ⚠️ 서버 모듈은 type 만 가져온다 — 값 import 는 클라이언트 번들에 서버 코드를 끌고 온다.
import type {
  NewYearHighlight,
  NewYearHighlightCategory,
  SajuNewYearExtras,
} from '@/server/ai/saju-yearly-interpretation';

const CATEGORY_LABEL: Record<NewYearHighlightCategory, string> = {
  work: '일·직업운',
  wealth: '재물운',
  love: '연애·결혼운',
  relationship: '인간관계운',
  health: '건강운',
  move: '이동·변화운',
  family: '가족운',
  study: '학업·시험운',
};

function HighlightList({
  title,
  items,
  tone,
}: {
  title: string;
  items: NewYearHighlight[];
  tone: 'good' | 'caution';
}) {
  return (
    <article
      className={`rounded-[16px] border px-4 py-3.5 ${tone === 'good' ? 'yearly-tone-good' : 'yearly-tone-caution'}`}
    >
      <h3 className="text-[15.5px] font-extrabold">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li
            key={`${item.month}-${item.category}-${item.text}`}
            className="rounded-[12px] bg-white/70 px-3.5 py-2.5"
          >
            <div className="text-[13.8px] font-extrabold">
              {item.month}월 · {CATEGORY_LABEL[item.category]}
            </div>
            <p className="mt-1 text-[14.4px] leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
              {item.text}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function AreaCard({ label, body }: { label: string; body: string }) {
  return (
    <article className="rounded-[18px] border bg-white p-5" style={{ borderColor: 'var(--app-line)' }}>
      <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        {label}
      </div>
      <p className="mt-2 text-[15px] leading-[1.75] text-[var(--app-copy)]" style={{ wordBreak: 'keep-all' }}>
        {body}
      </p>
    </article>
  );
}

export function NewYearExtrasSection({
  extras,
  part,
  year,
}: {
  extras: SajuNewYearExtras;
  part: 'areas' | 'quarters';
  /** 풀이 대상 연도 — 평생운세 안에서는 올해, 신년운세에서는 2027. */
  year: number;
}) {
  if (part === 'quarters') {
    return (
      <section className="rounded-[18px] border bg-white p-5" style={{ borderColor: 'var(--app-line)' }}>
        <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          분기별 흐름
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {extras.quarterlyFlows.map((q) => (
            <article
              key={q.quarter}
              data-quarter={q.quarter}
              className="rounded-[14px] border px-4 py-3"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[14.4px] font-extrabold text-[var(--app-ink)]">
                {q.quarter}분기 · {q.months[0]}~{q.months[2]}월
              </div>
              <p className="mt-1.5 text-[14.4px] leading-[1.7] text-[var(--app-copy)]" style={{ wordBreak: 'keep-all' }}>
                {q.summary}
              </p>
              <div className="mt-1.5 text-[12.6px] font-bold text-[var(--app-copy-muted)]">
                먼저 볼 분야 · {CATEGORY_LABEL[q.focusCategory]}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="grid gap-2.5">
        <AreaCard label={CATEGORY_LABEL.family} body={extras.categories.family} />
        <AreaCard label={CATEGORY_LABEL.study} body={extras.categories.study} />
      </div>
      <div className="grid gap-2.5">
        <HighlightList title={`${year}년에 기대할 일`} items={extras.expectations} tone="good" />
        <HighlightList title={`${year}년에 조심할 일`} items={extras.cautions} tone="caution" />
      </div>
    </>
  );
}
