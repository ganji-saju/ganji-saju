// 2026-09-01 — 대화방 "남은 질문 N회" 계산 가드. 이 숫자는 사용자에게 하는 약속이라
//   과대 표시(못 쓰는 횟수를 약속)와 과소 표시(결제한 걸 안 보여줌) 둘 다 버그다.
import { describe, it, expect } from 'vitest';
import {
  AI_CHAT_BUNDLE_COST,
  createAiChatBillingSummary,
  getAiChatQuestionsRemaining,
  getAiChatTurnPlan,
} from './ai-chat-access';

describe('getAiChatQuestionsRemaining', () => {
  it('전 잔액은 묶음 단위(3전=3회)로만 센다 — 나머지는 버림', () => {
    expect(getAiChatQuestionsRemaining(3)).toBe(3);
    expect(getAiChatQuestionsRemaining(6)).toBe(6);
    // 🔴 잔액 2개로는 한 질문도 못 한다(묶음 시작 비용 3전). 2회로 보이면 거짓 약속.
    expect(getAiChatQuestionsRemaining(2)).toBe(0);
    expect(getAiChatQuestionsRemaining(5)).toBe(3);
  });

  it('잔액 없음·null·음수 → 0', () => {
    expect(getAiChatQuestionsRemaining(0)).toBe(0);
    expect(getAiChatQuestionsRemaining(null)).toBe(0);
    expect(getAiChatQuestionsRemaining(-3)).toBe(0);
  });

  it('묶음 잔여·멤버십 무료분은 잔액과 합산된다', () => {
    expect(getAiChatQuestionsRemaining(3, { bundleTurnsRemaining: 2 })).toBe(5);
    expect(getAiChatQuestionsRemaining(0, { freeTurnsRemaining: 5 })).toBe(5);
  });
});

describe('createAiChatBillingSummary — questionsRemaining', () => {
  it('묶음 첫 턴 결제 후: 잔액 회수 + 이번 묶음 잔여 2회', () => {
    // 3전 결제 직후 잔액 0, 이번 묶음에 2회 남음.
    const plan = getAiChatTurnPlan(0);
    expect(plan.status).toBe('charged_bundle');
    expect(plan.cost).toBe(AI_CHAT_BUNDLE_COST);
    expect(createAiChatBillingSummary('charged_bundle', 0, plan).questionsRemaining).toBe(2);
  });

  it('묶음 중간 턴: 남은 묶음만 센다', () => {
    const plan = getAiChatTurnPlan(1); // 2번째 턴 = 묶음 포함
    expect(plan.status).toBe('bundle_included');
    expect(createAiChatBillingSummary('bundle_included', 0, plan).questionsRemaining).toBe(1);
  });

  it('멤버십 오늘 무료: 남은 무료 건수를 그대로 보여준다', () => {
    const summary = createAiChatBillingSummary('member_daily_free', 0, {
      turnNumber: 1,
      freeTurnsRemaining: 4,
    });
    expect(summary.questionsRemaining).toBe(4);
  });

  it('잔액 부족·미로그인은 0 — 결제 창을 띄우는 신호', () => {
    expect(createAiChatBillingSummary('insufficient_credits', 2, {}).questionsRemaining).toBe(0);
    expect(createAiChatBillingSummary('auth_required', null).questionsRemaining).toBe(0);
  });
});
