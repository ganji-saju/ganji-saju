// 2026-05-15 PR 1 — 운세톡톡 벤치마크 (간지사주_무료일진운세_적용방안.md 3-6 (3)):
// 사주 명식 카드 — 운세톡톡이 "신뢰장치" 로 사용하는 패턴. 사용자가 자기 사주의
// 8글자/오행 분포/일주 강약을 직접 보면 풀이 정확도 체감이 크게 올라간다.
//
// 운세톡톡 대비 차별화: 한자 + 한글 발음 병기, 오행 색상 막대, 부족·과다 표시,
// 격국 정보까지 노출.
import type { TodaySajuChartSnapshot } from '@/lib/today-fortune/types';

interface Props {
  chart: TodaySajuChartSnapshot;
}

// 한자 ganzi → 한글 발음.
const STEM_HANJA_TO_KOREAN: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const BRANCH_HANJA_TO_KOREAN: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

const ELEMENT_HAN: Record<'목' | '화' | '토' | '금' | '수', string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

const ELEMENT_COLOR: Record<'목' | '화' | '토' | '금' | '수', string> = {
  목: '#3F8796', // 청록
  화: '#E05298', // 적
  토: '#D59B2E', // 황
  금: '#A6A6A6', // 백
  수: '#3B4F6B', // 흑·청
};

function pillarLabel(stem: string, branch: string): string {
  const stemKor = STEM_HANJA_TO_KOREAN[stem] ?? '';
  const branchKor = BRANCH_HANJA_TO_KOREAN[branch] ?? '';
  return `${stemKor}${branchKor}`;
}

export function TodaySajuChartCard({ chart }: Props) {
  const pillars = [
    { label: '연', pillar: chart.pillars.year },
    { label: '월', pillar: chart.pillars.month },
    { label: '일', pillar: chart.pillars.day },
    { label: '시', pillar: chart.pillars.hour },
  ];
  const dayMasterKor = STEM_HANJA_TO_KOREAN[chart.dayMaster.stem] ?? '';
  const todayKor = chart.todayGanzi ? pillarLabel(chart.todayGanzi.charAt(0), chart.todayGanzi.charAt(1)) : '';

  return (
    <section
      className="rounded-[18px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
      aria-label="내 사주 명식"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            나의 사주 명식
          </div>
          <h2 className="mt-0.5 text-[15px] font-extrabold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
            {dayMasterKor}({chart.dayMaster.stem})일주 ·{' '}
            <span style={{ color: ELEMENT_COLOR[chart.dayMaster.element] }}>
              {chart.dayMaster.element}({ELEMENT_HAN[chart.dayMaster.element]})
            </span>
          </h2>
        </div>
        {chart.todayGanzi ? (
          <span
            className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold text-white"
            style={{ background: 'var(--app-ink)' }}
          >
            오늘 일진 · {todayKor || chart.todayGanzi}({chart.todayGanzi})
          </span>
        ) : null}
      </div>

      {/* 4 기둥 명식 도식 — 한자 + 한글 발음 + 오행 색상 */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {pillars.map((item) => {
          if (!item.pillar) {
            return (
              <article
                key={item.label}
                className="overflow-hidden rounded-[12px] border border-[var(--app-line)] bg-[rgba(0,0,0,0.02)] text-center"
              >
                <div className="border-b border-[var(--app-line)] py-1 text-[10px] font-extrabold text-[var(--app-copy-soft)]">
                  {item.label}주
                </div>
                <div className="py-3 text-[11px] text-[var(--app-copy-soft)]">미입력</div>
              </article>
            );
          }
          const stemKor = STEM_HANJA_TO_KOREAN[item.pillar.stem] ?? '';
          const branchKor = BRANCH_HANJA_TO_KOREAN[item.pillar.branch] ?? '';
          return (
            <article
              key={item.label}
              className="overflow-hidden rounded-[12px] border border-[var(--app-line)] bg-white text-center"
            >
              <div
                className="border-b border-[var(--app-line)] py-1 text-[10px] font-extrabold text-[var(--app-copy-soft)]"
                style={{ background: 'rgba(0,0,0,0.02)' }}
              >
                {item.label}주
              </div>
              <div className="py-1.5">
                <div
                  className="text-[20px] font-bold leading-none"
                  style={{ fontFamily: 'var(--font-han)' }}
                >
                  {item.pillar.stem}
                </div>
                <div className="mt-0.5 text-[9px] text-[var(--app-copy-soft)]">{stemKor}</div>
              </div>
              <div className="pb-2 pt-0.5">
                <div
                  className="text-[20px] font-bold leading-none"
                  style={{ fontFamily: 'var(--font-han)' }}
                >
                  {item.pillar.branch}
                </div>
                <div className="mt-0.5 text-[9px] text-[var(--app-copy-soft)]">{branchKor}</div>
              </div>
            </article>
          );
        })}
      </div>

      {/* 오행 분포 막대 — 부족(⚠)·과다 표시 */}
      <div className="mt-4">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
          오행 분포
        </div>
        <ul className="mt-1.5 grid gap-1.5">
          {chart.fiveElements.map((el) => {
            const color = ELEMENT_COLOR[el.element];
            const pct = Math.max(2, el.percentage);
            return (
              <li key={el.element} className="flex items-center gap-2">
                <span
                  className="w-8 shrink-0 text-[12px] font-extrabold"
                  style={{ fontFamily: 'var(--font-han)', color }}
                >
                  {el.element}({ELEMENT_HAN[el.element]})
                </span>
                <div
                  className="relative h-2 flex-1 overflow-hidden rounded-full"
                  style={{ background: 'var(--app-line)' }}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11.5px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {el.percentage}
                </span>
                {el.count === 0 ? (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold text-white"
                    style={{ background: 'var(--app-coral)' }}
                    title="부족한 오행"
                  >
                    부족
                  </span>
                ) : el.isDominant && el.percentage >= 40 ? (
                  <span
                    className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-extrabold"
                    style={{
                      borderColor: 'rgba(212,148,38,0.32)',
                      color: 'var(--app-amber)',
                      background: '#fff7e6',
                    }}
                    title="과다 오행"
                  >
                    과다
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {/* 일주 강약 + 격국 */}
      {(chart.strengthLabel || chart.patternName) ? (
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {chart.strengthLabel ? (
            <div
              className="rounded-[10px] border p-2.5 text-center"
              style={{
                background: '#e8f5ee',
                borderColor: 'rgba(45,135,88,0.22)',
              }}
            >
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                일주 강약
              </div>
              <div className="mt-0.5 text-[13px] font-extrabold text-[var(--app-ink)]">
                {chart.strengthLabel}
              </div>
            </div>
          ) : null}
          {chart.patternName ? (
            <div
              className="rounded-[10px] border p-2.5 text-center"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                격국
              </div>
              <div
                className="mt-0.5 text-[13px] font-extrabold text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {chart.patternName}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
