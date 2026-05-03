# 달빛인생 운영 연동 체크리스트

Google/Kakao 로그인, 저장, 코인, Toss 결제가 실제 운영에서 작동하려면 코드와 콘솔 설정이 함께 맞아야 합니다.

## 1. Vercel 환경변수

Production 환경에 아래 값이 비어 있지 않게 들어가야 합니다.

| 환경변수 | 용도 | 비고 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 로그인/결제 완료 후 돌아올 운영 주소 | 예: `https://ganji-saju.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 Supabase 연결 | 비어 있으면 로그인/저장이 동작하지 않음 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 Supabase 인증 키 | 비어 있으면 로그인/저장이 동작하지 않음 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버에서 결제/이용권/저장 처리 | 서버 전용, 공개 금지 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | Toss 결제창 호출 | 브라우저 공개 키 |
| `TOSS_SECRET_KEY` | Toss 결제 승인 확인 | 서버 전용, 공개 금지 |
| `OPENAI_API_KEY` | AI 풀이 생성 | 사용하는 경우 필요 |

## 2. Supabase Auth 설정

Supabase 프로젝트의 Authentication 설정에서 확인합니다.

| 항목 | 권장값 |
| --- | --- |
| Site URL | `https://ganji-saju.vercel.app` |
| Redirect URL | `https://ganji-saju.vercel.app/api/auth/callback` |
| Local Redirect URL | `http://localhost:3000/api/auth/callback` |
| Google provider | Enabled, Google Client ID/Secret 입력 |
| Kakao provider | Enabled, Kakao REST API Key/Secret 입력 |

Google/Kakao 개발자 콘솔에도 Supabase가 요구하는 OAuth callback URL을 등록해야 합니다. 앱의 `/api/auth/callback`은 Supabase 인증이 끝난 뒤 돌아오는 내부 경로입니다.

## 3. Toss Payments 설정

Toss 개발자센터에서 운영용 키를 발급해 Vercel Production 환경변수에 넣습니다.

| 항목 | 연결 위치 |
| --- | --- |
| Client Key | `NEXT_PUBLIC_TOSS_CLIENT_KEY` |
| Secret Key | `TOSS_SECRET_KEY` |
| 성공 URL | 코드에서 현재 도메인 기준으로 생성 |
| 실패 URL | 코드에서 현재 도메인 기준으로 생성 |

현재 결제 흐름은 Toss 결제창 완료 후 `/api/payments/confirm`에서 서버 키로 승인 확인을 수행합니다.

## 4. 코드 쪽 안전 처리

- Google/Kakao OAuth 실패 시 로그인 화면에 원인을 표시합니다.
- OAuth callback의 `next` 파라미터는 내부 경로만 허용합니다.
- Toss client key가 없으면 결제창 호출 전에 안내 메시지를 보여줍니다.
- 결제 완료 후 서버 승인 단계에서 Toss secret key가 없으면 승인 실패로 처리됩니다.

## 5. 운영 QA

- 로그인 전 `/login`에서 Google 버튼 클릭
- 로그인 전 `/login`에서 Kakao 버튼 클릭
- 로그인 후 `/my`에서 저장/코인 상태 확인
- `/credits`에서 카드 결제창 열림 확인
- `/membership/checkout`에서 Toss 결제창 열림 확인
- 결제 성공 후 `/membership/success` 또는 `/credits/success`에서 상태 반영 확인
