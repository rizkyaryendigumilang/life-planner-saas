import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Music2,
  Plus,
  Ticket,
  Trophy,
  Plane,
  Film,
  Utensils,
  Gamepad2,
  Sparkles,
  Theater,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "../components/ui";
import { pb } from "../lib/pocketbase";

import {
  AddExperienceDialog,
  type ExperienceFormData,
  type ExperienceStatus,
  type ExperienceType,
} from "../components/AddExperienceDialog";

import {
  AddItineraryDialog,
  type ItineraryFormData,
} from "../components/AddItineraryDialog";

import {
  AddExperienceExpenseDialog,
  type ExperienceExpenseFormData,
} from "../components/AddExperienceExpenseDialog";

type ItineraryItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  description?: string;
};

type TravelExpense = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
};

type Experience = {
  id: string;
  type: ExperienceType;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  estimatedCost: number;
  status: ExperienceStatus;
  notes: string;
  trackExpenses: boolean;
  itinerary: ItineraryItem[];
  expenses: TravelExpense[];
};

const tabs: Array<"All" | ExperienceType> = [
  "All",
  "Concert",
  "Cinema",
  "Running Event",
  "Travel",
  "Show & Event",
  "Dining",
  "Gaming",
  "Other",
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
  }).format(new Date(`${value}T00:00:00`));
}

function getTypeIcon(type: ExperienceType) {
  switch (type) {
    case "Concert":
      return <Music2 size={18} strokeWidth={1.8} />;

    case "Cinema":
      return <Film size={18} strokeWidth={1.8} />;

    case "Running Event":
      return <Trophy size={18} strokeWidth={1.8} />;

    case "Travel":
      return <Plane size={18} strokeWidth={1.8} />;

    case "Show & Event":
      return <Theater size={18} strokeWidth={1.8} />;

    case "Dining":
      return <Utensils size={18} strokeWidth={1.8} />;

    case "Gaming":
      return <Gamepad2 size={18} strokeWidth={1.8} />;

    default:
      return <Sparkles size={18} strokeWidth={1.8} />;
  }
}

function mapPocketBaseExperience(record: any): Experience {
  return {
    id: record.id,
    type: record.type as ExperienceType,
    name: record.name,
    startDate: record.start_date,
    endDate: record.end_date || "",
    location: record.location || "",
    estimatedCost: Number(record.estimated_cost || 0),
    status: record.status as ExperienceStatus,
    notes: record.notes || "",
    trackExpenses: Boolean(record.track_expenses),
    itinerary: [],
    expenses: [],
  };
}

