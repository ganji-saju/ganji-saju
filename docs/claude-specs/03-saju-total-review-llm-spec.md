# 사주 총평 LLM 풀이 생성 스펙

> ganjisaju.kr 사주 결과 페이지의 **총평 탭**을 위한 완전한 LLM 생성 스펙.
> 현재 7문장짜리 단락을 25~35문장 narrative + 평생 활용 3가지로 확장.
>
> **이 문서는 `naming-policy.md`의 어휘 정책을 따릅니다.** 충돌이 있으면 `naming-policy.md`가 우선.
>
> 짝이 되는 자료: `daewoon-llm-spec.md` (대운 풀이), `saju-terms-dictionary.json` (용어 사전), `saju-score-spec.md` (점수 시스템).

---

## 0. 이 스펙이 풀려는 문제

지금 사주 총평 페이지의 본문은 약 **7문장의 단일 단락**입니다. 그런데 같은 사이트의 *오늘의 운세*(무료 페이지)는 **14문장 narrative + 5요소 점수 산출표**로 더 풍부해요.

사용자 입장에서는 *사주 총평이 일일 운세보다 가벼워 보이는* 비대칭이 일어납니다. 사주가 사이트의 메인 가치인데 오히려 보조 기능보다 빈약해 보여요.

이 스펙은 사주 총평의 본문 LLM 출력을 다음 3개로 확장합니다:

1. **한 줄 요약** — 평생 적용 톤의 핵심 한 문장 (20~35자)
2. **본문 narrative** — 4단락, 총 25~35문장
3. **평생 활용 핵심 3가지** — 강한 환경 / 약한 자리 / 핵심 활용법

UI 자산은 그대로 두고 *콘텐츠 분량과 깊이만 5~7배 확장*하는 게 목표입니다.

---

## 1. 핵심 설계 원칙

### 1-1. "평생 적용" 톤이 핵심

사주 총평은 *오늘의 운세*가 아닙니다. 일일 톤("~날입니다", "오늘은~")이 들어가면 안 됩니다.

- ❌ "조용히 살피고 흐르는 사주, 무리하지 않는 **날입니다**"
- ⭕ "조용히 살피고 흐르는 사주, **단단한 기준 하나가 평생을 받쳐줍니다**"

현재 한 줄 요약 ("안정이 앞서고 정리가 비기 쉬운 날입니다")은 일일 톤으로 잘못 들어가 있어요. 이번 작업으로 *평생 톤*으로 교정.

### 1-2. 4단락 구조의 *의미적 분리*

각 단락은 *다른 질문*에 답해야 합니다. 한 단락이 다른 단락을 침범하면 중복이 생깁니다.

| 단락 | 답해야 할 질문 | 핵심 키워드 |
|------|-----------|----------|
| 1 | 이 사람은 어떤 사람인가? | 일주 본질, 타고난 성향 |
| 2 | 어떤 환경에서 가장 잘 살아나는가? | 강점 환경, 어울리는 일·관계 |
| 3 | 어디서 무너지기 쉬운가? | 약점 패턴, 반복되는 실수 |
| 4 | 지금 시기에 어떻게 살아야 하는가? | 대운·세운 매칭, 사용자 컨텍스트 |

### 1-3. 사용자 컨텍스트는 *반드시* 본문에 녹인다

총평 페이지에는 "이 풀이는 당신의 상황을 반영했어요" 카드(기혼/직장인/재물·투자 같은 칩)가 이미 있습니다. **그런데 본문에 그 컨텍스트가 자연스럽게 녹지 않으면 카드가 무의미해집니다.**

규칙:
- 단락 2에 *직업·환경* 컨텍스트 반영 (예: "직장인으로 일하시는 지금도, …")
- 단락 4에 *관계 상태 + 고민 영역* 반영 (예: "기혼이신 만큼 배우자와…", "재물·투자 고민이 있으신데…")
- 컨텍스트가 어색하게 끌어다 붙이는 게 아니라 *자연스러운 흐름의 일부*가 되도록

### 1-4. 길이 규칙

- 한 줄 요약: 20~35자
- 단락 1~4: 각 5~8문장
- 본문 총합: 25~35문장
- 평생 활용 3가지: 각 항목 제목 8자 이내 + 부제 20자 이내 + 본문 1~2문장

너무 길어도 안 되고 짧아도 안 됩니다. LLM이 알아서 채우게 두면 길이 편차가 큽니다 — 시스템 프롬프트에 명시.

---

## 2. 입력 JSON 스키마

`daewoon-llm-spec.md`의 입력 구조를 확장한 형태. 사주 총평은 *대운 1개*가 아니라 *사주 전체*를 보기 때문에 `wonkuk` 정보가 더 풍부해야 합니다.

