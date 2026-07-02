// 발송대행사 어댑터. 현재 구현체: Solapi(솔라피).
// 대행사 교체 시 이 파일의 구현만 바꾸면 됨(send.ts 는 인터페이스만 의존).
//
// ⚠️ Solapi API 필드명(kakaoOptions.templateId / pfId / messageId 등)은 대행사
//    현행 문서 기준으로 go-live 전 재확인할 것. 인터페이스로 추상화돼 있어 조정은 국소적.
import crypto from 'node:crypto';
import { kakaoConfig } from './config';

export interface SendAlimtalkInput {
  /** 수신 번호(국내 하이픈 없는 11자리) */
  to: string;
  /** 승인 템플릿 코드 */
  templateCode: string;
  /** 템플릿 치환 변수. 예: { '#{name}': '홍길동' } */
  variables: Record<string, string>;
  /** 알림톡 실패 시 SMS 대체발송 여부(기본 비활성) */
  enableSmsFallback?: boolean;
}

export interface VendorSendResult {
  ok: boolean;
  status: 'sent' | 'failed';
  vendorMsgId?: string;
  error?: string;
}

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send';

/** Solapi HMAC-SHA256 인증 헤더: signature = HMAC(secret, date+salt) */
function solapiAuthHeader(): string {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto
    .createHmac('sha256', kakaoConfig.apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${kakaoConfig.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function solapiSendAlimtalk(input: SendAlimtalkInput): Promise<VendorSendResult> {
  try {
    const res = await fetch(SOLAPI_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: solapiAuthHeader(),
      },
      body: JSON.stringify({
        message: {
          to: input.to,
          from: kakaoConfig.sender || undefined,
          kakaoOptions: {
            pfId: kakaoConfig.pfId,
            templateId: input.templateCode,
            variables: input.variables,
            disableSms: !(input.enableSmsFallback ?? false),
          },
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { messageId?: string; groupId?: string; errorMessage?: string; errorCode?: string }
      | null;
    if (!res.ok) {
      return {
        ok: false,
        status: 'failed',
        error: data?.errorMessage ?? data?.errorCode ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: 'sent', vendorMsgId: data?.messageId ?? data?.groupId };
  } catch (e) {
    return { ok: false, status: 'failed', error: (e as Error).message };
  }
}

export interface SendFriendtalkInput {
  to: string;
  /** 이미 (광고)/무료수신거부 포맷이 적용된 본문 */
  text: string;
  /** Solapi 업로드 이미지 ID(선택, 와이드/이미지형 친구톡) */
  imageId?: string;
}

export async function solapiSendFriendtalk(input: SendFriendtalkInput): Promise<VendorSendResult> {
  try {
    const res = await fetch(SOLAPI_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: solapiAuthHeader(),
      },
      body: JSON.stringify({
        message: {
          to: input.to,
          from: kakaoConfig.sender || undefined,
          text: input.text,
          kakaoOptions: {
            // templateId 없이 자유 텍스트 → 친구톡(FTA). adFlag 는 대행사 옵션 기준으로 조정.
            pfId: kakaoConfig.pfId,
            adFlag: true,
            ...(input.imageId ? { imageId: input.imageId } : {}),
          },
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { messageId?: string; groupId?: string; errorMessage?: string; errorCode?: string }
      | null;
    if (!res.ok) {
      return {
        ok: false,
        status: 'failed',
        error: data?.errorMessage ?? data?.errorCode ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: 'sent', vendorMsgId: data?.messageId ?? data?.groupId };
  } catch (e) {
    return { ok: false, status: 'failed', error: (e as Error).message };
  }
}
