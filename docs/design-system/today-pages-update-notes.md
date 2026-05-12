# 오늘 페이지군 달빛 결 디자인 적용 노트

## Summary

오늘운세, 타로, 띠운세, 별자리, 무료운세 허브를 달빛 결 디자인 시스템 흐름에 맞춰 정리했다. 이번 변경은 UI/UX와 반응형 구조에 한정하며, 운세/타로 결과 생성 로직, 결제/코인/권한, DB, route 구조는 변경하지 않았다.

## Updated Routes

- `/free`
- `/today-fortune`
- `/today-fortune/result`
- `/today-fortune/detail`
- `/tarot/daily`
- `/tarot/daily/pick`
- `/tarot/daily/result`
- `/zodiac`
- `/zodiac/[slug]`
- `/star-sign`
- `/star-sign/[slug]`

## Applied Components

- `PageIntro`: 오늘 페이지군 상단의 제목/설명 구조 통일
- `LightSection`: 가벼운 무료 결과와 선택 영역의 panel 스타일 통일
- `FlowEntryList`: 성향사주, 성향궁합, 12간지 대화방으로 이어지는 CTA 리스트 통일
- `ResultShell`: 타로/띠/별자리 상세 결과의 공통 결과 구조 적용
- `SafetyNotice`: 무료 운세가 참고용 콘텐츠임을 결과와 무료 허브에 반복 안내

## Free Entry UX

- 무료운세 허브에 별자리 진입을 추가했다.
- 오늘운세 상단 카피를 "오늘의 결" 중심으로 정리했다.
- 타로 뽑기 화면은 기존 카드 선택 로직을 유지하되, 안내와 카드 선택 영역을 `LightSection`으로 감쌌다.
- 띠운세의 12띠 선택은 작은 카드 격자 중심에서 row/list 중심으로 완화했다.
- 별자리는 기존 12별자리 compact grid를 유지하되, 상단과 확장 CTA는 공통 구조로 통일했다.

## Expansion CTA

- 오늘운세 결과에서 고민 유형별로 `성향사주`, `성향궁합`, `타로`, `12간지 대화방`으로 이어지는 CTA를 정리했다.
- 타로 결과에는 `성향사주로 이어보기`와 `12간지 캐릭터에게 이어 묻기`를 추가했다.
- 띠운세와 별자리 결과에는 사주, 성향사주, 12간지 대화방으로 이어지는 CTA를 추가했다.
- 대화방 route는 기존 `/dialogue`를 유지했다.

## Logic Preserved

- `/api/today-fortune` 호출 흐름 변경 없음
- 오늘운세 무료 결과 sessionStorage 저장/복구 흐름 변경 없음
- 오늘 자세히 보기 unlock API와 결제/코인 권한 흐름 변경 없음
- 타로 카드 deck 생성, pick, result 생성 흐름 변경 없음
- 띠/별자리 개인화 slug 계산과 redirect 흐름 변경 없음
- Supabase migration, DB, payment catalog 변경 없음

## Mobile Notes

- 선택지는 가능한 row/list 중심으로 정리했다.
- 결과 화면은 `ResultShell`과 `LightSection`을 사용해 카드 중첩을 줄였다.
- 12개 대형 이미지를 추가하지 않았고, 기존 아이콘/상징 표현만 유지했다.
- 모바일 360/390/430 실기기 확인은 최종 QA 단계에서 필요하다.

## Remaining Risks

- `TarotCardPicker`는 기존 이미지 기반 카드 선택 UI를 유지하므로, 구형 모바일 성능 최적화는 별도 작업에서 추가 점검이 필요하다.
- 별자리 선택 grid는 기존 스타일을 유지했으므로, 360px 실기기에서 터치 간격 확인이 필요하다.
- 오늘운세 결과는 sessionStorage 기반이므로 새 브라우저/기기에서 기존과 동일하게 재생성 안내가 노출된다.

## Next Step

작업 9에서 대화방, 보관함, 가격 페이지를 같은 달빛 결 디자인 시스템으로 이어서 정리한다.
