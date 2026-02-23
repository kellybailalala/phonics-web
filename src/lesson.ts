import { DailyLesson, LessonActivity } from "./contracts";
import { ACTIVITY_PLAN, CURRICULUM_UNITS, speechPrompt } from "./content";
import { ChildRecord, nextId } from "./store";

export function dateKey(isoDate = new Date()): string {
  return isoDate.toISOString().slice(0, 10);
}

function pickWord(words: string[], cursor: number): string {
  return words[cursor % words.length];
}

export function createDailyLesson(child: ChildRecord): DailyLesson {
  const sessions = child.progress.sessionsCompleted;
  const unit = CURRICULUM_UNITS[sessions % CURRICULUM_UNITS.length];

  const activities: LessonActivity[] = ACTIVITY_PLAN.slice(0, 5).map((template, index) => {
    const word = pickWord(unit.vocabulary, sessions + index);
    const prompt = `${template.instruction} Theme ${unit.theme}. Word ${word}.`;

    return {
      id: nextId("act"),
      type: template.type,
      promptAudioUrl: speechPrompt(prompt),
      assetIds: [`img:${word}`, `theme:${unit.theme.toLowerCase()}`],
      targetSkill: template.targetSkill
    };
  });

  return {
    lessonId: nextId("lesson"),
    childId: child.id,
    unitId: unit.id,
    activities,
    estimatedMinutes: 9
  };
}
