import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  HERO_REPORT_PREVIEW,
  QUESTION_CHIPS,
  TRUST_POINTS,
} from '@/features/home/content';
import type { FocusTopic } from '@/lib/saju/report';
import { FOCUS_TOPIC_META } from '@/lib/saju/report';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  selectedTopic: FocusTopic;
  onSelectTopic: (topic: FocusTopic) => void;
}

export default function HeroSection({
  selectedTopic,
  onSelectTopic,
}: HeroSectionProps) {
  const focusMeta = FOCUS_TOPIC_META[selectedTopic];
  const preview = HERO_REPORT_PREVIEW[selectedTopic];

  return (
    <section
      id="hero"
      className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(210,176,114,0.16),_transparent_28%),radial-gradient(circle_at_82%_20%,_rgba(129,140,248,0.18),_transparent_24%),linear-gradient(180deg,_#071327_0%,_#020817_74%)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d2b072]/60 to-transparent" />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-7">
            <div className="space-y-4">
              <Badge className="border-[#d2b072]/35 bg-[#d2b072]/10 px-3 py-1 text-[#f2d9a2]">
                시니어 친화 AI 명리 리포트 베타
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#f8f1df] sm:text-5xl lg:text-6xl">
                  오늘의 기분부터
                  <span className="block text-[#d9bc7f]">정통 사주 리포트까지 한 번에 이해되는 시작선</span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                  홈은 이제 무료 포털처럼 흩어지지 않고, 정통 사주와 궁합, 저장형 리포트가 어디서 시작되는지 바로 보이도록
                  정리합니다. 무료 운세는 유입용으로 두고, 본 서비스는 더 앞에 세웁니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUESTION_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onSelectTopic(chip.key)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm transition-colors',
                    selectedTopic === chip.key
                      ? 'border-[#d2b072]/60 bg-[#d2b072]/15 text-[#fff0c6]'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 sm:col-span-2">
                <div className="text-xs uppercase tracking-[0.22em] text-[#d2b072]/78">{focusMeta.badge}</div>
                <div className="mt-3 text-2xl font-semibold text-[#f7ecd5]">{preview.signal}</div>
                <p className="mt-3 text-sm leading-7 text-white/60">{preview.summary}</p>
              </div>

              <div className="rounded-[26px] border border-[#d2b072]/18 bg-[#d2b072]/8 p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-[#d2b072]/82">Preview Score</div>
                <div className="mt-3 text-4xl font-semibold text-[#f7ecd5]">{preview.score}</div>
                <p className="mt-2 text-sm leading-6 text-white/62">{preview.action}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/saju/new"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'h-12 rounded-full bg-[#d2b072] px-6 text-sm font-semibold text-[#111827] hover:bg-[#e0c28a]'
                )}
              >
                  정통 사주 시작
              </Link>
              <Link
                href="/#compatibility-lab"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'h-12 rounded-full border-white/15 bg-white/5 px-6 text-sm text-white hover:bg-white/10 hover:text-white'
                )}
              >
                  궁합 구조 먼저 보기
              </Link>
              <Link
                href="/today-fortune"
                className="inline-flex items-center text-sm text-white/62 underline underline-offset-4 transition-colors hover:text-[#f7ecd5]"
              >
                무료운세는 가볍게 둘러보기
              </Link>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              {TRUST_POINTS.map((point) => (
                <span
                  key={point}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/65"
                >
                  {point}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <article className="rounded-[28px] border border-[#d2b072]/20 bg-[linear-gradient(180deg,rgba(8,16,31,0.92),rgba(20,31,52,0.82))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.5)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[#d2b072]/75">Main Service</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#f8f1df]">질문형 사주 리포트</h2>
                </div>
                <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
                  30초 안 첫 결과
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.78fr_1fr]">
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#111c34_0%,#0a1224_100%)] p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">{focusMeta.badge}</div>
                  <div className="mt-3 text-3xl font-semibold text-[#f7ecd5]">{focusMeta.label} 리포트</div>
                  <div className="mt-6 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/60">
                      총운과 핵심 포인트를 먼저 요약 카드로 보여줍니다.
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/60">
                      필요할 때만 코인으로 연애·재물·직장 심화 리포트를 엽니다.
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div>
                    <div className="text-sm text-white/45">시작 순서</div>
                    <div className="mt-3 grid gap-3">
                      {[
                        '생년월일만 넣고 바로 첫 결과 보기',
                        '결과를 저장하고 다시보기 동선으로 연결',
                        '심화 해석은 코인과 멤버십으로 확장',
                      ].map((step, index) => (
                        <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-[#d2b072]/78">
                            Step {index + 1}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-white/68">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-sm text-white/45">본 서비스 우선</div>
                <div className="mt-2 text-xl font-semibold text-[#f7ecd5]">정통사주 → 궁합 → 저장/결제</div>
                <p className="mt-3 text-sm leading-6 text-white/58">
                  Day 3 기준 홈은 본 서비스 시작선을 먼저 보여주고, 무료 운세는 뒤쪽 탐색 구간으로 분리합니다.
                </p>
              </div>

              <div className="rounded-3xl border border-[#d2b072]/18 bg-[#d2b072]/8 p-5">
                <div className="text-sm text-[#d2b072]/80">무료 유입은 분리</div>
                <div className="mt-2 text-xl font-semibold text-[#f7ecd5]">SEO 입구는 따로, 서비스 진입은 더 선명하게</div>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  오늘의 운세, 타로, 띠별, 꿈해몽은 유입과 첫 경험용으로 유지하되 본 서비스와 같은 무게로 섞지 않습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
