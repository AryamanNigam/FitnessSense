import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Meals from "./pages/Meals";
import Workouts from "./pages/Workouts";
import Progress from "./pages/Progress";
import AskAI from "./pages/AskAI";
import ProfileEdit from "./pages/ProfileEdit";
import RequireAuth from "./components/auth/RequireAuth";
import AppLayout from "./components/layout/AppLayout";
import { useAuthStore } from "./store/authStore";
import apiClient from "./lib/apiClient";
import type { Profile } from "./types";

export default function App() {
  useEffect(() => {
    apiClient
      .post<{ access_token: string }>("/auth/refresh")
      .then(async (res) => {
        const token = res.data.access_token;
        useAuthStore.getState().setAuth(token, useAuthStore.getState().profile);
        try {
          const profileRes = await apiClient.get<Profile>("/profile/me");
          useAuthStore.getState().setAuth(token, profileRes.data);
        } catch {
          // No profile yet — onboarding will create it
        }
      })
      .catch(() => {
        // No valid cookie — RequireAuth will redirect to /login
      })
      .finally(() => {
        useAuthStore.getState().setHydrated();
      });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/meals" element={<Meals />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/ask-ai" element={<AskAI />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
