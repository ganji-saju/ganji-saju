// 카카오톡 공유(Kakao Share) 헬퍼.
// SDK(window.Kakao.Share)가 로드/init 된 경우에만 리치 피드 카드를 전송한다.
// SDK 미가용(키 미설정·미로드·데스크톱 등)이면 false 를 반환 → 호출측이 Web Share/클립보드로 폴백.
import { getCanonicalUrl, DEFAULT_OG_IMAGE } from '@/lib/site';

export interface KakaoSharePayload {
  /** 카드 제목. 예: "홍길동님의 사주 총평" */
  title: string;
  /** 카드 설명(1~2줄). 예: "오늘의 흐름과 조언 3가지 — 지금 확인" */
  description: string;
  /** 카드 썸네일. 반드시 https 절대경로 + 카카오 콘솔 등록 도메인. 800x400 권장. */
  imageUrl: string;
  /** 결과 페이지 절대 URL. */
  url: string;
  /** 하단 버튼 문구. 기본 "결과 보기". */
  buttonTitle?: string;
}

/**
 * 카카오톡으로 공유. SDK 가용 시 sendDefault 실행 후 true, 아니면 false.
 * 브라우저 클릭 핸들러 안에서만 호출(팝업/공유 시트가 제스처 컨텍스트 필요).
 */
export function shareToKakao(payload: KakaoSharePayload): boolean {
  if (typeof window === 'undefined') return false;
  const kakao = window.Kakao;
  if (!kakao || !kakao.Share || !kakao.isInitialized()) return false;

  const link = { mobileWebUrl: payload.url, webUrl: payload.url };
  try {
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: payload.title,
        description: payload.description,
        imageUrl: payload.imageUrl,
        link,
      },
      buttons: [{ title: payload.buttonTitle ?? '결과 보기', link }],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 서버 컴포넌트(결과 페이지)에서 payload 를 만든다. 경로는 canonical 절대 URL 로 변환.
 * imagePath 미지정 시 기본 OG 이미지 사용.
 */
export function buildKakaoShare(opts: {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
  buttonTitle?: string;
}): KakaoSharePayload {
  return {
    title: opts.title,
    description: opts.description,
    url: getCanonicalUrl(opts.path),
    imageUrl: getCanonicalUrl(opts.imagePath ?? DEFAULT_OG_IMAGE),
    buttonTitle: opts.buttonTitle,
  };
}
