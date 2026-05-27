// 2026-05-16 PR #154 — 회전하는 12간지 사주 로딩 모션.
// 첨부 AE 6초 시퀀스의 디자인 본질 (회전 12간지) 을 CSS+SVG 만으로 재현.
// 작업 완료 시 호출자가 unmount → fade-out. 최소 노출 시간 가드는 호출자 측.
//
// 2026-05-16 — 사용자 보고: 로딩 화면이 화면 정중앙이 아닌 엉뚱한 위치에서 떠
// 보이지 않는 회귀. 원인: 부모 `.app-shell-content` 의 `animation: app-fade-up`
// keyframe 이 `transform: translateY()` 를 사용해 `position: fixed` containing
// block 을 생성. fixed 가 viewport 가 아닌 부모 박스 원칙 위치됨.
// 해결: createPortal 로 document.body 에 직접 mount — ancestor transform 영향 0.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './zodiac-wheel-loading.css';

// 12 지지 한자 (子丑寅卯辰巳午未申酉戌亥) 와 30° 간격 배치.
const ZODIAC_CHARS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const DEFAULT_STEPS = [
  '네 기둥(年月日時) 정리 중...',
  '오행 균형 측정 중...',
  '오늘 일진 흐름 매칭 중...',
  '풀이 본문 다듬는 중...',
];

interface Props {
  title?: string;
  description?: string;
  /** 중앙 글자 (default: 月). */
  centerGlyph?: string;
  /** 진행 단계 4개 (1.5s씩 cycle). 4개 이상은 trim, 미만은 채움. */
  steps?: string[];
}

export function ZodiacWheelLoading({
  title = '사주를 풀어드리고 있어요',
  description = '네 기둥(年月日時)을 정리하고 오늘 흐름과 맞춰보는 중입니다.',
  centerGlyph = '月',
  steps,
}: Props) {
  const normalizedSteps = useMemo(() => {
    const list = steps && steps.length > 0 ? steps : DEFAULT_STEPS;
    // 정확히 4개로 맞춤 (animation-delay 가 4개 고정).
    if (list.length >= 4) return list.slice(0, 4);
    const filled = [...list];
    while (filled.length < 4) filled.push(list[filled.length % list.length]!);
    return filled;
  }, [steps]);

  // SSR 시 document 가 없으므로 mount 후에만 portal 생성.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 12 지지 글자 위치 — 반지름 88px, 12 슬롯 30°씩.
  // 12시 방향 (-90°) 부터 시계방향.
  const RADIUS = 88;
  const chars = ZODIAC_CHARS.map((ch, i) => {
    const angle = -90 + i * 30; // degrees
    const rad = (angle * Math.PI) / 180;
    const x = Math.cos(rad) * RADIUS;
    const y = Math.sin(rad) * RADIUS;
    return { ch, x, y };
  });

  if (!mounted) return null;

  const overlay = (
    <div className="zodiac-wheel-overlay" role="status" aria-live="polite">
      <div className="zodiac-wheel-card">
        <div className="zodiac-wheel-eyebrow">잠시만요</div>

        <div className="zodiac-wheel-stage" aria-hidden="true">
          {/* 외곽 회전 컨테이너 */}
          <div className="zodiac-wheel-ring-outer">
            {chars.map(({ ch, x, y }) => (
              <span
                key={ch}
                className="zodiac-wheel-char"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              >
                {ch}
              </span>
            ))}
          </div>

          {/* 안쪽 광원 ring (반대방향) */}
          <div className="zodiac-wheel-ring-inner" />

          {/* 중앙 코어 */}
          <div className="zodiac-wheel-core">
            <span className="zodiac-wheel-core-glyph">{centerGlyph}</span>
          </div>
        </div>

        <div className="zodiac-wheel-copy">
          <p className="zodiac-wheel-title">{title}</p>
          <p className="zodiac-wheel-desc">{description}</p>
        </div>

        {/* 진행 단계 fade cycle */}
        <div className="zodiac-wheel-step-stack" aria-live="polite">
          {normalizedSteps.map((step, idx) => (
            <span key={idx} className="zodiac-wheel-step">
              {step}
            </span>
          ))}
        </div>

        {/* 사주 4기둥 dots */}
        <div className="zodiac-wheel-dots" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
