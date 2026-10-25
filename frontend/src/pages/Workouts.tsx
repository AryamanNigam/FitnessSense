import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/apiClient";
import ExerciseTable from "../components/workouts/ExerciseTable";
import { queryKeys } from "../lib/queries";
import { useToast } from "../components/ui/toastContext";
import { errorMessage } from "../lib/errors";
import { useAuthStore } from "../store/authStore";
import { FOCUS_LABELS, FOCUS_OPTIONS, focusForToday } from "../lib/splits";
import type { Focus, GeneratedWorkout, WorkoutLogResponse } from "../types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Workouts() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const hasSplit = !!profile?.workout_split;
  // Today's scheduled focus. No split → default to full body (mirrors the backend).
  const todayFocus: Focus = hasSplit
    ? focusForToday(profile!.workout_split!.schedule)
    : "full_body";
  const isRestDay = todayFocus === "rest";

  // The focus we'll generate for. Defaults to today's; a rest day starts unset so
  // the user consciously picks one before generating "anyway".
  const [selectedFocus, setSelectedFocus] = useState<Focus>(todayFocus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const queryClient = useQueryClient();
  const toast = useToast();

  const logMutation = useMutation({
    mutationFn: (w: GeneratedWorkout) =>
      apiClient
        .post<WorkoutLogResponse>("/workouts/logs", {
          plan: w.exercises,
          notes: w.notes,
          session_focus: w.session_focus,
          logged_at: todayStr(),
        })
        .then((res) => res.data),
    onSuccess: (newLog) => {
      // Prepend into the shared cache → Dashboard's workout card updates too.
      queryClient.setQueryData<WorkoutLogResponse[]>(
        queryKeys.workoutLogs(todayStr()),
        (prev) => (prev ? [newLog, ...prev] : [newLog])
      );
    },
  });

  async function handleGenerate() {
    if (selectedFocus === "rest") return;
    setError(null);
    setLoading(true);
    setWorkout(null);
    setLogged(false);
    try {
      const res = await apiClient.post<GeneratedWorkout>("/workouts/generate", {
        focus: selectedFocus,
      });
      setWorkout(res.data);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to generate workout. Try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleLog() {
    if (!workout) return;
    setLogging(true);
    try {
      await logMutation.mutateAsync(workout);
      setLogged(true);
      toast.success("Workout logged");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to log workout. Try again."));
    } finally {
      setLogging(false);
    }
  }

  const canGenerate = selectedFocus !== "rest" && !loading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            {hasSplit ? `Today: ${FOCUS_LABELS[todayFocus]} day` : "Workout Generator"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {!hasSplit
              ? "No split set — generating full-body sessions. Manage split to schedule your week."
              : isRestDay
              ? "Rest day on your schedule. Recover well — or pick a focus to train anyway."
              : `Generates ${FOCUS_LABELS[todayFocus].toLowerCase()} work from your goal and activity level.`}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          <button
            onClick={() => navigate("/workouts/split")}
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            Manage split
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#09090b" }}
          >
            {loading ? "Generating…" : workout ? "Regenerate" : "Generate workout"}
          </button>
        </div>
      </div>

      {/* Focus override — pick a different focus (train ahead, or on a rest day) */}
      <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: "var(--surface-1)" }}>
        <span className="label" style={{ marginBottom: 0 }}>Focus</span>
        <select
          value={selectedFocus}
          onChange={(e) => { setSelectedFocus(e.target.value as Focus); setLogged(false); }}
          className="text-sm px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
          style={{
            background: "var(--surface-2)",
            color: selectedFocus === "rest" ? "var(--text-muted)" : "var(--text-primary)",
            border: "0.5px solid var(--border)",
          }}
        >
          <option value="rest">Rest</option>
          {FOCUS_OPTIONS.map((f) => (
            <option key={f} value={f}>{FOCUS_LABELS[f]}</option>
          ))}
        </select>
        {selectedFocus === todayFocus && !isRestDay && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>today's focus</span>
        )}
        {selectedFocus === "rest" && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>pick a focus to generate</span>
        )}
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
      )}

      {workout && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {FOCUS_LABELS[workout.session_focus as Focus] ?? workout.session_focus} session
            </span>
          </div>

          <ExerciseTable exercises={workout.exercises} />

          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
            <p className="label mb-2">Notes</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{workout.notes}</p>
          </div>

          <button
            onClick={handleLog}
            disabled={logged || logging}
            className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--surface-2)", color: logged ? "var(--text-success)" : "var(--text-primary)" }}
          >
            {logged ? "Logged" : logging ? "Logging…" : "Log workout"}
          </button>
        </div>
      )}

      {!workout && !loading && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {isRestDay && selectedFocus === "rest"
            ? "Nothing scheduled today. Enjoy the recovery."
            : "No workout yet — generate one above."}
        </p>
      )}
    </div>
  );
}
