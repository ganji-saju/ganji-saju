// 2026-05-15 PR 1 — 운세톡톡 벤치마크 (간지사주_무료일진운세_적용방안.md §7 차별화 무기):
// "무료 일진 운세 끝에 '이번 10년 대운은?' CTA 로 유료 대운/세운 풀이로 자연 연결.
//  재방문 시키는 무료 일진 → 깊이 있는 유료 대운/세운으로 수익화."
//
// 사용자가 결과 페이지에서 자기 사주 reading slug 를 들고 있으므로 (sajuSlug) 바로
// /saju/[slug]/deep (대운 8단 풀이) 로 연결. slug 가 없으면 /saju/new 가입 유도.
import Link from 'next/link';

interface Props {
  sajuSlug: string | null;
}

export function TodayDaewoonCtaCard({ sajuSlug }: Props) {
  const href = sajuSlug ? `/saju/${encodeURIComponent(sajuSlug)}/deep` : '/saju/new';

  return (
    <article
      className="rounded-[18px] p-5 text-white"
      style={{
        background: 'linear-gradient(135deg, #1a1f3b 0%, #2a2f5a 100%)',
        boxShadow: '0 18px 44px rgba(15,23,42,0.22)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11.5px] font-extrabold text-white"
          style={{ background: 'var(--app-pink)' }}
        >
          10년 흐름
        </span>
        <span
          className="text-[15px] font-extrabold uppercase tracking-[0.04em]"
          style={{ opacity: 0.7 }}
        >
          DAEUN
        </span>
      </div>
      <h3 className="mt-2 text-[20.7px] font-extrabold leading-snug tracking-tight">
        오늘 흐름은 짧은 한 점 —
        <br />
        이번 10년 큰 흐름은 어떨까요?
      </h3>
      <p
        className="mt-2 text-[14.4px] leading-[1.6]"
        style={{ opacity: 0.72 }}
      >
        대운은 10년 단위로 인생의 챕터를 바꿉니다. 지금 어떤 챕터를 지나는지, 다음
        챕터는 언제 시작되는지 한 호흡에 풀어드립니다.
      </p>
      <ul
        className="mt-3 grid gap-1.5 text-[15px]"
        style={{ color: 'rgba(255,255,255,0.82)' }}
      >
        <li className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--app-pink)' }}
            aria-hidden="true"
          />
          현재 진행 중 대운 + 8단 풀이 (멘탈·관계·돈/커리어)
        </li>
        <li className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--app-pink)' }}
            aria-hidden="true"
          />
          교운기·12운성·원진 metadata 까지 한 화면
        </li>
        <li className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--app-pink)' }}
            aria-hidden="true"
          />
          무료 — 가입한 사주 그대로 바로 열람
        </li>
      </ul>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[15.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
      >
        {sajuSlug ? '내 대운 풀이 열기 →' : '사주 등록하고 대운 보기 →'}
      </Link>
    </article>
  );
}
