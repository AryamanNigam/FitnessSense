import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/apiClient";
import { errorMessage } from "../lib/errors";
import { queryKeys, useAllWorkoutLogs, useProgressSummary, useProgressWeight } from "../lib/queries";
import { CalorieChart, WeightChart } from "../components/progress/charts";
import { EmptyState, ErrorNotice, Skeleton } from "../components/ui/QueryState";
import { useToast } from "../components/ui/toastContext";
import { FOCUS_LABELS } from "../lib/splits";
import type { Focus, WeightLogResponse } from "../types";

const RANGES = [7, 30, 90] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)" }}>
      <p className="label mb-2">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>
        {value}
        {unit && <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>{unit}</span>}
      </p>
      {hint && <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
      <p className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>{title}</p>
      {children}
    </div>
  );
}

export default function Progress() {
  const [days, setDays] = useState<number>(30);
  const [weightInput, setWeightInput] = useState("");
  const [dateInput, setDateInput] = useState(todayStr());

  const queryClient = useQueryClient();
  const toast = useToast();
  const summaryQuery = useProgressSummary(days);
  const weightQuery = useProgressWeight(days);
  const workoutsQuery = useAllWorkoutLogs();

  const summary = summaryQuery.data;
  const weightLogs = weightQuery.data ?? [];
  const recentWorkouts = (workoutsQuery.data ?? []).slice(0, 5);

  const logWeight = useMutation({
    mutationFn: (kg: number) =>
      apiClient
        .post<WeightLogResponse>("/progress/weight", { weight_kg: kg, logged_at: dateInput })
        .then((res) => res.data),
    onSuccess: (newLog) => {
      queryClient.setQueryData<WeightLogResponse[]>(queryKeys.weightLogs(), (prev) =>
        prev ? [newLog, ...prev] : [newLog]
      );
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      setWeightInput("");
      toast.success("Weight logged");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to log weight")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseFloat(weightInput);
    if (isNaN(kg) || kg <= 0 || kg > 500) {
      toast.error("Enter a weight between 1 and 500 kg");
      return;
    }
    logWeight.mutate(kg);
  }

  const change = summary?.weight.change_kg;
  const hasCalories = (summary?.days_with_meals ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Progress</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Weight, calories and training over time.
          </p>
        </div>
        <div className="flex items-center gap-1 self-start" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={
                days === r
                  ? "px-4 py-1.5 rounded-full bg-white text-zinc-900 text-sm font-medium"
                  : "px-4 py-1.5 rounded-full text-sm transition-colors"
              }
              style={days === r ? undefined : { color: "var(--text-secondary)" }}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {summaryQuery.isError && (
        <ErrorNotice message={errorMessage(summaryQuery.error, "Couldn't load your progress.")} onRetry={() => summaryQuery.refetch()} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryQuery.isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : summary ? (
          <>
            <Stat
              label="Weight change"
              value={change == null ? "—" : `${change > 0 ? "+" : ""}${change}`}
              unit={change == null ? undefined : "kg"}
              hint={summary.weight.latest_kg == null ? "No entries in range" : `Latest ${summary.weight.latest_kg} kg`}
            />
            <Stat
              label="Avg daily intake"
              value={hasCalories ? summary.avg_kcal.toLocaleString() : "—"}
              unit={hasCalories ? "kcal" : undefined}
              hint={`Target ${summary.calorie_target.toLocaleString()} kcal`}
            />
            <Stat label="Days logged" value={String(summary.days_with_meals)} unit={`/ ${summary.days}`} hint="Days with meals" />
            <Stat label="Workouts" value={String(summary.workouts_completed)} hint={`In the last ${summary.days} days`} />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Weight trend">
          {weightQuery.isLoading ? (
            <Skeleton className="h-60" />
          ) : weightQuery.isError ? (
            <ErrorNotice message="Couldn't load weight history." onRetry={() => weightQuery.refetch()} />
          ) : weightLogs.length === 0 ? (
            <EmptyState title="No weight entries in this range" hint="Log your weight below to start the chart." />
          ) : (
            <WeightChart logs={weightLogs} />
          )}
        </Card>

        <Card title="Calories vs target">
          {summaryQuery.isLoading ? (
            <Skeleton className="h-60" />
          ) : summary && hasCalories ? (
            <CalorieChart daily={summary.daily} target={summary.calorie_target} />
          ) : (
            <EmptyState title="No meals logged in this range" hint="Log a meal from the Meals page to see your intake." />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Log weight">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              step="0.1"
              min="1"
              max="500"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="Weight (kg)"
              aria-label="Weight in kilograms"
              className="flex-1 text-sm px-3 py-2 rounded-xl focus:outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
            />
            <input
              type="date"
              value={dateInput}
              max={todayStr()}
              onChange={(e) => setDateInput(e.target.value)}
              aria-label="Date"
              className="text-sm px-3 py-2 rounded-xl focus:outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "0.5px solid var(--border)", colorScheme: "dark" }}
            />
            <button
              type="submit"
              disabled={logWeight.isPending || !weightInput}
              className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#09090b" }}
            >
              {logWeight.isPending ? "Saving…" : "Log"}
            </button>
          </form>
        </Card>

        <Card title="Recent workouts">
          {workoutsQuery.isLoading ? (
            <Skeleton className="h-24" />
          ) : workoutsQuery.isError ? (
            <ErrorNotice message="Couldn't load workouts." onRetry={() => workoutsQuery.refetch()} />
          ) : recentWorkouts.length === 0 ? (
            <EmptyState title="No workouts logged yet" hint="Generate and log a session from the Workouts page." />
          ) : (
            <div>
              {recentWorkouts.map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between py-2.5"
                  style={i > 0 ? { borderTop: "0.5px solid var(--border)" } : undefined}
                >
                  <div>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {w.session_focus ? `${FOCUS_LABELS[w.session_focus as Focus] ?? w.session_focus} session` : "Workout"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {w.logged_at.slice(0, 10)}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{w.plan.length} exercises</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
