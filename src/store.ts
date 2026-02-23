import { ChildProfile, DailyLesson, PlacementTrack, ProgressSnapshot, Reward } from "./contracts";

export interface ParentRecord {
  id: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface ConsentRecord {
  parentId: string;
  accepted: boolean;
  market: string;
  acceptedAt: string;
}

export interface ChildRecord extends ChildProfile {
  parentId: string;
  rewards: Reward[];
  progress: ProgressSnapshot;
  completedUnitIds: Set<string>;
}

export interface SessionRecord {
  id: string;
  parentId: string;
  childId: string;
  lessonId: string;
  startedAt: string;
  completedAt?: string;
  completedActivityIds: string[];
  reward?: Reward;
}

export interface DeletionRequest {
  id: string;
  childId: string;
  parentId: string;
  status: "queued";
  requestedAt: string;
}

let sequence = 0;

export function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString().padStart(8, "0")}`;
}

export const parents = new Map<string, ParentRecord>();
export const parentsByLoginKey = new Map<string, string>();
export const consents = new Map<string, ConsentRecord>();
export const children = new Map<string, ChildRecord>();
export const lessonsByDate = new Map<string, DailyLesson>();
export const sessions = new Map<string, SessionRecord>();
export const deletionRequests: DeletionRequest[] = [];

export function resetStore(): void {
  sequence = 0;
  parents.clear();
  parentsByLoginKey.clear();
  consents.clear();
  children.clear();
  lessonsByDate.clear();
  sessions.clear();
  deletionRequests.splice(0, deletionRequests.length);
}

export function normalizeLoginKey(email?: string, phone?: string): string {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPhone = phone?.trim();
  if (!normalizedEmail && !normalizedPhone) {
    return "";
  }
  return normalizedEmail ? `email:${normalizedEmail}` : `phone:${normalizedPhone}`;
}

export function placementFromAge(ageMonths: number): PlacementTrack {
  if (ageMonths <= 41) {
    return "starter_a";
  }
  if (ageMonths <= 53) {
    return "starter_b";
  }
  return "starter_c";
}

export function emptyProgress(childId: string): ProgressSnapshot {
  return {
    childId,
    sessionsCompleted: 0,
    unitsCompleted: 0,
    milestoneBySkill: {
      listening: "not_started",
      phonics: "not_started",
      vocabulary: "not_started"
    },
    lastActiveAt: null
  };
}

export function trackLessonKey(childId: string, dateKey: string): string {
  return `${childId}:${dateKey}`;
}

export function updateMilestones(progress: ProgressSnapshot): ProgressSnapshot {
  const sessionsCompleted = progress.sessionsCompleted;

  const listening =
    sessionsCompleted >= 8
      ? "established"
      : sessionsCompleted >= 5
        ? "developing"
        : sessionsCompleted >= 2
          ? "emerging"
          : "not_started";
  const phonics =
    sessionsCompleted >= 10
      ? "established"
      : sessionsCompleted >= 6
        ? "developing"
        : sessionsCompleted >= 3
          ? "emerging"
          : "not_started";
  const vocabulary =
    sessionsCompleted >= 9
      ? "established"
      : sessionsCompleted >= 5
        ? "developing"
        : sessionsCompleted >= 2
          ? "emerging"
          : "not_started";

  return {
    ...progress,
    milestoneBySkill: {
      listening,
      phonics,
      vocabulary
    }
  };
}
