import { LessonActivityType, SkillArea } from "./contracts";

export interface CurriculumUnit {
  id: string;
  theme: string;
  soundFamily: string;
  vocabulary: string[];
}

export const CURRICULUM_UNITS: CurriculumUnit[] = [
  { id: "u01", theme: "Family", soundFamily: "m", vocabulary: ["mama", "dada", "baby", "home", "hug", "love", "family", "hello", "bye", "smile"] },
  { id: "u02", theme: "Colors", soundFamily: "r", vocabulary: ["red", "blue", "yellow", "green", "orange", "pink", "purple", "black", "white", "brown"] },
  { id: "u03", theme: "Animals", soundFamily: "c", vocabulary: ["cat", "dog", "duck", "bird", "fish", "lion", "tiger", "rabbit", "bear", "monkey"] },
  { id: "u04", theme: "Food", soundFamily: "b", vocabulary: ["bread", "banana", "apple", "rice", "milk", "egg", "soup", "carrot", "cake", "water"] },
  { id: "u05", theme: "Body", soundFamily: "h", vocabulary: ["hand", "head", "eyes", "ears", "nose", "mouth", "feet", "arms", "legs", "hair"] },
  { id: "u06", theme: "Toys", soundFamily: "t", vocabulary: ["toy", "ball", "car", "doll", "blocks", "kite", "puzzle", "drum", "book", "train"] },
  { id: "u07", theme: "Home", soundFamily: "s", vocabulary: ["sofa", "table", "bed", "chair", "door", "window", "kitchen", "bath", "room", "lamp"] },
  { id: "u08", theme: "Routines", soundFamily: "w", vocabulary: ["wake", "wash", "eat", "play", "read", "nap", "walk", "clean", "pack", "sleep"] },
  { id: "u09", theme: "Numbers", soundFamily: "n", vocabulary: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"] },
  { id: "u10", theme: "Weather", soundFamily: "s", vocabulary: ["sunny", "rainy", "cloudy", "windy", "storm", "hot", "cold", "wet", "dry", "rainbow"] },
  { id: "u11", theme: "Transport", soundFamily: "v", vocabulary: ["bus", "car", "train", "bike", "boat", "plane", "van", "taxi", "road", "wheel"] },
  { id: "u12", theme: "Feelings", soundFamily: "f", vocabulary: ["happy", "sad", "angry", "scared", "excited", "tired", "calm", "kind", "proud", "shy"] }
];

export interface ActivityTemplate {
  type: LessonActivityType;
  targetSkill: SkillArea;
  instruction: string;
}

// 70% listening/comprehension, 20% phonics, 10% speaking imitation.
export const ACTIVITY_PLAN: ActivityTemplate[] = [
  { type: "listen_tap", targetSkill: "listening", instruction: "Listen and tap the picture." },
  { type: "match_picture", targetSkill: "listening", instruction: "Match the word to the picture." },
  { type: "listen_tap", targetSkill: "vocabulary", instruction: "Tap the word you hear." },
  { type: "letter_sound", targetSkill: "phonics", instruction: "Pick the letter sound." },
  { type: "repeat_audio", targetSkill: "listening", instruction: "Listen and repeat the word." }
];

export const AVATAR_IDS = ["rocket", "tiger", "whale", "koala", "panda", "owl"];

export function speechPrompt(text: string): string {
  return `speech:${text}`;
}
