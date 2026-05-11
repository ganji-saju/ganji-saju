import assert from 'node:assert/strict';
import { MOONLIGHT_ANALYTICS_EVENTS } from './analytics-events';

declare const test: (name: string, fn: () => void) => void;

test('personality compatibility funnel events are registered', () => {
  const requiredEvents = [
    'personality_compatibility_viewed',
    'relationship_type_selected',
    'profile_a_completed',
    'profile_b_completed',
    'personality_type_selected',
    'personality_check_completed',
    'free_result_viewed',
    'paid_unlock_clicked',
    'payment_completed',
    'report_shared',
    'ai_chat_started_from_report',
    'report_feedback_submitted',
  ] as const;

  for (const eventName of requiredEvents) {
    assert.ok(MOONLIGHT_ANALYTICS_EVENTS.includes(eventName));
  }
});
