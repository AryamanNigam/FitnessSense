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

// Meals
export interface MealItem {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface GeneratedMeal {
  meal_name: string;
  items: MealItem[];
  total_kcal: number;
  instructions: string[];
}

export interface MealPlanResponse {
  meals: GeneratedMeal[];
}

export interface MealLogResponse {
  id: string;
  user_id: string;
  meal_name: string;
  items: MealItem[];
  total_kcal: number;
  instructions: string[];
  logged_at: string;
}

// Workouts
export interface WorkoutExercise {
  exercise: string;
  sets: number;
  reps: string;
  rest_s: number;
}

export interface GeneratedWorkout {
  exercises: WorkoutExercise[];
  notes: string;
}

export interface WorkoutLogResponse {
  id: string;
  user_id: string;
  plan: WorkoutExercise[];
  notes: string | null;
  logged_at: string;
}

// Weight
export interface WeightLogResponse {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
}
