import { Component } from "react";

interface State {
  failed: boolean;
}

export default class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--page-bg)" }}>
        <div className="text-center space-y-4">
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>Something went wrong</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>An unexpected error occurred. Reloading usually fixes it.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "#09090b" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
