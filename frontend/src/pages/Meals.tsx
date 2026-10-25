import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/apiClient";
import MacroCard from "../components/meals/MacroCard";
import Modal from "../components/ui/Modal";
import { useMealLogs, queryKeys } from "../lib/queries";
import { useToast } from "../components/ui/toastContext";
import { EmptyState, ErrorNotice, Skeleton } from "../components/ui/QueryState";
import { errorMessage } from "../lib/errors";
import type { GeneratedMeal, MealLogResponse, MealPlanResponse } from "../types";

type Mode = "ingredients" | "random";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Meals() {
  const [mode, setMode] = useState<Mode>("random");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meals, setMeals] = useState<GeneratedMeal[] | null>(null);

  const [recipeMeal, setRecipeMeal] = useState<GeneratedMeal | null>(null);
  const [loggingIndex, setLoggingIndex] = useState<number | null>(null);
  const [loggedIndices, setLoggedIndices] = useState<Set<number>>(new Set());

  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();
  const mealsQuery = useMealLogs();          // same cache the Dashboard reads
  const logs = mealsQuery.data ?? [];
  const logsLoading = mealsQuery.isLoading;

  const logMutation = useMutation({
    mutationFn: (meal: GeneratedMeal) =>
      apiClient
        .post<MealLogResponse>("/meals/logs", {
          meal_name: meal.meal_name,
          items: meal.items,
          total_kcal: meal.total_kcal,
          instructions: meal.instructions,
          logged_at: todayStr(),
        })
        .then((res) => res.data),
    onSuccess: (newLog) => {
      // Prepend into the shared cache → Dashboard's meal card updates too.
      queryClient.setQueryData<MealLogResponse[]>(queryKeys.mealLogs(), (prev) =>
        prev ? [newLog, ...prev] : [newLog]
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/meals/logs/${id}`);
      } catch (err) {
        // 404 = the row is already gone on the server. That's the end-state we
        // wanted, so treat it as success and let the UI reconcile (idempotent delete).
        if ((err as { response?: { status?: number } })?.response?.status !== 404) throw err;
      }
    },
    onSuccess: (_res, id) => {
      // Remove from the shared cache → Dashboard's meal card drops it too.
      queryClient.setQueryData<MealLogResponse[]>(queryKeys.mealLogs(), (prev) =>
        prev ? prev.filter((l) => l.id !== id) : prev
      );
    },
  });

  function addIngredient() {
    const value = ingredientInput.trim().replace(/,$/, "");
    if (value && !ingredients.includes(value)) {
      setIngredients((prev) => [...prev, value]);
    }
    setIngredientInput("");
  }

  function removeIngredient(value: string) {
    setIngredients((prev) => prev.filter((i) => i !== value));
  }

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    setMeals(null);
    setLoggedIndices(new Set());
    try {
      const res = await apiClient.post<MealPlanResponse>("/meals/generate", {
        mode,
        ingredients: mode === "ingredients" ? ingredients : null,
      });
      setMeals(res.data.meals);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to generate meal plan. Try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleLog(meal: GeneratedMeal, index: number) {
    setLoggingIndex(index);
    try {
      await logMutation.mutateAsync(meal);
      setLoggedIndices((prev) => new Set(prev).add(index));
      toast.success(`${meal.meal_name} logged`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to log meal. Try again."));
    } finally {
      setLoggingIndex(null);
    }
  }

  async function handleDeleteLog(id: string) {
    setDeletingLogId(id);
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Meal log removed");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete log. Try again."));
    } finally {
      setDeletingLogId(null);
    }
  }

  const canGenerate = mode === "random" || ingredients.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Meal Planner</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Generate a meal plan from ingredients you have, or let it surprise you.
        </p>
      </div>

      {/* Controls */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
        {/* Mode toggle */}
        <div className="flex items-center gap-1 mb-4">
          {(["random", "ingredients"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "px-4 py-1.5 rounded-full bg-white text-zinc-900 text-sm font-medium"
                  : "px-4 py-1.5 rounded-full text-sm transition-colors"
              }
              style={mode === m ? undefined : { color: "var(--text-secondary)" }}
            >
              {m === "random" ? "Surprise me" : "By ingredients"}
            </button>
          ))}
        </div>

        {mode === "ingredients" && (
          <div className="mb-4">
            <p className="label mb-2">Ingredients</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {ingredients.map((ing) => (
                <span
                  key={ing}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                  style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
                >
                  {ing}
                  <button onClick={() => removeIngredient(ing)} style={{ color: "var(--text-muted)" }}>×</button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={ingredientInput}
              onChange={(e) => setIngredientInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addIngredient();
                }
              }}
              onBlur={addIngredient}
              placeholder="Type an ingredient and press Enter…"
              className="w-full text-sm px-3 py-2 rounded-xl focus:outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
            />
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#09090b" }}
        >
          {loading ? "Generating…" : "Generate meal plan"}
        </button>

        {error && (
          <p className="text-xs mt-3" style={{ color: "#f87171" }}>{error}</p>
        )}
      </div>

      {/* Results */}
      {meals && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meals.map((meal, i) => (
            <MacroCard
              key={i}
              meal={meal}
              logged={loggedIndices.has(i)}
              logging={loggingIndex === i}
              onViewRecipe={() => setRecipeMeal(meal)}
              onLog={() => handleLog(meal, i)}
            />
          ))}
        </div>
      )}

      {!meals && !loading && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No plan yet — generate one above to see meals here.
        </p>
      )}

      {/* Log history */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
        <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Log history</p>
        {logsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : mealsQuery.isError ? (
          <ErrorNotice message="Couldn't load your meal history." onRetry={() => mealsQuery.refetch()} />
        ) : logs.length === 0 ? (
          <EmptyState title="No meals logged yet" hint="Generate a plan above and log the meals you eat." />
        ) : (
          <div>
            {logs.map((log, i) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-3"
                style={i > 0 ? { borderTop: "0.5px solid var(--border)" } : undefined}
              >
                <div>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>{log.meal_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {log.items.map((item) => item.name).join(", ")}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {log.logged_at} · {log.total_kcal} kcal
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteLog(log.id)}
                  disabled={deletingLogId === log.id}
                  className="text-xs px-2 py-1 transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: "#f87171" }}
                >
                  {deletingLogId === log.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipe modal */}
      <Modal open={!!recipeMeal} onClose={() => setRecipeMeal(null)}>
        {recipeMeal && (
          <div>
            <p className="text-lg font-medium mb-4" style={{ color: "var(--text-primary)" }}>{recipeMeal.meal_name}</p>
            <ol className="space-y-2 list-decimal list-inside">
              {recipeMeal.instructions.map((step, i) => (
                <li key={i} className="text-sm" style={{ color: "var(--text-secondary)" }}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </Modal>
    </div>
  );
}