export function Entertainment() {
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]>("All");

  const [experiences, setExperiences] =
    useState<Experience[]>([]);

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [selectedExperience, setSelectedExperience] =
    useState<Experience | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [itineraryDialogOpen, setItineraryDialogOpen] =
    useState(false);

  const [expenseDialogOpen, setExpenseDialogOpen] =
    useState(false);

  const [editingItinerary, setEditingItinerary] =
    useState<ItineraryItem | null>(null);

  const [editingExpense, setEditingExpense] =
    useState<TravelExpense | null>(null);

  async function loadExperiences() {
    try {
      setLoading(true);
      setError("");

      const userId = pb.authStore.record?.id;

      if (!userId) {
        setExperiences([]);
        return;
      }

      const records =
        await pb.collection("experiences").getFullList({
          filter: `user = "${userId}"`,
          sort: "-start_date,-created",
        });

      const mapped = records.map(
        mapPocketBaseExperience,
      );

      setExperiences(mapped);

      setSelectedExperience((current) => {
        if (!current) return null;

        return (
          mapped.find(
            (item) => item.id === current.id,
          ) || null
        );
      });
    } catch (err) {
      console.error(
        "Failed to load experiences:",
        err,
      );

      setError(
        "Unable to load your experiences.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadExperienceDetails(
    experienceId: string,
  ) {
    try {
      const [
        itineraryRecords,
        expenseRecords,
      ] = await Promise.all([
        pb
          .collection("itinerary_items")
          .getFullList({
            filter: `experience = "${experienceId}"`,
            sort: "date,time",
          }),

        pb
          .collection("experience_expenses")
          .getFullList({
            filter: `experience = "${experienceId}"`,
            sort: "-date,-created",
          }),
      ]);

      const itinerary: ItineraryItem[] =
        itineraryRecords.map((item) => ({
          id: item.id,
          date: item.date,
          time: item.time || "",
          title: item.title,
          location: item.location || "",
          description: item.notes || "",
        }));

      const expenses: TravelExpense[] =
        expenseRecords.map((item) => ({
          id: item.id,
          date: item.date,
          description: item.description || "",
          category: item.category || "Other",
          amount: Number(item.amount || 0),
        }));

      setSelectedExperience((current) => {
        if (
          !current ||
          current.id !== experienceId
        ) {
          return current;
        }

        return {
          ...current,
          itinerary,
          expenses,
        };
      });

      setExperiences((current) =>
        current.map((item) =>
          item.id === experienceId
            ? {
                ...item,
                itinerary,
                expenses,
              }
            : item,
        ),
      );
    } catch (err) {
      console.error(
        "Failed to load experience details:",
        err,
      );

      setError(
        "Unable to load trip details.",
      );
    }
  }

  useEffect(() => {
    void loadExperiences();
  }, []);

  const filteredExperiences = useMemo(() => {
    if (activeTab === "All") {
      return experiences;
    }

    return experiences.filter(
      (item) => item.type === activeTab,
    );
  }, [activeTab, experiences]);

  const upcoming = filteredExperiences.filter(
    (item) =>
      item.status === "Planned" ||
      item.status === "Booked",
  );

  const completed = filteredExperiences.filter(
    (item) => item.status === "Completed",
  );

  const totalUpcomingCost = upcoming.reduce(
    (sum, item) => sum + item.estimatedCost,
    0,
  );

  async function handleAddExperience(
    data: ExperienceFormData,
  ) {
    try {
      setSaving(true);
      setError("");

      const userId = pb.authStore.record?.id;

      if (!userId) {
        setError(
          "Your session has expired. Please sign in again.",
        );
        return;
      }

      await pb.collection("experiences").create({
        user: userId,
        type: data.type,
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate || "",
        location: data.location,
        estimated_cost: data.estimatedCost,
        status: data.status,
        notes: data.notes,
        track_expenses: data.trackExpenses,
      });

      setDialogOpen(false);

      await loadExperiences();

      toast.success("Experience created");
    } catch (err) {
      console.error(
        "Failed to create experience:",
        err,
      );

      setError(
        "Unable to save the experience. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddItinerary(
    data: ItineraryFormData,
  ) {
    if (!selectedExperience) return;

    try {
      setError("");

      await pb
        .collection("itinerary_items")
        .create({
          experience: selectedExperience.id,
          date: data.date,
          time: data.time,
          title: data.title,
          location: data.location,
          notes: data.notes,
        });

      setItineraryDialogOpen(false);

      await loadExperienceDetails(
        selectedExperience.id,
      );

      toast.success("Itinerary item added");
    } catch (err) {
      console.error(
        "Failed to create itinerary:",
        err,
      );

      setError(
        "Unable to save itinerary.",
      );
    }
  }

  async function handleUpdateItinerary(
    data: ItineraryFormData,
  ) {
    if (!editingItinerary) return;

    try {
      setError("");

      await pb
        .collection("itinerary_items")
        .update(
          editingItinerary.id,
          {
            date: data.date,
            time: data.time,
            title: data.title,
            location: data.location,
            notes: data.notes,
          },
        );

      setEditingItinerary(null);

      if (selectedExperience) {
        await loadExperienceDetails(
          selectedExperience.id,
        );
      }

      toast.success("Itinerary item updated");
    } catch (err) {
      console.error(
        "Failed to update itinerary:",
        err,
      );

      setError(
        "Unable to update itinerary.",
      );
    }
  }

  async function handleDeleteItinerary(
    item: ItineraryItem,
  ) {
    const confirmed = window.confirm(
      `Delete "${item.title}" from the itinerary?`,
    );

    if (!confirmed) return;

    try {
      setError("");

      await pb
        .collection("itinerary_items")
        .delete(item.id);

      if (selectedExperience) {
        await loadExperienceDetails(
          selectedExperience.id,
        );
      }

      toast.success("Itinerary item deleted");
    } catch (err) {
      console.error(
        "Failed to delete itinerary:",
        err,
      );

      setError(
        "Unable to delete itinerary.",
      );
    }
  }

  async function handleAddExpense(
    data: ExperienceExpenseFormData,
  ) {
    if (!selectedExperience) return;

    try {
      setError("");

      await pb
        .collection("experience_expenses")
        .create({
          experience: selectedExperience.id,
          date: data.date,
          category: data.category,
          description: data.description,
          amount: data.amount,
        });

      setExpenseDialogOpen(false);

      await loadExperienceDetails(
        selectedExperience.id,
      );

      toast.success("Expense added");
    } catch (err) {
      console.error(
        "Failed to create experience expense:",
        err,
      );

      setError(
        "Unable to save trip expense.",
      );
    }
  }

  async function handleUpdateExpense(
    data: ExperienceExpenseFormData,
  ) {
    if (!editingExpense) return;

    try {
      setError("");

      await pb
        .collection("experience_expenses")
        .update(
          editingExpense.id,
          {
            date: data.date,
            category: data.category,
            description: data.description,
            amount: data.amount,
          },
        );

      setEditingExpense(null);

      if (selectedExperience) {
        await loadExperienceDetails(
          selectedExperience.id,
        );
      }

      toast.success("Expense updated");
    } catch (err) {
      console.error(
        "Failed to update experience expense:",
        err,
      );

      setError(
        "Unable to update trip expense.",
      );
    }
  }

  async function handleDeleteExpense(
    expense: TravelExpense,
  ) {
    const confirmed = window.confirm(
      `Delete "${expense.description}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");

      await pb
        .collection("experience_expenses")
        .delete(expense.id);

      if (selectedExperience) {
        await loadExperienceDetails(
          selectedExperience.id,
        );
      }

      toast.success("Expense deleted");
    } catch (err) {
      console.error(
        "Failed to delete experience expense:",
        err,
      );

      setError(
        "Unable to delete trip expense.",
      );
    }
  }

  function openExperience(
    experience: Experience,
  ) {
    setSelectedExperience(experience);

    if (experience.type === "Travel") {
      void loadExperienceDetails(
        experience.id,
      );
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
              Experiences
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              Entertainment
            </h1>

            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              Plan the experiences you want to enjoy
              and remember.
            </p>
          </div>

          <Button
            className="w-full sm:w-auto"
            onClick={() => setDialogOpen(true)}
            disabled={saving}
          >
            <Plus size={16} />
            Add experience
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
          label="Upcoming"
          value={String(upcoming.length)}
          description="experiences planned"
        />

        <SummaryCard
          label="Planned spending"
          value={formatCurrency(totalUpcomingCost)}
          description="upcoming experiences"
        />

        <SummaryCard
          label="Completed"
          value={String(completed.length)}
          description="experiences completed"
        />
      </section>

      {/* Filter */}
      <section>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  "rounded-full px-4 py-2 text-sm transition",
                  active
                    ? "bg-accent text-accent-ink"
                    : "bg-muted text-ink-soft hover:bg-muted",
                ].join(" ")}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </section>

      {/* Loading */}
      {loading ? (
        <section className="rounded-xl border border-line/15 bg-surface px-6 py-12 text-center">
          <p className="text-sm text-ink-soft">
            Loading experiences...
          </p>
        </section>
      ) : (
        <>
          {/* Upcoming */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-ink">
                Upcoming experiences
              </h2>

              <p className="mt-1 text-sm text-ink-soft">
                Events and activities coming up next.
              </p>
            </div>

            {upcoming.length === 0 ? (
              <EmptyState
                onAdd={() => setDialogOpen(true)}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((experience) => (
                  <ExperienceCard
                    key={experience.id}
                    experience={experience}
                    onOpen={() =>
                      openExperience(experience)
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Completed */}
          {completed.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Completed
                </h2>

                <p className="mt-1 text-sm text-ink-soft">
                  Experiences you have already enjoyed.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {completed.map((experience) => (
                  <ExperienceCard
                    key={experience.id}
                    experience={experience}
                    onOpen={() =>
                      openExperience(experience)
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Add Experience */}
      <AddExperienceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddExperience}
      />

      {/* Experience Detail */}
      {selectedExperience && (
        <ExperienceDetail
          experience={selectedExperience}
          onClose={() =>
            setSelectedExperience(null)
          }
          onAddItinerary={() =>
            setItineraryDialogOpen(true)
          }
          onEditItinerary={(item) =>
            setEditingItinerary(item)
          }
          onDeleteItinerary={handleDeleteItinerary}
          onAddExpense={() =>
            setExpenseDialogOpen(true)
          }
          onEditExpense={(expense) =>
            setEditingExpense(expense)
          }
          onDeleteExpense={handleDeleteExpense}
        />
      )}

      {/* Add Itinerary */}
      <AddItineraryDialog
        open={itineraryDialogOpen}
        onClose={() =>
          setItineraryDialogOpen(false)
        }
        onSubmit={handleAddItinerary}
      />

      {/* Edit Itinerary */}
      <AddItineraryDialog
        open={Boolean(editingItinerary)}
        onClose={() =>
          setEditingItinerary(null)
        }
        onSubmit={handleUpdateItinerary}
        initialData={
          editingItinerary
            ? {
                date: editingItinerary.date,
                time: editingItinerary.time,
                title: editingItinerary.title,
                location:
                  editingItinerary.location,
                notes:
                  editingItinerary.description || "",
              }
            : undefined
        }
        title="Edit itinerary"
        submitLabel="Save changes"
      />

      {/* Add Expense */}
      <AddExperienceExpenseDialog
        open={expenseDialogOpen}
        onClose={() =>
          setExpenseDialogOpen(false)
        }
        onSubmit={handleAddExpense}
      />

      {/* Edit Expense */}
      <AddExperienceExpenseDialog
        open={Boolean(editingExpense)}
        onClose={() =>
          setEditingExpense(null)
        }
        onSubmit={handleUpdateExpense}
        initialData={
          editingExpense
            ? {
                date: editingExpense.date,
                category:
                  editingExpense.category,
                description:
                  editingExpense.description,
                amount: String(
                  editingExpense.amount,
                ),
              }
            : undefined
        }
        title="Edit trip expense"
        submitLabel="Save changes"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-line/15 bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>

      <p className="mt-3 text-xl font-semibold tracking-tight text-ink">
        {value}
      </p>

      <p className="mt-1 text-xs text-ink-faint">
        {description}
      </p>
    </div>
  );
}

function ExperienceCard({
  experience,
  onOpen,
}: {
  experience: Experience;
  onOpen: () => void;
}) {
  const isTravel = experience.type === "Travel";

  const spent = experience.expenses.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  return (
    <article className="rounded-xl border border-line/15 bg-surface p-5 transition hover:border-line/20">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-ink-soft">
          {getTypeIcon(experience.type)}
        </div>

        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-ink-soft">
          {experience.type}
        </span>
      </div>

      <h3 className="mt-5 text-base font-semibold text-ink">
        {experience.name}
      </h3>

      <div className="mt-4 space-y-2.5 text-sm text-ink-soft">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} />

          <span>
            {formatDate(experience.startDate)}

            {isTravel &&
              experience.endDate &&
              ` — ${formatDate(experience.endDate)}`}
          </span>
        </div>

        {experience.location && (
          <div className="flex items-center gap-2">
            <MapPin size={15} />
            <span>{experience.location}</span>
          </div>
        )}
      </div>

      {isTravel && experience.trackExpenses && (
        <div className="mt-4 rounded-lg bg-muted p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-soft">
              Trip spending
            </span>

            <span className="text-xs font-semibold text-ink">
              {formatCurrency(spent)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-end justify-between border-t border-line/10 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">
            Budget
          </p>

          <p className="mt-1 text-sm font-semibold text-ink">
            {formatCurrency(
              experience.estimatedCost,
            )}
          </p>
        </div>

        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
        >
          View
          <ChevronRight size={14} />
        </button>
      </div>
    </article>
  );
}

function ExperienceDetail({
  experience,
  onClose,
  onAddItinerary,
  onEditItinerary,
  onDeleteItinerary,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: {
  experience: Experience;
  onClose: () => void;
  onAddItinerary: () => void;
  onEditItinerary: (item: ItineraryItem) => void;
  onDeleteItinerary: (
    item: ItineraryItem,
  ) => Promise<void>;
  onAddExpense: () => void;
  onEditExpense: (
    expense: TravelExpense,
  ) => void;
  onDeleteExpense: (
    expense: TravelExpense,
  ) => Promise<void>;
}) {
  const isTravel = experience.type === "Travel";

  const spent = experience.expenses.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const remaining =
    experience.estimatedCost - spent;

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
        {/* Detail Header */}
        <div className="flex items-start justify-between border-b border-line/10 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-ink-soft">
                {getTypeIcon(experience.type)}
              </div>

              <span className="text-xs text-ink-faint">
                {experience.type}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
              {experience.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-muted"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Experience Information */}
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailItem
              label={
                isTravel ? "Start date" : "Date"
              }
              value={formatDate(
                experience.startDate,
              )}
            />

            {isTravel && (
              <DetailItem
                label="End date"
                value={formatDate(
                  experience.endDate,
                )}
              />
            )}

            <DetailItem
              label={
                isTravel
                  ? "Destination"
                  : "Location"
              }
              value={
                experience.location || "-"
              }
            />

            <DetailItem
              label="Status"
              value={experience.status}
            />

            <DetailItem
              label="Estimated cost"
              value={formatCurrency(
                experience.estimatedCost,
              )}
            />
          </div>

          {/* Notes */}
          {experience.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-faint">
                Notes
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">
                {experience.notes}
              </p>
            </div>
          )}

          {/* Travel */}
          {isTravel && (
            <>
              {/* Itinerary */}
              <div className="border-t border-line/10 pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-ink">
                      Itinerary
                    </h3>

                    <p className="mt-1 text-xs text-ink-faint">
                      Plan the activities for this
                      trip.
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddItinerary}
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </div>

                {experience.itinerary.length ===
                0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-line/15 bg-muted px-5 py-8 text-center">
                    <p className="text-sm font-medium text-ink-soft">
                      No itinerary yet
                    </p>

                    <p className="mt-1 text-xs text-ink-faint">
                      Start planning your trip
                      activities.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {experience.itinerary.map(
                      (item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-line/10 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-ink-soft">
                                  {formatDate(
                                    item.date,
                                  )}
                                </span>

                                {item.time && (
                                  <span className="text-xs text-ink-faint">
                                    {item.time}
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-sm font-semibold text-ink">
                                {item.title}
                              </p>

                              {item.location && (
                                <p className="mt-1 text-xs text-ink-soft">
                                  {item.location}
                                </p>
                              )}

                              {item.description && (
                                <p className="mt-2 text-xs leading-5 text-ink-soft">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onEditItinerary(
                                    item,
                                  )
                                }
                                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-muted"
                                aria-label="Edit itinerary"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void onDeleteItinerary(
                                    item,
                                  )
                                }
                                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-negative/10 hover:text-negative"
                                aria-label="Delete itinerary"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Trip Expenses */}
              {experience.trackExpenses && (
                <div className="border-t border-line/10 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-ink">
                        Trip expenses
                      </h3>

                      <p className="mt-1 text-xs text-ink-faint">
                        Actual money spent on this
                        trip.
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAddExpense}
                    >
                      <Plus size={14} />
                      Add expense
                    </Button>
                  </div>

                  {/* Budget Summary */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <SummaryCard
                      label="Budget"
                      value={formatCurrency(
                        experience.estimatedCost,
                      )}
                      description="planned"
                    />

                    <SummaryCard
                      label="Spent"
                      value={formatCurrency(spent)}
                      description="actual"
                    />

                    <SummaryCard
                      label="Remaining"
                      value={formatCurrency(
                        remaining,
                      )}
                      description="available"
                    />
                  </div>

                  {/* Expense List */}
                  {experience.expenses.length >
                    0 ? (
                    <div className="mt-4 space-y-2">
                      {experience.expenses.map(
                        (expense) => (
                          <div
                            key={expense.id}
                            className="rounded-lg border border-line/10 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink">
                                  {
                                    expense.description
                                  }
                                </p>

                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-faint">
                                  <span>
                                    {formatDate(
                                      expense.date,
                                    )}
                                  </span>

                                  <span>•</span>

                                  <span>
                                    {
                                      expense.category
                                    }
                                  </span>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-sm font-semibold text-ink">
                                  {formatCurrency(
                                    expense.amount,
                                  )}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onEditExpense(
                                      expense,
                                    )
                                  }
                                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-muted"
                                  aria-label="Edit expense"
                                >
                                  <Pencil
                                    size={14}
                                  />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void onDeleteExpense(
                                      expense,
                                    )
                                  }
                                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-negative/10 hover:text-negative"
                                  aria-label="Delete expense"
                                >
                                  <Trash2
                                    size={14}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-line/15 bg-muted px-5 py-8 text-center">
                      <p className="text-sm font-medium text-ink-soft">
                        No expenses yet
                      </p>

                      <p className="mt-1 text-xs text-ink-faint">
                        Add the actual money spent
                        during this trip.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
    <div className="rounded-lg bg-muted p-4">
      <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-ink">
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line/15 bg-surface px-6 py-12 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-ink-soft">
        <Ticket size={18} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-ink">
        No experiences yet
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-faint">
        Add your next concert, movie, running
        event, trip, or other experience.
      </p>

      <Button
        className="mt-5"
        size="sm"
        onClick={onAdd}
      >
        <Plus size={15} />
        Add experience
      </Button>
    </div>
  );
}
