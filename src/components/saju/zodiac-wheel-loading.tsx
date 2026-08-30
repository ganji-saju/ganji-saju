// 12간지 로딩 화면.
//
// 2026-05-16 PR #154 최초판은 보라 그라데이션 카드 + 별입자 배경이었다. 2026-08-25 전면
// 개편으로 사이트가 한지(#FBF7EE)+인주(#B3372A) 톤이 되면서 **로딩만 옛 브랜드로 남아**
// 페이지가 뜨는 순간 색이 튀었다(사용자 제보: "로딩화면 디자인이 구버전이라").
//
// 2026-08-29 재설계로 한지 톤을 입히면서, 가운데에는 이미 있던 **수호신 12종 클립을
// 2.6초마다 한 마리씩** 돌렸다. 12지를 보여주려고 12번에 나눠 보여준 셈이라
// 로딩이 짧게 끝나면 한 마리만 보고 끝났고, 바깥 한자 고리는 "지금 누구 차례인지"를
// 가리키느라 존재했다.
//
// 2026-08-30 — 12지신이 **한 화면에 함께** 서 있는 전용 모션으로 교체했다.
//   · 에셋 1개(zodiac-wheel.mp4, 140KB)면 끝난다. 12종 순환·프리로드·인덱스 상태가 전부 사라졌다.
//   · 순환이 없으니 "지금 누구" 표시도 필요 없다 — 한자 고리와 수호신 이름 줄을 걷어냈다.
//     십이지 한자는 아이브로우(十二支)가 계속 들고 있다.
//   · 원형 크롭은 장식이 아니라 **이음매 감추기**다. 영상 종이(#E8D8C7)가 카드
//     (#FFFDF7)보다 어두워 사각으로 두면 경계선이 보인다. 내접원은 12지신을 하나도
//     자르지 않는다(가장 튀어나온 닭 꼬리가 반지름의 93%, 소 지팡이 89% — 실측).
//
// 유지해야 하는 것:
//   · props(title/description/steps) — 호출자 2곳이 그대로 쓴다.
//   · createPortal(document.body) — 조상 transform(app-fade-up)이 position:fixed 의
//     containing block 을 만들어 오버레이가 엉뚱한 자리에 뜨던 회귀(2026-05-16).
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './zodiac-wheel-loading.css';

const MOTION_BASE = '/images/gangi/guardians/motion';
/** 12지신이 함께 선 원형 모션. 정지 화면(포스터)은 reduced-motion 에서 그대로 쓴다. */
const WHEEL_VIDEO = `${MOTION_BASE}/zodiac-wheel.mp4`;
const WHEEL_POSTER = `${MOTION_BASE}/zodiac-wheel.webp`;

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
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  if (!mounted) return null;

  const overlay = (
    <div className="zodiac-loading" role="status" aria-live="polite">
      <div className="zodiac-loading-card">
        <p className="zodiac-loading-eyebrow">십이지 &middot; 十二支</p>

        {/* 무대 전체가 12지신 원반이다. 안쪽 빈 자리는 원본 그림의 여백. */}
        <div className="zodiac-loading-stage">
          {reduced ? (
            <img className="zodiac-loading-wheel" src={WHEEL_POSTER} alt="" aria-hidden="true" />
          ) : (
            <video
              className="zodiac-loading-wheel"
              src={WHEEL_VIDEO}
              poster={WHEEL_POSTER}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          )}
        </div>

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
