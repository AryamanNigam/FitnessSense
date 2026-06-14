export type Goal = "cut" | "bulk" | "maintain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface Profile {
  id: string;
  name: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  goal: Goal;
  activity_level: ActivityLevel;
  tdee: number;
  protein_target_g: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileCreate {
  name: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  goal: Goal;
  activity_level: ActivityLevel;
}
