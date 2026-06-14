import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuthStore } from "../store/authStore";
import apiClient from "../lib/apiClient";
import type { Profile } from "../types";

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let session;

      if (mode === "signup") {
        const { data, error: authErr } = await supabase.auth.signUp({ email, password });
        if (authErr) throw authErr;
        session = data.session;
      } else {
        const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) throw authErr;
        session = data.session;
      }

      if (!session) {
        setError("Check your email to confirm your account.");
        return;
      }

      const token = session.access_token;

      // Try to load existing profile
      let profile: Profile | null = null;
      try {
        const res = await apiClient.get<Profile>("/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        profile = res.data;
      } catch {
        // No profile yet — onboarding will create it
      }

      setAuth(token, profile);
      navigate(profile ? "/dashboard" : "/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === "login" ? "Sign in to FitnessSense" : "Start your fitness journey"}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            className="text-indigo-600 font-medium hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
