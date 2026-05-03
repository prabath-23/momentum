import React, { useMemo, useState } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_PER_DAY = 86400000;
const ITEM_TYPES = {
  habit: { label: "Habit", tone: "bg-indigo-50 text-indigo-700 ring-indigo-100", avatar: "bg-indigo-600 text-white ring-indigo-200" },
  task: { label: "Task", tone: "bg-amber-50 text-amber-700 ring-amber-100", avatar: "bg-amber-600 text-white ring-amber-200" },
  hobby: { label: "Hobby", tone: "bg-emerald-50 text-emerald-700 ring-emerald-100", avatar: "bg-emerald-600 text-white ring-emerald-200" },
};

const toKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date, count) => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};

const makeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatDate = (key) => fromKey(key).toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" });
const isFuture = (key, todayKey) => key > todayKey;
const habitEnd = (habit) => habit.achievedDate || habit.endDate;
const isHabitActiveOn = (habit, key, todayKey) => !isFuture(key, todayKey) && key >= habit.startDate && key <= habitEnd(habit);
const isHabitVisibleOn = (habit, key, todayKey) => !(habit.achievedDate && key > habit.achievedDate) && isHabitActiveOn(habit, key, todayKey);
const activeHabitsForDay = (habits, key, todayKey) => habits.filter((habit) => isHabitVisibleOn(habit, key, todayKey));
const itemType = (habit) => ITEM_TYPES[habit.type] || ITEM_TYPES.habit;

const getMonthDays = (date) => {
  const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1));
};

