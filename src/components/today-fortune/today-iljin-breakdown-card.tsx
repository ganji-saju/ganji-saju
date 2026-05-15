// 2026-05-15 PR 3 — 운세톡톡 벤치마크 (일진_점수산출_알고리즘_정교화.md 6-2):
// 총점뿐 아니라 영역별 점수도 노출 → "명리 신뢰도가 올라간다" 가 spec doc 의 핵심 의도.
//
// 화면:
//   [총점 67점 🙂 무난]
//   ① 천간 작용(십성)        +12
//   ② 지지 관계(합/충/형)    +8
//   ③ 용신 작용              +10
//   ④ 신살                   +5
//   ⑤ 오행 균형              +8
//   ⑥ 일주 강약 조절          -4
//   ⑦ 12운성                 +2
//   ⑧ 특수 조합              +6
//   ─────────────────────
//   + 기본점 50 = 합계 67점

import type { TodayIljinScoreSnapshot, TodayIljinMessages } from '@/lib/today-fortune/types';

interface Props {
  iljinScore: TodayIljinScoreSnapshot;
  iljinMessages?: TodayIljinMessages | null;
}

const ROWS: Array<{
  key: keyof TodayIljinScoreSnapshot['breakdown'];
  label: string;
  detail: string;
}> = [
  { key: 'cheongan', label: '① 천간 작용 (십성)', detail: '일간 vs 일진 천간' },
  { key: 'jiji', label: '② 지지 관계', detail: '합·충·형·해·파·원진' },
  { key: 'ohaeng', label: '③ 용신·기신', detail: '일진 오행이 용신인지' },
  { key: 'sinsal', label: '④ 신살 발동', detail: '천을귀인·양인·백호 등' },
  { key: 'balance', label: '⑤ 오행 균형', detail: '부족/과다 보충 여부' },
  { key: 'regulation', label: '⑥ 일주 강약 조절', detail: '신강↔식상·신약↔비겁' },
  { key: 'unsung', label: '⑦ 12운성', detail: '장생·건록 ↔ 사·묘·절' },
  { key: 'special', label: '⑧ 특수 조합', detail: '식신생재·재생관·관인상생' },
];

function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return String(n);
  return '0';
}

function valueColor(n: number): string {
  if (n > 0) return 'var(--app-jade)';
  if (n < 0) return 'var(--app-coral)';
  return 'var(--app-copy-soft)';
}

export function TodayIljinBreakdownCard({ iljinScore, iljinMessages }: Props) {
  const sum =
    iljinScore.breakdown.cheongan +
    iljinScore.breakdown.jiji +
    iljinScore.breakdown.ohaeng +
    iljinScore.breakdown.sinsal +
    iljinScore.breakdown.balance +
    iljinScore.breakdown.regulation +
    iljinScore.breakdown.unsung +
    iljinScore.breakdown.special;

  return (
    <section
      className="rounded-[18px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
      aria-label="일진 점수 산출 내역"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            📊 점수 산출 내역
          </div>
          <h2
            className="mt-0.5 text-[15.5px] font-extrabold text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            오늘 점수가 이렇게 나온 이유
          </h2>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-[18px]">
              {iljinScore.gradeEmoji}
            </span>
            <span className="text-[22px] font-extrabold tabular-nums text-[var(--app-ink)]">
              {iljinScore.totalScore}
            </span>
          </div>
          <div className="text-[10.5px] font-extrabold text-[var(--app-copy-soft)]">
            {iljinScore.grade}
          </div>
        </div>
      </div>

      <p
        className="mt-2 rounded-[10px] px-3 py-2 text-[12px] leading-[1.55] text-[var(--app-copy)]"
        style={{ background: 'var(--app-pink-soft)', wordBreak: 'keep-all' }}
      >
        {iljinScore.gradeMessage}
      </p>

      <ul className="mt-3 divide-y divide-[var(--app-line)]">
        {ROWS.map((row) => {
          const val = iljinScore.breakdown[row.key];
          return (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <div
                  className="text-[12.5px] font-extrabold text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {row.label}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">{row.detail}</div>
              </div>
              <div
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-extrabold tabular-nums"
                style={{
                  background: val > 0 ? 'rgba(45,135,88,0.10)' : val < 0 ? 'rgba(220,79,79,0.10)' : 'transparent',
                  color: valueColor(val),
                }}
              >
                {formatSigned(val)}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2.5 flex items-center justify-between border-t border-[var(--app-line)] pt-2.5 text-[12px] text-[var(--app-copy-muted)]">
        <span>+ 기본점 50 + 합 {formatSigned(sum)}</span>
        <span className="font-extrabold text-[var(--app-ink)]">
          = {iljinScore.totalScore}점
        </span>
      </div>

      {iljinMessages && iljinMessages.messages.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
            오늘 발동한 명리 케이스
          </div>
          <ul className="mt-1.5 grid gap-1.5">
            {iljinMessages.messages.map((msg, idx) => (
              <li
                key={idx}
                className="rounded-[12px] border px-3 py-2 text-[12px] leading-[1.6] text-[var(--app-copy)]"
                style={{
                  borderColor: 'var(--app-line)',
                  background: 'rgba(0,0,0,0.02)',
                  wordBreak: 'keep-all',
                }}
              >
                {msg}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
