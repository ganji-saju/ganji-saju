# 카카오 연동 통합 가이드 — 공유하기 + 비즈니스 메시지

> 2026-07-02. 간지사주(Next.js 16 · Supabase · Vercel) 기준. "처음부터 상세하게" 요청 대응.
> **두 기능은 완전히 다릅니다.** 섞지 말고 A → B 순서로 접근하세요.

---

## 0. 두 기능은 다르다 (먼저 이걸 이해)

| 구분 | **A. 카카오톡 공유하기** | **B. 카카오 비즈니스 메시지(알림톡/친구톡)** |
|---|---|---|
| 방향 | 사용자 → 사용자(내가 친구에게) | **우리 서버 → 사용자**(자동 발송) |
| 트리거 | 사용자가 공유 버튼 클릭 | 이벤트(결제완료 등)·배치(cron) |
| 필요 키 | JavaScript 키(클라) | REST/발송대행사 API 키(서버) |
| 승인 절차 | 도메인 등록만(수분) | 비즈채널 전환·발신프로필·**템플릿 심의**(수일~수주) |
| 비용 | **무료** | **건당 과금**(알림톡 ~8~15원, 친구톡 ~13~25원 + 대행사비) |
| 개인정보 | 불필요 | **전화번호 수집**(알림톡) / **채널 친구**(친구톡) |
| 법규 | 없음 | **정보통신망법**(광고성 정보: 사전동의·야간금지·수신거부) |
| 난이도 | ★☆☆ (0.5~1일) | ★★★ (행정 1~3주 + 개발 1~2주) |

**결론 권장 순서:** ① A 공유(무료·바이럴, 즉시) → ② 알림톡 정보성(전화번호 수집부터) → ③ 친구톡 광고성(채널친구 확보 후).

---

## 1. 지금 코드베이스에 뭐가 있나 (= "여기서부터" 시작)

이미 있는 것:
- **카카오 로그인 완비**: `src/app/api/auth/kakao/start/route.ts` · `.../callback/route.ts` (인가코드/OIDC 플로우, REST 키 + client secret 사용). → **카카오 Developers 앱이 이미 존재**하고 도메인/키가 세팅돼 있음. 공유(A)는 이 앱을 그대로 재사용.
- **공유 버튼 UI**: `src/features/saju-detail/share-actions.tsx` — `ShareActions({ text, url })` 제네릭 컴포넌트. 채널 5개(카톡/인스타/스레드/트위터/복사). **단, 카톡 버튼이 카카오 SDK를 안 씀** — 현재는 Web Share API → 클립보드 fallback("카톡에 붙여넣으세요")로 동작. 즉 **가짜 카톡 공유**.
  - 사용처: **`src/app/saju/[slug]/share/page.tsx` 한 곳뿐** → 궁합/별자리/띠/타로엔 미적용.
