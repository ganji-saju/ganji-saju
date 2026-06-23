import type { SajuInterpretationGrounding } from '@/domain/saju/report';
import { GroundingDecisionTrace } from '@/components/saju/grounding-decision-trace';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import { simplifySajuCopy } from '@/lib/saju/public-copy';

function formatList(items: string[]) {
  return items.length > 0 ? items.join(' · ') : '없음';
}

export function SajuFactEvidencePanel({
  grounding,
  kasiComparison,
  showDecisionTrace = true,
}: {
  grounding: SajuInterpretationGrounding;
  kasiComparison?: KasiSingleInputComparison | null;
  showDecisionTrace?: boolean;
}) {
  const { factJson, evidenceJson } = grounding;
  const yongsinCandidates = evidenceJson.yongsin.candidates.slice(0, 3);
  const hasKasiMatch = kasiComparison ? kasiComparison.issues.length === 0 : null;

  return (
    <section className="gangi-report-panel p-6 sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="app-caption">내 입력 정보</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-ink)]">
            생년월일과 기본 사주표입니다.
          </h2>
        </div>
      </div>

      {showDecisionTrace ? (
        <div className="mt-6">
          <GroundingDecisionTrace
            grounding={grounding}
            kasiComparison={kasiComparison}
          />
        </div>
      ) : null}

      {/* 2026-05-15 — 사실 증거 카드 본문이 김. 1열 stack 으로 가독성 회복. */}
      <div className="mt-6 grid gap-4">
        <article className="gangi-evidence-card p-5">
          <div className="app-caption">내 사주의 기본 정보</div>
          <div className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">
            {factJson.pillars.year.ganzi} · {factJson.pillars.month.ganzi} · {factJson.pillars.day.ganzi}
            {factJson.pillars.hour ? ` · ${factJson.pillars.hour.ganzi}` : ''}
          </div>
          <div className="mt-4 grid gap-2 text-sm leading-7 text-[var(--app-copy)]">
            <div>
              나를 나타내는 기운: <span className="">{factJson.dayMaster.stem}</span> · {factJson.dayMaster.element}
            </div>
            <div>강한 오행: {factJson.fiveElements.dominant}</div>
            <div>약한 오행: {factJson.fiveElements.weakest}</div>
            <div>
              현재 흐름: {evidenceJson.luckFlow.currentMajorLuck ?? '미계산'}
              {evidenceJson.luckFlow.saewoon ? ` · 올해 ${evidenceJson.luckFlow.saewoon}` : ''}
              {evidenceJson.luckFlow.wolwoon ? ` · 이번 달 ${evidenceJson.luckFlow.wolwoon}` : ''}
            </div>
          </div>
        </article>

        <article className="gangi-evidence-card p-5">
          <div className="app-caption">기운의 균형</div>
          <div className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">
            {evidenceJson.strength.level ?? '미계산'} {evidenceJson.strength.score !== null ? `· ${evidenceJson.strength.score}점` : ''}
          </div>
          <div className="mt-4 grid gap-2">
            {evidenceJson.strength.rationale.slice(0, 3).map((line) => (
              <div
                key={`strength-${line}`}
                className="rounded-2xl border border-[var(--app-line)] bg-white px-3 py-2 text-sm leading-7 text-[var(--app-copy)]"
              >
                {line}
              </div>
            ))}
            <div className="rounded-2xl border border-[var(--app-line)] bg-white px-3 py-2 text-sm leading-7 text-[var(--app-copy)]">
              반복되는 흐름: {evidenceJson.pattern.name ?? '미계산'}
              {evidenceJson.pattern.tenGod ? ` · ${evidenceJson.pattern.tenGod}` : ''}
            </div>
          </div>
        </article>

        <article className="gangi-evidence-card p-5">
          <div className="app-caption">보완하면 좋은 점</div>
          <div className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">
            {evidenceJson.yongsin.primary ?? '미계산'}
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
            생활에서 균형을 잡을 때 함께 볼 부분입니다.
          </p>
          <div className="mt-4 grid gap-3">
            {yongsinCandidates.map((candidate) => (
              <div
                key={`${candidate.method}-${candidate.primary}-${candidate.score}`}
                className="rounded-2xl border border-[var(--app-line)] bg-white px-3 py-3"
              >
                <div className="text-sm font-medium text-[var(--app-ink)]">
                  후보 · {candidate.score}점
                </div>
                {candidate.plainSummary ? (
                  <div className="mt-2 text-[15px] leading-6 text-[var(--app-copy-soft)]">{simplifySajuCopy(candidate.plainSummary)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="gangi-evidence-card p-5">
          <div className="app-caption">관계 신호</div>
          <div className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">
            사람, 선택, 타이밍에서 함께 볼 부분입니다.
          </div>
          <div className="mt-4 grid gap-2 text-sm leading-7 text-[var(--app-copy)]">
            <div>관계 변화: {formatList(evidenceJson.relations.relations.slice(0, 4))}</div>
            <div>비어 보이는 부분: {formatList(evidenceJson.relations.gongmang)}</div>
            <div>함께 볼 부분: {formatList(evidenceJson.relations.specialSals.slice(0, 6))}</div>
          </div>
        </article>

        <article className="gangi-evidence-card p-5 lg:col-span-2">
          <div className="app-caption">날짜 확인</div>
          <div className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">
            {hasKasiMatch === null
              ? '날짜 대조 정보가 아직 없습니다.'
              : hasKasiMatch
                ? '입력한 날짜와 계산값이 맞게 연결됐습니다.'
                : '날짜 정보에서 다시 확인할 부분이 있습니다.'}
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
            {hasKasiMatch === null
              ? '저장된 결과에 날짜 대조 정보가 아직 없습니다.'
              : `음력 ${kasiComparison?.local.lunarYear}년 ${kasiComparison?.local.lunarMonth}월 ${kasiComparison?.local.lunarDay}일 정보로 비교했습니다.`}
          </p>
          {kasiComparison ? (
            <div className="mt-4 grid gap-2 text-sm leading-7 text-[var(--app-copy)]">
              <div>
                공식 음력일: {kasiComparison.kasi.lunYear}년 {kasiComparison.kasi.lunMonth}월 {kasiComparison.kasi.lunDay}일
                {kasiComparison.kasi.lunLeapmonth === '윤' ? ' (윤달)' : ''}
              </div>
              <div>공식 일진: {kasiComparison.kasi.lunIljin ?? '미기재'}</div>
              {kasiComparison.issues.length > 0 ? (
                <div className="rounded-2xl border border-[var(--app-coral)]/18 bg-[var(--app-coral)]/8 px-3 py-3 text-[var(--app-copy)]">
                  {kasiComparison.issues.map((issue) => `${issue.field}: 공식 ${issue.expected} / 현재 ${issue.actual}`).join(' · ')}
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--app-jade)]/18 bg-[var(--app-jade)]/8 px-3 py-3 text-[var(--app-copy)]">
                  달력 변환에서 현재 저장본과 공식 대조값이 일치합니다.
                </div>
              )}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
