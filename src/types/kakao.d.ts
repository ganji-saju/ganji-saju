// 카카오 JavaScript SDK 최소 타입 선언 (공유하기 sendDefault 용).
// 전체 SDK 타입이 아닌, 이 앱이 실제 사용하는 표면만 선언한다.

interface KakaoLinkObject {
  mobileWebUrl: string;
  webUrl: string;
}

interface KakaoShareFeedContent {
  title: string;
  description?: string;
  imageUrl: string;
  link: KakaoLinkObject;
}

interface KakaoShareButton {
  title: string;
  link: KakaoLinkObject;
}

interface KakaoShareDefaultFeed {
  objectType: 'feed';
  content: KakaoShareFeedContent;
  buttons?: KakaoShareButton[];
}

interface KakaoStatic {
  init(appKey?: string): void;
  isInitialized(): boolean;
  Share?: {
    sendDefault(settings: KakaoShareDefaultFeed): void;
  };
}

interface Window {
  Kakao?: KakaoStatic;
}
