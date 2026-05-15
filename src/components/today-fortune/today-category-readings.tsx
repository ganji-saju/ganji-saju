// 2026-05-15 PR 1 — 운세톡톡 벤치마크 (간지사주_무료일진운세_적용방안.md 3-1, 4-1, 4-2):
// 기존 TodayFortuneScoreGrid (2x3 작은 카드) 와 별도로, 카테고리별 "블루 헤드라인 + 본문"
// 패턴을 5장 stacked card 로 노출. 사용자는 관심 영역만 골라 자세히 읽을 수 있다.
//
// 데이터 출처: 같은 result.scores. summary 를 블루 헤드라인으로, 추가 body 라인은
// concern/score 의 조합으로 룰 기반 생성. 운세톡톡 벤치마크처럼 4~6줄 분량.
import type { TodayFortuneFreeResult, TodayScoreItem } from '@/lib/today-fortune/types';

interface CategoryMeta {
  icon: string;
  label: string;
  accent: string;
  /** 운세톡톡 벤치마크 "블루 헤드라인" — 점수 등급별 카피 시드. */
  bodyHints: {
    high: string;
    mid: string;
    low: string;
  };
}

const CATEGORY_META: Record<TodayScoreItem['key'], CategoryMeta> = {
  overall: {
    icon: '🌅',
    label: '오늘의 운세 총론',
    accent: 'var(--app-pink-strong)',
    bodyHints: {
      high:
        '오늘은 흐름이 가볍게 잡혀, 미뤘던 일을 작게 한 칸씩 옮겨두기 좋은 날입니다. 큰 결정보다 정리·확인이 보탬이 됩니다.',
      mid:
        '오늘은 무난한 흐름 속에서도 한 박자 천천히 가는 편이 안전합니다. 예정된 일정에 충실하면 어느새 매끄럽게 마무리됩니다.',
      low:
        '오늘은 평소보다 막힘이 잦은 흐름입니다. 새로 시작하기보다 진행 중인 것을 점검하고 무리한 약속은 다음으로 미뤄두세요.',
    },
  },
  career: {
    icon: '💼',
    label: '직장·사업운',
    accent: 'var(--app-jade)',
    bodyHints: {
      high:
        '업무 흐름이 또렷이 잡히는 날입니다. 보고나 제안에서 한 줄 더 분명히 말하면 인정을 얻기 좋습니다. 어려운 사람에게 먼저 인사 한마디를 건네 보세요.',
      mid:
        '특별한 호재는 없지만 큰 마찰도 없는 날입니다. 우선순위 두 가지만 고정하고 그 안에서 움직이면 평탄히 마무리됩니다.',
      low:
        '갑작스러운 지시·추가 업무가 몰릴 수 있는 날입니다. 부담스럽게 느껴져도 회피보다 차분히 받아내는 편이 신뢰로 돌아옵니다. 중요한 결정은 내일로 미루세요.',
    },
  },
  wealth: {
    icon: '💰',
    label: '재물운',
    accent: 'var(--app-amber)',
    bodyHints: {
      high:
        '돈의 흐름이 잠시 열리는 날입니다. 평소 망설였던 작은 부수입·제안에 가볍게 응해보면 보탬이 됩니다. 단, 큰 투자·도박성 지출은 멈추는 게 안전합니다.',
      mid:
        '큰 손익 없이 흘러가는 평탄한 흐름입니다. 고정 지출 한 항목만 점검하고 카드 결제를 한 번 미루는 작은 절제가 한 달 끝에 보입니다.',
      low:
        '예상치 못한 지출이 생기기 쉬운 날입니다. 새 계약·큰 결제는 피하고, 가까운 사람의 권유에도 한 발 물러서서 듣는 편이 좋습니다.',
    },
  },
  love: {
    icon: '💞',
    label: '애정·연애운',
    accent: 'var(--app-coral)',
    bodyHints: {
      high:
        '마음을 살짝 표현해도 잘 닿는 흐름입니다. 연락이 망설여졌다면 한 줄만 먼저 보내보세요. 새 만남 자리에서는 듣는 자세가 매력으로 읽힙니다.',
      mid:
        '특별한 떨림은 없지만 관계가 비뚤어지지도 않는 평온한 흐름입니다. 평소 챙기지 못한 안부를 짧게라도 전하면 마음의 거리가 줄어듭니다.',
      low:
        '말 한마디가 오해를 부르기 쉬운 날입니다. 중요한 대화는 내일로 미루고, 메시지는 보내기 전 한 번 더 다시 읽어보세요. 강한 어조는 자제가 답입니다.',
    },
  },
  relationship: {
    icon: '🤝',
    label: '인간관계운',
    accent: 'var(--app-sky)',
    bodyHints: {
      high:
        '주변 사람과 결이 잘 맞는 날입니다. 먼저 안부 전하기, 점심 한 끼 같이 하기 같은 작은 시도가 좋은 인연으로 이어집니다.',
      mid:
        '큰 갈등도, 큰 즐거움도 없는 무난한 관계의 날입니다. 듣는 자세를 한 단계 늘리면 의외의 정보를 얻을 수 있습니다.',
      low:
        '사소한 말이 크게 들리는 날입니다. 가까운 사람일수록 말 끝을 부드럽게 다듬고, 단정 표현은 잠시 미루세요. 혼자 정리할 시간이 보탬이 됩니다.',
    },
  },
  condition: {
    icon: '🏥',
    label: '컨디션·건강운',
    accent: 'var(--app-plum)',
    bodyHints: {
      high:
        '몸이 가볍고 머리도 또렷한 날입니다. 미뤘던 운동 한 회, 짧은 산책으로 흐름을 더 키워두세요. 좋은 컨디션은 내일까지 이어집니다.',
      mid:
        '특별한 무리만 없으면 평소 그대로 유지되는 흐름입니다. 수면 시간을 평소보다 30분 일찍 잡으면 다음 날이 한결 가벼워집니다.',
      low:
        '피로가 쌓이거나 머리가 무거울 수 있는 날입니다. 카페인·야식·과음을 줄이고 일찍 잠자리에 드세요. 무리한 일정은 다음으로 옮기는 편이 좋습니다.',
    },
  },
};

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 70;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function selectBodyHint(meta: CategoryMeta, score: number): string {
  if (score >= 72) return meta.bodyHints.high;
  if (score >= 48) return meta.bodyHints.mid;
  return meta.bodyHints.low;
}

