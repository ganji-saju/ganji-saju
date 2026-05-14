// 2026-05-14: saju-data/v2 의 modern interpretation 을 그대로 노출하는
// 표시 컴포넌트. v1 데이터만 있는 경우에도 안전하게 동작하도록 wrapper 가
// 자동으로 v2 로 업그레이드한 뒤 렌더링한다.
//
// 사용 예:
//   const v2 = loadSajuDataV2(input, storedV1OrV2);
//   <SajuV2InsightPanel data={v2} />
//
// 또는 v1 데이터만 가진 화면이라면:
//   <SajuV2InsightPanel data={v1OrV2} now={new Date().toISOString()} />
//
// design language: PR6+ pink-soft hero + tone-colored blocks + evidence
// chevron <details> + verification status badge.
import {
  upgradeSajuDataV1ToV2,
  type SajuClaimConfidence,
  type SajuDataV1,
  type SajuDataV2,
  type SajuInterpretationBlock,
  type SajuVerificationReport,
  type SajuVerifiedClaim,
} from '@/domain/saju/engine';
import { FRIENDLY_UI_LABEL } from '@/lib/saju/terminology';

interface Props {
  /** SajuDataV2 가 가장 안전. v1 이 들어오면 자동으로 업그레이드. */
  data: SajuDataV1 | SajuDataV2;
  /** v1 → v2 업그레이드 시 사용할 시각 ISO. 기본값 현재 시각. */
  now?: string;
  /** verification.status 가 fail 인 경우 본문 노출 정책.
   *  'block' = 본문 숨김 + 경고만 / 'warn-only' = 경고 + 본문 그대로 / 'ignore' = 무시. */
  failPolicy?: 'block' | 'warn-only' | 'ignore';
}

function isV2(data: SajuDataV1 | SajuDataV2): data is SajuDataV2 {
  return (
    (data as SajuDataV2).schemaVersion === 'saju-data/v2' &&
    Boolean((data as SajuDataV2).interpretation) &&
    Boolean((data as SajuDataV2).verification)
  );
}

// block.id 에 따른 톤 컬러 매핑 (v2 의 4개 block id 와 1:1). eyebrow 는
// 2026-05-14 친근 용어로 통일 — "기본 성향/오행/용신/흐름" 같은 한자 술어는
// 노출하지 않는다.
const BLOCK_TONE: Record<
  string,
  { accent: string; soft: string; border: string; eyebrow: string }
> = {
  foundation: {
    accent: 'var(--app-pink-strong)',
    soft: 'var(--app-pink-soft)',
    border: 'var(--app-pink-line)',
    eyebrow: '내 결',
  },
  'five-elements-balance': {
    accent: 'var(--app-jade)',
    soft: '#e8f5ee',
    border: 'rgba(45,135,88,0.22)',
    eyebrow: '다섯 기운',
  },
  pattern: {
    accent: 'var(--app-plum)',
    soft: '#f3eefb',
    border: 'rgba(127,92,176,0.22)',
    eyebrow: '반복 역할',
  },
  yongsin: {
    accent: '#b87a14',
    soft: '#fdf6e7',
    border: 'rgba(184,122,20,0.22)',
    eyebrow: '도움 기운',
  },
  'luck-flow': {
    accent: '#4a5cb8',
    soft: '#eef0fb',
    border: 'rgba(74,92,184,0.22)',
    eyebrow: '지금 흐름',
  },
};

const FALLBACK_TONE = {
  accent: 'var(--app-pink-strong)',
  soft: 'var(--app-pink-soft)',
  border: 'var(--app-pink-line)',
  eyebrow: FRIENDLY_UI_LABEL.blockDefaultEyebrow,
};

const CONFIDENCE_LABEL: Record<SajuClaimConfidence, string> = {
  high: '꽤 확실',
  medium: '비교적 확실',
  low: '참고용',
};

function getTone(blockId: string) {
  return BLOCK_TONE[blockId] ?? FALLBACK_TONE;
}

function VerificationBadge({ report }: { report: SajuVerificationReport }) {
  const label =
    report.status === 'pass'
      ? FRIENDLY_UI_LABEL.verificationPass
      : report.status === 'pass-with-warnings'
        ? FRIENDLY_UI_LABEL.verificationWarning
        : FRIENDLY_UI_LABEL.verificationFail;
  const palette =
    report.status === 'pass'
      ? { bg: '#e8f5ee', fg: 'var(--app-jade)', border: 'rgba(45,135,88,0.28)' }
      : report.status === 'pass-with-warnings'
        ? { bg: '#fdf6e7', fg: '#b87a14', border: 'rgba(184,122,20,0.28)' }
        : { bg: '#fdecec', fg: 'var(--app-coral)', border: 'rgba(198,69,69,0.28)' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold"
      style={{ background: palette.bg, color: palette.fg, borderColor: palette.border }}
    >
      <span aria-hidden="true">
        {report.status === 'pass' ? '✓' : report.status === 'pass-with-warnings' ? '!' : '×'}
      </span>
      {label} · {report.score}점
    </span>
  );
}

