// 2026-08-31 — 대화방 답변이 **단어 중간에서** 끊겨 나가던 것.
//
//   제보(캡처): "…연금 종류와 은퇴 시점, 현재 자산 규모를 알려주시면 그 조건에 맞"
//   원인: Responses API 의 status/incomplete_details 를 아무도 안 보고 output_text 를
//   그대로 내보냈다. 한국어는 토큰을 많이 먹어 상한(당시 600)에 자주 닿는다.
//
//   🔴 상한을 올리는 것만으로는 안 끝난다 — 더 긴 답이면 또 걸린다.
//      **잘린 응답을 마지막 완결 문장까지 자르는 것**이 실제 방어선이다.
import { describe, expect, it } from 'vitest';
import { trimToLastSentence } from './openai-text';

describe('잘린 답변 다듬기', () => {
  it('실제 제보 문장 — 단어 중간 절단을 잘라낸다', () => {
    const cut =
      '오늘 바로 하실 일은 은퇴 후 예상 월생활비를 적어보는 것입니다. ' +
      '그 숫자가 있어야 인출 계획을 제대로 잡을 수 있습니다. ' +
      '연금 종류와 은퇴 시점, 현재 자산 규모를 알려주시면 그 조건에 맞';
    const out = trimToLastSentence(cut);
    expect(out.endsWith('있습니다.')).toBe(true);
    expect(out).not.toContain('그 조건에 맞');
  });

  it('멀쩡한 답변은 그대로 둔다', () => {
    const ok = '첫 문장입니다. 두 번째 문장입니다.';
    expect(trimToLastSentence(ok)).toBe(ok);
  });

  it('물음표·느낌표도 문장 끝으로 본다', () => {
    expect(trimToLastSentence('이건 어떨까요? 그리고 이건 잘림')).toBe('이건 어떨까요?');
  });

  it('종결 부호가 없으면 원문을 살린다 — 통째로 버리지 않는다', () => {
    const noStop = '종결 부호가 하나도 없는 짧은 답';
    expect(trimToLastSentence(noStop)).toBe(noStop);
  });

  it('너무 많이 날아가면(원문 40% 미만) 원문을 살린다', () => {
    // 앞부분에만 마침표가 있고 뒤가 대부분이면, 잘랐을 때 답이 사라진 것과 다름없다.
    const mostlyAfter = '네. ' + '뒤에 이어지는 아주 긴 설명이 계속됩니다'.repeat(4);
    expect(trimToLastSentence(mostlyAfter)).toBe(mostlyAfter);
  });
});