```json
{
  "user": {
    "name": "간지사주 테스트",
    "birth_solar": "1999-04-01 14:30",
    "gender": "F",
    "birth_location": "대전",
    "current_age": 27
  },
  "context": {
    "relationship_status": "기혼",
    "occupation_status": "직장인",
    "concern": "재물·투자"
  },
  "wonkuk": {
    "ilgan_easy": {
      "label": "물처럼 부드럽게 흐르는 결",
      "detail": "강하게 밀어붙이기보다 주변을 살피고 필요한 곳에 맞춰 흐르는 성향",
      "metaphor": "조용히 스며들어 필요한 자리를 채우는 물"
    },
    "ilju_easy": {
      "label": "관찰하고 조정하는 사람",
      "detail": "전체 흐름을 살피고 작은 신호를 잘 잡아내는 결. 1:1 또는 작은 그룹에서 강점 발휘"
    },
    "ohaeng_balance": {
      "목": 1, "화": 2, "토": 2, "금": 0, "수": 3
    },
    "ohaeng_lack_easy": [
      {
        "element": "금",
        "label": "금 기운",
        "meaning": "결단·기준·마무리·단단함의 기운이 부족"
      }
    ],
    "ohaeng_excess_easy": [],
    "ganguk_easy": {
      "label": "자기 축이 다소 약한 편",
      "detail": "본인 페이스가 외부 영향에 흔들리기 쉬운 구조. 단, 흐름을 잘 읽는 강점도 같이 옴",
      "_internal": "신약"
    },
    "yongsin_easy": {
      "primary": {
        "label": "금 기운",
        "meaning": "체크리스트·예산표·정기 회고처럼 '단단한 구조'를 일상에 들이는 것이 보강"
      },
      "secondary": {
        "label": "토 기운",
        "meaning": "안정된 루틴과 책임감 있는 자리가 보강"
      },
      "_internal": "용신 금, 보조 토"
    },
    "kyeokguk_easy": {
      "label": "표현하고 살피는 별이 명확한 사주",
      "detail": "본인 안의 것을 부드럽게 표현하고 주변을 챙기는 패턴이 평생 따라옴",
      "career_fit": ["분석", "기획", "상담", "교육", "돌봄", "연구"],
      "_internal": "식신격"
    },
    "key_strengths_easy": [
      "전체 흐름을 살피고 조정하는 감각",
      "1:1 관계에서의 깊이",
      "부드럽고 자연스러운 표현"
    ],
    "key_weaknesses_easy": [
      "'아니오'라고 말하기 어려움 — 부탁을 다 받아들이기 쉬움",
      "단호하게 결정하고 마무리하는 자리에서 우유부단",
      "본인 의견을 미루다가 정작 본인이 가장 지치는 패턴"
    ]
  },
  "current_timeline": {
    "daewoon": {
      "label_easy": "27-36세의 10년",
      "label_short": "27-36세",
      "is_current": true,
      "meaning_easy": "겉으로 드러나는 일이 많아지는 시기. 일·관계 모두에서 본인이 직접 의사결정해야 할 자리가 늘어남",
      "_internal_label": "경오(庚午) 대운"
    },
    "saewoon": {
      "label_easy": "올해 2026년",
      "meaning_easy": "표현과 결단이 동시에 시험되는 한 해",
      "_internal_label": "병오(丙午) 세운"
    },
    "wolun": {
      "label_easy": "이번 달",
      "meaning_easy": "차분히 정보를 모으고 판단의 질을 높이기 좋은 시기",
      "_internal_label": "계사(癸巳) 월운"
    }
  }
}
```

### 핵심 포인트

- 모든 `_internal_*` 필드의 한자/명리어는 본문에 절대 노출 금지 (시스템 프롬프트에 명시).
- `easy_label`과 `detail`을 모두 LLM에 전달해서 자기 해석을 안 하도록 잠금.
- `key_strengths_easy`, `key_weaknesses_easy`는 단락 2·3의 핵심 재료. *3개씩* 미리 정해서 LLM이 만들지 않게.
- `current_timeline`은 단락 4의 핵심 재료. 대운+세운+월운 3개의 의미가 미리 일상어로 변환되어 있어야 함.

---

## 3. 시스템 프롬프트

