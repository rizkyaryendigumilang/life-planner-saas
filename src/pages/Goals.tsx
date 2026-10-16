import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CircleDollarSign,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Button } from "../components/ui";
import { pb } from "../lib/pocketbase";

type GoalCategory =
  | "Financial"
  | "Family"
  | "Vehicle"
  | "Travel"
  | "Lifestyle"
  | "Property"
  | "Education"
  | "Technology"
  | "Personal"
  | "Other";

type GoalPriority =
  | "High"
  | "Medium"
  | "Low";

type GoalStatus =
  | "Active"
  | "Upcoming"
  | "Completed"
  | "Paused";

type Goal = {
  id: string;
  name: string;
  category: GoalCategory;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: GoalPriority;
  status: GoalStatus;
  notes: string;
};

type Contribution = {
  id: string;
  goal: string;
  amount: number;
  date: string;
  notes: string;
};

type GoalFormData = {
  name: string;
  category: GoalCategory;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: GoalPriority;
  status: GoalStatus;
  notes: string;
};

const categories: GoalCategory[] = [
  "Financial",
  "Family",
  "Vehicle",
  "Travel",
  "Lifestyle",
  "Property",
  "Education",
  "Technology",
  "Personal",
  "Other",
];

const priorities: GoalPriority[] = [
  "High",
  "Medium",
  "Low",
];

const statuses: GoalStatus[] = [
  "Active",
  "Upcoming",
  "Completed",
  "Paused",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(
    new Date(`${value}T00:00:00`),
  );
}

function calculateProgress(goal: Goal) {
  if (goal.targetAmount <= 0) return 0;

  return Math.min(
    100,
    Math.round(
      (goal.currentAmount /
        goal.targetAmount) *
        100,
    ),
  );
}

function mapGoal(record: any): Goal {
  return {
    id: record.id,
    name: record.name,
    category:
      record.category as GoalCategory,
    targetAmount: Number(
      record.target_amount || 0,
    ),
    currentAmount: Number(
      record.current_amount || 0,
    ),
    targetDate: record.target_date || "",
    priority:
      record.priority as GoalPriority,
    status:
      record.status as GoalStatus,
    notes: record.notes || "",
  };
}

