import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { MEMBERSHIP_POINTS } from '@/features/home/content';
import { cn } from '@/lib/utils';

export default function MembershipSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid gap-5 rounded-[32px] border border-[#d2b072]/18 bg-[linear-gradient(135deg,rgba(210,176,114,0.1),rgba(10,18,36,0.92))] p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[#d2b072]/75">Membership</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#f8f1df]">
            단건 리포트를 넘어서 다시 오게 만드는 달빛 멤버십
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {MEMBERSHIP_POINTS.map((point) => (
              <span
                key={point}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/68"
              >
                {point}
              </span>
            ))}
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/58">
            월간 리포트 한 개를 파는 것이 아니라, 데일리 소비와 저장 가치를 묶어 반복 효용으로 설계합니다. 사주 리포트와 MY
            보관함이 연결될수록 멤버십의 이유도 더 선명해집니다.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            href="/membership"
            className={cn(
              buttonVariants({ variant: 'default' }),
              'h-12 rounded-full bg-[#d2b072] px-6 text-sm font-semibold text-[#111827] hover:bg-[#e3c68d]'
            )}
          >
              멤버십 보기
          </Link>
          <Link
            href="/credits"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-12 rounded-full border-white/15 bg-white/5 px-6 text-sm text-white hover:bg-white/10 hover:text-white'
            )}
          >
              코인 센터 열기
          </Link>
        </div>
      </div>
    </section>
  );
}