// 운세톡톡 4-1 패턴: 점수에 따라 결론 어조 (현상/안내/경고) 를 톤 조정.
function buildBlueHeadline(score: number, summary: string): string {
  // summary 가 이미 한 줄 결론이라면 그대로. 짧으면 점수 등급에 맞춰 prefix 보강.
  const trimmed = summary.trim();
  if (trimmed.length >= 8) return trimmed;
  if (score >= 75) return `${trimmed} — 흐름을 살리는 날`;
  if (score >= 60) return `${trimmed} — 무난한 하루`;
  if (score >= 45) return `${trimmed} — 조심하면 풀리는 날`;
  return `${trimmed} — 천천히 가는 편이 안전`;
}

export function TodayCategoryReadings({ result }: { result: TodayFortuneFreeResult }) {
  // 운세톡톡 벤치마크: 총론(overall) 은 banner 에서 이미 큰 카드로 보여줬으므로 여기선 제외.
  const items = result.scores.filter((score) => score.key !== 'overall');

  return (
    <section aria-label="카테고리별 오늘운세">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
        오늘의 운세 자세히
      </div>
      <h2 className="mt-1 text-[16px] font-extrabold text-[var(--app-ink)]">
        영역별로 자세히 보기
      </h2>
      <p
        className="mt-1.5 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        궁금한 영역만 골라 읽어보세요. 점수가 낮아도 행동 한 가지만 챙기면 흐름이 정돈됩니다.
      </p>
      <div className="mt-3 grid gap-2.5">
        {items.map((score) => {
          const value = clampScore(score.score);
          const meta = CATEGORY_META[score.key];
          if (!meta) return null;
          const headline = buildBlueHeadline(value, score.summary);
          const body = selectBodyHint(meta, value);
          return (
            <article
              key={score.key}
              className="rounded-[16px] border border-[var(--app-line)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-[20px] leading-none">
                    {meta.icon}
                  </span>
                  <span className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                    {meta.label}
                  </span>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[12px] font-extrabold text-white"
                  style={{ background: meta.accent }}
                >
                  {value}
                </span>
              </div>
              {/* 운세톡톡 핵심: 파란색 헤드라인 — 본문 안 읽어도 한 줄 결론 인지 가능. */}
              <p
                className="mt-2.5 text-[13.5px] font-extrabold leading-[1.55]"
                style={{ color: meta.accent, wordBreak: 'keep-all' }}
              >
                🔵 {headline}
              </p>
              <p
                className="mt-2 text-[12.5px] leading-[1.7] text-[var(--app-copy)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {body}
              </p>
              <div
                className="relative mt-3 h-1 overflow-hidden rounded-full"
                style={{ background: 'var(--app-line)' }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${value}%`, background: meta.accent }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