```text
당신은 친근하고 차분한 명리 해설가입니다. 사용자의 사주 *총평*을 쓰는 일이며,
이 글은 *평생 적용되는 본질*에 대한 풀이입니다. 오늘이나 이번 주의 흐름이
아닙니다.

[절대 규칙 — 한 번이라도 어기면 출력 폐기]

1. 한자(漢字)는 본문에 한 글자도 노출하지 않는다. _internal 필드의 값은 절대
   본문에 쓰지 않는다.

2. 다음 사주 전문 용어는 본문에 쓰지 않는다:
   - 천간, 지지, 일간, 일주, 월주, 시주, 연주, 시지, 월지, 연지
   - 격국, 식신격, 정인격, 편관격 등 모든 격국명
   - 용신, 신강, 신약, 강약, 대운, 세운, 월운, 일진
   - 비견, 겁재, 식신, 상관, 편재, 정재, 편관, 정관, 편인, 정인
   - 합, 충, 형, 파, 해, 원진, 공망, 신살, 양인, 도화, 역마, 화개
   - 장생, 목욕, 관대, 건록, 제왕, 쇠, 병, 사, 묘, 절, 태, 양 (12운성)
   대신 입력 JSON의 _easy 필드에 있는 일상어 풀이를 사용한다.

3. "결" 단어 사용 엄격 제한 (`naming-policy.md` §9 적용):
   - 한 줄 요약: 사용 금지
   - 단락 1~4: 단락당 최대 1회, 정말 필요할 때만
   - 평생 활용 3가지 카드 제목·부제: 사용 금지
   대신 "사주", "성향", "기운", "흐름", "자리", "방식"을 사용한다.
   "타고난 결" 대신 "타고난 성향" 또는 "본인 사주". "본인 결" 대신
   "본인 사주" 또는 "본인 성향".

4. 시제(時制) 규칙 — *평생 적용 톤*을 유지한다:
   - ❌ 금지: "~날입니다", "오늘은~", "이번 주~"
   - ⭕ 허용: "~사주예요", "~성향입니다", "평생~"
   - 단락 4(지금 시기)에서만 *현재 흐름*을 짚을 수 있음. 단, 이때도 "이번 10년",
     "올해", "지금 시기" 정도로 표현하고 일일 톤은 피한다.

5. 사용자 이름 호명 규칙:
   - 본문 전체(한 줄 요약 + 4단락 + 3가지)에서 *최대 2회*
   - 성을 빼고 이름만 + "님" (예: "테스트 님")
   - 한 단락 안에 1회 이하

6. 사용자 컨텍스트(context.relationship_status / occupation_status /
   concern) 반영 규칙:
   - 단락 2(강한 환경)에 직업·환경 컨텍스트 자연스럽게 녹임
   - 단락 4(지금 시기)에 관계 상태 + 고민 영역 자연스럽게 녹임
   - 어색하게 끌어다 붙이지 말 것 — 문맥에 맞을 때만

7. 길이 규칙:
   - 한 줄 요약: 20~35자 (한국어 글자 기준)
   - 단락 1~4: 각 5~8문장
   - 본문 4단락 총합: 25~35문장
   - 한 문장: 60자 안팎, 최대 90자
   - 평생 활용 3가지: 각 항목 제목 8자 이내, 부제 20자 이내, 본문 1~2문장

8. 금지 표현:
   - "대박", "비책", "암흑기", "텅장", "꿀팁" 등 자극적·속어 표현
   - "반드시", "절대", "확실히" 등 단정적 표현
   - "괜찮을 거예요", "잘 될 거예요" 등 막연한 위로
   - 막연한 인생 조언("긍정적으로 생각하세요" 같은) 금지 — 반드시 사주
     데이터에서 도출된 구체적 행동/관찰을 짚을 것

9. 오행 어휘 정책 (`naming-policy.md` §2 적용):
   - 오행은 반드시 "X 기운" 형태로 표기:
     "목 기운 / 화 기운 / 토 기운 / 금 기운 / 수 기운"
   - 금지: "쇠의 결", "햇살의 결", "흙의 결", "물의 결", "새싹의 결"
     (자연 비유 + "결" 합성)
   - 금지: "결단과", "안정과", "열정과", "시작과", "지혜과" (구 X과 라벨)
   - 금지: "쇠", "햇살", "새싹" 등 자연 명사를 *단독으로* 오행 대신 사용
   - 첫 등장 시 짧은 의미를 옆에 붙일 수 있음:
     "금 기운(단단함과 결단)을 들이면…" → 이후엔 그냥 "금 기운"

10. 십성 어휘 정책 (`naming-policy.md` §3 적용):
    - 식신·정인·정관·편관 등 십성은 *원어 그대로* 사용
    - 첫 등장 시 짧은 설명: "식신(표현하고 베푸는 별)"
    - 금지: "표현의 기운", "생각의 기운", "절제의 기운" 등 추상명사화

[구조 규칙]

각 단락은 다음 구조를 따른다:
- 첫 문장: 단정적 한 줄 결론 (그 단락의 주제)
- 중간: 왜 그런지 일상어 비유 또는 사주 데이터 풀이
- 마지막: 구체적 관찰 포인트 또는 행동 힌트

[톤]
- 친근한 구어체 (~예요, ~죠, ~세요). 단정형(~다)은 피한다.
- 따뜻하지만 단호한 톤. 점쟁이 톤(과장·확정) 금지.
- 비유는 일상에서 가져온다 (강물, 씨앗, 무대, 운전 등 *흔한* 일상 사물).
  단, 자연 명사 + "의 결" 합성 금지 ("쇠의 결", "햇살의 결").
  자연 명사 + "~처럼" 직유는 본문에 자연스럽게 녹는 한 OK
  ("물처럼 부드럽게 흐르는 성향").
- 오행 라벨은 항상 "X 기운" ("금 기운", "화 기운" 등)으로.

[출력 형식]
지정된 JSON 스키마를 정확히 따른다. 다른 텍스트는 출력하지 않는다.
```

---

## 4. 사용자 메시지 (3개 섹션 분리 호출)

대운 스펙과 마찬가지로 한 번에 다 받지 말고 3섹션을 *분리 호출*하세요. 각 섹션이 자기 주제에 집중하기 좋습니다.

### 4-1. 한 줄 요약 (one_line_summary)

```text
입력 JSON을 참고해 이 사주의 *평생 본질*을 한 문장으로 요약해주세요.

[요건]
- 20~35자 (한국어 글자)
- 평생 적용 톤 — "~날입니다", "오늘은~" 절대 금지
- 일주 본질 (wonkuk.ilgan_easy.label, ilju_easy.label) + 핵심 강약/보완 흐름을
  한 문장으로 묶을 것
- 시그니처 키워드 1개 (예: "기준", "흐름", "조용함", "관찰") 자연스럽게 포함

[좋은 예]
- "조용히 살피고 흐르는 사주, 단단한 기준 하나가 평생을 받쳐줍니다"
- "관찰력 강한 결, 거절의 기준만 잡으면 흐름이 안정됩니다"
- "타고난 표현력 위에, 작은 마무리 습관 하나가 평생을 바꿉니다"

[나쁜 예 — 사용 금지 패턴]
- "안정이 앞서고 정리가 비기 쉬운 날입니다" (일일 톤)
- "대박 나는 사주, 이것만 지키면 흐름이 바뀝니다" (자극적)
- "행복하고 안정된 인생이 펼쳐집니다" (막연)

출력은 다음 JSON만:
{ "one_line_summary": "..." }
```

### 4-2. 본문 4단락 (main_narrative)

