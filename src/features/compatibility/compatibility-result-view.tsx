// Redesign 2026-05-13 (Claude Design / screens-b.jsx ScreenGunghap):
// pink-soft hero + 두 사람 ZodiacChip pair + conic-gradient 궁합 점수 donut +
// practicalCards 4축 bar list + ink-dark premium upsell.
// 데이터·라우팅 무수정.
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import {
  COMPATIBILITY_PREMIUM_EXPANSION,
  type CompatibilityRelationship,
} from '@/content/moonlight';
import type { CompatibilityInterpretation } from '@/lib/compatibility';
import type { BirthInput } from '@/lib/saju/types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { CompatibilityDeepSections } from '@/features/compatibility/compatibility-deep-sections';
import { Price } from '@/components/payments/price-provider';

interface CompatibilityResultViewProps {
  selected: CompatibilityRelationship;
  compatibility: CompatibilityInterpretation;
  selfName: string;
  partnerName: string;
  selfBirthSummary: string;
  partnerBirthSummary: string;
  retakeHref?: string;
  hasLoveQuestionPurchase?: boolean;
  /** ②-b: 깊은 풀이 LLM 강화용. 두 값이 있고 deepLlmEnabled 면 §8 에서 비동기 LLM 호출. */
  selfBirthInput?: BirthInput;
  partnerBirthInput?: BirthInput;
  deepLlmEnabled?: boolean;
  /** ①: per-couple 1회권. 플래그 ON + 커플 키가 있으면 CTA 가 compat-reading(커플 단위)을 판매. */
  compatibilityCoupleKey?: string;
  perCouplePricingEnabled?: boolean;
}

const BRANCH_TO_ZODIAC: Record<string, ZodiacKey> = {
  子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake',
  午: 'horse', 未: 'sheep', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig',
};

const ZODIAC_KOR: Record<ZodiacKey, string> = {
  rat: '쥐띠', ox: '소띠', tiger: '범띠', rabbit: '토끼띠', dragon: '용띠', snake: '뱀띠',
  horse: '말띠', sheep: '양띠', monkey: '원숭이띠', rooster: '닭띠', dog: '개띠', pig: '돼지띠',
};

function getYearZodiac(data: SajuDataV1 | SajuDataV2): ZodiacKey {
  return BRANCH_TO_ZODIAC[data.pillars.year.branch] ?? 'dragon';
}

function getBirthYear(data: SajuDataV1 | SajuDataV2): number {
  return data.input.birth.year;
}

// practicalCards.tone → 색상 매핑
const TONE_COLOR: Record<'coral' | 'sky' | 'gold' | 'jade', string> = {
  coral: 'var(--app-coral)',
  sky: 'var(--app-sky)',
  gold: 'var(--app-amber)',
  jade: 'var(--app-jade)',
};

