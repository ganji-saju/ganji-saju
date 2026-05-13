import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { SERVICE_ENTRY_CARDS } from '@/features/home/content';
import { cn } from '@/lib/utils';

export default function ServiceEntrySection() {
  return (
    <section id="core-service" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-[#d2b072]/75">Core Service</p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#f8f1df]">
            어디서 시작해야 할지 명확한 본 서비스 입구
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            홈은 더 이상 메뉴를 많이 보여주는 포털이 아니라, 정통사주와 궁합, 저장형 리포트가 어디서 시작되는지 먼저 알려주는
            앱 셸처럼 동작해야 합니다.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/62">
          무료 유입 메뉴는 아래에서 별도로 탐색
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_1fr]">
        {SERVICE_ENTRY_CARDS.map((card, index) => (
          <article
            key={card.title}
            className="flex h-full flex-col rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
          >
            <div className="text-xs uppercase tracking-[0.2em] text-[#d2b072]/78">{card.eyebrow}</div>
            <h3 className="mt-4 text-2xl font-semibold text-[#f8f1df]">{card.title}</h3>
            <p className="mt-4 flex-1 text-sm leading-7 text-white/58">{card.body}</p>
            <Link
              href={card.href}
              className={cn(
                buttonVariants({ variant: index === 0 ? 'default' : 'outline' }),
                'mt-6 rounded-full px-5',
                index === 0
                  ? 'bg-[#d2b072] text-[#111827] hover:bg-[#e3c68d]'
                  : 'border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white'
              )}
            >
              {card.cta}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