```text
입력 JSON을 참고해 이 사주의 *평생 본질*을 4단락 narrative로 작성해주세요.
각 단락은 다음 *의미적 역할*을 가집니다. 단락 간 내용 중복 금지.

## 단락 1 — 이 사람은 어떤 사람인가 (5~8문장)

[핵심 재료]
- wonkuk.ilgan_easy (일주 본질)
- wonkuk.ilju_easy (일주 성향)
- wonkuk.ganguk_easy (강약 의미)

[구조]
- 첫 문장: "테스트 님의 타고난 성향은…" 또는 "이 사주는…" 식 단정 결론
- 일주 본질을 *비유*로 풀어 쓰기 — "물처럼 흐르는", "강물처럼 깊어지는" 같이
  일상 자연 직유는 OK. 단 "쇠의 결", "햇살의 결" 같은 합성 라벨 금지.
- 강한 기운 1개 + 약한 기운 1개를 짚어줄 것 (key_strengths_easy[0],
  key_weaknesses_easy의 1개)
- 마지막: "다만…" 또는 "이 점에서…"로 다음 단락 자연스럽게 연결

## 단락 2 — 어떤 환경에서 잘 살아나는가 (5~8문장)

[핵심 재료]
- wonkuk.kyeokguk_easy (격국 의미 + career_fit 직업 적합도)
- wonkuk.key_strengths_easy (강점 3개)
- context.occupation_status (직업 컨텍스트 반영)
- context.relationship_status (관계 컨텍스트 반영)

[구조]
- 첫 문장: "이 사주는 'X하는' 자리에서 본인의 강점이 가장 잘 드러납니다" 식
- 어울리는 직업 환경 1~2개 (kyeokguk_easy.career_fit에서 선택해서 풀어 쓰기)
- 사용자의 *현재 직업/상황*에 매핑 — "직장인으로 일하시는 지금도…" 같이
- 어울리는 관계 환경 1~2문장 (1:1, 작은 그룹, 큰 모임 중 어디가 잘 맞는지)
- 결혼/연애 상태에 따라 한 줄 추가

## 단락 3 — 어디서 무너지기 쉬운가 (5~8문장)

[핵심 재료]
- wonkuk.key_weaknesses_easy (약점 패턴 2~3개)
- wonkuk.ohaeng_lack_easy (부족한 기운 의미)

[구조]
- 첫 문장: "본인의 약점은 'X' 에서 옵니다" 식
- key_weaknesses_easy 중 2개를 풀어 쓰기 (1개는 단락 1에서 이미 짚었으니 중복 X)
- 부족한 기운(ohaeng_lack_easy)이 본인 일상에서 어떻게 드러나는지 한 문장
- "이게 누적되면…" 같이 *반복 패턴*의 결과를 짚을 것

[금지]
- "조심하세요", "주의해야 합니다" 같은 일반적 경고
- 반드시 *어떤 자리에서 어떤 방식으로* 무너지는지 구체적으로

## 단락 4 — 지금 시기에 어떻게 살아야 하는가 (5~8문장)

[핵심 재료]
- current_timeline.daewoon.meaning_easy (현재 10년 의미)
- wonkuk.yongsin_easy (보강 흐름)
- context.concern (사용자 고민 영역)
- context.relationship_status (관계 컨텍스트)

[구조]
- 첫 문장: "지금 진행 중인 [27세 무렵의] 10년은…" 식 (current_timeline.
  daewoon.label_easy + meaning_easy 활용)
- 사용자 고민(context.concern)을 직접 언급하면서 *사주의 보강 흐름*과 연결
  - "재물·투자 쪽 고민이 있으신데, 이 사주에는 '금 기운(단단함과 결단)'을
    보강하는 게 핵심입니다"
- 보강 흐름(yongsin_easy.primary.meaning)을 *구체 행동 1~2개*로 풀어 쓰기
  - 예: "체크리스트, 예산표, 매월 정산표 같이 '단단한 구조'를 일상에 들이는
    방식이에요"
- 관계 상태(기혼/연애중/솔로)에 맞춰 한 줄 (배우자/연인/혼자 의사결정)
- 마지막: 평생 적용 가능한 한 가지 원칙 ("큰 결정 한 번보다 작은 결정 여러 번
  차곡차곡" 같은)

## 절대 규칙 (모든 단락 공통)

- 한자 본문 노출 금지
- 사주 전문 용어 본문 노출 금지 (시스템 프롬프트 §2 참조)
- "결" 단어 단락당 최대 1회, 정말 필요할 때만 (`naming-policy.md` §9)
- 오행은 "X 기운" ("금 기운", "화 기운" 등)으로만 표기 — "쇠의 결",
  "햇살의 결" 같은 합성 라벨 금지
- "오늘", "이번 주", "~날입니다" 같은 일일 톤 금지 (단락 4의 "지금 10년"은 OK)
- 단락 간 *동일 문장 절대 금지* — 만약 같은 데이터를 재참조하면 표현을 다르게

출력은 다음 JSON만:
{
  "main_narrative": {
    "paragraph_1_who_you_are": "...",
    "paragraph_2_strong_environment": "...",
    "paragraph_3_weak_zone": "...",
    "paragraph_4_now": "..."
  }
}
```

### 4-3. 평생 활용 3가지 (lifetime_keys)

```text
입력 JSON을 참고해 이 사주의 *평생 활용 핵심 3가지*를 카드 형태로 만들어주세요.
각 카드는 사용자가 *바로 행동에 옮길 수 있는* 구체 가이드여야 합니다.

[카드 1 — 강한 환경]
- 제목: 8자 이내 (예: "관찰하고 조정하는 자리")
- 부제: 20자 이내 (한 줄 보충 설명)
- 본문: 1~2문장. wonkuk.kyeokguk_easy.career_fit과 key_strengths_easy를 활용

[카드 2 — 약한 자리]
- 제목: 8자 이내 (예: "단호함과 마무리")
- 부제: 20자 이내
- 본문: 1~2문장. key_weaknesses_easy에서 가장 큰 약점 + *구체 행동* 1개
  (예: "'아니오'를 못하면 에너지가 빠르게 새요. 거절 기준 1~2개를 외부에 적어두세요")

[카드 3 — 핵심 활용법]
- 제목: 8자 이내 (예: "금 기운 들이기")
- 부제: 20자 이내
- 본문: 1~2문장. wonkuk.yongsin_easy.primary.meaning을 *행동으로* 풀어 쓰기
  (예: "체크리스트·예산표·정기 회고 같은 '단단한 구조'가 평생 큰 보강이 됩니다")

[금지]
- 막연한 조언 ("긍정적으로", "노력하세요") 금지
- 누구에게나 해당되는 일반론 금지
- 반드시 이 사주의 데이터에서만 도출되는 고유 가이드

출력은 다음 JSON만:
{
  "lifetime_keys": [
    { "title": "...", "subtitle": "...", "body": "..." },
    { "title": "...", "subtitle": "...", "body": "..." },
    { "title": "...", "subtitle": "...", "body": "..." }
  ]
}
```

---

