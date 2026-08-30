// 2026-08-31 — LLM 한도 경보 배너. /admin 랜딩과 /admin/llm-cost 양쪽에 건다.
//   한 곳에만 걸면 그 화면을 안 여는 날엔 8/31(사용자 제보로 알게 된 장애)이 반복된다.
//
//   대비 실측(2026-08-30 '버튼 글자가 안 보인다' 재발 방지):
//     칩 배경 --app-coral #c25438 + 흰 글자 = 4.55 : 1
//     칩 배경 --app-amber #b07c22 + --app-ink #1c1a17 = 4.75 : 1
//   색을 바꾸려면 다시 재보고 바꿀 것.
import Link from 'next/link';
import type { LlmQuotaAlert } from '@/lib/admin/llm-quota-alert';

const TONE = {
  critical: { border: 'var(--app-coral)', chipBg: 'var(--app-coral)', chipInk: '#ffffff', label: '긴급' },
  warn: { border: 'var(--app-amber)', chipBg: 'var(--app-amber)', chipInk: 'var(--app-ink)', label: '주의' },
  ok: { border: 'var(--app-line)', chipBg: 'var(--app-line)', chipInk: 'var(--app-ink)', label: '신호 없음' },
} as const;

export function LlmQuotaBanner({
  alert,
  withLink = true,
}: {
  alert: LlmQuotaAlert;
  withLink?: boolean;
}) {
  const tone = TONE[alert.level];
  return (
    <section
      className="rounded-[14px] bg-white p-4"
      style={{ border: `2px solid ${tone.border}` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11.5px] font-extrabold"
          style={{ background: tone.chipBg, color: tone.chipInk }}
        >
          {tone.label}
        </span>
        <h2 className="text-[14px] font-extrabold text-[var(--app-ink)]">{alert.headline}</h2>
        {withLink ? (
          <Link
            href="/admin/llm-cost"
            className="ml-auto text-[13px] font-bold text-[var(--app-pink-strong)] underline"
          >
            LLM 비용 보기
          </Link>
        ) : null}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--app-copy-soft)]">
        {alert.detail}
      </p>
    </section>
  );
}
