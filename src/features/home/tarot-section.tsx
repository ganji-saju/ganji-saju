import { Badge } from '@/components/ui/badge';
import { TAROT_TOPICS } from '@/features/home/content';

export default function TarotSection() {
  return (
    <section className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(2,8,23,0.96),rgba(7,19,39,0.92))]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#d2b072]/75">Topic Expansion</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#f8f1df]">
              타로는 무입력 첫 경험 뒤에 따라오는 가벼운 확장선
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            타로는 본 서비스의 핵심이 아니라, 무료 경험에서 감각을 만들고 주제형 마이크로 결제로 확장하는 보조 축으로 둡니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TAROT_TOPICS.map((topic) => (
            <article key={topic.title} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[#f8f1df]">{topic.title}</h3>
                <Badge className="border-white/10 bg-white/5 text-white/55">{topic.status}</Badge>
              </div>
              <p className="text-sm leading-7 text-white/58">{topic.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
