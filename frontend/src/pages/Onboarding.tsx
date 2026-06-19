import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../lib/apiClient";
import { useAuthStore } from "../store/authStore";
import type { ActivityLevel, Goal, Profile, ProfileCreate } from "../types";

const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: "cut", label: "Cut", desc: "Lose fat, preserve muscle" },
  { value: "maintain", label: "Maintain", desc: "Stay at current weight" },
  { value: "bulk", label: "Bulk", desc: "Build muscle and strength" },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary (desk job, no exercise)" },
  { value: "light", label: "Light (1–3 days/week)" },
  { value: "moderate", label: "Moderate (3–5 days/week)" },
  { value: "active", label: "Active (6–7 days/week)" },
  { value: "very_active", label: "Very Active (physical job + training)" },
];

const STEPS = ["About you", "Your goal", "Activity level"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { setProfile } = useAuthStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<ProfileCreate>({
    name: "",
    age: 25,
    weight_kg: 70,
    height_cm: 170,
    goal: "maintain",
    activity_level: "moderate",
  });

  function update<K extends keyof ProfileCreate>(key: K, value: ProfileCreate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinish() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post<Profile>("/profile", form);
      setProfile(res.data);
      navigate("/dashboard");
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      setError(detail ?? (err instanceof Error ? err.message : "Failed to save profile"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i <= step ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 ${i < step ? "bg-indigo-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">{STEPS[step]}</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 0 — About you */}
        {step === 0 && (
          <div className="space-y-4 mt-4">
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputCls}
                placeholder="Your name"
              />
            </Field>
            <Field label="Age">
              <input
                type="number"
                value={form.age}
                onChange={(e) => update("age", Number(e.target.value))}
                className={inputCls}
                min={10}
                max={120}
              />
            </Field>
            <Field label="Weight (kg)">
              <input
                type="number"
                value={form.weight_kg}
                onChange={(e) => update("weight_kg", Number(e.target.value))}
                className={inputCls}
                step={0.1}
                min={1}
              />
            </Field>
            <Field label="Height (cm)">
              <input
                type="number"
                value={form.height_cm}
                onChange={(e) => update("height_cm", Number(e.target.value))}
                className={inputCls}
                min={1}
              />
            </Field>
          </div>
        )}

        {/* Step 1 — Goal */}
        {step === 1 && (
          <div className="space-y-3 mt-4">
            {GOALS.map((g) => (
              <button
                key={g.value}
                onClick={() => update("goal", g.value)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition ${
                  form.goal === g.value
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-semibold text-gray-900">{g.label}</p>
                <p className="text-sm text-gray-500">{g.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Activity level */}
        {step === 2 && (
          <div className="space-y-2 mt-4">
            {ACTIVITY_LEVELS.map((a) => (
              <button
                key={a.value}
                onClick={() => update("activity_level", a.value)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm transition ${
                  form.activity_level === a.value
                    ? "border-indigo-600 bg-indigo-50 font-medium text-indigo-900"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !form.name.trim()}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? "Saving…" : "Get started"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
