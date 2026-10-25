import { useNavigate } from "react-router-dom";
import SplitPicker from "../components/workouts/SplitPicker";

export default function WorkoutSplit() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Your split</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Pick a training split. Workouts generate for whatever day's focus is scheduled.
          </p>
        </div>
        <button
          onClick={() => navigate("/workouts")}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          Back
        </button>
      </div>

      <SplitPicker />
    </div>
  );
}
