import { Outlet } from "react-router-dom";
import NavBar from "./NavBar";

export default function AppLayout() {
  return (
    <div className="min-h-screen" style={{ background: "var(--page-bg)", color: "var(--text-primary)" }}>
      <NavBar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
