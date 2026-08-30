// 2026-08-25 전면 개편 — 사주 결과 단일 페이지화(사용자 지시 "탭 없이 한 화면에").
//   구 /saju/[slug]/overview(명식 탭)의 본문을 섹션으로 이동 — 도식·핵심 키·합충 카드.
//   탭 페이지의 히어로/내비/업셀은 단일 페이지에서 불필요라 제외. 구 라우트는 앵커 리다이렉트.

import { ELEMENT_INFO } from '@/lib/saju/elements';
import type { ReadingRecord } from '@/lib/saju/readings';
import { SajuRelationsSymbolsCard } from '@/components/saju/saju-relations-symbols-card';

const PILLAR_LABELS: Array<{ key: '시' | '일' | '월' | '년'; label: string; meaning: string }> = [
  { key: '시', label: '시주', meaning: '자식·말년·결과' },
  { key: '일', label: '일주', meaning: '나·배우자·중심' },
  { key: '월', label: '월주', meaning: '직장·부모·현재' },
  { key: '년', label: '연주', meaning: '조상·어린 시절' },
];

export function MyeongsikSection({
  sajuData,
  grounding,
}: {
  sajuData: ReadingRecord['sajuData'];
  grounding: ReadingRecord['grounding'];
}) {
  const metaphor = sajuData.dayMaster.metaphor ?? '자연의 상징';
  const patternName = sajuData.pattern?.name ?? null;
  const yongsinPrimary = sajuData.yongsin?.primary?.label ?? null;
  const strengthLevel = sajuData.strength?.level ?? null;

  return (
    <div className="space-y-5">
      {/* 4 pillars 명식 도식 — 각 기둥의 의미와 한자 */}
      <section>
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          四柱八字 · 네 기둥
        </div>
        <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">내 사주 도식</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {PILLAR_LABELS.map((item) => {
            const pillar =
              item.key === '시'
                ? sajuData.pillars.hour
                : item.key === '일'
                  ? sajuData.pillars.day
                  : item.key === '월'
                    ? sajuData.pillars.month
                    : sajuData.pillars.year;
            const stemColor = pillar?.stemElement
              ? ELEMENT_INFO[pillar.stemElement].textColor
              : 'var(--app-ink)';
            const branchColor = pillar?.branchElement
              ? ELEMENT_INFO[pillar.branchElement].textColor
              : 'var(--app-ink)';
            return (
              <article
                key={item.key}
                className="overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white text-center"
              >
                <div
                  className="border-b border-[var(--app-line)] py-1.5 text-[12.1px] font-extrabold text-[var(--app-copy-soft)]"
                  style={{ background: 'rgba(0,0,0,0.02)' }}
                >
                  {item.label}
                </div>
                <div className="py-2.5">
                  <div
                    className="text-[25.3px] font-bold leading-none"
                    style={{ fontFamily: 'var(--font-han)', color: stemColor }}
                  >
                    {pillar?.stem ?? '-'}
                  </div>
                  <div className="mt-0.5 text-[10.9px] text-[var(--app-copy-soft)]">천간</div>
                </div>
                <div className="pb-3 pt-1">
                  <div
                    className="text-[25.3px] font-bold leading-none"
                    style={{ fontFamily: 'var(--font-han)', color: branchColor }}
                  >
                    {pillar?.branch ?? '-'}
                  </div>
                  <div className="mt-0.5 text-[10.9px] text-[var(--app-copy-soft)]">지지</div>
                </div>
                <div className="border-t border-[var(--app-line)] py-1.5 text-[10.9px] font-extrabold text-[var(--app-copy-muted)]">
                  {item.meaning}
                </div>
              </article>
            );
          })}
        </div>
        <article
          className="mt-3 rounded-[14px] border p-4"
          style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            일주 해석
          </div>
          <p className="mt-1.5 text-[16.1px] font-medium leading-[1.55] text-[var(--app-ink)]">
            내 사주는 <strong>{metaphor}</strong>처럼 드러나는 기질을 중심으로 읽습니다.
          </p>
        </article>
      </section>

      {/* 격국·용신·강약 사실 카드 */}
      {patternName || yongsinPrimary || strengthLevel ? (
        <section
          className="rounded-[18px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            사주 핵심 키
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <div
              className="rounded-[12px] border p-3 text-center"
              style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                격국
              </div>
              <div
                className="mt-1 text-[16.1px] font-extrabold leading-tight text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {patternName ?? '미정'}
              </div>
              <div
                className="mt-1 text-[12.1px] leading-[1.45] text-[var(--app-copy-soft)]"
                style={{ wordBreak: 'keep-all' }}
              >
                반복되는 역할 후보
              </div>
            </div>
            <div
              className="rounded-[12px] border p-3 text-center"
              style={{ background: '#fff7e6', borderColor: 'rgba(212,148,38,0.22)' }}
            >
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-amber)]">
                용신
              </div>
              <div
                className="mt-1 text-[16.1px] font-extrabold leading-tight text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {yongsinPrimary ?? '미정'}
              </div>
              <div
                className="mt-1 text-[12.1px] leading-[1.45] text-[var(--app-copy-soft)]"
                style={{ wordBreak: 'keep-all' }}
              >
                잘 풀리게 도와주는 기운
              </div>
            </div>
            <div
              className="rounded-[12px] border p-3 text-center"
              style={{ background: '#e8f5ee', borderColor: 'rgba(45,135,88,0.22)' }}
            >
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                강약
              </div>
              <div
                className="mt-1 text-[16.1px] font-extrabold leading-tight text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {strengthLevel ?? '미정'}
              </div>
              <div
                className="mt-1 text-[12.1px] leading-[1.45] text-[var(--app-copy-soft)]"
                style={{ wordBreak: 'keep-all' }}
              >
                지금 흐르는 기운
              </div>
            </div>
          </div>
          <p
            className="mt-2.5 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {patternName && yongsinPrimary
              ? `${patternName}에 ${yongsinPrimary}을 보완점으로 잡고 풀이를 구성했습니다.`
              : '사주 구조와 보완점을 함께 보며 풀이를 구성했습니다.'}
          </p>
        </section>
      ) : null}

      {/* 합충·공망·신살 */}
      {grounding ? <SajuRelationsSymbolsCard grounding={grounding} /> : null}
    </div>
  );
}
