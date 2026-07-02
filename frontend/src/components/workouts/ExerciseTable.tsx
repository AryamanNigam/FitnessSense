import type { WorkoutExercise } from "../../types";

interface ExerciseTableProps {
  exercises: WorkoutExercise[];
}

export default function ExerciseTable({ exercises }: ExerciseTableProps) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)" }}>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3" style={{ borderBottom: "0.5px solid var(--border)" }}>
        <p className="label">Exercise</p>
        <p className="label text-right">Sets</p>
        <p className="label text-right">Reps</p>
        <p className="label text-right">Rest</p>
      </div>
      {exercises.map((ex, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 items-center"
          style={i > 0 ? { borderTop: "0.5px solid var(--border)" } : undefined}
        >
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>{ex.exercise}</p>
          <p className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{ex.sets}</p>
          <p className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{ex.reps}</p>
          <p className="text-sm text-right" style={{ color: "var(--text-muted)" }}>{ex.rest_s}s</p>
        </div>
      ))}
    </div>
  );
}
