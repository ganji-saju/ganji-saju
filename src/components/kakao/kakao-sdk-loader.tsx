// 카카오 JavaScript SDK 로더 — 루트 <body> 에 1회 마운트.
// NEXT_PUBLIC_KAKAO_JS_KEY 가 없으면 아무 것도 로드하지 않음(키 세팅 전 안전).
// SRI(integrity)는 SDK 버전마다 값이 달라 하드코딩 시 버전업에서 깨질 수 있어 생략.
// 필요 시 카카오 문서의 해당 버전 integrity/crossOrigin 를 추가할 것.
'use client';

import Script from 'next/script';

const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

export function KakaoSdkLoader() {
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!jsKey) return null;

  return (
    <Script
      src={KAKAO_SDK_SRC}
      strategy="afterInteractive"
      onLoad={() => {
        const kakao = window.Kakao;
        if (kakao && !kakao.isInitialized()) {
          kakao.init(jsKey);
        }
      }}
    />
  );
}