// 4축 별 점수 — 메인 점수에 tone 별 미세 offset
const TONE_OFFSET: Record<'coral' | 'sky' | 'gold' | 'jade', number> = {
  coral: 8,
  sky: -4,
  gold: -8,
  jade: 2,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function CompatibilityResultView({
  selected,
  compatibility,
  selfName,
  partnerName,
  selfBirthSummary,
  partnerBirthSummary,
  retakeHref = `/compatibility/input?relationship=${selected.slug}`,
  hasLoveQuestionPurchase = false,
  selfBirthInput,
  partnerBirthInput,
  deepLlmEnabled = false,
  compatibilityCoupleKey,
  perCouplePricingEnabled = false,
}: CompatibilityResultViewProps) {
  const premiumExpansion = COMPATIBILITY_PREMIUM_EXPANSION[selected.slug];
  const score = clampScore(compatibility.score);
  // ① per-couple 가격이 켜지고 커플 키가 있으면 compat-reading(커플 1회권) 결제, 아니면 기존 love-question.
  const checkoutHref =
    perCouplePricingEnabled && compatibilityCoupleKey
      ? `/membership/checkout?product=compat-reading&slug=${encodeURIComponent(compatibilityCoupleKey)}&from=compatibility-result`
      : '/membership/checkout?product=love-question&from=compatibility-result';
  const selfZodiac = getYearZodiac(compatibility.selfData);
  const partnerZodiac = getYearZodiac(compatibility.partnerData);
  const selfYear = getBirthYear(compatibility.selfData);
  const partnerYear = getBirthYear(compatibility.partnerData);

  return (
    <>
      <GangiPageHeader title="궁합" backHref={retakeHref} />

      <section className="space-y-5 px-1">
        {/* §1 Eyebrow + headline with score highlight */}
        <div>
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            {hasLoveQuestionPurchase ? '깊은 풀이 열람중' : selected.title} · 두 사람의 흐름
          </div>
          <h1 className="mt-1.5 text-[25.3px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
            궁합 <span className="text-[var(--app-pink-strong)]">{score}점</span>
            <br />
            {compatibility.headline}
          </h1>
        </div>

        {/* §2 Pair card */}
        <article
          className="rounded-[18px] border border-[var(--app-line)] p-5"
          style={{ background: 'var(--app-pink-soft)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 flex-col items-center text-center">
              <ZodiacChip kind={selfZodiac} size="lg" />
              <div className="mt-2 text-[15px] font-extrabold text-[var(--app-ink)]">
                {selfName}
              </div>
              <div className="text-[15px] text-[var(--app-copy-soft)]">
                {selfYear} · {ZODIAC_KOR[selfZodiac]}
              </div>
            </div>
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[25.3px] font-extrabold text-white"
              style={{
                background: 'var(--app-pink)',
                boxShadow: '0 6px 14px rgba(216,27,114,0.32)',
              }}
              aria-hidden="true"
            >
              ♥
            </div>
            <div className="flex flex-1 flex-col items-center text-center">
              <ZodiacChip kind={partnerZodiac} size="lg" />
              <div className="mt-2 text-[15px] font-extrabold text-[var(--app-ink)]">
                {partnerName}
              </div>
              <div className="text-[15px] text-[var(--app-copy-soft)]">
                {partnerYear} · {ZODIAC_KOR[partnerZodiac]}
              </div>
            </div>
          </div>
        </article>

        {/* §3 Big score gauge */}
        <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-5 text-center">
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            총 궁합
          </div>
          <div
            className="relative mx-auto mt-3 grid h-[168px] w-[168px] place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--app-pink) 0deg ${score * 3.6}deg, var(--app-line) ${score * 3.6}deg 360deg)`,
            }}
          >
            <div
              className="absolute inset-[14px] grid place-items-center rounded-full bg-white"
              aria-hidden="true"
            >
              <div>
                <div className="text-[41.4px] font-extrabold tracking-tighter text-[var(--app-ink)]">
                  {score}
                </div>
                <div className="-mt-1 text-[12.6px] text-[var(--app-copy-soft)]">/ 100</div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[15px] leading-[1.55] text-[var(--app-copy)]">
            {compatibility.dataNote ?? compatibility.summary}
          </p>
        </article>

        {/* §4 분야별 궁합 — 4축 bar */}
        <section>
          <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">
            분야별 궁합
          </h2>
          <p className="mt-1 text-[15px] text-[var(--app-copy-muted)]">
            관계의 흐름을 4축으로 나눠 봅니다
          </p>
          <div className="mt-3 grid gap-2.5">
            {compatibility.practicalCards.map((card) => {
              const color = TONE_COLOR[card.tone];
              const offset = TONE_OFFSET[card.tone];
              const axisScore = clampScore(score + offset);
              return (
                <article
                  key={card.key}
                  className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15.5px] font-bold text-[var(--app-ink)]">
                      {card.eyebrow}
                    </span>
                    <span
                      className="text-[16.1px] font-extrabold"
                      style={{ color }}
                    >
                      {axisScore}
                    </span>
                  </div>
                  <div
                    className="relative mt-2 h-1.5 overflow-hidden rounded-full"
                    style={{ background: 'var(--app-line)' }}
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${axisScore}%`, background: color }}
                    />
                  </div>
                  <p className="mt-2 text-[15px] leading-[1.55] text-[var(--app-copy-muted)]">
                    {card.summary}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* §5 두 사람 흐름 */}
        <section>
          <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">
            두 사람 흐름
          </h2>
          <div className="mt-3 grid gap-2.5">
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
              <div className="text-[15px] font-bold text-[var(--app-pink-strong)]">{selfName}</div>
              <div className="mt-1 text-[16.1px] font-extrabold text-[var(--app-ink)]">
                {compatibility.selfData.dayMaster.metaphor ?? '내 기본 기질'}
              </div>
              <p className="mt-1.5 text-[15px] leading-[1.55] text-[var(--app-copy-muted)]">
                {compatibility.selfData.dayMaster.description ?? selfBirthSummary}
              </p>
            </article>
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
              <div className="text-[15px] font-bold text-[var(--app-pink-strong)]">{partnerName}</div>
              <div className="mt-1 text-[16.1px] font-extrabold text-[var(--app-ink)]">
                {compatibility.partnerData.dayMaster.metaphor ?? '상대 기본 기질'}
              </div>
              <p className="mt-1.5 text-[15px] leading-[1.55] text-[var(--app-copy-muted)]">
                {compatibility.partnerData.dayMaster.description ?? partnerBirthSummary}
              </p>
            </article>
          </div>
          <p
            className="mt-3 rounded-[12px] px-3.5 py-2.5 text-[15px] leading-[1.6]"
            style={{ background: 'var(--app-pink-soft)', color: 'var(--app-pink-strong)' }}
          >
            {compatibility.summary}
          </p>
        </section>

        {/* §6 잘 맞는 / 조심 / 지금 살리는 */}
        <section>
          <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">
            관계 흐름 정리
          </h2>
          <div className="mt-3 grid gap-2.5">
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
              <div className="text-[15px] font-bold text-[var(--app-jade)]">잘 맞는 지점</div>
              <p className="mt-1 text-[15px] leading-[1.6] text-[var(--app-ink)]">
                {compatibility.supportiveSummary}
              </p>
            </article>
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
              <div className="text-[15px] font-bold text-[var(--app-coral)]">조심할 지점</div>
              <p className="mt-1 text-[15px] leading-[1.6] text-[var(--app-ink)]">
                {compatibility.cautionSummary}
              </p>
            </article>
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
              <div className="text-[15px] font-bold text-[var(--app-pink-strong)]">지금 살리는 방식</div>
              <p className="mt-1 text-[15px] leading-[1.6] text-[var(--app-ink)]">
                {compatibility.currentFlowSummary}
              </p>
            </article>
          </div>
        </section>

        {/* §7 평가 원칙 — details 접기 */}
        <details className="rounded-[14px] border border-[var(--app-line)] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[15px] font-bold text-[var(--app-ink)] [&::-webkit-details-marker]:hidden">
            <span>궁합 풀이와 참고 단서 보기</span>
            <span className="text-[var(--app-copy-muted)]" aria-hidden="true">
              ▾
            </span>
          </summary>
          <div className="grid gap-2.5 border-t border-[var(--app-line)] px-4 py-4">
            <article className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
              <div className="text-[15px] font-bold text-[var(--app-pink-strong)]">
                관계를 보는 렌즈
              </div>
              <div className="mt-1 text-[15px] font-bold text-[var(--app-ink)]">
                {compatibility.relationshipLensTitle}
              </div>
              <p className="mt-1 text-[15px] leading-[1.55] text-[var(--app-copy-muted)]">
                {compatibility.relationshipLensBody}
              </p>
            </article>
            <article className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
              <div className="text-[15px] font-bold text-[var(--app-pink-strong)]">
                다루는 방식
              </div>
              <p className="mt-1 text-[15px] leading-[1.55] text-[var(--app-copy-muted)]">
                {compatibility.practiceSummary}
              </p>
            </article>
            {compatibility.evidence.map((item) => (
              <article
                key={item.title}
                className="rounded-[12px] border border-[var(--app-line)] bg-white p-3"
              >
                <div className="text-[15px] font-bold text-[var(--app-pink-strong)]">
                  {item.title}
                </div>
                <p className="mt-1 text-[15px] leading-[1.55] text-[var(--app-copy-muted)]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </details>

        {/* §8 — 구매 여부에 따라 분기.
            · 미구매: ink-dark CTA + 2개 teaser preview + 990원 결제 버튼.
            · 구매: pink-soft hero + ✓ 구매 완료 배지 + 3개 풀 콘텐츠. */}
        {hasLoveQuestionPurchase ? (
          <>
            <article
              className="rounded-[18px] border p-5"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="grid h-6 w-6 place-items-center rounded-full text-white"
                  style={{
                    background: 'var(--app-pink)',
                    boxShadow: '0 4px 10px rgba(216,27,114,0.35)',
                  }}
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div
                  className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  구매 완료 · 깊은 풀이
                </div>
              </div>
              <h2
                className="mt-2 text-[20.7px] font-extrabold leading-[1.45] tracking-tight text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {premiumExpansion.ctaTitle}
              </h2>
              <p className="mt-2 text-[15px] leading-[1.65] text-[var(--app-copy-muted)]">
                {premiumExpansion.ctaBody}
              </p>
            </article>

            {selfBirthInput && partnerBirthInput ? (
              <CompatibilityDeepSections
                relationship={selected.slug}
                self={{ name: selfName, birthInput: selfBirthInput }}
                partner={{ name: partnerName, birthInput: partnerBirthInput }}
                fallbackSections={compatibility.deepSections}
                enabled={deepLlmEnabled}
              />
            ) : (
              <div className="grid gap-2.5">
                {compatibility.deepSections.map((item, index) => (
                  <article
                    key={item.key}
                    className="rounded-[14px] border bg-white p-4"
                    style={{ borderColor: 'var(--app-pink-line)' }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.6px] font-extrabold text-white"
                        style={{ background: 'var(--app-pink)' }}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className="break-keep text-[16.7px] font-extrabold leading-[1.5] text-[var(--app-ink)]"
                          style={{ wordBreak: 'keep-all' }}
                        >
                          {item.title}
                        </div>
                        <p className="mt-1.5 break-keep text-[15px] leading-[1.7] text-[var(--app-copy)]">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* 2026-05-16 — 사용자 보고: 버튼이 텍스트 길이만큼만 좁게 그려져
                좌측에 외롭게 놓였다. w-full + 적절한 가로 padding 으로 위 카드들과
                동일한 폭으로 확장. text-overflow 발생 시 ellipsis. */}
            <Link
              href={retakeHref}
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-5 text-[15px] font-bold text-[var(--app-copy-muted)]"
            >
              <span className="truncate">다른 사람과 다시 보기</span>
            </Link>
          </>
        ) : (
          <article
            className="rounded-[18px] p-5 text-white"
            style={{
              background: 'var(--app-ink)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              더 보고 싶다면
            </div>
            <h2 className="mt-1.5 text-[20.7px] font-extrabold leading-snug tracking-tight">
              {premiumExpansion.ctaTitle}
            </h2>
            <p
              className="mt-2 text-[15px] leading-[1.55]"
              style={{ opacity: 0.75 }}
            >
              {premiumExpansion.ctaBody}
            </p>
            <ul className="mt-3 grid gap-1.5">
              {premiumExpansion.preview.slice(0, 2).map((item) => (
                <li
                  key={item.title}
                  className="rounded-[12px] px-3.5 py-2.5 text-[15px] leading-[1.55]"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <strong className="text-white">{item.title}</strong>
                  <span className="block mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {item.body}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-2">
              <Link
                href="/membership"
                className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
              >
                멤버십이면 궁합 매달 무료 →
              </Link>
              <Link
                href={checkoutHref}
                className="inline-flex items-center justify-center rounded-full border border-[var(--app-pink)] px-5 py-2.5 text-[15px] font-bold text-[var(--app-pink)]"
              >
                <Price priceKey="taste_love_question" /> · 깊은 궁합 풀이 보기
              </Link>
              <Link
                href={retakeHref}
                className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-2.5 text-[15px] font-bold text-white/80"
              >
                다른 사람과 다시 보기
              </Link>
            </div>
          </article>
        )}
      </section>
    </>
  );
}
