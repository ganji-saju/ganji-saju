// 2026-05-14: 모션 13종을 한 화면에 배치 + replay 버튼 + reduced-motion 표시.
'use client';

import { useState } from 'react';
import {
  MotionChartDraw,
  MotionCoinSuccess,
  MotionHanjaMorph,
  MotionInputFocus,
  MotionModalAppear,
  MotionPageTransition,
  MotionPalshjaShuffle,
  MotionPushArrive,
  MotionResultReveal,
  MotionSajuLoading,
  MotionSpinners,
  MotionTarotFlip,
  MotionToastStack,
  useReducedMotion,
} from '@/components/motion/motion-primitives';

interface BoardEntry {
  id: string;
  title: string;
  duration: string;
  trigger: string;
  render: (active: boolean) => React.ReactNode;
}

const BOARDS: BoardEntry[] = [
  {
    id: 'm-loading',
    title: '51 · 사주 분석 로딩',
    duration: '6s 루프',
    trigger: '사주 시작 / today-detail unlock 시 GangiLoadingOverlay',
    render: (active) => <MotionSajuLoading active={active} />,
  },
  {
    id: 'm-reveal',
    title: '52 · 결과 카드 등장',
    duration: '6s (stagger)',
    trigger: '사주 결과 / 오늘운세 결과 첫 진입',
    render: (active) => <MotionResultReveal active={active} />,
  },
  {
    id: 'm-tarot',
    title: '53 · 타로 카드 플립',
    duration: '6s',
    trigger: '타로 카드 선택',
    render: (active) => <MotionTarotFlip active={active} />,
  },
  {
    id: 'm-coin',
    title: '54 · 코인 충전 성공',
    duration: '5s',
    trigger: '/credits/success',
    render: (active) => <MotionCoinSuccess active={active} />,
  },
  {
    id: 'm-page',
    title: '55 · 페이지 전환',
    duration: '5s 루프',
    trigger: 'router.push (사주 시작 → 결과)',
    render: (active) => <MotionPageTransition active={active} />,
  },
  {
    id: 'm-modal',
    title: '56 · 모달 등장',
    duration: '5s',
    trigger: 'drawer/sheet 오픈',
    render: (active) => <MotionModalAppear active={active} />,
  },
  {
    id: 'm-toast',
    title: '57 · 토스트 시퀀스',
    duration: '6s',
    trigger: '결제/저장/복사 후 알림 큐',
    render: (active) => <MotionToastStack active={active} />,
  },
  {
    id: 'm-push',
    title: '58 · 푸시 알림 도착',
    duration: '5s',
    trigger: 'web push 수신 preview',
    render: (active) => <MotionPushArrive active={active} />,
  },
  {
    id: 'm-hanja',
    title: '59 · 한자 변환',
    duration: '6s 루프',
    trigger: '12간지 chip / 사주팔자 한자 morph',
    render: (active) => <MotionHanjaMorph active={active} />,
  },
  {
    id: 'm-spinners',
    title: '60 · 로딩 스피너 6종',
    duration: '3s 루프',
    trigger: 'inline 로딩 (사주 분석/결제/알림 등)',
    render: (active) => <MotionSpinners active={active} />,
  },
  {
    id: 'm-input',
    title: '61 · 인풋 포커스/검증',
    duration: '5s 루프',
    trigger: 'birth info / login form focus',
    render: (active) => <MotionInputFocus active={active} />,
  },
  {
    id: 'm-chart',
    title: '62 · 차트 그리기',
    duration: '6s',
    trigger: '오행 균형 / fortune calendar tone bar',
    render: (active) => <MotionChartDraw active={active} />,
  },
  {
    id: 'm-palshja',
    title: '63 · 사주팔자 셔플',
    duration: '6s',
    trigger: '사주 분석 loading 내 8글자 슬롯',
    render: (active) => <MotionPalshjaShuffle active={active} />,
  },
];

export function MotionGalleryClient() {
  const reduced = useReducedMotion();
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="space-y-4">
      {/* §Hero */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          design QA · 운영 노출 X
        </div>
        <h1
          className="mt-1.5 text-[20px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          모션 13종 한눈에 검수
        </h1>
        <p className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]">
          각 카드는 production motion primitive (`src/components/motion/motion-primitives.tsx`)
          와 동일한 컴포넌트를 사용합니다. `prefers-reduced-motion: reduce`
          상태이면 모든 keyframe 이 비활성화되고 최종 상태만 표시됩니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full border bg-white px-2.5 py-1 text-[11px] font-extrabold"
            style={{
              borderColor: reduced ? 'rgba(184,122,20,0.28)' : 'rgba(45,135,88,0.28)',
              color: reduced ? '#b87a14' : 'var(--app-jade)',
            }}
          >
            {reduced ? '⚠ reduced-motion 활성 (애니메이션 OFF)' : '✓ 정상 motion'}
          </span>
          <button
            type="button"
            onClick={() => setResetKey((v) => v + 1)}
            className="inline-flex h-9 items-center gap-1 rounded-full border bg-white px-3 text-[12px] font-extrabold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            ↻ 모든 모션 재시작
          </button>
        </div>
      </article>

      {/* §보드 그리드 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {BOARDS.map((board) => (
          <article
            key={board.id}
            id={board.id}
            className="rounded-[18px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  {board.duration}
                </div>
                <h2 className="mt-0.5 text-[15px] font-extrabold leading-[1.4] text-[var(--app-ink)]">
                  {board.title}
                </h2>
                <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--app-copy-muted)]">
                  trigger: {board.trigger}
                </p>
              </div>
              <a
                href={`#${board.id}`}
                className="text-[10.5px] font-extrabold text-[var(--app-pink-strong)] underline-offset-2 hover:underline"
                aria-label={`${board.id} 앵커 링크`}
              >
                #{board.id}
              </a>
            </div>
            <div className="mt-3 rounded-[12px] bg-[#fafafa] p-3" key={resetKey}>
              {board.render(true)}
            </div>
          </article>
        ))}
      </div>

      {/* §footer */}
      <article
        className="rounded-[14px] border bg-white p-4"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
          source of truth
        </div>
        <ul className="mt-2 grid gap-1 text-[11.5px] leading-[1.55] text-[var(--app-copy)]">
          <li>· primitive: <code>src/components/motion/motion-primitives.tsx</code></li>
          <li>· CSS: <code>src/components/motion/motion-primitives.css</code></li>
          <li>· spec: <code>docs/design/ganji-redesign/source/03_MOTION_IMPLEMENTATION_SPEC.md</code></li>
          <li>· manifest: <code>docs/design/ganji-redesign/BOARD_MANIFEST.md</code></li>
        </ul>
      </article>
    </div>
  );
}
