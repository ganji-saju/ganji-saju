import assert from 'node:assert/strict';
import { MOONLIGHT_ANALYTICS_EVENTS } from './analytics-events';

declare const test: (name: string, fn: () => void) => void;

test('home redesign events are registered', () => {
  const requiredEvents = [
    'home_viewed',
    'home_hero_primary_clicked',
    'home_hero_secondary_clicked',
    'home_primary_feature_clicked',
    'home_free_service_clicked',
    'home_theme_service_clicked',
    'home_ai_dialogue_clicked',
    'home_archive_clicked',
    'home_pricing_clicked',
  ] as const;

  for (const eventName of requiredEvents) {
    assert.ok(MOONLIGHT_ANALYTICS_EVENTS.includes(eventName));
  }
});

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

test('saju personality funnel events are registered', () => {
  const requiredEvents = [
    'saju_personality_viewed',
    'saju_personality_profile_selected',
    'saju_personality_birth_info_completed',
    'saju_personality_type_selected',
    'saju_personality_check_completed',
    'saju_personality_life_area_selected',
    'saju_personality_free_result_viewed',
    'saju_personality_paid_unlock_clicked',
    'saju_personality_payment_completed',
    'saju_personality_report_saved',
    'saju_personality_report_shared',
    'saju_personality_ai_chat_started',
    'saju_personality_feedback_submitted',
  ] as const;

  for (const eventName of requiredEvents) {
    assert.ok(MOONLIGHT_ANALYTICS_EVENTS.includes(eventName));
  }
});
