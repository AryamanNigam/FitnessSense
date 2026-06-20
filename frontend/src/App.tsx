import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import RequireAuth from "./components/auth/RequireAuth";
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
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