function ClaimRow({
  claim,
  tone,
}: {
  claim: SajuVerifiedClaim;
  tone: ReturnType<typeof getTone>;
}) {
  return (
    <article
      className="rounded-[14px] border bg-white p-3.5"
      style={{ borderColor: tone.border }}
    >
      <div className="flex items-start gap-2">
        <span
          className="grid h-5 shrink-0 items-center rounded-full border bg-white px-2 text-[9.5px] font-extrabold"
          style={{ borderColor: tone.border, color: tone.accent }}
        >
          {FRIENDLY_UI_LABEL.confidenceLabel} · {CONFIDENCE_LABEL[claim.confidence]}
        </span>
      </div>
      <p
        className="mt-2 text-[13.5px] leading-[1.75] text-[var(--app-ink)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {claim.text}
      </p>
      {claim.caveat ? (
        <p
          className="mt-1.5 rounded-[10px] px-2.5 py-1.5 text-[11.5px] leading-[1.65] text-[var(--app-copy-muted)]"
          style={{
            background: 'rgba(0,0,0,0.03)',
            wordBreak: 'keep-all',
          }}
        >
          ⓘ {FRIENDLY_UI_LABEL.caveatPrefix} — {claim.caveat}
        </p>
      ) : null}

      <details className="group mt-2">
        <summary
          className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] border bg-white px-3 py-2 text-[11px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: tone.border }}
        >
          <span>{FRIENDLY_UI_LABEL.evidenceCount(claim.evidence.length)}</span>
          <span className="text-[9px] transition-transform group-open:rotate-180" aria-hidden="true">
            ▼
          </span>
        </summary>
        <ul className="mt-1.5 grid gap-1">
          {claim.evidence.map((ev) => (
            <li
              key={ev.path}
              className="rounded-[10px] border bg-white px-3 py-2 text-[11.5px] leading-[1.55] text-[var(--app-copy)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
                {ev.path}
              </span>
              <span
                className="mt-0.5 block text-[12px] font-bold text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {ev.label}
                {ev.value !== undefined && ev.value !== null ? (
                  <span className="ml-1.5 text-[11px] font-extrabold" style={{ color: tone.accent }}>
                    {String(ev.value)}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function Block({ block }: { block: SajuInterpretationBlock }) {
  const tone = getTone(block.id);

  return (
    <section
      className="rounded-[18px] border bg-white p-4 sm:p-5"
      style={{ borderColor: tone.border }}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11.5px] font-extrabold text-white"
          style={{
            background: tone.accent,
            boxShadow: `0 6px 14px ${tone.accent}40`,
          }}
          aria-hidden="true"
        >
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
            style={{ color: tone.accent }}
          >
            {tone.eyebrow}
          </div>
          <h3 className="text-[16px] font-extrabold text-[var(--app-ink)]">{block.title}</h3>
        </div>
      </div>

      <p
        className="mt-2 text-[13px] leading-[1.7] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {block.summary}
      </p>

      {block.claims.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {block.claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} tone={tone} />
          ))}
        </div>
      ) : null}

      {block.actions.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            오늘부터 작게 해볼 일
          </div>
          <ul className="mt-1.5 grid gap-1.5">
            {block.actions.map((action) => (
              <li
                key={action}
                className="flex items-start gap-2 rounded-[10px] border bg-white px-3 py-2 text-[12.5px] leading-[1.65] text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)', wordBreak: 'keep-all' }}
              >
                <span
                  className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: tone.accent }}
                  aria-hidden="true"
                />
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {block.antiClaims.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
            {FRIENDLY_UI_LABEL.antiClaimsTitle}
          </div>
          <ul className="mt-1.5 grid gap-1">
            {block.antiClaims.map((line) => (
              <li
                key={line}
                className="rounded-[10px] border px-3 py-2 text-[11.5px] leading-[1.6] text-[var(--app-ink)]"
                style={{
                  background: '#fdecec',
                  borderColor: 'rgba(198,69,69,0.18)',
                  wordBreak: 'keep-all',
                }}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function SajuV2InsightPanel({ data, now, failPolicy = 'warn-only' }: Props) {
  // v1 으로 들어오면 v2 로 자동 업그레이드.
  const v2: SajuDataV2 = isV2(data)
    ? data
    : upgradeSajuDataV1ToV2(data, { now });

  const { interpretation, verification } = v2;
  const isFailHidden = failPolicy === 'block' && verification.status === 'fail';

  return (
    <section id="saju-v2-insight" className="space-y-3">
      {/* §Hero — pink-soft + 검증 배지 + executiveSummary */}
      <article
        className="relative overflow-hidden rounded-[20px] border p-5"
        style={{
          background: 'linear-gradient(180deg, var(--app-pink-soft) 0%, #fff 100%)',
          borderColor: 'var(--app-pink-line)',
          boxShadow: '0 22px 50px -28px rgba(216,27,114,0.22)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,79,154,0.18), transparent 70%)' }}
        />

        <div className="relative flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[22px] font-extrabold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
              boxShadow: '0 10px 22px rgba(216,27,114,0.32)',
              fontFamily: 'var(--font-han)',
            }}
            aria-hidden="true"
          >
            干
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-extrabold text-[var(--app-pink-strong)]"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                ✦ 한 줄 요약
              </span>
              <VerificationBadge report={verification} />
            </div>
            <p
              className="mt-2 text-[14.5px] leading-[1.78] font-bold text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {interpretation.executiveSummary}
            </p>
          </div>
        </div>
      </article>

      {/* §검증 실패 시 경고 banner */}
      {verification.status === 'fail' ? (
        <div
          className="rounded-[14px] border p-4"
          style={{
            background: '#fdecec',
            borderColor: 'rgba(198,69,69,0.28)',
          }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
            ⚠ 풀이 점검에 문제가 있어요
          </div>
          <p
            className="mt-1.5 text-[13px] leading-[1.7] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            풀이를 만드는 과정에서 {verification.summary.errors}건의 문제가 있었어요. 본문을 그대로 믿기보다, 다시 계산하는 편이 안전해요.
          </p>
          {verification.issues.length > 0 ? (
            <details className="group mt-2.5">
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] border bg-white px-3 py-2 text-[11.5px] font-extrabold text-[var(--app-coral)]"
                style={{ borderColor: 'rgba(198,69,69,0.28)' }}
              >
                <span>문제 자세히 보기 ({verification.issues.length}건)</span>
                <span className="text-[9px] transition-transform group-open:rotate-180" aria-hidden="true">
                  ▼
                </span>
              </summary>
              <ul className="mt-1.5 grid gap-1">
                {verification.issues.slice(0, 8).map((issue) => (
                  <li
                    key={`${issue.code}-${issue.path}`}
                    className="rounded-[10px] border bg-white px-3 py-2 text-[11.5px] leading-[1.55] text-[var(--app-copy)]"
                    style={{ borderColor: 'var(--app-line)' }}
                  >
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-coral)]">
                      {issue.severity} · {issue.code}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-bold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
                      {issue.path}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-[var(--app-copy-muted)]" style={{ wordBreak: 'keep-all' }}>
                      {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {/* §본문 blocks (실패 + block 정책 시 숨김) */}
      {!isFailHidden ? (
        <div className="space-y-3">
          {interpretation.blocks.map((block) => (
            <Block key={block.id} block={block} />
          ))}
        </div>
      ) : null}

      {/* §다음에 할 일 (nextBestActions) */}
      {interpretation.nextBestActions.length > 0 && !isFailHidden ? (
        <article
          className="rounded-[18px] border p-5 text-white"
          style={{
            background: 'var(--app-ink)',
            boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
          }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
            style={{ color: 'var(--app-pink)' }}
          >
            {FRIENDLY_UI_LABEL.nextStepsTitle}
          </div>
          <h3 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-tight">
            가장 먼저 시작해보면 좋아요
          </h3>
          <ul className="mt-3 grid gap-1.5">
            {interpretation.nextBestActions.map((action, index) => (
              <li
                key={action}
                className="flex items-start gap-2 rounded-[10px] px-3 py-2 text-[12.5px] leading-[1.7]"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.92)',
                  wordBreak: 'keep-all',
                }}
              >
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white"
                  style={{ background: 'var(--app-pink)' }}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {action}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {/* §Disclaimers */}
      {interpretation.disclaimers.length > 0 ? (
        <details
          className="group rounded-[12px] border bg-white"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[11.5px] font-extrabold text-[var(--app-copy-muted)]">
            <span>{FRIENDLY_UI_LABEL.disclaimers} ({interpretation.disclaimers.length})</span>
            <span className="text-[10px] transition-transform group-open:rotate-180" aria-hidden="true">
              ▼
            </span>
          </summary>
          <div className="border-t border-[var(--app-line)] px-4 py-3">
            <ul className="grid gap-1.5">
              {interpretation.disclaimers.map((line) => (
                <li
                  key={line}
                  className="text-[11.5px] leading-[1.65] text-[var(--app-copy-soft)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  · {line}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </section>
  );
}
