import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { FREE_EXPERIENCES } from '@/features/home/content';
import { cn } from '@/lib/utils';

export default function SeoEntrySection() {
  return (
    <section id="seo-entry" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-[#d2b072]/75">Free Entry / SEO</p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#f8f1df]">가볍게 둘러보는 무료 입구는 뒤쪽 탐색 구간으로 분리</h2>
          <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            오늘의 운세, 무료 타로, 띠별, 꿈해몽은 검색과 첫 경험을 담당하는 유입선입니다. Day 3에서는 이들을 본 서비스와 같은
            무게로 앞세우지 않고, 탐색용 구간으로 한 단계 뒤에 배치합니다.
          </p>
        </div>

        <Link
          href="/saju/new"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white'
          )}
        >
            본 서비스로 돌아가기
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FREE_EXPERIENCES.map((item) => (
          <article key={item.title} className="flex h-full flex-col rounded-[26px] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[#f8f1df]">{item.title}</h3>
              <Badge
                className={cn(
                  'border text-xs',
                  item.status === '무입력'
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-white/55'
                )}
              >
                {item.status}
              </Badge>
            </div>
            <p className="flex-1 text-sm leading-7 text-white/58">{item.body}</p>
            <Link href={item.href} className="mt-6 text-sm text-[#d2b072] underline underline-offset-4 hover:text-[#e3c68d]">
              무료 메뉴 열기
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
