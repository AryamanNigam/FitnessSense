import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { useToast } from "../components/ui/toastContext";
import { errorMessage } from "../lib/errors";
import DailyRing from "../components/dashboard/DailyRing";
import WeightTracker from "../components/dashboard/WeightTracker";
import apiClient from "../lib/apiClient";
import { useChatHistory, useMealLogs, useWeightLogs, useWorkoutLogs, queryKeys } from "../lib/queries";
import { ErrorNotice } from "../components/ui/QueryState";
import { FOCUS_LABELS, focusForToday } from "../lib/splits";
import type { Focus, WeightLogResponse } from "../types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = todayStr();

  // Cached queries — instant on tab switch, deduped across the app.
  const mealsQuery   = useMealLogs();
  const weightQuery  = useWeightLogs();
  const workoutQuery = useWorkoutLogs(today);
  const chatQuery    = useChatHistory();
  const recentChat   = (chatQuery.data ?? []).slice(-2);
  const loadFailed   = mealsQuery.isError || weightQuery.isError || workoutQuery.isError;

  const mealLogs      = mealsQuery.data ?? [];
  const weightLogs    = weightQuery.data ?? [];
  // useWorkoutLogs(today) is already date-scoped, so these are today's workouts.
  const todaysWorkouts = workoutQuery.data ?? [];
  const workoutDone    = todaysWorkouts.length > 0;
  // weightDone is derived from the full weight log — no separate request needed.
  const weightDone  = weightLogs.some((l) => l.logged_at.slice(0, 10) === today);

  const ringLoading   = mealsQuery.isLoading || workoutQuery.isLoading || weightQuery.isLoading;
  const weightLoading = weightQuery.isLoading;

  const weightMutation = useMutation({
    mutationFn: (kg: number) =>
      apiClient
        .post<WeightLogResponse>("/weight/logs", { weight_kg: kg, logged_at: today })
        .then((res) => res.data),
    onSuccess: (newLog) => {
      // Write the new log straight into the cache so the ring + tracker update instantly.
      queryClient.setQueryData<WeightLogResponse[]>(queryKeys.weightLogs(), (prev) =>
        prev ? [newLog, ...prev] : [newLog]
      );
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      toast.success("Weight logged");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to log weight")),
  });

  async function handleWeightLog(kg: number) {
    await weightMutation.mutateAsync(kg);
  }

  if (!profile) return <Navigate to="/onboarding" replace />;

  const todaysMeals = mealLogs.filter((l) => l.logged_at.slice(0, 10) === today);
  const mealDone    = todaysMeals.length > 0;

  // Today's scheduled focus (only when a split is set). Drives the workout card chip.
  const todayFocus: Focus | null = profile.workout_split
    ? focusForToday(profile.workout_split.schedule)
    : null;
  const isRestDay = todayFocus === "rest";

  const greeting     = getGreeting();
  const todayLabel   = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const goalLabel    = profile.goal.charAt(0).toUpperCase() + profile.goal.slice(1);
  const activityLabel = profile.activity_level.replace(/_/g, " ");
  const latestWeight = weightLogs[0]?.weight_kg ?? profile.weight_kg;
  const deficitLabel =
    profile.goal === "cut"  ? `~${Math.round(profile.tdee * 0.15)} kcal deficit` :
    profile.goal === "bulk" ? `~${Math.round(profile.tdee * 0.1)} kcal surplus`  :
    "maintenance";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{greeting}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {goalLabel} · {activityLabel} · {profile.tdee.toLocaleString()} kcal target · {profile.protein_target_g}g protein
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
          <div className="px-4 py-2 rounded-xl text-sm" style={{ border: "0.5px solid var(--border)", color: "var(--text-secondary)" }}>{todayLabel}</div>
          <button onClick={() => navigate("/meals")} className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80" style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}>
            Generate today's plan
          </button>
        </div>
      </div>

      {loadFailed && (
        <ErrorNotice
          message="Some of your data didn't load."
          onRetry={() => {
            mealsQuery.refetch();
            weightQuery.refetch();
            workoutQuery.refetch();
          }}
        />
      )}

      {/* Row 1 — ring + weight tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)" }}>
          <DailyRing
            mealDone={mealDone}
            workoutDone={workoutDone}
            weightDone={weightDone}
            loading={ringLoading}
            onWeightLog={handleWeightLog}
          />
        </div>
        <WeightTracker logs={weightLogs} loading={weightLoading} />
      </div>

      {/* Row 2 — meal/workout (left) + stats/AI (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* Left — meal plan + workout */}
        <div className="lg:col-span-3 space-y-4">
          {/* Today's meal plan */}
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Today's meal plan</p>
              <button
                onClick={() => navigate("/meals")}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Go to Meals
              </button>
            </div>
            {todaysMeals.length > 0 ? (
              <div className="space-y-0.5">
                {todaysMeals.map((meal, i) => (
                  <div key={meal.id} className="py-3" style={i > 0 ? { borderTop: "0.5px solid var(--border)" } : undefined}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{meal.meal_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {meal.items.map((item) => item.name).join(", ")}
                        </p>
                      </div>
                      <p className="text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>{meal.total_kcal} kcal</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No meals logged yet today — head to Meals to generate and log one.
              </p>
            )}
          </div>

          {/* Today's workout */}
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Today's workout</p>
                {todayFocus && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                  >
                    {FOCUS_LABELS[todayFocus]} day
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate("/workouts")}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Go to Workouts
              </button>
            </div>
            {todaysWorkouts.length > 0 ? (
              <div>
                {todaysWorkouts.flatMap((workout) => workout.plan).map((ex, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 py-2"
                    style={i > 0 ? { borderTop: "0.5px solid var(--border)" } : undefined}
                  >
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{ex.exercise}</p>
                    <p className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
                      {ex.sets} × {ex.reps}
                      <span style={{ color: "var(--text-muted)" }}> · {ex.rest_s}s</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : isRestDay ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Rest day on your schedule — recover well.
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No workout logged yet today — head to Workouts to generate and log one.
              </p>
            )}
          </div>
        </div>

        {/* Right — daily target + protein/weight + Ask AI */}
        <div className="lg:col-span-2 space-y-4">
          {/* Daily target — hero */}
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
            <p className="label mb-3">Daily target</p>
            <p className="font-serif leading-none" style={{ fontSize: 58, color: "var(--accent)" }}>
              {profile.tdee.toLocaleString()}
              <span className="text-xl font-sans font-normal ml-2" style={{ color: "var(--text-muted)" }}>kcal</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{deficitLabel}</p>
          </div>

          {/* Protein + body weight side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)" }}>
              <p className="label mb-2">Protein</p>
              <p className="text-2xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>
                {profile.protein_target_g}
                <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>g</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {(profile.protein_target_g / profile.weight_kg).toFixed(1)}g · kg
              </p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)" }}>
              <p className="label mb-2">Body weight</p>
              <p className="text-2xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>
                {latestWeight}
                <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>kg</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {weightLogs.length > 0 ? "synced from weight log" : "from your profile"}
              </p>
            </div>
          </div>

          {/* Ask AI */}
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Ask AI</p>
              <button
                onClick={() => navigate("/ask-ai")}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                full chat
              </button>
            </div>
            <div className="space-y-2 mb-3">
              {recentChat.length === 0 ? (
                <div className="flex justify-end">
                  <div className="text-xs px-3 py-2 rounded-[10px_10px_0_10px] max-w-[80%]" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                    Ask me anything about your nutrition or workouts…
                  </div>
                </div>
              ) : (
                recentChat.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`text-xs px-3 py-2 max-w-[85%] line-clamp-3 ${m.role === "user" ? "rounded-[10px_10px_0_10px]" : "rounded-[10px_10px_10px_0]"}`}
                      style={{
                        background: m.role === "user" ? "var(--surface-2)" : "var(--ai-bubble-bg)",
                        color: m.role === "user" ? "var(--text-secondary)" : "var(--ai-bubble-text)",
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            <input
              type="text"
              placeholder="Ask anything about nutrition…"
              className="w-full text-xs px-3 py-2 rounded-xl focus:outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const question = e.currentTarget.value.trim();
                navigate("/ask-ai", { state: question ? { question } : undefined });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
