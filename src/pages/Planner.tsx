import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import {
  Check,
  CalendarClock,
  ListTodo,
  Plus,
  Search,
  Tag,
  Trash2,
  GripVertical,
} from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { pb } from "../lib/pocketbase";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Label,
  Select,
  SelectItem,
  Textarea,
} from "../components/ui";
import { toast } from "sonner";
import type { Priority, Task, TaskStatus } from "../types";

const cols: TaskStatus[] = ["Inbox", "To-Do", "In Progress", "Done"];

const filters = ["All", "Today", "Upcoming", "Inbox", "Board"] as const;

type Filter = (typeof filters)[number];

export function Planner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const load = async () => {
    setLoading(true);
    try {
      const r = await pb
        .collection("life_planner")
        .getList<Task>(1, 300, {
          sort: "order,due_date",
        });

      setTasks(r.items);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      toast.error("Could not load tasks. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function add(data: Partial<Task>) {
    try {
      const rec = await pb.collection("life_planner").create<Task>({
        ...data,
        user: pb.authStore.record!.id,
        order: tasks.length,
      });

      setTasks((x) => [...x, rec]);
      setOpen(false);
      toast.success("Task added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save task");
    }
  }

  async function update(t: Task, data: Partial<Task>) {
    try {
      const rec = await pb
        .collection("life_planner")
        .update<Task>(t.id, data);

      setTasks((x) => x.map((i) => (i.id === t.id ? rec : i)));
    } catch {
      toast.error("Could not update task");
    }
  }

  async function toggle(t: Task) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch {}
    }
    await update(t, {
      status: t.status === "Done" ? "To-Do" : "Done",
    });
  }

  async function remove(t: Task) {
    try {
      await pb.collection("life_planner").delete(t.id);

      setTasks((x) => x.filter((i) => i.id !== t.id));
      toast.success("Task removed");
    } catch {
      toast.error("Could not remove task");
    }
  }

  async function drag(e: DragEndEvent) {
    const active = tasks.find((t) => t.id === e.active.id);

    if (!active) return;

    const overId = String(e.over?.id || "");

    if (!overId) return;

    const target = cols.includes(overId as TaskStatus)
      ? (overId as TaskStatus)
      : tasks.find((t) => t.id === overId)?.status;

    if (target && target !== active.status) {
      const previousTasks = tasks;
      setTasks((x) =>
        x.map((t) =>
          t.id === active.id
            ? { ...t, status: target }
            : t,
        ),
      );

      try {
        await pb.collection("life_planner").update(active.id, {
          status: target,
        });
        toast.success(`Task moved to ${target}`);
      } catch {
        setTasks(previousTasks);
        toast.error("Could not save task status. The change was reverted.");
      }
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((t) => {
      const match =
        !q ||
        `${t.title} ${t.description || ""} ${t.category || ""} ${
          t.tags || ""
        }`
          .toLowerCase()
          .includes(q);

      if (!match) return false;

      if (filter === "Inbox") {
        return t.status === "Inbox";
      }

      if (filter === "Today") {
        if (!t.due_date || t.status === "Done") return false;

        const d = new Date(t.due_date);
        d.setHours(0, 0, 0, 0);

        return d.getTime() === today.getTime();
      }

      if (filter === "Upcoming") {
        return (
          !!t.due_date &&
          new Date(t.due_date) >= today &&
          t.status !== "Done"
        );
      }

      return true;
    });
  }, [tasks, search, filter]);

  const board = filter === "Board";

  return (
    <div className="animate-rise">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-.03em]">
            Life Planner
          </h1>

          <p className="mt-1 text-sm text-ink-soft">
            TickTick-style personal tasks with a Trello-style visual board.
          </p>
        </div>

        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Quick add
        </Button>
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                filter === f ? "bg-surface shadow-sm" : "text-ink-soft"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-3 text-ink-soft"
          />

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, tags, projects…"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 xl:grid-cols-4" aria-label="Loading tasks">
          {cols.map((col) => <div key={col} className="min-h-[300px] animate-pulse rounded-2xl border border-line/10 bg-surface p-4"><div className="h-4 w-24 rounded bg-muted"/><div className="mt-5 space-y-3">{[1,2,3].map((n) => <div key={n} className="h-20 rounded-xl bg-muted"/>)}</div></div>)}
        </div>
      ) : loadFailed ? (
        <Card className="p-10 text-center"><p className="font-semibold">Tasks could not be loaded</p><p className="mt-2 text-sm text-ink-soft">Your tasks are still on the server. Try refreshing this view.</p><Button className="mt-4" onClick={() => void load()}>Try again</Button></Card>
      ) : board || filter === "All" ? (
        <DndContext sensors={sensors} onDragEnd={drag}>
          <div className="grid gap-3 xl:grid-cols-4">
            {cols.map((col) => (
              <TaskColumn
                key={col}
                status={col}
                tasks={filtered.filter((t) => t.status === col)}
                onToggle={toggle}
                onDelete={remove}
                onStatus={(t) => update(t, { status: t.status })}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <TaskList
          tasks={filtered}
          onToggle={toggle}
          onDelete={remove}
        />
      )}

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        onCreate={add}
      />
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  onToggle,
  onDelete,
  onStatus,
}: {
  status: TaskStatus;
  tasks: Task[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStatus: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[420px] rounded-2xl border p-3 transition ${
        isOver
          ? "border-line/20 bg-muted"
          : "border-line/15 bg-muted"
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{status}</span>
          <Badge>{tasks.length}</Badge>
        </div>

        <span className="text-ink-faint">
          <ListTodo size={15} />
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-line/15 p-6 text-center">
          <p className="text-xs font-medium text-ink-faint">No tasks in {status}</p>
          <p className="mt-0.5 text-[10px] text-ink-soft/70">Drag items here or add new ones</p>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
      }}
      className={`group rounded-xl border border-line/10 bg-surface p-3 shadow-[0_1px_1px_rgba(0,0,0,.02)] ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-ink-faint opacity-50 sm:opacity-0 sm:group-hover:opacity-100 transition hover:text-ink active:scale-95 touch-none"
          aria-label="Drag task"
        >
          <GripVertical size={15} />
        </button>

        <button
          onClick={() => onToggle(task)}
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
            task.status === "Done"
              ? "border-accent bg-accent text-accent-ink"
              : "border-line/20"
          }`}
        >
          {task.status === "Done" && <Check size={12} />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={
              task.status === "Done"
                ? "text-sm leading-5 text-ink-faint line-through"
                : "text-sm leading-5 font-medium"
            }
          >
            {task.title}
          </p>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
              {task.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.priority === "High" && (
              <Badge tone="danger">High</Badge>
            )}

            {task.priority === "Medium" && (
              <Badge tone="warning">Medium</Badge>
            )}

            {task.priority === "Low" && <Badge>Low</Badge>}

            {task.due_date && (
              <span className="inline-flex items-center gap-1 text-[10px] text-ink-soft">
                <CalendarClock size={11} />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}

            {task.category && (
              <span className="text-[10px] text-ink-soft">
                #{task.category}
              </span>
            )}

            {task.recurrence && (
              <Badge tone="accent">↻ {task.recurrence}</Badge>
            )}
          </div>

          {task.tags && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-ink-soft">
              <Tag size={11} />
              {task.tags}
            </div>
          )}
        </div>

        <button
          onClick={() => onDelete(task)}
          className="text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-negative"
          aria-label="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  onToggle,
  onDelete,
}: {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  return (
    <Card className="divide-y divide-line/10 overflow-hidden">
      {tasks.length ? (
        tasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 p-4"
          >
            <button
              onClick={() => onToggle(t)}
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                t.status === "Done"
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line/20"
              }`}
            >
              {t.status === "Done" && <Check size={12} />}
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={
                  t.status === "Done"
                    ? "text-sm line-through text-ink-faint"
                    : "text-sm font-medium"
                }
              >
                {t.title}
              </p>

              <p className="mt-1 text-xs text-ink-soft">
                {t.due_date
                  ? new Date(t.due_date).toLocaleDateString()
                  : "No due date"}{" "}
                · {t.status}
                {t.category ? ` · ${t.category}` : ""}
              </p>
            </div>

            <button
              onClick={() => onDelete(t)}
              className="text-ink-faint hover:text-negative"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-muted text-ink-soft">
            <ListTodo size={20} />
          </div>
          <p className="mt-3.5 text-sm font-semibold text-ink">No tasks found</p>
          <p className="mt-1 max-w-xs text-xs text-ink-soft">
            All clear in this view. Plan your day by creating your first task above.
          </p>
        </div>
      )}
    </Card>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (data: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [status, setStatus] = useState<TaskStatus>("Inbox");
  const [due, setDue] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [recurrence, setRecurrence] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick add task"
    >
      <div className="space-y-4">
        <div>
          <Label>Task</Label>

          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
          />
        </div>

        <div>
          <Label>Description</Label>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>List / status</Label>

            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TaskStatus)}
            >
              {cols.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div>
            <Label>Priority</Label>

            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
            >
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </Select>
          </div>

          <div>
            <Label>Due date</Label>

            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>

          <div>
            <Label>Repeat</Label>

            <Select
              value={recurrence || "none"}
              onValueChange={(v) =>
                setRecurrence(v === "none" ? "" : v)
              }
            >
              <SelectItem value="none">No repeat</SelectItem>
              <SelectItem value="Daily">Daily</SelectItem>
              <SelectItem value="Weekly">Weekly</SelectItem>
              <SelectItem value="Monthly">Monthly</SelectItem>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Category / project</Label>

            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Work, Home, Finance…"
            />
          </div>

          <div>
            <Label>Tags</Label>

            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="urgent, errands"
            />
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!title.trim()}
          onClick={() => {
            onCreate({
              title: title.trim(),
              description: description || undefined,
              priority,
              status,
              due_date: due || undefined,
              category: category || undefined,
              tags: tags || undefined,
              recurrence: recurrence || undefined,
            });

            setTitle("");
            setDescription("");
            setDue("");
            setCategory("");
            setTags("");
            setRecurrence("");
          }}
        >
          Create task
        </Button>
      </div>
    </Dialog>
  );
}
