import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useChatHistory, queryKeys } from "../lib/queries";
import { streamChat } from "../lib/chatStream";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How much protein is in chicken breast?",
  "What are good high-protein snacks for a cut?",
  "Compare the macros of rice and oats",
];

export default function AskAI() {
  const { data: history = [], isLoading } = useChatHistory();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [pending, setPending] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handledState = useRef(false);

  const turns: Turn[] = [...history.map(({ role, content }) => ({ role, content })), ...pending];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, pending]);

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || streaming) return;

    setInput("");
    setError(null);
    setStreaming(true);
    setPending([
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    try {
      await streamChat(message, (token) =>
        setPending((prev) => {
          const next = [...prev];
          next[1] = { role: "assistant", content: next[1].content + token };
          return next;
        })
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending([]);
      setStreaming(false);
    }
  }

  useEffect(() => {
    const question = (location.state as { question?: string } | null)?.question;
    if (question && !handledState.current && !isLoading) {
      handledState.current = true;
      navigate(location.pathname, { replace: true, state: null });
      void send(question);
    }
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {!isLoading && turns.length === 0 && (
          <div className="text-center pt-16 space-y-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Ask about nutrition, macros, or training.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-2 rounded-xl transition-opacity hover:opacity-70"
                  style={{ background: "var(--surface-1)", color: "var(--text-secondary)", border: "0.5px solid var(--border)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`text-sm px-4 py-2.5 max-w-[80%] whitespace-pre-wrap ${
                turn.role === "user" ? "rounded-[14px_14px_0_14px]" : "rounded-[14px_14px_14px_0]"
              }`}
              style={{
                background: turn.role === "user" ? "var(--surface-2)" : "var(--surface-1)",
                color: "var(--text-primary)",
              }}
            >
              {turn.content || <span style={{ color: "var(--text-muted)" }}>Thinking…</span>}
            </div>
          </div>
        ))}

        {error && (
          <p className="text-xs text-center" style={{ color: "var(--danger, #f87171)" }}>
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2 pt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="Ask anything about nutrition or training…"
          className="flex-1 text-sm px-4 py-3 rounded-xl focus:outline-none"
          style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-contrast, #000)" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
