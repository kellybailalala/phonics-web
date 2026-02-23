export type SkillArea = "listening" | "phonics" | "vocabulary";

export type PlacementTrack = "starter_a" | "starter_b" | "starter_c";

export interface ChildProfile {
  id: string;
  displayName: string;
  ageMonths: number;
  homeLanguage: string;
  avatarId: string;
  placementTrack: PlacementTrack;
  createdAt: string;
}

export type LessonActivityType =
  | "listen_tap"
  | "match_picture"
  | "letter_sound"
  | "repeat_audio"
  | "trace_tap";

export interface LessonActivity {
  id: string;
  type: LessonActivityType;
  promptAudioUrl: string;
  assetIds: string[];
  targetSkill: SkillArea;
}

export interface DailyLesson {
  lessonId: string;
  childId: string;
  unitId: string;
  activities: LessonActivity[];
  estimatedMinutes: number;
}

export interface ProgressSnapshot {
  childId: string;
  sessionsCompleted: number;
  unitsCompleted: number;
  milestoneBySkill: Record<SkillArea, "not_started" | "emerging" | "developing" | "established">;
  lastActiveAt: string | null;
}

export interface Reward {
  id: string;
  type: "sticker" | "star" | "badge";
  label: string;
  earnedAt: string;
}

export interface ParentAuthResponse {
  parentId: string;
  token: string;
}
