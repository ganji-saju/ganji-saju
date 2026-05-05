import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppShell } from '@/shared/layout/app-shell';
import {
  GangiIntro,
  GangiMetricBar,
  GangiPageHeader,
} from '@/components/gangi/gangi-ui';

export const metadata: Metadata = {
  title: '대운 · 올해 흐름',
  description: '10년 흐름과 올해 밀어도 되는 달을 모바일 운세형 카드로 확인하는 달빛인생 대운 화면입니다.',
  alternates: { canonical: '/daewoon' },
};

const PERIODS = [
  { age: '20대', years: '20-29세', title: '탐색기', desc: '방향을 잡는 시간', score: 65, color: '#94c094' },
  { age: '30대', years: '30-39세', title: '성장기', desc: '기반을 다지는 시간', score: 78, color: '#6db0c4' },
  { age: '40대', years: '40-49세', title: '전환기', desc: '큰 흐름이 바뀌는 시간', score: 88, color: '#e89a8a', current: true },
  { age: '50대', years: '50-59세', title: '수확기', desc: '결실이 이어지는 시간', score: 82, color: '#d49a3a' },
  { age: '60대', years: '60-69세', title: '정리기', desc: '나누고 정리하는 시간', score: 70, color: '#ecd2a5' },
] satisfies Array<{
  age: string;
  years: string;
  title: string;
  desc: string;
  score: number;
  color: string;
  current?: boolean;
}>;

export default function DaewoonPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <div className="gangi-subpage">
        <GangiPageHeader title="대운" />
        <GangiIntro
          eyebrow="10년 흐름"
          title={
            <>
              앞으로의 흐름을
              <br />
              한눈에 봐요
            </>
          }
          description="정확한 풀이는 생년월일 입력 뒤 열립니다. 여기서는 어떤 방식으로 보여드릴지 먼저 확인하세요."
        />

        <section className="px-5 pb-6">
          <div className="gangi-pink-panel p-5">
            <p className="gangi-sub-eyebrow mb-0">현재 흐름 예시</p>
            <h2 className="mt-3 font-[var(--font-classic)] text-[1.35rem] font-black leading-snug text-[var(--app-ink)]">
              지금은 큰 흐름이
              <br />
              바뀌는 전환기예요
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[rgba(17,17,20,0.64)]">
              실제 결과에서는 내 생년월일 기준으로 현재 대운과 올해 흐름을 이어서 보여드립니다.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {PERIODS.map((period) => (
              <article
                key={period.age}
                className={`gangi-card-panel p-4 ${period.current ? 'border-[var(--app-pink)] bg-[var(--app-pink-soft)]' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <strong className="text-sm font-black text-[var(--app-ink)]">{period.age}</strong>
                    <span className="ml-2 text-xs font-bold text-[rgba(17,17,20,0.56)]">{period.years}</span>
                    {period.current ? (
                      <span className="ml-2 rounded-full bg-[var(--app-pink)] px-2 py-0.5 text-[10px] font-black text-white">
                        NOW
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-black" style={{ color: period.color }}>
                    {period.score}
                  </span>
                </div>
                <h3 className="mt-2 font-[var(--font-classic)] text-base font-black">{period.title}</h3>
                <p className="mt-1 text-xs font-bold text-[rgba(17,17,20,0.64)]">{period.desc}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 gangi-card-panel p-4">
            <GangiMetricBar label="올해 움직임" value={88} color="#e6549a" />
          </div>

          <Link href="/saju/new?focus=year&product=year-core" className="mt-5 flex h-12 items-center justify-center rounded-[0.9rem] bg-[var(--app-pink)] text-sm font-black text-white">
            내 생년월일로 올해 흐름 보기
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
