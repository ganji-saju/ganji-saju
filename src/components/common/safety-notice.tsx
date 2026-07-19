import { AlertCircle, Gavel, HeartPulse, Landmark, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SafetyNoticeVariant = 'general' | 'health' | 'finance' | 'legal' | 'crisis';

type SafetyNoticeProps = {
  variant?: SafetyNoticeVariant;
  className?: string;
};

const COMMON_COPY =
  '간지사주의 해석은 삶의 흐름을 참고하기 위한 구조 해석입니다. 의료·법률·투자·위기상황 판단은 전문가 판단과 도움을 우선해 주세요.';

const VARIANT_META: Record<
  SafetyNoticeVariant,
  {
    label: string;
    title: string;
    body: string;
    icon: typeof AlertCircle;
    tone: string;
  }
> = {
  general: {
    label: '일반 안내',
    title: '해석은 참고 흐름으로만 보셔도 충분합니다',
    body: '길흉을 단정하기보다, 지금 어떤 리듬과 선택을 점검하면 좋은지 살펴보는 안내로 받아들여 주세요.',
    icon: AlertCircle,
    tone: 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy)]',
  },
  health: {
    label: '건강·생활',
    title: '건강 해석은 생활 리듬 관리 관점에서만 읽습니다',
    body: '몸의 상태나 치료 판단은 전문 진료가 필요한 영역입니다. 간지사주는 생활 리듬과 피로 관리에 대한 참고 흐름만 다룹니다.',
    icon: HeartPulse,
    tone: 'border-[var(--app-coral)]/22 bg-[var(--app-coral)]/10 text-[var(--app-copy)]',
  },
  finance: {
    label: '투자·재물',
    title: '투자 판단은 별도 전문가 판단이 필요한 영역입니다',
    body: '재물 흐름은 지출과 선택의 경향을 참고하기 위한 해석입니다. 특정 상품이나 종목에 대한 투자 판단을 대신하지 않습니다.',
    icon: TrendingUp,
    tone: 'border-[var(--app-gold)]/22 bg-[var(--app-gold)]/10 text-[var(--app-copy)]',
  },
  legal: {
    label: '법률',
    title: '법률 판단은 전문가 상담이 필요한 영역입니다',
    body: '갈등과 관계 흐름은 참고할 수 있지만, 소송·계약·법적 대응 판단은 별도의 법률 자문을 우선해 주세요.',
    icon: Gavel,
    tone: 'border-[var(--app-sky)]/22 bg-[var(--app-sky)]/10 text-[var(--app-copy)]',
  },
  crisis: {
    label: '위기 상황',
    title: '위기상황은 사주 해석보다 즉각적인 도움 연결이 우선입니다',
    body: '자해, 타해, 응급한 위기감, 급한 의료 위험이 느껴질 때는 해석보다 주변 도움과 긴급 자원 연결을 먼저 권합니다.',
    icon: Landmark,
    tone: 'border-[var(--app-plum)]/22 bg-[var(--app-plum)]/10 text-[var(--app-copy)]',
  },
};

export function SafetyNotice({
  variant = 'general',
  className,
}: SafetyNoticeProps) {
  const meta = VARIANT_META[variant];
  const Icon = meta.icon;

  return (
    <section
      className={cn(
        'rounded-[1.5rem] border px-5 py-5 sm:px-6 sm:py-6',
        meta.tone,
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="app-caption">안전한 해석 안내</div>
          <h2 className="mt-2 text-3xl text-[var(--app-ivory)]">{meta.title}</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-sm text-[var(--app-copy-muted)]">
          <Icon className="h-3.5 w-3.5" />
          <span>{meta.label}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-base leading-7">
        <p className="text-[var(--app-copy)]">{COMMON_COPY}</p>
        <p className="text-[var(--app-copy-muted)]">{meta.body}</p>
      </div>
    </section>
  );
}
