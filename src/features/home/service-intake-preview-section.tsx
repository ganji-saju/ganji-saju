import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { QUESTION_CHIPS } from '@/features/home/content';
import { FOCUS_TOPIC_META, type FocusTopic } from '@/lib/saju/report';
import { cn } from '@/lib/utils';

interface ServiceIntakePreviewSectionProps {
  selectedTopic: FocusTopic;
  onSelectTopic: (topic: FocusTopic) => void;
}

export default function ServiceIntakePreviewSection({
  selectedTopic,
  onSelectTopic,
}: ServiceIntakePreviewSectionProps) {
  const focusMeta = FOCUS_TOPIC_META[selectedTopic];

  return (
    <section
      id="personalized-reading"
      className="border-y border-white/8 bg-[linear-gradient(180deg,rgba(7,19,39,0.82),rgba(2,8,23,0.96))]"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-20">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.24em] text-[#d2b072]/75">3-Step Intake</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#f8f1df]">
              무입력에서 정밀입력까지,
              <span className="block text-white/72">사주 시작 부담을 단계적으로 덜어낸 새 흐름</span>
            </h2>
            <p className="text-sm leading-7 text-white/60 sm:text-base">
              무료 콘텐츠로 먼저 감을 잡고, 생년월일만으로 요약 리포트를 본 뒤 필요하면 태어난 시간과 성별까지 더해
              정밀 해석으로 이어가는 구조입니다.
            </p>
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
                    ? 'border-[#d2b072]/55 bg-[#d2b072]/15 text-[#fff0c6]'
                    : 'border-white/10 bg-white/5 text-white/68 hover:border-white/20 hover:bg-white/10 hover:text-white'
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                title: '무입력',
                body: '오늘의 운세, 무료 타로, 꿈해몽처럼 가볍게 들어오는 무료 진입선입니다.',
              },
              {
                title: '저입력',
                body: '생년월일만 넣고 총운과 행동 제안을 먼저 보는 가장 추천되는 시작선입니다.',
              },
              {
                title: '정밀입력',
                body: '태어난 시간과 성별까지 반영해 더 깊은 사주 흐름으로 이어지는 확장선입니다.',
              },
            ].map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-sm font-medium text-[#f8f1df]">Step {index + 1}</div>
                <div className="mt-2 text-xl font-semibold text-[#f8f1df]">{step.title}</div>
                <p className="mt-3 text-sm leading-6 text-white/55">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,36,0.96),rgba(7,19,39,0.92))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:p-7">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/42">{focusMeta.badge}</div>
              <h3 className="mt-2 text-2xl font-semibold text-[#f8f1df]">{focusMeta.label} 기준으로 입력 방식 고르기</h3>
            </div>
            <Badge className="w-fit border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              추천: 저입력
            </Badge>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[24px] border border-[#d2b072]/18 bg-[#d2b072]/8 p-5">
              <div className="text-sm font-medium text-[#f8f1df]">정통 사주 전용 입력 화면으로 이동</div>
              <p className="mt-2 text-sm leading-7 text-white/60">
                <span className="font-medium text-[#f8f1df]">/saju/new</span>
                에서 무입력, 저입력, 정밀입력 중 하나를 고른 뒤 바로 시작할 수 있습니다. 현재 질문 포커스는
                {` ${focusMeta.label}`}로 이어집니다.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-[#f8f1df]">입력 검증도 한 곳에서 정리</div>
              <p className="mt-2 text-sm leading-7 text-white/60">
                생년월일의 실제 유효성, 정밀입력의 성별 선택, 태어난 시간 모름 허용 규칙까지 같은 validator로 맞췄습니다.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-[#f8f1df]">{focusMeta.label} 중심 리포트를 먼저 미리 보여드립니다</div>
              <p className="mt-2 text-sm leading-7 text-white/60">
                총운, 연애, 재물, 직장 점수와 행동 제안, 날짜 포인트를 먼저 확인한 뒤 필요하면 심화 해석으로 이어집니다.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/saju/new"
              className={cn(
                buttonVariants({ variant: 'default' }),
                'h-12 rounded-full bg-[#d2b072] px-6 text-sm font-semibold text-[#111827] hover:bg-[#e3c68d]'
              )}
            >
                3단계 입력 시작하기
            </Link>
            <Link
              href="/today-fortune"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-12 rounded-full border-white/15 bg-white/5 px-6 text-sm text-white hover:bg-white/10 hover:text-white'
              )}
            >
                무료운세 먼저 보기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