const getWeekDays = (date) => {
  const start = addDays(date, -date.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

const getYearDays = (date) => {
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const start = addDays(end, -364);
  return Array.from({ length: 365 }, (_, i) => addDays(start, i));
};

function dayCompletion(habits, key, todayKey) {
  if (isFuture(key, todayKey)) return null;
  const active = activeHabitsForDay(habits, key, todayKey);
  if (!active.length) return 0;
  return Math.round((active.filter((habit) => habit.done[key]).length / active.length) * 100);
}

function heatClass(percent) {
  if (percent === null) return "bg-slate-50 opacity-40";
  if (percent <= 0) return "bg-slate-100";
  if (percent < 34) return "bg-emerald-200";
  if (percent < 67) return "bg-emerald-400";
  if (percent < 100) return "bg-emerald-600";
  return "bg-emerald-700";
}

function getStreak(habit, todayKey) {
  let streak = 0;
  const cursor = fromKey(todayKey);
  while (isHabitActiveOn(habit, toKey(cursor), todayKey) && habit.done[toKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getLongestStreak(habit, days, todayKey) {
  let current = 0;
  let best = 0;
  days.forEach((day) => {
    const key = toKey(day);
    if (!isHabitActiveOn(habit, key, todayKey)) return;
    current = habit.done[key] ? current + 1 : 0;
    best = Math.max(best, current);
  });
  return best;
}

function calculateStats(habits, days, todayKey) {
  let total = 0;
  let done = 0;
  const keys = days.map(toKey).filter((key) => !isFuture(key, todayKey));

  keys.forEach((key) => {
    habits.forEach((habit) => {
      if (isHabitActiveOn(habit, key, todayKey)) {
        total += 1;
        if (habit.done[key]) done += 1;
      }
    });
  });

  const todayHabits = activeHabitsForDay(habits, todayKey, todayKey);
  return {
    totalSlots: total,
    completedSlots: done,
    monthPercent: total ? Math.round((done / total) * 100) : 0,
    todayTotal: todayHabits.length,
    todayCompleted: todayHabits.filter((habit) => habit.done[todayKey]).length,
    bestStreak: habits.reduce((max, habit) => Math.max(max, getStreak(habit, todayKey)), 0),
    achieved: habits.filter((habit) => habit.achievedDate).length,
  };
}

function weeklyTrend(habits, days, todayKey) {
  const buckets = [];
  days.forEach((day) => {
    const key = toKey(day);
    if (isFuture(key, todayKey)) return;
    const index = Math.floor((day.getDate() - 1) / 7);
    if (!buckets[index]) buckets[index] = { label: `Week ${index + 1}`, total: 0, done: 0 };
    habits.forEach((habit) => {
      if (isHabitActiveOn(habit, key, todayKey)) {
        buckets[index].total += 1;
        if (habit.done[key]) buckets[index].done += 1;
      }
    });
  });
  return buckets.map((b) => ({ ...b, percent: b.total ? Math.round((b.done / b.total) * 100) : 0 }));
}

function targetProgress(target, habits, todayKey) {
  if (target.achievedDate) return 100;
  const mapped = habits.filter((habit) => target.habitIds.includes(habit.id));
  if (!mapped.length) return 0;
  const done = mapped.filter((habit) => habit.achievedDate || habit.done[todayKey]).length;
  return Math.round((done / mapped.length) * 100);
}

function Icon({ name, size = 18 }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    plus: <svg {...props}><path d="M12 5v14" /><path d="M5 12h14" /></svg>,
    check: <svg {...props}><path d="M20 6 9 17l-5-5" /></svg>,
    close: <svg {...props}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></svg>,
    trash: <svg {...props}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>,
    pencil: <svg {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
    target: <svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>,
    chart: <svg {...props}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-9" /></svg>,
    calendar: <svg {...props}><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>,
    flame: <svg {...props}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>,
    lock: <svg {...props}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
    trophy: <svg {...props}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></svg>,
    spark: <svg {...props}><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></svg>,
    chevron: <svg {...props}><path d="m6 9 6 6 6-6" /></svg>,
  };
  return icons[name] || icons.target;
}

const initialHabits = [];
const initialTargets = [];

export default function HabitTrackerApp() {
  const today = new Date();
  const todayKey = toKey(today);
  const [page, setPage] = useState("dashboard");
  const [activeDate, setActiveDate] = useState(today);
  const [modalOpen, setModalOpen] = useState(false);
  const [newHabit, setNewHabit] = useState("");
  const [newHabitType, setNewHabitType] = useState("habit");
  const [newHabitStart, setNewHabitStart] = useState(todayKey);
  const [newHabitEnd, setNewHabitEnd] = useState(toKey(addDays(today, 30)));
  const [newHabitTarget, setNewHabitTarget] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [toast, setToast] = useState("Today is open. Take one clean action.");
  const [habits, setHabits] = useState(initialHabits);
  const [targets, setTargets] = useState(initialTargets);
  const [confetti, setConfetti] = useState([]);

  const monthDays = useMemo(() => getMonthDays(activeDate), [activeDate]);
  const weekDays = useMemo(() => getWeekDays(activeDate), [activeDate]);
  const yearDays = useMemo(() => getYearDays(activeDate), [activeDate]);
  const stats = useMemo(() => calculateStats(habits, monthDays, todayKey), [habits, monthDays, todayKey]);
  const trends = useMemo(() => weeklyTrend(habits, monthDays, todayKey), [habits, monthDays, todayKey]);
  const activeToday = useMemo(() => activeHabitsForDay(habits, todayKey, todayKey), [habits, todayKey]);
  const sortedHabits = useMemo(() => [...habits].sort((a, b) => getStreak(b, todayKey) - getStreak(a, todayKey)), [habits, todayKey]);
  const selectedDayKey = toKey(activeDate);

  const addHabit = () => {
    const name = newHabit.trim();
    if (!name) return setToast("Item name is required.");
    if (newHabitStart > newHabitEnd) return setToast("Start date cannot be after end date.");
    const id = makeId();
    setHabits((prev) => [...prev, { id, type: newHabitType, name, startDate: newHabitStart, endDate: newHabitEnd, achievedDate: "", targetId: newHabitTarget, done: {} }]);
    if (newHabitTarget) {
      setTargets((prev) => prev.map((target) => target.id === newHabitTarget ? { ...target, habitIds: [...new Set([...target.habitIds, id])] } : target));
    }
    setNewHabit("");
    setNewHabitType("habit");
    setModalOpen(false);
    setToast(`New ${ITEM_TYPES[newHabitType].label.toLowerCase()} added. Keep it repeatable.`);
  };

  const addTarget = () => {
    const name = newTarget.trim();
    if (!name) return;
    const id = makeId();
    setTargets((prev) => [...prev, { id, name, habitIds: [], achievedDate: "" }]);
    setNewTarget("");
    setNewHabitTarget(id);
    setToast("Target created. Map items into it.");
  };

  const launchConfetti = () => {
    const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
    const shapes = ["rounded-sm", "rounded-full", "rounded-[1px]"];
    const pieces = Array.from({ length: 96 }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      left: `${4 + Math.random() * 92}%`,
      color: colors[index % colors.length],
      delay: `${Math.random() * 0.45}s`,
      drift: `${Math.random() * 220 - 110}px`,
      spin: `${Math.random() * 900 + 240}deg`,
      size: `${6 + Math.random() * 8}px`,
      shape: shapes[index % shapes.length],
    }));
    setConfetti(pieces);
    window.setTimeout(() => setConfetti([]), 2400);
  };

  const toggleDay = (habitId, key) => {
    if (isFuture(key, todayKey)) return setToast("Future days are locked. Win today first.");
    const habit = habits.find((item) => item.id === habitId);
    if (!habit || !isHabitActiveOn(habit, key, todayKey)) return;
    const wasDone = Boolean(habit.done[key]);
    setHabits((prev) => prev.map((item) => {
      if (item.id !== habitId) return item;
      const done = { ...item.done };
      if (done[key]) delete done[key];
      else done[key] = true;
      return { ...item, done };
    }));
    setToast(wasDone ? "A missed day is data, not defeat." : `${habit.name} done. Momentum banked.`);
  };

  const markAchieved = (habitId) => {
    const habit = habits.find((item) => item.id === habitId);
    if (!habit) return;
    setHabits((prev) => prev.map((item) => item.id === habitId ? { ...item, achievedDate: todayKey, done: { ...item.done, [todayKey]: true } } : item));
    setToast(`${habit.name} achieved. Retired from daily tracking.`);
  };

  const deleteHabit = (habitId) => {
    setHabits((prev) => prev.filter((habit) => habit.id !== habitId));
    setTargets((prev) => prev.map((target) => ({ ...target, habitIds: target.habitIds.filter((id) => id !== habitId) })));
  };

  const finishTarget = (targetId) => {
    const target = targets.find((item) => item.id === targetId);
    if (!target || target.achievedDate) return;
    setTargets((prev) => prev.map((item) => item.id === targetId ? { ...item, achievedDate: todayKey } : item));
    setToast(`${target.name} achieved. Target complete.`);
    launchConfetti();
  };

  const deleteTarget = (targetId) => {
    const target = targets.find((item) => item.id === targetId);
    if (!target) return;
    if (!window.confirm(`Delete target "${target.name}"? Items stay in your tracker.`)) return;
    setTargets((prev) => prev.filter((item) => item.id !== targetId));
    setHabits((prev) => prev.map((habit) => habit.targetId === targetId ? { ...habit, targetId: "" } : habit));
    if (newHabitTarget === targetId) setNewHabitTarget("");
    setToast(`${target.name} deleted. Items were kept.`);
  };

  const renameHabit = (habitId) => {
    const oldName = habits.find((habit) => habit.id === habitId)?.name || "";
    const next = window.prompt("Rename item", oldName);
    if (!next?.trim()) return;
    setHabits((prev) => prev.map((habit) => habit.id === habitId ? { ...habit, name: next.trim() } : habit));
  };

  const toggleTargetHabit = (targetId, habitId) => {
    setTargets((prev) => prev.map((target) => {
      if (target.id !== targetId) return target;
      const exists = target.habitIds.includes(habitId);
      return { ...target, habitIds: exists ? target.habitIds.filter((id) => id !== habitId) : [...target.habitIds, habitId] };
    }));
  };

  const assignHabitToTarget = (targetId, habitId) => {
    if (!targetId || !habitId) return;
    setTargets((prev) => prev.map((target) => target.id === targetId ? { ...target, habitIds: [...new Set([...target.habitIds, habitId])] } : { ...target, habitIds: target.habitIds.filter((id) => id !== habitId) }));
    setHabits((prev) => prev.map((habit) => habit.id === habitId ? { ...habit, targetId } : habit));
    setToast("Item assigned to target.");
  };

  const unassignHabitFromTarget = (targetId, habitId) => {
    setTargets((prev) => prev.map((target) => target.id === targetId ? { ...target, habitIds: target.habitIds.filter((id) => id !== habitId) } : target));
    setHabits((prev) => prev.map((habit) => habit.id === habitId && habit.targetId === targetId ? { ...habit, targetId: "" } : habit));
    setToast("Item removed from target.");
  };

  const common = { habits, targets, stats, trends, sortedHabits, todayKey, monthDays, weekDays, yearDays, activeDate, setActiveDate, selectedDayKey, setPage, openModal: () => setModalOpen(true), toggleDay, markAchieved, deleteHabit, renameHabit, addTarget, newTarget, setNewTarget, toggleTargetHabit, assignHabitToTarget, unassignHabitFromTarget, finishTarget, deleteTarget };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8fbff_0%,#eef7ff_42%,#f7fff8_100%)] text-slate-950">
      <style>{`@keyframes floatIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes confettiFall{0%{opacity:1;transform:translate3d(0,-16px,0) rotate(0deg)}100%{opacity:0;transform:translate3d(var(--drift),95vh,0) rotate(var(--spin))}}.animate-card{animation:floatIn .35s ease both}.confetti-piece{animation:confettiFall 1.4s ease-in forwards}`}</style>
      <Header page={page} setPage={setPage} toast={toast} todayStats={stats} activeToday={activeToday} openModal={() => setModalOpen(true)} />
      <main className="relative mx-auto max-w-7xl px-4 pb-10 pt-24 md:px-8 md:pt-24">
        {page === "dashboard" && <Dashboard {...common} activeToday={activeToday} toast={toast} />}
        {page === "targets" && <Targets {...common} />}
        {page === "year" && <YearView {...common} />}
        {page === "month" && <MonthView {...common} />}
        {page === "week" && <WeekView {...common} />}
        {page === "daily" && <DailyView {...common} />}
      </main>
      {modalOpen && <AddHabitModal newHabit={newHabit} setNewHabit={setNewHabit} newHabitType={newHabitType} setNewHabitType={setNewHabitType} newHabitStart={newHabitStart} setNewHabitStart={setNewHabitStart} newHabitEnd={newHabitEnd} setNewHabitEnd={setNewHabitEnd} newHabitTarget={newHabitTarget} setNewHabitTarget={setNewHabitTarget} targets={targets} addHabit={addHabit} close={() => setModalOpen(false)} />}
      {confetti.length > 0 && <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"><div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-2xl"><span className="inline-flex items-center gap-2"><Icon name="spark" size={16} /> Target complete</span></div>{confetti.map((piece) => <span key={piece.id} className={`confetti-piece absolute top-0 ${piece.shape}`} style={{ left: piece.left, width: piece.size, height: piece.size, backgroundColor: piece.color, animationDelay: piece.delay, "--drift": piece.drift, "--spin": piece.spin }} />)}</div>}
    </div>
  );
}

function Header({ page, setPage, toast, todayStats, activeToday, openModal }) {
  const nav = [["dashboard", "Dashboard", "chart"], ["targets", "Targets", "target"], ["year", "Year", "calendar"], ["month", "Month", "calendar"], ["week", "Week", "calendar"], ["daily", "Daily", "check"]];
  const todayPercent = activeToday.length ? Math.round((todayStats.todayCompleted / activeToday.length) * 100) : 0;
  const todayOffset = 100 - todayPercent;
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/70 bg-white/70 shadow-sm backdrop-blur-2xl">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 md:flex md:gap-3 md:px-8">
        <button onClick={() => setPage("dashboard")} className="flex shrink-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/60"><Icon name="target" /></div>
          <div className="hidden text-left sm:block"><div className="font-medium">Momentum</div><div className="-mt-1 text-xs font-medium text-slate-400">Habit OS</div></div>
        </button>
        <nav className="flex min-w-0 items-center justify-between rounded-full border border-white/80 bg-white/75 p-1 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200/70 md:ml-auto md:flex-none md:justify-center">
          {nav.map(([id, label, icon]) => <button key={id} onClick={() => setPage(id)} aria-label={label} title={label} className={`flex h-9 min-w-0 flex-1 items-center justify-center rounded-full px-1 text-slate-500 transition hover:text-slate-950 md:h-10 md:w-auto md:flex-none md:gap-2 md:px-3 md:text-sm md:font-medium ${page === id ? "bg-slate-950 text-white shadow-md shadow-slate-300/70 hover:text-white" : ""}`}><Icon name={icon} size={17} /><span className="hidden md:inline">{label}</span></button>)}
        </nav>
        <div className="hidden h-10 items-center gap-2 rounded-full bg-slate-100/80 px-4 text-slate-600 ring-1 ring-slate-200/70 lg:flex">
          <svg className="h-5 w-5 -rotate-90 text-indigo-600" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={todayOffset} />
          </svg>
          <span className="whitespace-nowrap text-sm font-medium">{todayStats.todayCompleted}/{activeToday.length || 0} today</span>
        </div>
        <button onClick={openModal} aria-label="Add item" title="Add item" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 md:h-10 md:w-auto md:rounded-full md:px-4 md:text-sm md:font-medium"><Icon name="plus" size={19} /><span className="hidden md:ml-2 md:inline">Add item</span></button>
        <div className="hidden max-w-xs truncate rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white xl:block">{toast}</div>
      </div>
    </header>
  );
}

function Dashboard({ habits, activeToday, stats, trends, targets, sortedHabits, monthDays, yearDays, todayKey, toast, setPage, openModal }) {
  const todayPercent = activeToday.length ? Math.round((stats.todayCompleted / activeToday.length) * 100) : 0;
  const typeCounts = Object.keys(ITEM_TYPES).map((type) => ({ type, label: ITEM_TYPES[type].label, count: habits.filter((habit) => habit.type === type && !habit.achievedDate).length }));
  const targetProgresses = targets.map((target) => targetProgress(target, habits, todayKey));
  const targetAverage = targetProgresses.length ? Math.round(targetProgresses.reduce((sum, value) => sum + value, 0) / targetProgresses.length) : 0;
  const unassigned = habits.filter((habit) => !habit.targetId && !targets.some((target) => target.habitIds.includes(habit.id))).length;
  return (
    <div className="space-y-6">
      <section className="animate-card overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_15%_15%,rgba(20,184,166,.28),transparent_28rem),radial-gradient(circle_at_86%_18%,rgba(99,102,241,.34),transparent_26rem),linear-gradient(135deg,#081426_0%,#0b1f3a_55%,#0f2f2e_100%)] p-6 text-white shadow-2xl shadow-cyan-900/10 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div><div className="mb-4 w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[.16em] text-cyan-100">Momentum</div><h1 className="max-w-3xl text-4xl font-medium tracking-tight md:text-6xl">Progress you can actually see.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-cyan-50/80">Track habits, tasks, and hobbies, lock future days, retire achieved items, and map work into bigger targets.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><button onClick={openModal} className="flex w-fit items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-950/20"><Icon name="plus" /> Add item</button><div className="rounded-2xl bg-white/10 p-4 text-sm font-medium text-cyan-50 ring-1 ring-white/10">{toast}</div></div></div>
          <div className="rounded-[1.75rem] bg-white/95 p-5 text-slate-950 shadow-2xl shadow-slate-950/20"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-slate-500">Today's active completion</p><h2 className="text-5xl font-medium tracking-tight">{todayPercent}%</h2></div><div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Icon name="target" size={34} /></div></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-cyan-500 to-emerald-500" style={{ width: `${todayPercent}%` }} /></div><div className="mt-5 grid grid-cols-3 gap-3 text-center"><MiniMetric label="Done" value={stats.todayCompleted} /><MiniMetric label="Active" value={activeToday.length} /><MiniMetric label="Targets" value={targets.length} /></div></div>
        </div>
      </section>
      <section className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"><StatCard icon="chart" label="Monthly progress" value={`${stats.monthPercent}%`} helper={`${stats.completedSlots}/${stats.totalSlots || 0} check-ins`} /><StatCard icon="check" label="Active today" value={`${stats.todayCompleted}/${stats.todayTotal}`} helper="Open items" /><StatCard icon="flame" label="Best streak" value={stats.bestStreak} helper="Consecutive days" /><StatCard icon="target" label="Target health" value={`${targetAverage}%`} helper={`${targets.length} targets`} /><StatCard icon="spark" label="Unassigned" value={unassigned} helper="Items without target" /><StatCard icon="trophy" label="Achieved" value={stats.achieved} helper="Retired items" /></section>
      <Panel title="Item mix" subtitle="Open work by type."><div className="grid gap-3 md:grid-cols-3">{typeCounts.map((item) => <div key={item.type} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><div className="mb-3 flex items-center justify-between"><TypeBadge type={item.type} /><span className="text-2xl font-medium">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${item.type === "habit" ? "bg-indigo-600" : item.type === "task" ? "bg-amber-600" : "bg-emerald-600"}`} style={{ width: `${habits.length ? (item.count / habits.length) * 100 : 0}%` }} /></div></div>)}</div></Panel>
      <section className="grid auto-rows-fr items-stretch gap-6 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Year calendar" subtitle="Last 12 months in two calendar rows."><YearSummary habits={habits} days={yearDays} todayKey={todayKey} /><HeatLegend compact /></Panel><Panel title="Targets" subtitle="Grouped outcome progress."><TargetMiniList targets={targets} habits={habits} todayKey={todayKey} setPage={setPage} /></Panel></section>
      <section className="grid auto-rows-fr items-stretch gap-6 xl:grid-cols-2"><Panel title="Weekly trend" subtitle="Monthly progress by week."><div className="space-y-4">{trends.map((week) => <ProgressRow key={week.label} label={week.label} percent={week.percent} />)}</div></Panel><Panel title="Quick actions" subtitle="Move fast."><div className="grid h-full gap-3 sm:grid-cols-3 xl:grid-cols-1"><QuickAction title="Add item" desc="Habit, task, or hobby" icon="plus" onClick={openModal} /><QuickAction title="Targets" desc="Map goals" icon="target" onClick={() => setPage("targets")} /><QuickAction title="Mark today" desc="Daily check-in" icon="check" onClick={() => setPage("daily")} /></div></Panel></section>
      <Panel title="Live streak board" subtitle="Strongest momentum first."><div className="grid auto-rows-fr gap-3 md:grid-cols-3">{sortedHabits.length ? sortedHabits.map((habit) => <StreakCard key={habit.id} habit={habit} todayKey={todayKey} monthDays={monthDays} />) : <EmptyState icon="plus" title="No live items yet" desc="Add your first habit, task, or hobby to start building momentum." action={<button onClick={openModal} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"><Icon name="plus" size={15} />Add first item</button>} />}</div></Panel>
    </div>
  );
}

function Targets({ targets, habits, todayKey, newTarget, setNewTarget, addTarget, assignHabitToTarget, unassignHabitFromTarget, finishTarget, deleteTarget }) {
  const targetActions = <div className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 shadow-sm sm:w-80">
    <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[.12em] text-slate-500"><Icon name="plus" size={14} />New target</div>
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTarget()} placeholder="Outcome name" className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none focus:ring-4 focus:ring-indigo-100" />
      <button onClick={addTarget} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white hover:bg-indigo-700"><Icon name="plus" size={15} />Add</button>
    </div>
  </div>;
  return <div className="space-y-6"><PageHeader title="Targets" eyebrow="Goal mapping" metric={targets.length} metricLabel="targets" description="Targets are bigger outcomes made from multiple items." actions={targetActions} /><section className="grid gap-6 lg:grid-cols-2">{targets.length ? targets.map((target) => <TargetCard key={target.id} target={target} habits={habits} todayKey={todayKey} assignHabitToTarget={assignHabitToTarget} unassignHabitFromTarget={unassignHabitFromTarget} finishTarget={finishTarget} deleteTarget={deleteTarget} />) : <EmptyState icon="target" title="No targets yet" desc="Create a target when several items roll up to the same outcome." />}</section></div>;
}

function TargetCard({ target, habits, todayKey, assignHabitToTarget, unassignHabitFromTarget, finishTarget, deleteTarget }) {
  const mapped = habits.filter((habit) => target.habitIds.includes(habit.id));
  const active = mapped.filter((habit) => isHabitVisibleOn(habit, todayKey, todayKey));
  const progress = targetProgress(target, habits, todayKey);
  const achieved = Boolean(target.achievedDate);
  const available = habits.filter((habit) => !target.habitIds.includes(habit.id));
  return (
    <Panel title={target.name} subtitle={`${mapped.length} assigned · ${active.length} active today · ${progress}% progress${achieved ? ` · finished ${formatDate(target.achievedDate)}` : ""}`}>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="flex items-center gap-3">
          <div className="h-3 min-w-32 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${achieved ? "bg-emerald-600" : "bg-indigo-600"}`} style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <button disabled={achieved} onClick={() => finishTarget(target.id)} className={`flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ${achieved ? "bg-emerald-50 text-emerald-700" : "bg-slate-950 text-white hover:bg-emerald-700"}`}>
          <Icon name="check" size={15} />{achieved ? "Finished" : "Finish"}
        </button>
        <button onClick={() => deleteTarget(target.id)} className="flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600">
          <Icon name="trash" size={15} />Delete
        </button>
      </div>
      <label className="mb-4 block text-xs font-medium text-slate-500">
        Assign item
        <SelectField disabled={achieved || available.length === 0} value="" onChange={(e) => assignHabitToTarget(target.id, e.target.value)}>
          <option value="">{available.length ? "Choose an item..." : "All items assigned"}</option>
          {available.map((habit) => <option key={habit.id} value={habit.id}>{habit.name} · {itemType(habit).label}</option>)}
        </SelectField>
      </label>
      <div className="grid gap-3">
        {mapped.length ? mapped.map((habit) => (
          <div key={habit.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{habit.name}</span><TypeBadge type={habit.type} /></div>
              <div className="whitespace-nowrap text-xs font-medium text-slate-500">{formatDate(habit.startDate)} → {formatDate(habitEnd(habit))}{habit.achievedDate ? " · achieved" : ""}</div>
            </div>
            <button disabled={achieved} onClick={() => unassignHabitFromTarget(target.id, habit.id)} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">Remove</button>
          </div>
        )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-400">No items assigned yet.</div>}
      </div>
    </Panel>
  );
}

function MonthView({ habits, sortedHabits, monthDays, activeDate, todayKey, stats, setActiveDate, openModal, toggleDay, renameHabit, deleteHabit, markAchieved }) {
  const monthKeys = monthDays.map(toKey);
  const label = activeDate.toLocaleString("default", { month: "long", year: "numeric" });
  const previousMonth = new Date(activeDate.getFullYear(), activeDate.getMonth() - 1, 1);
  const nextMonth = new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 1);
  const monthActions = <div className="flex flex-wrap gap-2"><button onClick={() => setActiveDate(previousMonth)} className="flex h-11 min-w-20 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium">{previousMonth.toLocaleString("default", { month: "short" })}</button><button onClick={() => setActiveDate(new Date())} className="flex h-11 min-w-28 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white">This month</button><button onClick={() => setActiveDate(nextMonth)} className="flex h-11 min-w-20 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium">{nextMonth.toLocaleString("default", { month: "short" })}</button><button onClick={openModal} className="flex h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-medium text-white"><Icon name="plus" size={15} /> New</button></div>;
  return <div className="space-y-6"><PageHeader title="Month view" eyebrow={label} metric={`${stats.monthPercent}%`} metricLabel="month score" description="Monthly check-ins and item board. Future days are locked." actions={monthActions} /><Panel title="Monthly calendar" subtitle="Choose a day to inspect its check-ins."><div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(18rem,1fr)]"><MonthHeatmap habits={habits} monthDays={monthDays} activeDate={activeDate} todayKey={todayKey} setActiveDate={setActiveDate} /><MonthInfo habits={habits} monthDays={monthDays} activeDate={activeDate} todayKey={todayKey} stats={stats} /></div><HeatLegend /></Panel><HabitGrid habits={sortedHabits} monthDays={monthDays} monthKeys={monthKeys} todayKey={todayKey} toggleDay={toggleDay} renameHabit={renameHabit} deleteHabit={deleteHabit} markAchieved={markAchieved} openModal={openModal} /></div>;
}

function WeekView({ habits, weekDays, todayKey, activeDate, setActiveDate, toggleDay, openModal }) {
  const stats = calculateStats(habits, weekDays, todayKey);
  const label = `${weekDays[0].toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekDays[6].toLocaleDateString("default", { month: "short", day: "numeric" })}`;
  const previousWeek = addDays(activeDate, -7);
  const nextWeek = addDays(activeDate, 7);
  const shortDate = (date) => date.toLocaleDateString("default", { month: "short", day: "numeric" });
  const weekActions = <div className="flex flex-wrap gap-2"><button onClick={() => setActiveDate(previousWeek)} className="flex h-11 min-w-20 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium">{shortDate(getWeekDays(previousWeek)[0])}</button><button onClick={() => setActiveDate(new Date())} className="flex h-11 min-w-28 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white">This week</button><button onClick={() => setActiveDate(nextWeek)} className="flex h-11 min-w-20 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium">{shortDate(getWeekDays(nextWeek)[0])}</button><button onClick={openModal} className="flex h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-medium text-white"><Icon name="plus" size={15} /> New</button></div>;
  return <div className="space-y-6"><PageHeader title="Week view" eyebrow={label} metric={`${stats.monthPercent}%`} metricLabel="week score" description="Seven-day sprint board." actions={weekActions} /><section className="grid grid-cols-7 gap-2 md:gap-4">{weekDays.map((day) => <WeekDayCard key={toKey(day)} day={day} habits={habits} todayKey={todayKey} activeDate={activeDate} setActiveDate={setActiveDate} />)}</section><Panel title="Weekly marking board" subtitle="Only active items are listed."><WeekBoard habits={habits} weekDays={weekDays} todayKey={todayKey} toggleDay={toggleDay} /></Panel></div>;
}

function DailyView({ habits, selectedDayKey, todayKey, activeDate, setActiveDate, toggleDay, markAchieved, openModal }) {
  const visible = activeHabitsForDay(habits, selectedDayKey, todayKey);
  const completed = visible.filter((habit) => habit.done[selectedDayKey]).length;
  const percent = visible.length ? Math.round((completed / visible.length) * 100) : 0;
  const label = activeDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" });
  const navDay = (date, fallback) => {
    const key = toKey(date);
    if (key === todayKey) return "Today";
    if (key === toKey(addDays(new Date(), -1))) return "Yesterday";
    if (key === toKey(addDays(new Date(), 1))) return "Tomorrow";
    return fallback || date.toLocaleDateString("default", { month: "short", day: "numeric" });
  };
  const dayActions = <div className="flex flex-wrap gap-2"><button onClick={() => setActiveDate(addDays(activeDate, -1))} className="flex h-11 min-w-24 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium">{navDay(addDays(activeDate, -1), "Prev")}</button><button className="flex h-11 min-w-28 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white">{navDay(activeDate)}</button><button onClick={() => setActiveDate(addDays(activeDate, 1))} className="flex h-11 min-w-24 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium">{navDay(addDays(activeDate, 1), "Next")}</button><button onClick={openModal} className="flex h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-medium text-white"><Icon name="plus" size={15} /> New</button></div>;
  return <div className="space-y-6"><PageHeader title="Daily marking" eyebrow={label} metric={`${percent}%`} metricLabel="day score" description={isFuture(selectedDayKey, todayKey) ? "Future status is locked until the day arrives." : "Only active items are listed."} actions={dayActions} /><section className="grid gap-6 xl:grid-cols-[360px_1fr]"><section className="animate-card rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/70"><div className="flex items-center justify-between"><div><h3 className="text-2xl font-medium">Day score</h3><p className="mt-1 text-sm text-slate-500">{completed}/{visible.length} active items completed</p></div><MetricBadge value={`${percent}%`} label="done" /></div><div className="mt-5"><RadialProgress percent={percent} /></div><div className="mt-4 grid grid-cols-2 gap-3"><MiniMetric label="Done" value={completed} /><MiniMetric label="Open" value={Math.max(visible.length - completed, 0)} /></div></section><Panel title="Mark active items" subtitle="Achieved items retire from future daily lists."><DailyCards habits={visible} selectedDayKey={selectedDayKey} todayKey={todayKey} toggleDay={toggleDay} markAchieved={markAchieved} /></Panel></section><Panel title="Day timeline" subtitle="Completed vs pending."><DayTimeline habits={visible} selectedDayKey={selectedDayKey} todayKey={todayKey} toggleDay={toggleDay} /></Panel></div>;
}

function YearView({ habits, yearDays, todayKey, activeDate, setActiveDate }) {
  return <div className="space-y-6"><PageHeader title="Year heatmap" eyebrow="Last 365 days" metric={activeDate.getFullYear()} metricLabel="year" description="Month-by-month consistency view." actions={<button onClick={() => setActiveDate(new Date())} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white">Current year</button>} /><Panel title="Annual heatmap" subtitle="Compact monthly calendars. Darker green means stronger completion."><YearHeatmap habits={habits} days={yearDays} todayKey={todayKey} /><HeatLegend /></Panel></div>;
}

function PageHeader({ eyebrow, title, description, actions, metric, metricLabel }) {
  return <section className="animate-card rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur-xl md:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-medium uppercase tracking-[.24em] text-indigo-500">{eyebrow}</p><div className="mt-2 flex flex-wrap items-center gap-4"><h1 className="text-3xl font-medium tracking-tight md:text-5xl">{title}</h1><MetricBadge value={metric} label={metricLabel} /></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">{description}</p></div><div className="w-full shrink-0 lg:w-auto">{actions}</div></div></section>;
}

function MetricBadge({ value, label }) {
  return <div className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-100 px-4 text-slate-700 ring-1 ring-slate-200"><span className="text-lg font-medium text-slate-950">{value}</span><span className="text-xs font-medium text-slate-500">{label}</span></div>;
}

function SelectField({ value, onChange, disabled = false, children, size = "md" }) {
  const height = size === "lg" ? "h-12 rounded-2xl" : "h-11 rounded-xl";
  return (
    <div className="relative mt-1">
      <select
        disabled={disabled}
        value={value}
        onChange={onChange}
        className={`${height} w-full appearance-none border border-slate-200 bg-white px-3 pr-10 text-sm font-medium text-slate-950 outline-none transition focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
        <Icon name="chevron" size={16} />
      </span>
    </div>
  );
}

function StatCard({ icon, label, value, helper }) {
  return <div className="animate-card h-full rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-lg shadow-slate-200/60 transition hover:-translate-y-0.5"><div className="flex h-full items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><Icon name={icon} size={19} /></div><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-medium tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs font-medium text-slate-400">{helper}</p></div></div></div>;
}

function Panel({ title, subtitle, children }) {
  return <section className="animate-card flex h-full flex-col rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur-xl md:p-6"><div className="mb-5"><h3 className="text-2xl font-medium tracking-tight">{title}</h3><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><div className="min-h-0 flex-1">{children}</div></section>;
}

function MiniMetric({ label, value }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xl font-medium">{value}</div><div className="text-xs font-medium text-slate-400">{label}</div></div>;
}

function TypeBadge({ type }) {
  const meta = ITEM_TYPES[type] || ITEM_TYPES.habit;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[.08em] ring-1 ${meta.tone}`}>{meta.label}</span>;
}

function ItemAvatar({ item }) {
  const meta = itemType(item);
  return <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-medium shadow-sm ring-2 ${meta.avatar}`}>{item.name.slice(0, 1).toUpperCase()}</div>;
}

function QuickAction({ title, desc, icon, onClick }) {
  return <button onClick={onClick} className="flex h-full items-center gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 text-left transition hover:-translate-y-1 hover:bg-white hover:shadow-xl"><div className="rounded-2xl bg-slate-950 p-3 text-white"><Icon name={icon} /></div><div><h3 className="font-medium">{title}</h3><p className="text-sm font-medium text-slate-500">{desc}</p></div></button>;
}

function ProgressRow({ label, percent }) {
  return <div><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-700">{label}</span><span className="font-medium text-slate-950">{percent}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950 transition-all duration-700" style={{ width: `${percent}%` }} /></div></div>;
}

function RadialProgress({ percent }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return <div className="flex flex-col items-center justify-center rounded-[1.5rem] bg-slate-50 p-5"><div className="relative h-32 w-32"><svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r={r} stroke="currentColor" strokeWidth="12" className="text-slate-200" fill="none" /><circle cx="60" cy="60" r={r} stroke="currentColor" strokeWidth="12" className="text-indigo-600 transition-all duration-700" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-medium">{percent}%</span><span className="text-xs font-medium text-slate-400">complete</span></div></div><p className="mt-3 text-center text-sm font-medium text-slate-600">Consistency score</p></div>;
}

function HeatLegend({ compact = false }) {
  const swatch = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  return <div className={`${compact ? "mt-4" : "mt-5"} flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500`}><span>Less</span><span className={`${swatch} rounded bg-slate-100`} /><span className={`${swatch} rounded bg-emerald-200`} /><span className={`${swatch} rounded bg-emerald-400`} /><span className={`${swatch} rounded bg-emerald-600`} /><span className={`${swatch} rounded bg-emerald-700`} /><span>More</span></div>;
}

function MonthHeatmap({ habits, monthDays, activeDate, todayKey, setActiveDate }) {
  const selectedKey = toKey(activeDate);
  return <div className="overflow-x-auto pb-1"><div className="mx-auto grid w-max grid-cols-7 gap-1.5">{WEEKDAYS.map((day) => <div key={day} className="w-9 text-center text-[10px] font-medium text-slate-400 md:w-10">{day}</div>)}{Array.from({ length: monthDays[0]?.getDay() || 0 }).map((_, index) => <div key={`blank-${index}`} className="h-9 w-9 md:h-10 md:w-10" />)}{monthDays.map((day) => { const key = toKey(day); const percent = dayCompletion(habits, key, todayKey); const locked = isFuture(key, todayKey); const selected = key === selectedKey; return <button key={key} onClick={() => !locked && setActiveDate(day)} title={`${key}: ${locked ? "locked" : `${percent}% complete`}`} className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium transition md:h-10 md:w-10 ${selected ? "border-slate-950 bg-slate-950 text-white shadow-lg ring-4 ring-slate-200" : `${heatClass(percent)} border-white`} ${locked ? "cursor-not-allowed opacity-40" : "hover:-translate-y-1 hover:shadow-lg"}`}>{day.getDate()}</button>; })}</div></div>;
}

function MonthInfo({ habits, monthDays, activeDate, todayKey, stats }) {
  const trackedDays = monthDays.filter((day) => !isFuture(toKey(day), todayKey));
  const activeDays = trackedDays.filter((day) => activeHabitsForDay(habits, toKey(day), todayKey).length);
  const perfectDays = activeDays.filter((day) => dayCompletion(habits, toKey(day), todayKey) === 100);
  const partialDays = activeDays.filter((day) => { const percent = dayCompletion(habits, toKey(day), todayKey); return percent > 0 && percent < 100; });
  const futureDays = monthDays.filter((day) => isFuture(toKey(day), todayKey)).length;
  const selectedInMonth = monthDays.some((day) => toKey(day) === toKey(activeDate));
  const focusDay = selectedInMonth ? activeDate : trackedDays[trackedDays.length - 1] || monthDays[0];
  const focusKey = toKey(focusDay);
  const focusHabits = activeHabitsForDay(habits, focusKey, todayKey);
  const focusDone = focusHabits.filter((habit) => habit.done[focusKey]).length;
  const focusPercent = focusHabits.length ? Math.round((focusDone / focusHabits.length) * 100) : 0;
  const upcomingLabel = futureDays ? `${futureDays} locked` : "0 locked";
  const focusLabel = focusKey === todayKey ? "Today" : isFuture(focusKey, todayKey) ? "Locked day" : "Selected day";

  const statsLine = [
    ["Check-ins", `${stats.completedSlots}/${stats.totalSlots || 0}`],
    ["Score", `${stats.monthPercent}%`],
    ["Perfect", perfectDays.length],
    ["Partial", partialDays.length],
  ];

  return <div className="h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-[.14em] text-slate-400">{focusLabel}</p><h4 className="mt-1 text-xl font-medium text-slate-950">{focusDay.toLocaleDateString("default", { month: "short", day: "numeric" })}</h4></div>
      <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-100">{focusPercent}%</div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
      {statsLine.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"><div className="text-base font-medium text-slate-950">{value}</div><div className="text-[10px] font-medium uppercase tracking-[.08em] text-slate-400">{label}</div></div>)}
    </div>
    <div className="mt-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-[.12em] text-slate-400">Focus day items</div>
      <div className="grid gap-2">
        {focusHabits.length ? focusHabits.slice(0, 4).map((habit) => <div key={habit.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-100"><span className="min-w-0 truncate font-medium">{habit.name}</span><span className="shrink-0"><TypeBadge type={habit.type} /></span><span className={`text-xs font-medium ${habit.done[focusKey] ? "text-emerald-600" : "text-slate-400"}`}>{habit.done[focusKey] ? "Done" : "Open"}</span></div>) : <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium text-slate-400 ring-1 ring-slate-100">No active items on this day.</p>}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500"><span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-100">{activeDays.length} active days</span><span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-100">{upcomingLabel}</span></div>
  </div>;
}

function YearSummary({ habits, days, todayKey }) {
  const months = [];
  days.forEach((day) => {
    const id = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
    let month = months.find((item) => item.id === id);
    if (!month) {
      month = { id, date: new Date(day.getFullYear(), day.getMonth(), 1), days: [] };
      months.push(month);
    }
    month.days.push(day);
  });
  const displayMonths = months.slice(-12);

  return <div className="pb-1"><div className="mx-auto grid w-full grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">{displayMonths.map((month) => <YearMonthCard key={month.id} month={month} habits={habits} todayKey={todayKey} compact />)}</div></div>;
}

function YearHeatmap({ habits, days, todayKey, compact = false }) {
  const months = [];
  days.forEach((day) => {
    const id = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
    let month = months.find((item) => item.id === id);
    if (!month) {
      month = { id, date: new Date(day.getFullYear(), day.getMonth(), 1), days: [] };
      months.push(month);
    }
    month.days.push(day);
  });
  const displayMonths = months.slice(-12);

  return <div className="pb-1"><div className={`mx-auto grid w-full ${compact ? "max-w-5xl gap-2" : "max-w-6xl gap-3"} grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]`}>{displayMonths.map((month) => <YearMonthCard key={month.id} month={month} habits={habits} todayKey={todayKey} compact={compact} />)}</div></div>;
}

function YearMonthCard({ month, habits, todayKey, compact = false }) {
  const allDays = getMonthDays(month.date);
  const visibleKeys = new Set(month.days.map(toKey));
  const trackedDays = month.days.filter((day) => !isFuture(toKey(day), todayKey));
  const completed = trackedDays.reduce((sum, day) => sum + (dayCompletion(habits, toKey(day), todayKey) || 0), 0);
  const score = trackedDays.length ? Math.round(completed / trackedDays.length) : 0;
  const cell = compact ? "h-2 w-2" : "h-3 w-3";
  const monthLabel = compact
    ? month.date.toLocaleString("default", { month: "short" })
    : month.date.toLocaleString("default", { month: "short", year: "numeric" });
  return <section className={`${compact ? "rounded-xl p-2" : "rounded-2xl p-3"} min-w-0 overflow-hidden border border-slate-100 bg-slate-50/80`}><div className="mb-2 flex items-center justify-between gap-1"><h4 className={`${compact ? "truncate text-[10px]" : "text-xs"} font-medium leading-tight text-slate-950`}>{monthLabel}</h4><span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">{score}%</span></div><div className="mx-auto grid w-max max-w-full grid-cols-7 gap-0.5">{WEEKDAYS.map((day) => <div key={day} className={`${cell} mb-0.5 text-center text-[7px] font-medium leading-3 text-slate-300`}>{day[0]}</div>)}{Array.from({ length: allDays[0].getDay() }).map((_, index) => <div key={`blank-${index}`} className={`${cell} rounded`} />)}{allDays.map((day) => { const key = toKey(day); const inRange = visibleKeys.has(key); const percent = inRange ? dayCompletion(habits, key, todayKey) : null; return <div key={key} title={`${key}: ${inRange ? `${percent}%` : "outside range"}`} className={`${cell} rounded ${inRange ? heatClass(percent) : "bg-transparent"} ${key === todayKey ? "ring-2 ring-slate-900" : ""}`} />; })}</div></section>;
}

function WeekDayCard({ day, habits, todayKey, activeDate, setActiveDate }) {
  const key = toKey(day);
  const percent = dayCompletion(habits, key, todayKey);
  const selected = toKey(activeDate) === key;
  const locked = isFuture(key, todayKey);
  const activeCount = activeHabitsForDay(habits, key, todayKey).length;
  const doneCount = activeHabitsForDay(habits, key, todayKey).filter((habit) => habit.done[key]).length;
  return <button onClick={() => !locked && setActiveDate(day)} className={`rounded-2xl border p-2 text-center transition md:rounded-[1.5rem] md:p-4 md:text-left ${selected ? "border-slate-950 bg-slate-950 text-white shadow-xl" : "border-white bg-white/85"} ${locked ? "cursor-not-allowed opacity-40" : "hover:-translate-y-1 hover:shadow-xl"}`}><div className="flex items-start justify-center gap-2 md:justify-between"><p className="text-[10px] font-medium uppercase tracking-[.08em] opacity-60 md:text-xs md:tracking-[.16em]"><span className="md:hidden">{WEEKDAYS[day.getDay()][0]}</span><span className="hidden md:inline">{WEEKDAYS[day.getDay()]}</span></p><span className="hidden rounded-full bg-current/10 px-2 py-0.5 text-[10px] font-medium md:inline-flex">{doneCount}/{activeCount}</span></div><h3 className="mt-1 text-lg font-medium md:mt-2 md:text-3xl">{day.getDate()}</h3><p className="mt-1 text-[10px] font-medium opacity-70 md:mt-2 md:text-sm"><span className="md:hidden">{percent === null ? "Lock" : `${percent}%`}</span><span className="hidden md:inline">{percent === null ? "Locked" : `${percent}% done`}</span></p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/10 md:mt-4 md:h-2"><div className="h-full rounded-full bg-current" style={{ width: `${percent || 0}%` }} /></div></button>;
}

function WeekBoard({ habits, weekDays, todayKey, toggleDay }) {
  const visible = habits.filter((habit) => weekDays.some((day) => isHabitActiveOn(habit, toKey(day), todayKey)));
  if (!visible.length) return <EmptyState icon="calendar" title="No weekly items" desc="Items scheduled for this week will appear here." />;
  return <>
    <div className="grid gap-3 md:hidden">{visible.map((habit) => <div key={habit.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-lg font-medium text-slate-950">{habit.name}</div><TypeBadge type={habit.type} /></div><ItemAvatar item={habit} /></div><div className="grid grid-cols-7 gap-1.5">{weekDays.map((day) => { const key = toKey(day); const active = isHabitActiveOn(habit, key, todayKey); const checked = Boolean(habit.done[key]); return <button key={key} disabled={!active || isFuture(key, todayKey)} onClick={() => toggleDay(habit.id, key)} className={`flex h-10 flex-col items-center justify-center rounded-xl border text-[10px] font-medium ${checked ? "border-slate-950 bg-slate-950 text-white" : active ? "border-slate-200 bg-white text-slate-600" : "border-transparent bg-transparent text-slate-300"} ${key === todayKey ? "ring-2 ring-indigo-100" : ""}`}>{WEEKDAYS[day.getDay()][0]}<span>{day.getDate()}</span></button>; })}</div></div>)}</div>
    <div className="hidden overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white md:block"><table className="w-full min-w-[760px] border-collapse"><thead><tr className="bg-slate-50"><th className="p-4 text-left text-sm font-medium">Item</th>{weekDays.map((day) => <th key={toKey(day)} className="p-4 text-center text-sm font-medium">{WEEKDAYS[day.getDay()]} {day.getDate()}</th>)}</tr></thead><tbody>{visible.map((habit) => <tr key={habit.id} className="border-t border-slate-100"><td className="p-4"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-800">{habit.name}</span><TypeBadge type={habit.type} /></div></td>{weekDays.map((day) => { const key = toKey(day); const active = isHabitActiveOn(habit, key, todayKey); return <td key={key} className="p-4 text-center">{active ? <CheckButton checked={Boolean(habit.done[key])} disabled={isFuture(key, todayKey)} isToday={key === todayKey} onClick={() => toggleDay(habit.id, key)} /> : <span className="text-xs font-medium text-slate-300">—</span>}</td>; })}</tr>)}</tbody></table></div>
  </>;
}

function DailyCards({ habits, selectedDayKey, todayKey, toggleDay, markAchieved }) {
  const locked = isFuture(selectedDayKey, todayKey);
  if (!habits.length) return <EmptyState icon="check" title="Nothing to mark" desc={locked ? "Future days are locked until they arrive." : "No active items are scheduled for this day."} />;
  return <div className="grid gap-3 md:grid-cols-2">{habits.map((habit) => { const checked = Boolean(habit.done[selectedDayKey]); const type = itemType(habit); return <div key={habit.id} className={`rounded-[1.5rem] border p-4 ${checked ? "border-slate-950 bg-slate-950 text-white" : "border-slate-100 bg-slate-50"}`}><button disabled={locked} onClick={() => toggleDay(habit.id, selectedDayKey)} className="w-full text-left"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><ItemAvatar item={habit} /><div className="min-w-0"><div className="mb-1"><TypeBadge type={habit.type} /></div><h3 className="truncate text-lg font-medium">{habit.name}</h3><p className="text-sm font-medium opacity-60">{checked ? "Done. Keep rolling." : `${type.label} waiting for check-in.`}</p></div></div><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${checked ? "border-white bg-white text-slate-950" : "border-slate-200 bg-white text-slate-300"}`}>{checked && <Icon name="check" />}</div></div></button><button disabled={locked} onClick={() => markAchieved(habit.id)} className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-medium ${checked ? "bg-white/10 text-white" : "bg-white text-slate-600"}`}>Mark {type.label.toLowerCase()} achieved</button></div>; })}</div>;
}

function DayTimeline({ habits, selectedDayKey, todayKey, toggleDay }) {
  if (!habits.length) return <EmptyState icon="calendar" title="Clean day" desc="There are no active items in this date window." />;
  return <div className="space-y-3">{habits.map((habit, index) => { const checked = Boolean(habit.done[selectedDayKey]); return <div key={habit.id} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-full font-medium ${checked ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{index + 1}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{habit.name}</h3><TypeBadge type={habit.type} /></div><p className="text-sm font-medium text-slate-500">{formatDate(habit.startDate)} → {formatDate(habitEnd(habit))}</p></div><CheckButton checked={checked} disabled={isFuture(selectedDayKey, todayKey)} isToday={selectedDayKey === todayKey} onClick={() => toggleDay(habit.id, selectedDayKey)} /></div>; })}</div>;
}

function CheckButton({ checked, disabled, isToday, onClick }) {
  return <button disabled={disabled} onClick={onClick} className={`mx-auto flex h-9 w-9 items-center justify-center rounded-2xl border transition ${checked ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-indigo-50"} ${isToday ? "ring-4 ring-indigo-100" : ""} ${disabled ? "cursor-not-allowed opacity-30" : "hover:-translate-y-1 hover:shadow-lg"}`}>{checked && <Icon name="check" size={16} />}</button>;
}

function HabitGrid({ habits, monthDays, monthKeys, todayKey, toggleDay, renameHabit, deleteHabit, markAchieved, openModal }) {
  return <main className="rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-xl shadow-slate-200/70 md:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-2xl font-medium">Monthly item board</h3><p className="text-sm text-slate-500">Tap a day to mark an active item.</p></div></div>{habits.length ? <div className="grid gap-3 md:hidden">{habits.map((habit) => <MobileMonthHabitCard key={habit.id} habit={habit} monthKeys={monthKeys} todayKey={todayKey} toggleDay={toggleDay} renameHabit={renameHabit} deleteHabit={deleteHabit} markAchieved={markAchieved} />)}</div> : <EmptyState icon="plus" title="No items yet" desc="Add a habit, task, or hobby to start marking the calendar." action={<button onClick={openModal} className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"><Icon name="plus" size={15} />Add item</button>} />}<div className={`${habits.length ? "hidden md:block" : "hidden"} overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white`}><table className="w-full min-w-[1120px] border-collapse"><thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 min-w-80 bg-slate-50 p-4 text-left text-sm font-medium">Item</th>{monthDays.map((day) => <th key={toKey(day)} className="p-2 text-center text-xs font-medium text-slate-500"><div>{day.getDate()}</div><div>{WEEKDAYS[day.getDay()]}</div></th>)}<th className="p-4 text-sm font-medium">Month</th></tr></thead><tbody>{habits.map((habit) => { const activeKeys = monthKeys.filter((key) => isHabitActiveOn(habit, key, todayKey)); const doneCount = activeKeys.filter((key) => habit.done[key]).length; const rate = activeKeys.length ? Math.round((doneCount / activeKeys.length) * 100) : 0; return <tr key={habit.id} className="border-t border-slate-100 hover:bg-indigo-50/40"><td className="sticky left-0 z-10 border-r border-slate-100 bg-white p-4"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><ItemAvatar item={habit} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="truncate font-medium text-slate-900">{habit.name}</div><TypeBadge type={habit.type} /></div><div className="mt-1 whitespace-nowrap text-xs font-medium text-slate-500">{formatDate(habit.startDate)} → {formatDate(habitEnd(habit))}{habit.achievedDate ? " · achieved" : ""}</div></div></div><div className="flex shrink-0 gap-1"><button onClick={() => renameHabit(habit.id)} className="rounded-xl p-2 hover:bg-slate-100"><Icon name="pencil" size={15} /></button><button onClick={() => markAchieved(habit.id)} className="rounded-xl p-2 hover:bg-emerald-50"><Icon name="target" size={15} /></button><button onClick={() => deleteHabit(habit.id)} className="rounded-xl p-2 hover:bg-rose-50"><Icon name="trash" size={15} /></button></div></div></td>{monthDays.map((day) => { const key = toKey(day); const active = isHabitActiveOn(habit, key, todayKey); return <td key={key} className="p-2 text-center">{active ? <CheckButton checked={Boolean(habit.done[key])} disabled={isFuture(key, todayKey)} isToday={key === todayKey} onClick={() => toggleDay(habit.id, key)} /> : <span className="text-xs font-medium text-slate-300">—</span>}</td>; })}<td className="p-4 text-center"><div className="font-medium">{rate}%</div><div className="mx-auto mt-2 h-2 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${rate}%` }} /></div></td></tr>; })}</tbody></table></div></main>;
}

function MobileMonthHabitCard({ habit, monthKeys, todayKey, toggleDay, renameHabit, deleteHabit, markAchieved }) {
  const activeKeys = monthKeys.filter((key) => isHabitActiveOn(habit, key, todayKey));
  const doneCount = activeKeys.filter((key) => habit.done[key]).length;
  const rate = activeKeys.length ? Math.round((doneCount / activeKeys.length) * 100) : 0;
  return <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><ItemAvatar item={habit} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="truncate text-lg font-medium text-slate-950">{habit.name}</div><TypeBadge type={habit.type} /></div><div className="mt-1 whitespace-nowrap text-xs font-medium text-slate-500">{formatDate(habit.startDate)} → {formatDate(habitEnd(habit))}</div></div></div><div className="shrink-0 text-right"><div className="text-lg font-medium">{rate}%</div><div className="text-[10px] font-medium text-slate-400">{doneCount}/{activeKeys.length}</div></div></div><div className="mt-3 flex gap-1"><button onClick={() => renameHabit(habit.id)} className="rounded-xl p-2 hover:bg-white"><Icon name="pencil" size={15} /></button><button onClick={() => markAchieved(habit.id)} className="rounded-xl p-2 hover:bg-white"><Icon name="target" size={15} /></button><button onClick={() => deleteHabit(habit.id)} className="rounded-xl p-2 hover:bg-white"><Icon name="trash" size={15} /></button></div>{activeKeys.length ? <div className="mt-4 grid grid-cols-7 gap-1.5">{activeKeys.map((key) => <button key={key} disabled={isFuture(key, todayKey)} onClick={() => toggleDay(habit.id, key)} className={`flex h-9 items-center justify-center rounded-xl border text-xs font-medium ${habit.done[key] ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-500"} ${key === todayKey ? "ring-2 ring-indigo-100" : ""}`}>{fromKey(key).getDate()}</button>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm font-medium text-slate-400">No active days this month.</div>}</div>;
}

function TargetMiniList({ targets, habits, todayKey, setPage }) {
  if (!targets.length) return <EmptyState icon="target" title="No targets yet" desc="Targets will summarize grouped item progress here." action={<button onClick={() => setPage("targets")} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"><Icon name="target" size={15} />Create target</button>} />;
  return <div className="space-y-3">{targets.map((target) => { const progress = targetProgress(target, habits, todayKey); const mapped = habits.filter((habit) => target.habitIds.includes(habit.id)); const achieved = Boolean(target.achievedDate); return <div key={target.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-medium">{target.name}</h3><p className="text-xs font-medium text-slate-500">{achieved ? `Finished ${formatDate(target.achievedDate)}` : `${mapped.length} mapped items`}</p></div><span className={`text-xl font-medium ${achieved ? "text-emerald-600" : ""}`}>{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${achieved ? "bg-emerald-600" : "bg-indigo-600"}`} style={{ width: `${progress}%` }} /></div></div>; })}</div>;
}

function StreakCard({ habit, todayKey, monthDays }) {
  return <div className="h-full rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4"><div className="flex h-full items-center gap-3"><ItemAvatar item={habit} /><div className="min-w-0"><div className="mb-1"><TypeBadge type={habit.type} /></div><h3 className="truncate font-medium">{habit.name}</h3><p className="mt-1 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500"><span className="inline-flex items-center gap-1"><Icon name="flame" size={14} />Streak {getStreak(habit, todayKey)} days</span><span className="inline-flex items-center gap-1"><Icon name="trophy" size={14} />Best {getLongestStreak(habit, monthDays, todayKey)}</span></p></div></div></div>;
}

function EmptyState({ icon, title, desc, action }) {
  return <div className="col-span-full rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-8 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Icon name={icon} /></div><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm font-medium text-slate-500">{desc}</p>{action}</div>;
}

function AddHabitModal({ newHabit, setNewHabit, newHabitType, setNewHabitType, newHabitStart, setNewHabitStart, newHabitEnd, setNewHabitEnd, newHabitTarget, setNewHabitTarget, targets, addHabit, close }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-slate-950 p-6 text-white">
          <div>
            <p className="text-xs font-medium uppercase tracking-[.22em] text-indigo-200">New item</p>
            <h2 className="mt-1 text-3xl font-medium tracking-tight">Add item</h2>
            <p className="mt-1 text-sm font-medium text-slate-300">Create a habit, task, or hobby and optionally place it under a target.</p>
          </div>
          <button onClick={close} className="rounded-2xl bg-white/10 p-3 text-slate-300 hover:text-white"><Icon name="close" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid gap-3 md:grid-cols-[.8fr_1.2fr]">
            <label className="text-xs font-medium text-slate-500">
              Type
              <SelectField value={newHabitType} onChange={(e) => setNewHabitType(e.target.value)} size="lg">
                {Object.entries(ITEM_TYPES).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
              </SelectField>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Name
              <input value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} autoFocus placeholder={`${ITEM_TYPES[newHabitType].label} name...`} className="mt-1 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-950 outline-none focus:ring-4 focus:ring-indigo-100" />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-medium text-slate-500">Start date<input type="date" value={newHabitStart} onChange={(e) => setNewHabitStart(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-950" /></label>
            <label className="text-xs font-medium text-slate-500">End date<input type="date" value={newHabitEnd} onChange={(e) => setNewHabitEnd(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-950" /></label>
            <label className="text-xs font-medium text-slate-500">
              Target
              <SelectField value={newHabitTarget} onChange={(e) => setNewHabitTarget(e.target.value)}>
                <option value="">No target</option>
                {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
              </SelectField>
            </label>
          </div>
          <button onClick={addHabit} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 font-medium text-white hover:bg-indigo-700"><Icon name="plus" /> Add {ITEM_TYPES[newHabitType].label.toLowerCase()}</button>
        </div>
      </div>
    </div>
  );
}
