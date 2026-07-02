import { useQuery } from "@tanstack/react-query";
import apiClient from "./apiClient";
import type { MealLogResponse, WorkoutLogResponse, WeightLogResponse } from "../types";

// Centralized query keys so different pages (Dashboard, Meals, …) read and write
// the SAME cache entry. Ask for ["meals","logs"] from two places → one cached result.
export const queryKeys = {
  mealLogs: () => ["meals", "logs"] as const,
  weightLogs: () => ["weight", "logs"] as const,
  workoutLogs: (date: string) => ["workouts", "logs", { date }] as const,
};

export function useMealLogs() {
  return useQuery({
    queryKey: queryKeys.mealLogs(),
    queryFn: async () => (await apiClient.get<MealLogResponse[]>("/meals/logs")).data,
  });
}

export function useWeightLogs() {
  return useQuery({
    queryKey: queryKeys.weightLogs(),
    queryFn: async () => (await apiClient.get<WeightLogResponse[]>("/weight/logs")).data,
  });
}

export function useWorkoutLogs(date: string) {
  return useQuery({
    queryKey: queryKeys.workoutLogs(date),
    queryFn: async () =>
      (await apiClient.get<WorkoutLogResponse[]>(`/workouts/logs?date=${date}`)).data,
  });
}