## 5. Few-shot 예시 (현재 스크린샷 케이스 그대로)

**케이스**: 1999.04.01 14:30 여성, 대전, 계미 일주, 식신격, 신약, 용신 금, 대운 경오(27-36세), 세운 병오(2026), 월운 계사. 기혼/직장인/재물·투자.

### 5-1. 입력 (이 문서 §2의 JSON 그대로)

### 5-2. BEFORE — 현재 사이트 출력 (참고)

> 직장인이신 간지사주 테스트님, 계미일주, 조용히 스며드는 물에 식신격의 결을 가진 사주입니다.
>
> 계미(癸未) 일간은 부드럽게 살피고 필요한 곳에 맞춰 흐르는 성향입니다. 신약의 균형 위에서 식신격이 뚜렷이 보이게 흐름의 기준이 됩니다. 보완은 金 (금)을 중심으로, 土 (토)을 보조로 두고 일어납니다. 지금은 경오(庚午) 대운 · 병오(丙午) 세운 · 계사(癸巳) 월운이 함께 작동합니다. 오늘은 남의 속도보다 내 편한 속도를 먼저 잡으세요. 현재 재물·투자 고민은 사주의 보완 흐름인 金 (금)을(를) 통해 풀어가는 편이 자연스럽습니다. 이 풀이는 간지사주 테스트님이 입력하신 현재 상황을 함께 반영했어요.

문제:
- 한자 6개 노출 (癸未, 庚午, 丙午, 癸巳, 金, 土)
- 명리어 4개 노출 (일간, 식신격, 신약, 용신)
- "오늘은 남의 속도보다…" — 일일 톤이 평생 톤에 섞임
- 7문장. 분량 부족
- "이 풀이는 ~ 반영했어요" 중복 (이미 위 카드에 같은 문구 있음)

### 5-3. AFTER — 기대 출력

```json
{
  "one_line_summary": "조용히 살피고 흐르는 사주, 단단한 기준 하나가 평생을 받쳐줍니다",

  "main_narrative": {
    "paragraph_1_who_you_are": "테스트 님의 타고난 성향은 물처럼 부드럽게 흐르는 편이에요. 강하게 밀어붙이기보다 주변을 먼저 살피고, 필요한 곳에 자연스럽게 자기를 맞추는 사주입니다. 사람들 사이에서는 '편안한 사람', '오래 같이 있고 싶은 사람'이라는 인상을 줄 거예요.\n\n다만 사주의 자기 축이 다소 약한 편이라, 너무 많은 일이나 사람에 둘러싸이면 본인의 페이스를 잃기 쉽습니다. 표현하고 살피는 기운은 잘 살아 있는데, 결단하고 마무리하는 쪽이 보강을 필요로 합니다.",

    "paragraph_2_strong_environment": "이 사주는 '관찰하고 조정하는' 자리에서 본인의 강점이 가장 잘 드러납니다. 분석·기획·상담·교육·돌봄처럼 전체 흐름을 살피는 영역에서 자연스러운 능력을 발휘하기 좋아요. 직장인으로 일하시는 지금도, 본인이 전체를 살펴보고 조정하는 역할일수록 만족도가 올라갑니다.\n\n사람 관계에서는 1:1 또는 작은 그룹이 잘 맞아요. 큰 모임의 중심에 서기보다, 신뢰할 수 있는 몇 명과 깊게 가는 방식입니다. 결혼 생활도 이런 방식으로 풀어가시는 게 자연스러워요.",

    "paragraph_3_weak_zone": "본인의 약점은 '단호함의 부족'에서 옵니다. 너무 많은 부탁을 받아들이거나, 결정해야 할 자리에서 우유부단해지기 쉬워요. 특히 '아니오'라고 말하기 어려운 자리에서 에너지가 새기 쉽습니다.\n\n또 한 가지, 본인의 의견을 분명히 드러내지 않고 '알아서 해주겠지'라고 미루는 패턴이 가끔 나옵니다. 이게 누적되면 정작 본인이 가장 지치는 결과로 이어져요. 금 기운—단단함과 마무리의 기운—이 부족한 영향이에요.",

    "paragraph_4_now": "지금 진행 중인 27세 무렵의 10년은 '겉으로 드러나는 일'이 많아지는 시기예요. 일에서도, 인간관계에서도 본인이 직접 의사결정을 해야 할 자리가 늘어납니다.\n\n재물·투자 쪽 고민이 있으신데, 이 사주에는 금 기운(단단함과 결단)을 들이는 게 핵심입니다. 구체적으로는 체크리스트, 예산표, 매월 정산표 같이 손에 잡히는 도구를 일상에 두는 방식이에요. 기혼이신 만큼 배우자와 가계의 큰 그림을 한 줄로 정리해두면, 흐름이 한결 안정됩니다. 큰 결정을 한 번에 내리기보다, 작은 결정을 여러 번 차곡차곡 쌓는 방식이 이 사주에 잘 맞아요."
  },

  "lifetime_keys": [
    {
      "title": "관찰하고 조정하는 자리",
      "subtitle": "전체 흐름을 살피는 역할",
      "body": "분석·기획·상담·교육·돌봄처럼 '전체를 살피는' 영역에서 강점이 가장 잘 드러납니다. 큰 결정자보다 흐름을 조율하는 자리가 자연스러워요."
    },
    {
      "title": "단호함과 마무리",
      "subtitle": "거절의 기준이 평생 자산",
      "body": "'아니오'를 못하면 에너지가 빠르게 새요. 받아들이지 않을 일의 기준 1~2개를 외부에 적어두면 평생 도움이 됩니다."
    },
    {
      "title": "금 기운 들이기",
      "subtitle": "단단한 구조가 평생 보강",
      "body": "체크리스트·예산표·정기 회고 같은 손에 잡히는 도구가 큰 보강이 됩니다. '구조 위에서 흐르는' 방식이 이 사주에 가장 잘 맞아요."
    }
  ]
}
```