- **웹푸시 알림 인프라(성숙함)**: `src/app/api/notifications/*` (subscribe·unsubscribe·dispatch·feed·click·heartbeat·preferences·test), `notification_delivery_logs` 테이블, `notification_preferences`, `src/lib/notifications.ts`, **cron dispatch 라우트(KST 시간대 분기 + `x-cron-secret` 게이트)**, web-push 키. → **알림톡/친구톡 발송(B)은 이 구조를 그대로 미러링**하면 됨(delivery_logs·preferences·dispatch cron·secret).
- **OG 이미지 시스템**(최근 2줄 로고로 교체 #566/#568) → 공유 카드 썸네일에 재사용.
- **결제/idempotency/cron 인프라**(payment_orders·idempotency 감사·CRON_SECRET) → 이벤트성 알림톡 트리거에 재사용.

없는 것(= 새로 추가):
- 카카오 **JavaScript SDK 로드 + JS 키**(공유 SDK용).
- 사용자 **전화번호**(알림톡 타겟) 및 수집/동의 플로우.
- **발송대행사** 연동, **비즈니스 채널** 전환, **템플릿 심의**.

---

# A. 카카오톡 공유하기 (Kakao Share) — 상세

가장 빠른 성과. 모든 메뉴 결과를 친구/채팅방에 리치 카드로 공유.

## A-1. 사전 준비 (콘솔, 코드 아님)

1. [Kakao Developers](https://developers.kakao.com) → 로그인에 쓰는 **기존 앱** 선택(새로 만들 필요 없음).
2. **앱 키 → JavaScript 키** 복사. (로그인은 REST 키, 공유 SDK는 JS 키)
3. **플랫폼 → Web** 에 사이트 도메인 등록: `https://ganjisaju.kr` (+ `https://www.ganjisaju.kr`, 로컬 개발용 `http://localhost:3000`).
4. **카카오톡 공유** 기능은 별도 승인 불필요(도메인만 맞으면 됨). 단 공유 카드의 이미지·링크 도메인이 등록 도메인과 일치해야 함.

## A-2. 환경변수

```
NEXT_PUBLIC_KAKAO_JS_KEY=<JavaScript 키>
```
- `NEXT_PUBLIC_` 접두사 필수(클라이언트 노출). Vercel 환경변수에 추가(Production/Preview/Development). JS 키는 도메인 화이트리스트로 보호되므로 노출돼도 오남용 어려움.

## A-3. SDK 로드 (1회, 전역)

앱 셸/루트 레이아웃에 `next/script`로 로드. (프로젝트가 Next 16 App Router이므로 `next/script` `afterInteractive` 사용)

```tsx
// src/shared/layout/app-shell.tsx (또는 루트 layout) 에 추가
import Script from 'next/script';

// ...JSX 내부, 최상단 근처
<Script
  src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
  integrity="sha384-..."   // 카카오 문서의 최신 SRI 해시 사용
  crossOrigin="anonymous"
  strategy="afterInteractive"
  onLoad={() => {
    // @ts-expect-error Kakao 전역
    if (window.Kakao && !window.Kakao.isInitialized()) {
      // @ts-expect-error
      window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
    }
  }}
/>
```

타입 안전을 위해 `src/types/kakao.d.ts` 로 최소 선언:

```ts
// src/types/kakao.d.ts
interface KakaoShareFeed {
  objectType: 'feed';
  content: { title: string; description?: string; imageUrl: string; link: { mobileWebUrl: string; webUrl: string } };
  buttons?: Array<{ title: string; link: { mobileWebUrl: string; webUrl: string } }>;
}
interface KakaoStatic {
  init(key?: string): void;
  isInitialized(): boolean;
  Share: { sendDefault(settings: KakaoShareFeed): void };
}
interface Window { Kakao?: KakaoStatic }
```

## A-4. 공유 로직 (share-actions.tsx 의 kakao 분기 교체)

현재 `share-actions.tsx` 의 `if (channel === 'kakao')` 블록을 실제 SDK 호출로:

```ts
// src/lib/kakao-share.ts (신규)
export interface KakaoSharePayload {
  title: string;        // 예: "홍길동님의 사주 총평"
  description: string;   // 예: "오늘의 흐름과 3가지 조언 — 지금 확인"
  imageUrl: string;      // https 절대경로 (등록 도메인, 800x400 권장)
  url: string;           // 결과 페이지 절대 URL
  buttonTitle?: string;  // 기본 "결과 보기"
}

export function shareToKakao(p: KakaoSharePayload): boolean {
  if (typeof window === 'undefined' || !window.Kakao?.Share) return false;
  if (!window.Kakao.isInitialized()) return false;
  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      link: { mobileWebUrl: p.url, webUrl: p.url },
    },
    buttons: [{ title: p.buttonTitle ?? '결과 보기', link: { mobileWebUrl: p.url, webUrl: p.url } }],
  });
  return true;
}
```

`ShareActions` 는 지금 `text`/`url` 만 받으므로, 카카오 리치카드용 `title`/`description`/`imageUrl` 을 받도록 props 확장:

```tsx
// share-actions.tsx — props에 kakao?: KakaoSharePayload 추가
if (channel === 'kakao') {
  if (props.kakao && shareToKakao(props.kakao)) return;   // ① SDK 성공
  const ok = await triggerWebShare({ text, url });         // ② Web Share fallback
  if (!ok) { /* 기존 클립보드 fallback 유지 */ }
  return;
}
```
- **하위호환**: `kakao` prop 없으면 기존 동작(fallback) 그대로 → 점진 적용 가능.

## A-5. 메뉴별 적용 (사주·궁합·별자리·띠·타로)

`ShareActions` 는 제네릭이므로 각 결과 페이지에서 메뉴 맞춤 payload만 주입:

| 메뉴 | 결과 라우트(현재) | 공유 title 예 | 상태 |
|---|---|---|---|
| 사주 | `saju/[slug]/share` | "OO님 사주 총평" | ShareActions 이미 있음 → payload만 추가 |
| 궁합 | `compatibility/result`, `gunghap` | "OO×OO 궁합 결과" | ShareActions **신규 배치** |
| 별자리 | `star-sign/[slug]` | "OO자리 이번 주 운세" | **신규 배치** |
| 띠운세 | `zodiac/[slug]` | "OO띠 오늘의 운세" | **신규 배치** |
| 타로 | `tarot/daily/result` | "오늘 뽑은 타로 3장" | **신규 배치** |

- `imageUrl` 은 메뉴별 OG 이미지(기존 OG 인프라 재사용) 또는 결과 동적 OG. **반드시 https 절대경로 + 등록 도메인**.
- 각 페이지는 서버에서 title/description/absoluteUrl/ogImage 를 만들어 `<ShareActions kakao={...} text=... url=... />` 로 전달.

## A-6. 흔한 함정
- **도메인 미등록** → `sendDefault` 무반응. 콘솔 플랫폼>Web 도메인 확인.
- **imageUrl 이 상대경로/http/미등록도메인** → 카드 이미지 안 뜸.
- **JS 키/REST 키 혼동** → 공유는 JS 키.
- **SDK 중복 init** → `isInitialized()` 가드.
- 카톡 인앱브라우저/데스크톱: `sendDefault` 는 카카오톡 설치 환경에서 최적. 미설치/데스크톱은 Web Share/복사 fallback 유지.
- **iOS Safari Web Share**: `navigator.share` 는 사용자 제스처(클릭) 컨텍스트에서만 → 이미 onClick 안이라 OK.

## A-7. 작업량
- 개발 0.5~1일(SDK 로드 + lib + share-actions 확장 + 4개 메뉴 배치), 비용 0.

---

# B. 카카오 비즈니스 메시지 (알림톡 / 친구톡) — 상세

우리가 사용자에게 자동 발송. **행정 절차가 개발보다 오래 걸림.** 먼저 성격부터 구분.

## B-1. 알림톡 vs 친구톡 (반드시 구분)

| | **알림톡(AlimTalk)** | **친구톡(FriendTalk)** |
|---|---|---|
| 성격 | **정보성**(거래/예약/인증) | **광고성 포함 가능**(마케팅) |
| 수신 대상 | **전화번호**(채널 친구 아니어도 됨) | **채널 친구**만 |
| 사전동의 | 정보성이면 불필요(단 범위 엄격) | **광고 수신동의 필수** |
| 템플릿 심의 | **필수**(고정 문구 + `#{변수}`) | 상대적으로 자유(이미지·와이드) |
| 미달 시 대체발송 | 실패 시 SMS/LMS 대체발송 가능 | 친구 아니면 발송 불가 |
| 야간(21~08) | 정보성은 가능 | **광고성 야간 금지** |
| 단가(대략) | 8~15원 | 13~25원 (+이미지) |

**핵심 판단:** "결제완료/구독만료 D-3/예약확정" = **정보성 → 알림톡**. "오늘의 운세 보러오세요/이벤트/신메뉴" = **광고성 → 친구톡**(또는 광고 알림톡, 동의·야간규정 적용).

## B-2. 필수 준비물 (행정 — 개발 전)

1. **카카오 비즈니스 계정** + **카카오톡 채널 개설** → **비즈니스 채널 전환**(사업자등록번호 인증). 간지사주 사업자 정보 필요.
2. **발송대행사 선정**(카카오는 개별 서비스에 알림톡 직접 API를 안 줌 → 공식 인증 대행사 경유):
   | 대행사 | 특징 | 비고 |
   |---|---|---|
   | **Solapi(솔라피)** | 개발자 친화 REST API·문서 좋음·SMS 통합 | 스타트업 추천 |
   | **NHN Cloud (Notification/KakaoTalk Bizmessage)** | 대형·안정·콘솔 | Toss가 NHN이라 익숙 |
   | **Aligo(알리고)** | 저렴·간단 | 소규모 |
   | **Bizm / 카카오 i Connect** | 엔터프라이즈 | |
   → **권장: Solapi 또는 NHN Cloud**(REST + delivery webhook 제공).
3. **발신프로필 등록**: 채널을 대행사에 연동(발신프로필 키 발급).
4. **템플릿 등록 + 심의**: 알림töク 문구를 대행사 콘솔에서 등록 → 카카오 심의(영업일 1~수일). 변수는 `#{name}` 형태. 반려 사유 흔함(광고성 표현·과도한 링크) → 정보성 문구로.
5. **전화번호 수집**(알림톡 대상): 현재 미수집 → 회원가입/결제/마이페이지에서 수집 + 저장 + (광고성이면)수신동의.

## B-3. 법규 — 정보통신망법 (광고성 정보 전송)

- **광고성**(친구톡·광고 알림톡): ① **사전 수신동의(옵트인)**, ② 제목/본문에 **(광고)** 및 **발신자 명시**, ③ **무료 수신거부 방법** 명시, ④ **야간(21:00~08:00) 발송 금지**, ⑤ 동의 이력 보관.
- **정보성**(거래 알림톡: 결제완료/예약확정/인증): 동의 불필요하나 **광고 문구 섞으면 광고성으로 재분류**됨 → 순수 정보만.
- 사주/운세 "보러 오세요"류는 **광고성**. 결제영수증·구독만료 안내는 정보성.
- 개인정보: 전화번호 수집 시 **이용약관/개인정보처리방침에 항목·목적 추가**(이미 `bundled-policies.ts`·`policy_versions` 있음 → 갱신).

## B-4. 아키텍처 (이 코드베이스 기준 — 웹푸시 인프라 미러링)

기존 `notifications` 구조를 그대로 본떠 `kakao` 발송 계층 추가:

```
DB (신규 마이그레이션):
  user_contact          : user_id, phone_e164, phone_verified, ad_consent bool, ad_consent_at
  kakao_message_log      : id, user_id, kind(alimtalk|friendtalk), template_code,
                           vars jsonb, status(queued|sent|failed|substituted),
                           vendor_msg_id, error, created_at, sent_at  (idempotency_key uniq)
  kakao_template         : code, title, body, kind, approved bool   (선택: 코드에 상수로 둬도 됨)

서버:
  src/lib/kakao/vendor.ts       : 대행사 API 어댑터(sendAlimtalk/sendFriendtalk) — 인터페이스로 추상화(대행사 교체 대비)
  src/lib/kakao/send.ts         : 큐잉·idempotency·로그 기록·재시도 (기존 credit idempotency 패턴 재사용)
  src/app/api/kakao/dispatch/route.ts  : cron 게이트(x-cron-secret) 배치 발송 — notifications/dispatch 미러
  src/app/api/kakao/webhook/route.ts   : 대행사 발송결과 콜백 → status 갱신 (HMAC 검증, 기존 Toss webhook 패턴 재사용)

트리거:
  - 이벤트성(정보 알림톡): 결제완료 라우트/구독만료 로직에서 send.ts 호출
  - 배치(친구톡/리마인드): Vercel cron → /api/kakao/dispatch (KST 시간대·야간가드)
```

발송 어댑터 예시:

```ts
// src/lib/kakao/vendor.ts
export interface KakaoVendor {
  sendAlimtalk(input: {
    to: string;               // E.164 전화번호
    templateCode: string;
    variables: Record<string, string>;
    fallbackSms?: string;     // 실패 시 대체발송 문구
    idempotencyKey: string;
  }): Promise<{ vendorMsgId: string; status: 'sent' | 'queued' }>;
  sendFriendtalk(input: { to: string; text: string; imageUrl?: string; idempotencyKey: string }): Promise<{ vendorMsgId: string }>;
}
// Solapi/NHN 구현체를 이 인터페이스로 감싸 교체 가능하게.
```

## B-5. 구현 Phase

- **Phase 0 (행정, 1~3주)**: 비즈채널 전환, 대행사 계약, 발신프로필, 템플릿 심의. *개발 없이 병행.*
- **Phase 1 (전화번호 기반)**: `user_contact` 마이그레이션 + 회원가입/결제/마이페이지 전화번호 입력·인증(선택 SMS 인증) + 약관/개인정보 갱신 + 광고 수신동의 UI.
- **Phase 2 (정보성 알림톡)**: `vendor.ts`+`send.ts`+`webhook` + 결제완료/구독만료 트리거. 가장 안전한 첫 발송(동의 불필요·전환율 높음).
- **Phase 3 (친구톡 마케팅)**: 채널 친구 확보(로그인/결과 화면에 "채널 추가" 유도) + 광고 수신동의 + `dispatch` cron(야간가드·(광고)표기·수신거부) + 오늘의 운세/이벤트 발송.
- **Phase 4**: A/B·세그먼트·성과 로깅(open/click은 카톡 특성상 제한적 → 링크 UTM으로 전환 측정).

## B-6. 작업량/비용
- 행정 1~3주(심의 대기 포함), 개발 Phase1~2 각 3~5일, Phase3 3~5일.
- 발송비 종량(알림톡 ~8~15원/건, 친구톡 ~13~25원/건) + 대행사 기본료.

---

## 2. 사주 서비스 유스케이스 매핑 (권장)

| 시나리오 | 방식 | 성격 | 우선순위 |
|---|---|---|---|
| 결과를 친구에게 공유 (전 메뉴) | **A 공유** | - | ★ 즉시 |
| 결제완료 영수증 | 알림톡 | 정보성 | ★ Phase2 |
| 구독 만료 D-3 / 자동결제 예정 고지 | 알림톡 | 정보성(고지 의무성) | ★ Phase2 |
| 예약상담 확정/리마인드 | 알림톡 | 정보성 | Phase2 |
| 오늘의 운세/신메뉴/이벤트 | 친구톡 | **광고성** | Phase3(동의·야간가드) |
| 미완성 결과 이어보기 유도 | 친구톡 | 광고성 | Phase3 |

## 3. 추천 로드맵 (요약)

1. **이번 주**: A 카카오 공유 SDK 완성(무료·바이럴) + 4개 메뉴 공유 버튼 배치.
2. **병행 착수(행정)**: 비즈채널 전환 + 대행사(Solapi/NHN) 계약 + 정보성 템플릿 심의.
3. **다음**: 전화번호 수집/동의 → 정보성 알림톡(결제완료·구독만료).
4. **그다음**: 채널 친구 확보 → 친구톡 마케팅(법규 가드).

## 4. 체크리스트

**A 공유**
- [ ] JS 키 발급 + 플랫폼>Web 도메인 등록
- [ ] `NEXT_PUBLIC_KAKAO_JS_KEY` (Vercel 3개 환경)
- [ ] SDK 로드 + `Kakao.init` 가드
- [ ] `lib/kakao-share.ts` + `share-actions.tsx` kakao 분기 교체(하위호환)
- [ ] 메뉴별(사주/궁합/별자리/띠/타로) payload + OG 이미지(https 절대경로)
- [ ] 궁합/별자리/띠/타로 결과 페이지에 `<ShareActions>` 배치

**B 메시지**
- [ ] 비즈니스 채널 전환(사업자 인증)
- [ ] 발송대행사 계약 + 발신프로필
- [ ] 템플릿 등록·심의(정보성)
- [ ] `user_contact` 전화번호 수집 + 동의 + 약관/개인정보 갱신
- [ ] `vendor.ts`/`send.ts`/`webhook`/`dispatch`(cron secret·야간가드)
- [ ] 정보성 알림톡 트리거(결제완료/구독만료)
- [ ] (광고)표기·무료수신거부·야간금지(친구톡)

---

## 부록. 참고 링크
- Kakao Developers — 카카오톡 공유(JavaScript SDK): https://developers.kakao.com/docs/latest/ko/message/js-link
- 카카오톡 채널 · 비즈니스: https://business.kakao.com
- 알림톡/친구톡 대행사: Solapi(https://solapi.com), NHN Cloud(https://www.nhncloud.com), Aligo(https://smartsms.aligo.in)
- 정보통신망법 광고성 정보 전송 안내(KISA): 야간(21~08)·(광고)표기·수신거부·사전동의
