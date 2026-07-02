import { useState } from "react";
import apiClient from "../lib/apiClient";
import ExerciseTable from "../components/workouts/ExerciseTable";
import type { GeneratedWorkout } from "../types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Workouts() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    setWorkout(null);
    setLogged(false);
    try {
      const res = await apiClient.post<GeneratedWorkout>("/workouts/generate");
      setWorkout(res.data);
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      setError(detail ?? "Failed to generate workout. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLog() {
    if (!workout) return;
    setLogging(true);
    try {
      await apiClient.post("/workouts/logs", {
        plan: workout.exercises,
        notes: workout.notes,
        logged_at: todayStr(),
      });
      setLogged(true);
    } catch {
      setError("Failed to log workout. Try again.");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Workout Generator</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Generated from your goal and activity level.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-50 shrink-0"
          style={{ background: "var(--accent)", color: "#09090b" }}
        >
          {loading ? "Generating…" : workout ? "Regenerate" : "Generate workout"}
        </button>
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
      )}

      {workout && (
        <div className="space-y-4">
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
          No workout yet — generate one above.
        </p>
      )}
    </div>
  );
}