**확인 포인트**:

- 본문 4단락 = 약 32문장. 25~35 범위 안.
- 한자 0개, 명리 용어 0개.
- "결" 단어: 한 줄 요약 0회, 단락 1~4 각 0~1회, 카드 0회. 모두 `naming-policy.md` §9 룰 안.
- 오행 라벨: "금 기운", "물처럼" 등 — "쇠의 결", "햇살의 결" 같은 합성 0개.
- 사용자 이름 "테스트 님" 1회만 (단락 1).
- 컨텍스트 반영:
  - 단락 2: "직장인으로 일하시는 지금도…" + "결혼 생활도 이런 방식으로…"
  - 단락 4: "재물·투자 쪽 고민이 있으신데…" + "기혼이신 만큼 배우자와…"
- 일일 톤 0개. 단락 4의 "지금 진행 중인 27세 무렵의 10년"은 OK.
- 단락 간 내용 중복 0건.

---

## 6. 출력 스키마 (구조화 JSON 모드용)

OpenAI Structured Outputs로 강제하려면 다음 JSON Schema 사용:

```json
{
  "type": "object",
  "properties": {
    "one_line_summary": {
      "type": "string",
      "minLength": 15,
      "maxLength": 80,
      "description": "평생 적용 톤의 핵심 한 문장"
    },
    "main_narrative": {
      "type": "object",
      "properties": {
        "paragraph_1_who_you_are": { "type": "string", "minLength": 200, "maxLength": 600 },
        "paragraph_2_strong_environment": { "type": "string", "minLength": 200, "maxLength": 600 },
        "paragraph_3_weak_zone": { "type": "string", "minLength": 200, "maxLength": 600 },
        "paragraph_4_now": { "type": "string", "minLength": 200, "maxLength": 600 }
      },
      "required": ["paragraph_1_who_you_are", "paragraph_2_strong_environment", "paragraph_3_weak_zone", "paragraph_4_now"]
    },
    "lifetime_keys": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "maxLength": 20 },
          "subtitle": { "type": "string", "maxLength": 30 },
          "body": { "type": "string", "minLength": 30, "maxLength": 150 }
        },
        "required": ["title", "subtitle", "body"]
      },
      "minItems": 3,
      "maxItems": 3
    }
  },
  "required": ["one_line_summary", "main_narrative", "lifetime_keys"]
}
```

길이 제약은 한국어 글자 수가 아닌 *바이트/글자 카운트*입니다. UTF-8에서 한국어 1자 = 약 3바이트라 적절한 범위로 설정.

---

## 7. 후처리 검증 (L3.5)

`daewoon-llm-spec.md` §6의 검증 함수를 사주 총평용으로 확장:

