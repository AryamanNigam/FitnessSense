import { useQuery } from "@tanstack/react-query";
import apiClient from "./apiClient";
import type { MealLogResponse, WorkoutLogResponse, WeightLogResponse, ChatMessage, ProgressSummary } from "../types";

// Centralized query keys so different pages (Dashboard, Meals, …) read and write
// the SAME cache entry. Ask for ["meals","logs"] from two places → one cached result.
export const queryKeys = {
  mealLogs: () => ["meals", "logs"] as const,
  weightLogs: () => ["weight", "logs"] as const,
  progressSummary: (days: number) => ["progress", "summary", { days }] as const,
  progressWeight: (days: number) => ["progress", "weight", { days }] as const,
  allWorkoutLogs: () => ["workouts", "logs", "all"] as const,
  chatHistory: () => ["chat", "history"] as const,
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

export function useChatHistory() {
  return useQuery({
    queryKey: queryKeys.chatHistory(),
    queryFn: async () => (await apiClient.get<ChatMessage[]>("/chat/history")).data,
  });
}

export function useProgressSummary(days: number) {
  return useQuery({
    queryKey: queryKeys.progressSummary(days),
    queryFn: async () => (await apiClient.get<ProgressSummary>(`/progress/summary?days=${days}`)).data,
  });
}

export function useProgressWeight(days: number) {
  return useQuery({
    queryKey: queryKeys.progressWeight(days),
    queryFn: async () => (await apiClient.get<WeightLogResponse[]>(`/progress/weight?days=${days}`)).data,
  });
}

export function useAllWorkoutLogs() {
  return useQuery({
    queryKey: queryKeys.allWorkoutLogs(),
    queryFn: async () => (await apiClient.get<WorkoutLogResponse[]>("/workouts/logs")).data,
  });
}
