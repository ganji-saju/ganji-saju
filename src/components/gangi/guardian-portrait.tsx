'use client';
// 2026-08-28 — 12지신 수호신 카드 초상. 정지 이미지가 진실이고, 영상은 **얹는 것**이다.
//
//   ⚠️ 포스터는 원본 guardians/{id}.jpg 가 아니라 **영상의 첫 프레임**(motion/{id}.webp)이다.
//      영상은 원본을 다시 렌더한 결과라 프레이밍이 미세하게 다르다. 원본을 포스터로 쓰면
//      재생이 시작되는 순간 그림이 한 번 튄다.
//
//   받지 않는 조건(영상에 src 를 아예 붙이지 않아 네트워크 요청이 0이다):
//     · prefers-reduced-motion: reduce  — 접근성. 움직임에 불편한 사용자가 있다.
//     · navigator.connection.saveData   — 데이터 절약 모드.
//   화면 밖이면 재생하지 않는다(IntersectionObserver) — 12장이 동시에 디코딩되면
//   저사양 기기에서 스크롤이 끊긴다.
//
//   iOS 저전력 모드는 autoplay 를 막는다. play() 가 거부되면 포스터가 그대로 남는 게
//   정상 동작이라 따로 처리하지 않는다(에러를 삼키되 화면은 깨지지 않는다).
import { useEffect, useRef, useState } from 'react';

const MOTION_BASE = '/images/gangi/guardians/motion';

export function GuardianPortrait({
  id,
  alt,
  className,
}: {
  /** guardians/{id}.jpg 의 id — 12지신 키. */
  id: string;
  alt: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ??
      false;
    setAllowMotion(!reduce && !saveData);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !allowMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // src 는 여기서 처음 붙는다 — 화면에 들어오기 전엔 한 바이트도 받지 않는다.
          if (!el.getAttribute('src')) el.setAttribute('src', `${MOTION_BASE}/${id}.mp4`);
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [allowMotion, id]);

  // 움직임을 안 쓰는 경우엔 video 를 만들지 않는다(디코더도, 요청도 없다).
  if (!allowMotion) {
    return (
      <picture>
        <source srcSet={`${MOTION_BASE}/${id}.webp`} type="image/webp" />
        <img src={`/images/gangi/guardians/${id}.jpg`} alt={alt} loading="lazy" decoding="async" className={className} />
      </picture>
    );
  }

  return (
    <video
      ref={videoRef}
      poster={`${MOTION_BASE}/${id}.webp`}
      preload="none"
      muted
      loop
      playsInline
      // 장식이 아니라 카드의 주 이미지다 — 스크린리더에 이름을 준다.
      role="img"
      aria-label={alt}
      className={className}
    />
  );
}
