// 12간지 로딩 화면.
//
// 2026-05-16 PR #154 최초판은 보라 그라데이션 카드 + 별입자 배경이었다. 2026-08-25 전면
// 개편으로 사이트가 한지(#FBF7EE)+인주(#B3372A) 톤이 되면서 **로딩만 옛 브랜드로 남아**
// 페이지가 뜨는 순간 색이 튀었다(사용자 제보: "로딩화면 디자인이 구버전이라").
//
// 2026-08-29 재설계:
//   · 배경·카드를 한지 톤으로. 강조는 인주 한 곳(현재 수호신)에만 쓴다.
//   · 가운데에 **힉스필드 12지신 모션**(이미 있는 에셋)을 돌린다. 2.6s 마다 다음 지지로
//     넘어가고, 바깥 12지 한자 고리에서 지금 나온 지지가 인주로 켜진다 —
//     고리가 장식이 아니라 **지금 무엇이 도는지 가리키는 표시**가 된다.
//   · 영상은 한 번에 하나만 mount 한다(각 50~70KB). 로딩이 2초 만에 끝나면 1개만 받는다.
//   · prefers-reduced-motion 이면 회전·순환을 멈추고 포스터 한 장으로 선다.
//
// 유지해야 하는 것:
//   · props(title/description/steps) — 호출자 8곳이 그대로 쓴다.
//   · createPortal(document.body) — 조상 transform(app-fade-up)이 position:fixed 의
//     containing block 을 만들어 오버레이가 엉뚱한 자리에 뜨던 회귀(2026-05-16).
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './zodiac-wheel-loading.css';

/** 12지: 지지 한자 · 모션 에셋 id · 우리말 이름. 순서가 곧 고리 배치 순서다. */
const BRANCHES = [
  { char: '子', id: 'rat', name: '쥐' },
  { char: '丑', id: 'ox', name: '소' },
  { char: '寅', id: 'tiger', name: '호랑이' },
  { char: '卯', id: 'rabbit', name: '토끼' },
  { char: '辰', id: 'dragon', name: '용' },
  { char: '巳', id: 'snake', name: '뱀' },
  { char: '午', id: 'horse', name: '말' },
  { char: '未', id: 'sheep', name: '양' },
  { char: '申', id: 'monkey', name: '원숭이' },
  { char: '酉', id: 'rooster', name: '닭' },
  { char: '戌', id: 'dog', name: '개' },
  { char: '亥', id: 'pig', name: '돼지' },
] as const;

const MOTION_BASE = '/images/gangi/guardians/motion';
/** 한 지지가 화면에 서 있는 시간. 너무 짧으면 영상이 시작도 못 하고 넘어간다. */
const ROTATE_MS = 2600;
/** 고리 반지름 — 무대 크기 대비 %. px 로 박으면 좁은 폰(320px)에서 카드 밖으로 넘친다. */
const RADIUS_PCT = 40;

const DEFAULT_STEPS = [
  '네 기둥(年月日時) 세우는 중',
  '오행 균형 재는 중',
  '오늘 일진과 맞춰보는 중',
  '풀이 문장 다듬는 중',
];

interface Props {
  title?: string;
  description?: string;
  /** 진행 단계. 4개로 정규화된다(애니메이션 delay 가 4개 고정). */
  steps?: string[];
}

export function ZodiacWheelLoading({
  title = '사주를 풀어드리고 있어요',
  description = '네 기둥(年月日時)을 세우고 오늘 흐름과 맞춰보는 중입니다.',
  steps,
}: Props) {
  const normalizedSteps = useMemo(() => {
    const list = steps && steps.length > 0 ? steps : DEFAULT_STEPS;
    if (list.length >= 4) return list.slice(0, 4);
    const filled = [...list];
    while (filled.length < 4) filled.push(list[filled.length % list.length]!);
    return filled;
  }, [steps]);

  // SSR 엔 document 가 없다. portal 은 mount 후에만.
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    // 매번 같은 지지로 시작하면 로딩이 한 캐릭터의 화면처럼 보인다. 진입마다 다르게.
    const start = Math.floor(Math.random() * BRANCHES.length);
    setIndex(start);
    if (media.matches) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % BRANCHES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const ring = useMemo(
    () =>
      BRANCHES.map((branch, i) => {
        const rad = ((-90 + i * 30) * Math.PI) / 180;
        return {
          ...branch,
          // left/top 의 % 는 부모(무대) 기준이라 무대가 줄면 고리도 같이 준다.
          x: Math.cos(rad) * RADIUS_PCT,
          y: Math.sin(rad) * RADIUS_PCT,
        };
      }),
    []
  );

  if (!mounted) return null;

  const current = BRANCHES[index]!;

  const overlay = (
    <div className="zodiac-loading" role="status" aria-live="polite">
      <div className="zodiac-loading-card">
        <p className="zodiac-loading-eyebrow">십이지 &middot; 十二支</p>

        <div className="zodiac-loading-stage">
          {/* 12지 한자 고리 — 지금 도는 지지가 인주로 켜진다. */}
          <div className="zodiac-loading-ring" aria-hidden="true">
            {ring.map((branch, i) => (
              <span
                key={branch.char}
                className="zodiac-loading-branch"
                data-active={i === index}
                style={{
                  left: `calc(50% + ${branch.x.toFixed(3)}%)`,
                  top: `calc(50% + ${branch.y.toFixed(3)}%)`,
                }}
              >
                {/* 고리가 돌면 한자가 같이 기울어진다 — 안쪽에서 같은 속도로 되돌린다. */}
                <span className="zodiac-loading-glyph">{branch.char}</span>
              </span>
            ))}
          </div>

          {/* 가운데 수호신 모션 — 한 번에 하나만 mount 해 그만큼만 내려받는다. */}
          <div className="zodiac-loading-orb">
            <video
              key={current.id}
              className="zodiac-loading-video"
              src={`${MOTION_BASE}/${current.id}.mp4`}
              poster={`${MOTION_BASE}/${current.id}.webp`}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* 화면에 이름을 띄워 '무엇이 도는지'를 글로도 준다(고리는 aria-hidden). */}
        <p className="zodiac-loading-guardian">
          <span className="zodiac-loading-guardian-char">{current.char}</span>
          {current.name} 수호신
        </p>

        <div className="zodiac-loading-copy">
          <p className="zodiac-loading-title">{title}</p>
          <p className="zodiac-loading-desc">{description}</p>
        </div>

        <div className="zodiac-loading-steps">
          {normalizedSteps.map((step, idx) => (
            <span key={idx} className="zodiac-loading-step">
              {step}
            </span>
          ))}
        </div>

        <div className="zodiac-loading-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
