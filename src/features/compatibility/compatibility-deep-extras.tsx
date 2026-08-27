// 2026-08-27 — 유료 궁합에 붙는 두 블록: **무엇에 맞는가**(§9) · **언제 움직이면 좋은가**(§10).
//
//   🔴 사용자 제보: "이 궁합으로 사람들이 알고자 하는 건 진짜 잘 어울리는지, 같이 뭘 해도
//   (결혼·사업·동업·관계유지) 되는지, 언제 어떻게 하면 좋을지, 좋은 해·달과 안 좋은 해·달인데
//   그런 설명은 하나도 없어." 기존 유료 §8 은 4축 실천 조언뿐이라 그 답이 없었다.
//
//   렌더 없는 순수 표시 컴포넌트 — 계산은 서버(couple-fit / couple-timing)에서 끝난다.
import type { CoupleFitItem } from '@/lib/compatibility/couple-fit';
import type { CoupleMonth, CoupleTimingReport } from '@/lib/compatibility/couple-timing';

const GRADE_COLOR: Record<CoupleFitItem['grade'], string> = {
  strong: 'var(--app-jade)',
  workable: 'var(--app-amber)',
  careful: 'var(--app-coral)',
};

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">{title}</h2>
      <p className="mt-1 text-[15px] text-[var(--app-copy-muted)]">{desc}</p>
    </div>
  );
}

export function CoupleFitSection({ items }: { items: CoupleFitItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle
        title="함께 무엇을 하면 좋을까"
        desc="같은 두 사람이라도 결혼과 동업은 판단이 다릅니다"
      />
      <div className="mt-3 grid gap-2.5">
        {items.map((item) => {
          const color = GRADE_COLOR[item.grade];
          return (
            <article
              key={item.key}
              className="rounded-[14px] border border-[var(--app-line)] bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[16.1px] font-extrabold text-[var(--app-ink)]">
                  {item.label}
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[12.6px] font-extrabold text-white"
                  style={{ background: color }}
                >
                  {item.gradeLabel}
                </span>
              </div>
              <div
                className="relative mt-2.5 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--app-line)' }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${item.score}%`, background: color }}
                />
              </div>
              <p className="mt-2.5 break-keep text-[15px] leading-[1.65] text-[var(--app-copy)]">
                {item.reason}
              </p>
              {/* 판단만 던지면 점집이고, 조건을 주면 풀이다 — 조건을 강조해서 둔다. */}
              <p
                className="mt-2 break-keep rounded-[12px] px-3 py-2.5 text-[15px] leading-[1.6]"
                style={{ background: 'var(--app-pink-soft)', color: 'var(--app-pink-strong)' }}
              >
                {item.condition}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MonthCard({ month, accent }: { month: CoupleMonth; accent: string }) {
  return (
    <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[12.6px] font-extrabold text-white"
          style={{ background: accent }}
        >
          {month.label}
        </span>
        <span className="break-keep text-[15.5px] font-bold text-[var(--app-ink)]">
          {month.title}
        </span>
      </div>
      <p className="mt-2 break-keep text-[15px] leading-[1.65] text-[var(--app-copy-muted)]">
        {month.body}
      </p>
    </article>
  );
}

export function CoupleTimingSection({ timing }: { timing: CoupleTimingReport }) {
  return (
    <section>
      <SectionTitle
        title="언제 움직이면 좋을까"
        desc={`${timing.year}년 두 분의 흐름을 겹쳐 본 결과입니다`}
      />

      {/* 연 전망 먼저 — "올해 해도 되나" 가 달보다 앞선 질문이다. */}
      <div className="mt-3 grid gap-2">
        {timing.years.map((year) => (
          <article
            key={year.year}
            className="flex items-start gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
          >
            <span className="shrink-0 text-[15px] font-extrabold text-[var(--app-pink-strong)]">
              {year.label}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15.5px] font-bold text-[var(--app-ink)]">{year.verdict}</div>
              <p className="mt-1 break-keep text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
                {year.body}
              </p>
            </div>
          </article>
        ))}
      </div>

      {timing.bestMonths.length > 0 ? (
        <>
          <h3 className="mt-5 text-[15.5px] font-extrabold text-[var(--app-jade)]">
            함께 움직이기 좋은 달
          </h3>
          <div className="mt-2 grid gap-2.5">
            {timing.bestMonths.map((month) => (
              <MonthCard key={month.month} month={month} accent="var(--app-jade)" />
            ))}
          </div>
        </>
      ) : null}

      {timing.cautionMonths.length > 0 ? (
        <>
          <h3 className="mt-5 text-[15.5px] font-extrabold text-[var(--app-coral)]">
            무리하지 않는 편이 나은 달
          </h3>
          <div className="mt-2 grid gap-2.5">
            {timing.cautionMonths.map((month) => (
              <MonthCard key={month.month} month={month} accent="var(--app-coral)" />
            ))}
          </div>
        </>
      ) : null}

      {timing.mixedMonths.length > 0 ? (
        <>
          <h3 className="mt-5 text-[15.5px] font-extrabold text-[var(--app-amber)]">
            한 사람이 끌어야 하는 달
          </h3>
          <div className="mt-2 grid gap-2.5">
            {timing.mixedMonths.map((month) => (
              <MonthCard key={month.month} month={month} accent="var(--app-amber)" />
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-3 break-keep text-[15px] leading-[1.6] text-[var(--app-copy-soft)]">
        달의 흐름은 결정을 대신해 주지 않습니다. 같은 일을 언제 꺼내면 덜 부딪히는지를 보는
        참고 자료로 쓰시는 편이 좋습니다.
      </p>
    </section>
  );
}