export function Goals() {
  const [goals, setGoals] = useState<Goal[]>(
    [],
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [editingGoal, setEditingGoal] =
    useState<Goal | null>(null);

  const [selectedGoal, setSelectedGoal] =
    useState<Goal | null>(null);

  const [contributions, setContributions] =
    useState<Contribution[]>([]);

  const [contributionOpen, setContributionOpen] =
    useState(false);

  async function loadGoals() {
    try {
      setLoading(true);
      setError("");

      const userId = pb.authStore.record?.id;

      if (!userId) {
        setGoals([]);
        return;
      }

      const records =
        await pb.collection("goals").getFullList({
          filter: `user = "${userId}"`,
          sort: "target_date,-created",
        });

      setGoals(records.map(mapGoal));
    } catch (err) {
      console.error(
        "Failed to load goals:",
        err,
      );

      setError(
        "Unable to load your goals.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadContributions(
    goalId: string,
  ) {
    try {
      const records =
        await pb
          .collection("goal_contributions")
          .getFullList({
            filter: `goal = "${goalId}"`,
            sort: "-date,-created",
          });

      setContributions(
        records.map((record) => ({
          id: record.id,
          goal: record.goal,
          amount: Number(record.amount || 0),
          date: record.date || "",
          notes: record.notes || "",
        })),
      );
    } catch (err) {
      console.error(
        "Failed to load contributions:",
        err,
      );

      setError(
        "Unable to load goal contributions.",
      );
    }
  }

  useEffect(() => {
    void loadGoals();
  }, []);

  const activeGoals = useMemo(
    () =>
      goals.filter(
        (goal) =>
          goal.status === "Active" ||
          goal.status === "Upcoming",
      ),
    [goals],
  );

  const totalTarget = activeGoals.reduce(
    (sum, goal) =>
      sum + goal.targetAmount,
    0,
  );

  const totalCurrent = activeGoals.reduce(
    (sum, goal) =>
      sum + goal.currentAmount,
    0,
  );

  const overallProgress =
    totalTarget > 0
      ? Math.round(
          (totalCurrent / totalTarget) *
            100,
        )
      : 0;

  async function handleSaveGoal(
    data: GoalFormData,
  ) {
    try {
      setError("");

      const userId =
        pb.authStore.record?.id;

      if (!userId) {
        setError(
          "Your session has expired. Please sign in again.",
        );
        return;
      }

      if (editingGoal) {
        await pb
          .collection("goals")
          .update(editingGoal.id, {
            name: data.name,
            category: data.category,
            target_amount:
              data.targetAmount,
            current_amount:
              data.currentAmount,
            target_date:
              data.targetDate,
            priority: data.priority,
            status: data.status,
            notes: data.notes,
          });
      } else {
        await pb.collection("goals").create({
          user: userId,
          name: data.name,
          category: data.category,
          target_amount:
            data.targetAmount,
          current_amount:
            data.currentAmount,
          target_date:
            data.targetDate,
          priority: data.priority,
          status: data.status,
          notes: data.notes,
        });
      }

      setDialogOpen(false);
      setEditingGoal(null);

      await loadGoals();

      toast.success(editingGoal ? "Goal updated" : "Goal created");
    } catch (err) {
      console.error(
        "Failed to save goal:",
        err,
      );

      setError(
        "Unable to save the goal.",
      );
    }
  }

  async function handleDeleteGoal(
    goal: Goal,
  ) {
    const confirmed = window.confirm(
      `Delete "${goal.name}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");

      await pb
        .collection("goals")
        .delete(goal.id);

      if (
        selectedGoal?.id === goal.id
      ) {
        setSelectedGoal(null);
      }

      await loadGoals();

      toast.success("Goal deleted");
    } catch (err) {
      console.error(
        "Failed to delete goal:",
        err,
      );

      setError(
        "Unable to delete the goal.",
      );
    }
  }

  async function handleAddContribution(
    amount: number,
    date: string,
    notes: string,
  ) {
    if (!selectedGoal) return;

    try {
      setError("");

      await pb
        .collection("goal_contributions")
        .create({
          goal: selectedGoal.id,
          amount,
          date,
          notes,
        });

      const newCurrentAmount =
        selectedGoal.currentAmount +
        amount;

      await pb
        .collection("goals")
        .update(selectedGoal.id, {
          current_amount:
            newCurrentAmount,
        });

      setContributionOpen(false);

      await loadGoals();

      toast.success("Contribution added");

      const updatedGoal = goals.find(
        (goal) =>
          goal.id === selectedGoal.id,
      );

      if (updatedGoal) {
        setSelectedGoal({
          ...updatedGoal,
          currentAmount:
            newCurrentAmount,
        });
      }

      await loadContributions(
        selectedGoal.id,
      );
    } catch (err) {
      console.error(
        "Failed to add contribution:",
        err,
      );

      setError(
        "Unable to add contribution.",
      );
    }
  }

  async function handleDeleteContribution(
    contribution: Contribution,
  ) {
    if (!selectedGoal) return;

    const confirmed = window.confirm(
      "Delete this contribution?",
    );

    if (!confirmed) return;

    try {
      await pb
        .collection("goal_contributions")
        .delete(contribution.id);

      const newCurrentAmount = Math.max(
        0,
        selectedGoal.currentAmount -
          contribution.amount,
      );

      await pb
        .collection("goals")
        .update(selectedGoal.id, {
          current_amount:
            newCurrentAmount,
        });

      setSelectedGoal({
        ...selectedGoal,
        currentAmount:
          newCurrentAmount,
      });

      await loadGoals();
      await loadContributions(
        selectedGoal.id,
      );
      toast.success("Contribution deleted");
    } catch (err) {
      console.error(
        "Failed to delete contribution:",
        err,
      );

      setError(
        "Unable to delete contribution.",
      );
    }
  }

  function openGoal(goal: Goal) {
    setSelectedGoal(goal);
    void loadContributions(goal.id);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Goals
            </h1>

            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              Define what you want to achieve
              and track your progress over time.
            </p>
          </div>

          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setEditingGoal(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={16} />
            Add goal
          </Button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-negative/25 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </div>
      )}

      {/* Summary */}
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Target size={17} />}
          label="Active goals"
          value={String(activeGoals.length)}
          description="goals currently tracked"
        />

        <SummaryCard
          icon={
            <CircleDollarSign size={17} />
          }
          label="Total target"
          value={formatCurrency(totalTarget)}
          description="combined active goals"
        />

        <SummaryCard
          icon={<TrendingUp size={17} />}
          label="Overall progress"
          value={`${overallProgress}%`}
          description={`${formatCurrency(totalCurrent)} saved`}
        />
      </section>

      {/* Goals */}
      {loading ? (
        <section className="rounded-xl border border-line/15 bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-soft">
            Loading goals...
          </p>
        </section>
      ) : goals.length === 0 ? (
        <EmptyGoals
          onAdd={() => {
            setEditingGoal(null);
            setDialogOpen(true);
          }}
        />
      ) : (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Your goals
            </h2>

            <p className="mt-1 text-sm text-ink-soft">
              Keep your most important plans
              visible and measurable.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onOpen={() =>
                  openGoal(goal)
                }
                onEdit={() => {
                  setEditingGoal(goal);
                  setDialogOpen(true);
                }}
                onDelete={() =>
                  void handleDeleteGoal(
                    goal,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Goal Dialog */}
      <GoalDialog
        open={dialogOpen}
        goal={editingGoal}
        onClose={() => {
          setDialogOpen(false);
          setEditingGoal(null);
        }}
        onSubmit={handleSaveGoal}
      />

      {/* Goal Detail */}
      {selectedGoal && (
        <GoalDetail
          goal={selectedGoal}
          contributions={contributions}
          onClose={() =>
            setSelectedGoal(null)
          }
          onAddContribution={() =>
            setContributionOpen(true)
          }
          onDeleteContribution={
            handleDeleteContribution
          }
        />
      )}

      {/* Contribution Dialog */}
      <ContributionDialog
        open={contributionOpen}
        onClose={() =>
          setContributionOpen(false)
        }
        onSubmit={handleAddContribution}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-line/15 bg-surface p-5">
      <div className="flex items-center gap-2 text-ink-soft">
        {icon}

        <p className="text-xs font-medium uppercase tracking-[0.12em]">
          {label}
        </p>
      </div>

      <p className="mt-3 text-xl font-semibold tracking-tight text-ink">
        {value}
      </p>

      <p className="mt-1 text-xs text-ink-faint">
        {description}
      </p>
    </div>
  );
}

function GoalCard({
  goal,
  onOpen,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const progress = calculateProgress(goal);

  const remaining = Math.max(
    0,
    goal.targetAmount -
      goal.currentAmount,
  );

  return (
    <article className="rounded-xl border border-line/15 bg-surface p-5 transition hover:border-line/20">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-ink-soft">
          <Target
            size={18}
            strokeWidth={1.8}
          />
        </div>

        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-ink-soft">
          {goal.status}
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-base font-semibold text-ink">
          {goal.name}
        </h3>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-ink-soft">
            {goal.category}
          </span>

          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-ink-soft">
            {goal.priority} priority
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-ink-faint">
              Progress
            </p>

            <p className="mt-1 text-sm font-semibold text-ink">
              {formatCurrency(
                goal.currentAmount,
              )}
            </p>
          </div>

          <span className="text-sm font-semibold text-ink-soft">
            {progress}%
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-ink-faint">
          <span>
            Remaining{" "}
            {formatCurrency(remaining)}
          </span>

          <span>
            Target{" "}
            {formatCurrency(
              goal.targetAmount,
            )}
          </span>
        </div>
      </div>

      {goal.targetDate && (
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
          <CalendarDays size={14} />
          <span>
            Target {formatDate(goal.targetDate)}
          </span>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-line/10 pt-4">
        <button
          type="button"
          onClick={onOpen}
          className="text-xs font-medium text-ink-soft hover:text-ink"
        >
          View details
        </button>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-muted"
            aria-label="Edit goal"
          >
            <Pencil size={14} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-negative/10 hover:text-negative"
            aria-label="Delete goal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function GoalDetail({
  goal,
  contributions,
  onClose,
  onAddContribution,
  onDeleteContribution,
}: {
  goal: Goal;
  contributions: Contribution[];
  onClose: () => void;
  onAddContribution: () => void;
  onDeleteContribution: (
    contribution: Contribution,
  ) => Promise<void>;
}) {
  const progress = calculateProgress(goal);

  const remaining = Math.max(
    0,
    goal.targetAmount -
      goal.currentAmount,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line/15 bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-line/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-ink-soft">
                <Target size={17} />
              </div>

              <span className="text-xs text-ink-faint">
                {goal.category}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
              {goal.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-muted"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <DetailStat
              label="Current"
              value={formatCurrency(
                goal.currentAmount,
              )}
            />

            <DetailStat
              label="Target"
              value={formatCurrency(
                goal.targetAmount,
              )}
            />

            <DetailStat
              label="Remaining"
              value={formatCurrency(
                remaining,
              )}
            />
          </div>

          <div>
            <div className="flex justify-between">
              <span className="text-xs text-ink-soft">
                Progress
              </span>

              <span className="text-xs font-semibold text-ink">
                {progress}%
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem
              label="Status"
              value={goal.status}
            />

            <DetailItem
              label="Priority"
              value={goal.priority}
            />

            <DetailItem
              label="Target date"
              value={
                goal.targetDate
                  ? formatDate(
                      goal.targetDate,
                    )
                  : "-"
              }
            />

            <DetailItem
              label="Category"
              value={goal.category}
            />
          </div>

          {goal.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-faint">
                Notes
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">
                {goal.notes}
              </p>
            </div>
          )}

          <div className="border-t border-line/10 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Contributions
                </h3>

                <p className="mt-1 text-xs text-ink-faint">
                  Track the money added toward
                  this goal.
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={onAddContribution}
              >
                <Plus size={14} />
                Add contribution
              </Button>
            </div>

            {contributions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-line/15 bg-muted px-5 py-8 text-center">
                <p className="text-sm font-medium text-ink-soft">
                  No contributions yet
                </p>

                <p className="mt-1 text-xs text-ink-faint">
                  Add your first contribution
                  to this goal.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {contributions.map(
                  (contribution) => (
                    <div
                      key={contribution.id}
                      className="flex items-center justify-between rounded-lg border border-line/10 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {formatCurrency(
                            contribution.amount,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-ink-faint">
                          {formatDate(
                            contribution.date,
                          )}

                          {contribution.notes &&
                            ` • ${contribution.notes}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void onDeleteContribution(
                            contribution,
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-negative/10 hover:text-negative"
                        aria-label="Delete contribution"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-ink">
        {value}
      </p>
    </div>
  );
}

function GoalDialog({
  open,
  goal,
  onClose,
  onSubmit,
}: {
  open: boolean;
  goal: Goal | null;
  onClose: () => void;
  onSubmit: (
    data: GoalFormData,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<GoalCategory>("Financial");
  const [targetAmount, setTargetAmount] =
    useState("");
  const [currentAmount, setCurrentAmount] =
    useState("");
  const [targetDate, setTargetDate] =
    useState("");
  const [priority, setPriority] =
    useState<GoalPriority>("Medium");
  const [status, setStatus] =
    useState<GoalStatus>("Active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    setName(goal?.name || "");
    setCategory(
      goal?.category || "Financial",
    );
    setTargetAmount(
      goal
        ? String(goal.targetAmount)
        : "",
    );
    setCurrentAmount(
      goal
        ? String(goal.currentAmount)
        : "0",
    );
    setTargetDate(
      goal?.targetDate || "",
    );
    setPriority(
      goal?.priority || "Medium",
    );
    setStatus(
      goal?.status || "Active",
    );
    setNotes(goal?.notes || "");
    setSaving(false);
  }, [open, goal]);

  if (!open) return null;

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    const target = Number(
      targetAmount,
    );

    const current = Number(
      currentAmount,
    );

    if (
      !name.trim() ||
      !target ||
      target <= 0 ||
      current < 0
    ) {
      return;
    }

    try {
      setSaving(true);

      await onSubmit({
        name: name.trim(),
        category,
        targetAmount: target,
        currentAmount: current,
        targetDate,
        priority,
        status,
        notes: notes.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line/15 bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              {goal
                ? "Edit goal"
                : "Add goal"}
            </h2>

            <p className="mt-1 text-xs text-ink-faint">
              Define the target and how you
              want to reach it.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-muted"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 p-6"
        >
          <Field
            label="Goal name"
            required
          >
            <input
              className="form-input"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="e.g. Dana Darurat"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select
                className="form-input"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target
                      .value as GoalCategory,
                  )
                }
              >
                {categories.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Priority">
              <select
                className="form-input"
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target
                      .value as GoalPriority,
                  )
                }
              >
                {priorities.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Target amount"
              required
            >
              <input
                type="number"
                min="1"
                className="form-input"
                value={targetAmount}
                onChange={(event) =>
                  setTargetAmount(
                    event.target.value,
                  )
                }
                placeholder="85000000"
                required
              />
            </Field>

            <Field label="Current amount">
              <input
                type="number"
                min="0"
                className="form-input"
                value={currentAmount}
                onChange={(event) =>
                  setCurrentAmount(
                    event.target.value,
                  )
                }
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target date">
              <input
                type="date"
                className="form-input"
                value={targetDate}
                onChange={(event) =>
                  setTargetDate(
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Status">
              <select
                className="form-input"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target
                      .value as GoalStatus,
                  )
                }
              >
                {statuses.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className="form-input"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Additional notes..."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : goal
                  ? "Save changes"
                  : "Add goal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContributionDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    amount: number,
    date: string,
    notes: string,
  ) => Promise<void>;
}) {
  const [amount, setAmount] =
    useState("");
  const [date, setDate] =
    useState("");
  const [notes, setNotes] =
    useState("");
  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    if (!open) return;

    setAmount("");
    setDate(
      new Date()
        .toISOString()
        .slice(0, 10),
    );
    setNotes("");
    setSaving(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    const parsedAmount = Number(amount);

    if (
      !parsedAmount ||
      parsedAmount <= 0 ||
      !date
    ) {
      return;
    }

    try {
      setSaving(true);

      await onSubmit(
        parsedAmount,
        date,
        notes.trim(),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-line/15 bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              Add contribution
            </h2>

            <p className="mt-1 text-xs text-ink-faint">
              Add money toward this goal.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-muted"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 p-6"
        >
          <Field
            label="Amount"
            required
          >
            <input
              type="number"
              min="1"
              className="form-input"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
              placeholder="1000000"
              required
            />
          </Field>

          <Field label="Date" required>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              required
            />
          </Field>

          <Field label="Notes">
            <input
              className="form-input"
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="e.g. Monthly saving"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Add contribution"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">
        {label}
        {required && " *"}
      </span>

      {children}
    </label>
  );
}

function EmptyGoals({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <section className="rounded-xl border border-dashed border-line/15 bg-surface px-6 py-12 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-ink-soft">
        <Target size={18} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-ink">
        No goals yet
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-faint">
        Create your first goal and start
        tracking your progress.
      </p>

      <Button
        className="mt-5"
        size="sm"
        onClick={onAdd}
      >
        <Plus size={15} />
        Add goal
      </Button>
    </section>
  );
}