```typescript
interface TotalReviewOutput {
  one_line_summary: string;
  main_narrative: {
    paragraph_1_who_you_are: string;
    paragraph_2_strong_environment: string;
    paragraph_3_weak_zone: string;
    paragraph_4_now: string;
  };
  lifetime_keys: Array<{ title: string; subtitle: string; body: string }>;
}

function validateTotalReview(output: TotalReviewOutput, context: {
  relationshipStatus?: string;
  occupationStatus?: string;
  concern?: string;
}): ValidationResult {
  const reasons: string[] = [];
  const fullText = [
    output.one_line_summary,
    output.main_narrative.paragraph_1_who_you_are,
    output.main_narrative.paragraph_2_strong_environment,
    output.main_narrative.paragraph_3_weak_zone,
    output.main_narrative.paragraph_4_now,
    ...output.lifetime_keys.flatMap(k => [k.title, k.subtitle, k.body])
  ].join('\n');

  // 1. 한자 누출 검사
  const hanjaMatches = fullText.match(/[\u4e00-\u9fff]/g);
  if (hanjaMatches?.length) {
    reasons.push(`한자 누출: ${[...new Set(hanjaMatches)].join(', ')}`);
  }

  // 2. 사주 전문 용어 검사
  const bannedTerms = [
    '천간', '지지', '일간', '일주', '월주', '시주', '연주', '시지', '월지', '연지',
    '격국', '식신격', '정인격', '편관격', '용신', '신강', '신약', '대운', '세운', '월운',
    '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
    '원진', '공망', '신살', '양인', '도화', '역마', '화개',
    '장생', '목욕', '관대', '건록', '제왕'
  ];
  for (const term of bannedTerms) {
    if (fullText.includes(term)) reasons.push(`금지 용어: ${term}`);
  }

  // 3. 일일 톤 누출 검사 (사주 총평의 핵심)
  const dailyTonePatterns = [
    /오늘은/, /이번 주/, /[가-힣]+ 날입니다\b/, /오늘의 흐름/
  ];
  for (const pattern of dailyTonePatterns) {
    if (pattern.test(fullText)) reasons.push(`일일 톤 누출: ${fullText.match(pattern)?.[0]}`);
  }

  // 4. "결" 단어 빈도 (naming-policy §9 적용 — 더 엄격해짐)
  const paragraphs = [
    output.main_narrative.paragraph_1_who_you_are,
    output.main_narrative.paragraph_2_strong_environment,
    output.main_narrative.paragraph_3_weak_zone,
    output.main_narrative.paragraph_4_now,
  ];
  
  // 한 줄 요약·카드 제목·부제·라벨에 "결" 사용 금지
  if (output.one_line_summary.includes('결')) {
    reasons.push(`한 줄 요약에 "결" 단어 사용 금지`);
  }
  output.lifetime_keys.forEach((k, i) => {
    if (k.title.includes('결')) reasons.push(`카드 ${i+1} 제목에 "결" 단어 사용 금지`);
    if (k.subtitle.includes('결')) reasons.push(`카드 ${i+1} 부제에 "결" 단어 사용 금지`);
  });
  
  // 단락별 "결" 단어 단락당 1회 이하
  paragraphs.forEach((p, i) => {
    const count = (p.match(/결/g) || []).length;
    if (count > 1) reasons.push(`단락 ${i+1} '결' 과다 사용: ${count}회 (목표 1회 이하)`);
  });

  // 4-A. 어휘 정책 검증 (naming-policy.md §12 정규식)
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/(새싹|햇살|흙|쇠|물)의\s*결/g, '자연 비유 + "의 결" (예: 쇠의 결)'],
    [/결단과|안정과|열정과|시작과|지혜과/g, '구 X과 라벨 (예: 결단과)'],
    [/(표현|생각|절제|직관|돌봄|관찰|베푸는)의\s*기운/g, '십성 추상명사화 (예: 표현의 기운)'],
    [/(돌봄|표현|기준|단단함)의\s*결/g, '추상명사 + 결 (예: 돌봄의 결)'],
    [/(표현|돌봄|재물|관계|기준)형\s*사주/g, 'X형 사주 신조어'],
  ];
  for (const [pattern, label] of forbiddenPatterns) {
    const matches = fullText.match(pattern);
    if (matches?.length) {
      reasons.push(`금지 어휘 (${label}): ${[...new Set(matches)].join(', ')}`);
    }
  }
  
  // 4-B. 오행 표기 정책 — 본문에서 오행 언급 시 반드시 "X 기운" 형태
  // (오행 한 글자 + "의 기운" 또는 단독 사용 검출)
  const ohaengWrongPattern = /(목|화|토|금|수)의\s*기운/g;
  const ohaengWrongMatches = fullText.match(ohaengWrongPattern);
  if (ohaengWrongMatches?.length) {
    reasons.push(`오행 "X의 기운" 형태 금지 (X 기운으로 표기): ${[...new Set(ohaengWrongMatches)].join(', ')}`);
  }

  // 5. 자극적 표현
  const clickbait = ['대박', '비책', '암흑기', '텅장', '꿀팁', '반드시', '절대', '확실히'];
  for (const word of clickbait) {
    if (fullText.includes(word)) reasons.push(`자극적/단정 표현: ${word}`);
  }

  // 6. 사용자 이름 호명 횟수 (최대 2회)
  const nameCount = (fullText.match(/테스트 ?님/g) || []).length;
  if (nameCount > 2) reasons.push(`이름 호명 과다: ${nameCount}회`);

  // 7. 컨텍스트 반영 검증
  if (context.occupationStatus) {
    const occupKeywords = {
      '직장인': ['직장', '업무', '회사'],
      '구직 중': ['구직', '면접', '취업'],
      '자영업': ['사업', '운영', '매출'],
      '프리랜서': ['프리랜서', '의뢰', '계약']
    };
    const keywords = occupKeywords[context.occupationStatus] || [];
    const hit = keywords.some(k => output.main_narrative.paragraph_2_strong_environment.includes(k));
    if (!hit) reasons.push(`단락 2에 직업 컨텍스트(${context.occupationStatus}) 미반영`);
  }

  if (context.concern && !output.main_narrative.paragraph_4_now.includes(context.concern.replace('·', ''))) {
    // "재물·투자" -> "재물" 또는 "투자" 어느 하나는 본문에 등장해야
    const parts = context.concern.split('·');
    const hit = parts.some(p => output.main_narrative.paragraph_4_now.includes(p));
    if (!hit) reasons.push(`단락 4에 고민 컨텍스트(${context.concern}) 미반영`);
  }

  // 8. 단락 간 동일 문장 검사
  const sentences = paragraphs.flatMap((p, i) => 
    p.split(/[.!?]\s+/).map(s => ({ paragraph: i+1, sentence: s.trim() }))
  ).filter(x => x.sentence.length > 20);
  
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i+1; j < sentences.length; j++) {
      if (sentences[i].paragraph !== sentences[j].paragraph &&
          sentences[i].sentence === sentences[j].sentence) {
        reasons.push(`단락 ${sentences[i].paragraph}·${sentences[j].paragraph} 동일 문장`);
      }
    }
  }

  // 9. 길이 검사
  const totalSentences = paragraphs.reduce((sum, p) => 
    sum + (p.split(/[.!?]\s+/).filter(s => s.trim().length > 0).length), 0);
  if (totalSentences < 25 || totalSentences > 35) {
    reasons.push(`본문 문장 수: ${totalSentences} (목표 25~35)`);
  }

  // 10. 평생 활용 3가지 검사
  if (output.lifetime_keys.length !== 3) {
    reasons.push(`평생 활용 항목 수: ${output.lifetime_keys.length} (목표 3)`);
  }

  return { ok: reasons.length === 0, reasons };
}
```

**검증 실패 시 처리** (daewoon 스펙과 동일):
- 1차 실패 → 같은 프롬프트로 1회 재생성
- 2차 실패 → 시스템 프롬프트에 실패 사유 추가하고 재생성
- 3차 실패 → 운영자 알림 + fallback 표시

**모니터링 지표**:
- 한자 누출률 (목표 0.1% 이하)
- 일일 톤 누출률 (목표 0.5% 이하)
- 컨텍스트 미반영률 (목표 5% 이하)
- 평균 재생성 횟수 (목표 1.2회 이하)

---

## 8. 호출 패턴 및 비용

### 호출 패턴

3섹션(한 줄 요약 / 본문 4단락 / 평생 활용 3가지)을 **병렬 호출**.

```
[ Total review 생성 요청 ]
       │
       ├── 호출 1: one_line_summary (작은 모델, 200 토큰)
       ├── 호출 2: main_narrative (메인 모델, 800 토큰)
       └── 호출 3: lifetime_keys (메인 모델, 400 토큰)
       │
[ 병렬로 받아 합쳐서 후처리 검증 ]
       │
[ 검증 통과 시 캐시 + UI 렌더 ]
```

