# Toast 사용 가이드

> 2026-05-15 handoff PR-K 정리. 신규 코드는 처음부터 sonner 사용. 기존 자체 state 토스트는 점진 마이그레이션.

## 기본 사용

```tsx
import { toast } from 'sonner';

// 성공 (jade tint)
toast.success('저장됐어요');

// 오류 (coral tint)
toast.error('저장에 실패했어요');

// 일반 안내 (pink-soft)
toast('새 풀이가 도착했어요');

// 설명 추가
toast.success('보관함에 저장됐어요', {
  description: '언제든 다시 열어볼 수 있어요',
});
```

전역 `<AppToaster>` 가 `app/layout.tsx` 에 마운트돼 있어 별도 컨테이너 설정 없음.

## 언제 토스트, 언제 inline?

| 상황 | 권장 |
|---|---|
| transient action 결과 (저장 / 복사 / 예약 접수) | **토스트** (`toast.success` / `toast.error`) |
| form 검증 오류 (입력값 잘못) | **inline** (`<p className="...coral...">{error}</p>`) — input 옆 |
| 비동기 진행 중 알림 | **토스트** with `toast.promise()` |
| 위험 action 확인 (탈퇴 / 결제 취소) | 토스트 X — `confirm dialog` 또는 dedicated 페이지 |
| 영구 상태 표시 (network 오프라인) | **inline banner** (상단 고정) |

## 마이그레이션 패턴

### Before (자체 state)

```tsx
const [error, setError] = useState('');
async function handleSubmit() {
  setError('');
  try {
    await api();
  } catch {
    setError('실패했어요');
  }
}
// JSX
{error ? <p className="...">{error}</p> : null}
```

### After (sonner)

```tsx
import { toast } from 'sonner';
async function handleSubmit() {
  try {
    await api();
    toast.success('성공!');
  } catch {
    toast.error('실패했어요');
  }
}
// JSX — inline 마크업 제거
```

## 마이그레이션 완료 위치 (참고)

- `src/features/saju-detail/share-actions.tsx` — 클립보드 / 카톡 / 인스타 5개 분기 (PR #83)
- `src/app/dialogue/appointment/page.tsx` — 상담 예약 결과 (PR #87 후속)

## 마이그레이션 후보 (자체 state 사용 중)

다음 위치는 `setError` / `setStatusMessage` 등 자체 state 사용 — 우선순위에 맞춰 점진 마이그레이션:

| 파일 | 상황 | 권장 |
|---|---|---|
| `app/reset-password/page.tsx` | 비밀번호 재설정 form | inline 유지 (form 검증) |
| `app/my/settings/delete-account/page.tsx` | 탈퇴 흐름 | inline 유지 (위험 action) |
| `features/notifications/notification-center-page.tsx` | 알림 권한 / 구독 | toast 마이그레이션 권장 |
| 결제 confirm 페이지의 transient success/fail | LoadingState / SuccessState / ErrorState 카드 | dedicated 페이지 카드 유지 (전체 화면 상태) |

## 스타일

`src/components/motion/motion-primitives.css` 의 `[data-sonner-toaster] [data-sonner-toast]` 분기로 디자인 토큰 적용. 변경 시 motion-primitives.css 갱신.

- 기본: `var(--app-line)` border + 18px 그림자 + 14px 라운드
- success: jade tint (#f1faf3)
- error: coral tint (#fdf0f0)
- info: `var(--app-pink-soft)` (default)

## 위치

`position="top-center"` — 상단 중앙 (모바일 친화). `gap={8}`, `visibleToasts={3}`, `duration={3200}`.
