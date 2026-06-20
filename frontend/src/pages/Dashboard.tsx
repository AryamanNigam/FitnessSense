import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function Dashboard() {
  const { profile } = useAuthStore();

  if (!profile) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Hey, {profile.name} 👋
        </h1>
        <p className="text-gray-500 text-sm mb-6">Here's your daily snapshot</p>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Daily Target" value={`${profile.tdee} kcal`} />
          <StatCard label="Protein Target" value={`${profile.protein_target_g}g`} />
          <StatCard label="Goal" value={profile.goal.charAt(0).toUpperCase() + profile.goal.slice(1)} />
          <StatCard label="Activity" value={profile.activity_level.replace("_", " ")} />
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          More features coming soon — meal planner, workouts, and progress tracking.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