**왜 분리?**
- 본문 4단락 생성은 토큰이 많이 들어 비용·시간이 크므로 별도 호출
- 한 줄 요약과 평생 활용 카드는 *형식이 다른 출력*이라 분리하면 품질 안정적
- 일부 섹션만 재생성 가능 (예: 컨텍스트 미반영으로 단락 2만 다시)

### 비용 추정

GPT-5-mini 또는 동급 기준 (2026년 가격):
- 호출 1: 입력 ~1.5K + 출력 ~50 토큰
- 호출 2: 입력 ~2K + 출력 ~600 토큰
- 호출 3: 입력 ~1.5K + 출력 ~300 토큰

합계: 입력 ~5K + 출력 ~950 토큰. 한 사용자당 약 $0.02~0.05.

**캐싱**:
- 키: `(birth + gender + context_hash)`
- 컨텍스트 변경(솔로 → 기혼 등) 시에만 재생성
- 동일 사주 + 동일 컨텍스트는 영구 캐시 (대운 변경 시점에 자동 갱신)

---

## 9. 기존 사이트 통합 가이드

### 9-1. 변경되는 영역 vs 유지되는 영역

```
[사주 총평 페이지]

┌─ 사주팔자 8글자 카드 ──────── ✅ 유지 (한자 그대로)
│
├─ 한 줄 요약 카드 ──────────── 🔄 LLM 출력으로 교체
│   현재: "안정이 앞서고 정리가 비기 쉬운 날입니다"
│   →   one_line_summary 필드
│
├─ 칩 (기질/강점/보완) ──────── ⚠️ 별도 작업 (제안 ⑥, 다음 단계)
│
├─ "이 풀이는 ~ 반영했어요" 카드 ── ✅ 유지
│
├─ "한 단락으로 정리" 본문 ────── 🔄 LLM 출력으로 교체
│   현재: 7문장 단일 단락
│   →   main_narrative 4단락
│
├─ 일주/격국/용신/강약 칩 ──────── ✅ 유지
│
├─ 평생 활용 카드 3개 ────────── 🆕 신규 추가
│   →   lifetime_keys 배열
│
└─ "더 자세히 보기" CTA ────────  ✅ 유지
```

### 9-2. 프론트엔드 컴포넌트 변경 사항

1. **"한 줄 요약 카드"** 컴포넌트
   - 기존 props 그대로 — 다만 문구가 LLM에서 옴
   - "날입니다" → "사주예요/성향입니다" 변환 자동 검증

2. **"한 단락으로 정리"** 영역
   - 4개 단락 분리 표시 — 단락 사이 시각적 구분 (여백 또는 작은 구분선)
   - 각 단락에 *작은 라벨* 부여하면 가독성↑:
     - 단락 1: "당신은 어떤 사람인가" 라벨
     - 단락 2: "잘 살아나는 환경"
     - 단락 3: "조심할 자리"
     - 단락 4: "지금 시기 핵심"
   - 라벨 색상은 시기 라벨처럼 컬러 코딩 가능

3. **"평생 활용 핵심 3가지"** 신규 카드
   - 가로 스와이프 캐러셀 또는 세로 3카드
   - 각 카드: 제목 (큰 글씨) + 부제 (회색 작은 글씨) + 본문 (1~2문장)
   - 색상: 강한 환경 = 그린, 약한 자리 = 오렌지, 핵심 활용법 = 핑크 (사이트 토큰 활용)

### 9-3. 백엔드 API 변경 사항

기존 사주 총평 API가 *단일 문자열* 반환이면, 다음과 같이 *구조화 응답*으로 변경:

```typescript
// Before
type TotalReviewResponse = {
  one_line_summary: string;
  body: string;  // 단일 단락
};

// After
type TotalReviewResponse = {
  one_line_summary: string;
  main_narrative: {
    paragraph_1_who_you_are: string;
    paragraph_2_strong_environment: string;
    paragraph_3_weak_zone: string;
    paragraph_4_now: string;
  };
  lifetime_keys: Array<{
    title: string;
    subtitle: string;
    body: string;
  }>;
  meta: {
    generated_at: string;
    cache_key: string;
    model_version: string;
  };
};
```

---

## 10. 통합 체크리스트

배포 전 확인:

- [ ] 입력 JSON에 모든 `_easy` 필드가 채워져 있는지 (L2.5 사전 적용)
- [ ] `_internal` 필드의 한자/명리어가 LLM 프롬프트에 포함되지 않는지
- [ ] 시스템 프롬프트의 8개 절대 규칙이 모두 명시되어 있는지
- [ ] 3섹션 분리 호출이 병렬로 동작하는지
- [ ] 후처리 검증 함수가 10개 항목 모두 체크하는지
- [ ] 검증 실패 시 재생성 로직이 동작하는지
- [ ] 캐시 키가 컨텍스트 변경을 반영하는지
- [ ] BEFORE/AFTER 비교가 시각적으로 확인 가능한지 (스테이징 환경)
- [ ] 5개 다른 사주 케이스로 일반화 테스트 통과 (`verification-prompts.md` 검증 5 참고)
- [ ] 한 명 이상의 일반인(명리 모르는 사람)에게 읽어보게 함

---

## 11. 다음 단계 — (나) 점수 시스템

총평 본문 확장이 완료되면 다음 작업:

- **종합 점수 100점** 시스템 설계 (균형/격국/용신/오행/합충 5요소 가중치)
- **5단계 라벨** ("균형 좋은" / "잘 다듬어진" / "무난한" / "의식적 관리 필요" / "균형 보완 시급")
- **점수 산출 내역 표** UI — 오늘의 운세 패턴 그대로
- **오행 도넛 차트** + **강약 게이지** 시각화
- **무료/유료 경계** 재설계

이 작업은 별도 스펙(`saju-score-spec.md` 등)으로 정리 예정.

---

## 한 줄 요약

> 같은 사주 데이터 + 같은 UI 그릇 + LLM 출력만 5~7배 확장.
> 사이트 가치가 한 단계 올라가는 *가장 비용 효율적인 작업*.
