import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppShell } from '@/shared/layout/app-shell';
import { GangiIntro, GangiPageHeader } from '@/components/gangi/gangi-ui';

export const metadata: Metadata = {
  title: '좋은 날',
  description: '결혼, 이사, 계약, 오픈처럼 중요한 날을 고르는 달빛인생 좋은 날 화면입니다.',
  alternates: { canonical: '/taekil' },
};

const PURPOSES = [
  { key: 'wedding', label: '결혼·약혼', color: '#e6549a' },
  { key: 'open', label: '개업·오픈', color: '#d49a3a' },
  { key: 'move', label: '이사·입주', color: '#3f7a8c' },
  { key: 'contract', label: '계약·서명', color: '#5b8a5b' },
  { key: 'trip', label: '여행·출발', color: '#8a6a3a' },
  { key: 'etc', label: '기타', color: '#7e7c8a' },
] as const;

const DAYS = [
  { date: '11월 12일', weekday: '수', score: 92, label: '최상' },
  { date: '11월 18일', weekday: '화', score: 86, label: '좋음' },
  { date: '11월 25일', weekday: '화', score: 80, label: '좋음' },
] as const;

export default function TaekilPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <div className="gangi-subpage">
        <GangiPageHeader title="좋은 날" />
        <GangiIntro
          eyebrow="택일"
          title={
            <>
              어떤 날을
              <br />
              잡아드릴까요?
            </>
          }
          description="목적을 고르면 좋은 날, 한 번 더 확인할 날, 피하면 좋은 날을 달력형으로 이어볼 수 있게 준비합니다."
        />

        <section className="gangi-topic-grid">
          {PURPOSES.map((purpose) => (
            <Link key={purpose.key} href={`/saju/new?focus=year&product=monthly-calendar&purpose=${purpose.key}`} className="gangi-topic-card">
              <span className="gangi-topic-icon" style={{ color: purpose.color, background: `${purpose.color}22` }}>
                <CalendarDays className="h-5 w-5" />
              </span>
              <h2>{purpose.label}</h2>
              <p>추천 날짜 보기</p>
            </Link>
          ))}
        </section>

        <section className="px-5 pb-6">
          <div className="gangi-pink-panel p-5">
            <p className="gangi-sub-eyebrow mb-0">예시</p>
            <h2 className="mt-3 text-[1.28rem] font-bold leading-snug text-[var(--app-ink)]">
              앞으로 두 달,
              <br />
              먼저 볼 날을 골라드려요
            </h2>
            <div className="mt-4 space-y-2.5">
              {DAYS.map((day, index) => (
                <div key={day.date} className="gangi-card-panel flex items-center gap-3 p-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-[var(--app-line)] bg-white">
                    <span className="text-[10px] font-bold text-[var(--app-pink-strong)]">{day.date.split(' ')[0]}</span>
                    <strong className=" text-xl leading-none">{Number.parseInt(day.date.split(' ')[1], 10)}</strong>
                    <span className="text-[9px] font-medium text-[rgba(17,17,20,0.56)]">{day.weekday}요일</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{day.label}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f4f4f6]">
                      <span className="block h-full rounded-full bg-[var(--app-pink)]" style={{ width: `${day.score}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-[rgba(17,17,20,0.56)]">점수 {day.score} · 추천 {index + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
