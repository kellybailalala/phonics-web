export type AnalyticsEventName =
  | "parent_signup_completed"
  | "consent_accepted"
  | "child_profile_created"
  | "placement_completed"
  | "lesson_started"
  | "activity_completed"
  | "lesson_completed"
  | "reward_earned"
  | "dashboard_viewed"
  | "deletion_requested";

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  parentId?: string;
  childId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

let sequence = 0;
const events: AnalyticsEvent[] = [];

function eventId(): string {
  sequence += 1;
  return `evt_${sequence.toString().padStart(8, "0")}`;
}

export function logEvent(
  name: AnalyticsEventName,
  payload: Omit<AnalyticsEvent, "id" | "name" | "createdAt">
): AnalyticsEvent {
  const event: AnalyticsEvent = {
    id: eventId(),
    name,
    createdAt: new Date().toISOString(),
    ...payload
  };
  events.push(event);
  return event;
}

export function getEvents(): AnalyticsEvent[] {
  return [...events];
}

export function resetAnalytics(): void {
  sequence = 0;
  events.splice(0, events.length);
}
