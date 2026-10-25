// Frontend mirror of backend/app/services/splits.py — used only for display
// (labels, preset previews, deriving today's focus). The backend remains the
// source of truth: for presets we send just the split_type and it fills the
// schedule authoritatively.
import type { Focus, Schedule, SplitType } from "../types";

// Weekday keys in order; index matches the Mon-first week below.
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

// Focus vocabulary a user can assign to a day, in picker order. "rest" handled separately.
export const FOCUS_OPTIONS: Focus[] = [
  "push", "pull", "legs",
  "chest", "back", "shoulders", "arms",
  "upper", "lower", "full_body",
];

export const FOCUS_LABELS: Record<Focus, string> = {
  push: "Push", pull: "Pull", legs: "Legs",
  chest: "Chest", back: "Back", shoulders: "Shoulders", arms: "Arms",
  upper: "Upper", lower: "Lower", full_body: "Full body",
  rest: "Rest",
};

export const PRESET_SCHEDULES: Record<Exclude<SplitType, "custom">, Schedule> = {
  ppl_3: {
    mon: "push", tue: "rest", wed: "pull",
    thu: "rest", fri: "legs", sat: "rest", sun: "rest",
  },
  ppl_6: {
    mon: "push", tue: "pull", wed: "legs",
    thu: "push", fri: "pull", sat: "legs", sun: "rest",
  },
  bro_5: {
    mon: "chest", tue: "back", wed: "shoulders",
    thu: "legs", fri: "arms", sat: "rest", sun: "rest",
  },
};

export const PRESET_META: { type: Exclude<SplitType, "custom">; label: string; desc: string }[] = [
  { type: "ppl_3", label: "PPL — 3 day", desc: "Push / Pull / Legs, three days a week" },
  { type: "ppl_6", label: "PPL — 6 day", desc: "Push / Pull / Legs twice, one rest day" },
  { type: "bro_5", label: "Bro split — 5 day", desc: "One muscle group per day, two rest days" },
];

// Blank week — every day rest. Seed for a fresh custom split.
export function emptySchedule(): Schedule {
  return WEEKDAYS.reduce((acc, d) => ({ ...acc, [d]: "rest" }), {} as Schedule);
}

// Today's weekday key. JS getDay(): 0=Sun…6=Sat → Mon-first index.
export function todayKey(): string {
  return WEEKDAYS[(new Date().getDay() + 6) % 7];
}

// The focus scheduled for today. Missing schedule/day -> "rest".
export function focusForToday(schedule: Schedule | undefined): Focus {
  return schedule?.[todayKey()] ?? "rest";
}
