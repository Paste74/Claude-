"use client";

import { KeyRound, MessageCircleQuestion, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AGENTS } from "@/lib/agents";
import { useStore } from "@/lib/store";
import type { AgentId, RunStatus, ViewId } from "@/lib/types";
import { groupsForView } from "@/lib/views";
import { AgentsView } from "./AgentsView";
import { CommandPalette, ShortcutsDialog } from "./CommandPalette";
import type { QuickAddHandle } from "./QuickAdd";
import { Sidebar, type ThemePref } from "./Sidebar";
import { TaskDetail } from "./TaskDetail";
import { TaskList } from "./TaskList";
import { AgentAvatar, cx } from "./ui";

interface Toast {
  id: string;
  runId: string;
  taskId: string;
  agentId: AgentId;
  title: string;
  status: RunStatus;
}

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const { state, ready, dispatch, startAgent } = useStore();
  const [view, setViewState] = useState<ViewId>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "agent">("details");
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const quickAdd = useRef<QuickAddHandle>(null);
  const gPressed = useRef(0);

  // ---- preferences
  useEffect(() => {
    setViewState(readPref<ViewId>("tempo:view", "today"));
    setThemeState(readPref<ThemePref>("tempo:theme", "system"));
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: { configured: boolean }) => setApiReady(s.configured))
      .catch(() => setApiReady(null));
  }, []);

  const setView = useCallback((v: ViewId) => {
    setViewState(v);
    setQuery("");
    setFocusedId(null);
    try {
      localStorage.setItem("tempo:view", v);
    } catch {}
  }, []);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    try {
      localStorage.setItem("tempo:theme", t);
    } catch {}
  }, []);

  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  }, [setTheme]);

  // ---- derived
  const groups = useMemo(() => (view === "agents" ? [] : groupsForView(state, view, query)), [state, view, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.tasks.map((t) => t.id)), [groups]);

  useEffect(() => {
    if (selectedId && !state.tasks[selectedId]) setSelectedId(null);
  }, [state.tasks, selectedId]);

  const openTask = useCallback((id: string, t: "details" | "agent" = "details") => {
    setSelectedId(id);
    setFocusedId(id);
    setTab(t);
  }, []);

  const delegate = useCallback(
    (taskId: string, agent: AgentId) => {
      startAgent(taskId, agent);
      openTask(taskId, "agent");
    },
    [startAgent, openTask],
  );

  const newTask = useCallback(() => {
    if (view === "agents" || view === "completed") setView("inbox");
    setTimeout(() => quickAdd.current?.focus(), 30);
  }, [view, setView]);

  // ---- toasts when agents finish or need input
  const prevStatus = useRef<Record<string, RunStatus>>({});
  useEffect(() => {
    const prev = prevStatus.current;
    const next: Record<string, RunStatus> = {};
    for (const r of Object.values(state.runs)) {
      next[r.id] = r.status;
      const was = prev[r.id];
      if (was === "running" && (r.status === "done" || r.status === "needs_input")) {
        const viewing = selectedId === r.taskId && tab === "agent";
        if (!viewing) {
          const task = state.tasks[r.taskId];
          const toast: Toast = { id: r.id + r.status, runId: r.id, taskId: r.taskId, agentId: r.agentId, title: task?.title ?? "", status: r.status };
          setToasts((ts) => [...ts.filter((t) => t.runId !== r.id), toast].slice(-3));
          setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== toast.id)), 7000);
        }
      }
    }
    prevStatus.current = next;
  }, [state.runs, state.tasks, selectedId, tab]);

  // ---- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (palette || help) {
        if (e.key === "Escape") setHelp(false);
        return;
      }
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]")) return;
      if (mod || e.altKey) return;

      if (Date.now() - gPressed.current < 800) {
        gPressed.current = 0;
        const map: Record<string, ViewId> = { t: "today", u: "upcoming", a: "inbox", g: "agents", c: "completed" };
        if (map[e.key]) {
          e.preventDefault();
          setView(map[e.key]);
          return;
        }
      }

      const current = focusedId ?? selectedId;
      switch (e.key) {
        case "g":
          gPressed.current = Date.now();
          break;
        case "n":
        case "q":
          e.preventDefault();
          newTask();
          break;
        case "?":
          setHelp(true);
          break;
        case "j":
        case "ArrowDown": {
          if (!flat.length) return;
          e.preventDefault();
          const i = current ? flat.indexOf(current) : -1;
          const id = flat[Math.min(flat.length - 1, i + 1)];
          setFocusedId(id);
          if (selectedId) setSelectedId(id);
          document.querySelector(`[data-task-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "k":
        case "ArrowUp": {
          if (!flat.length) return;
          e.preventDefault();
          const i = current ? flat.indexOf(current) : flat.length;
          const id = flat[Math.max(0, i - 1)];
          setFocusedId(id);
          if (selectedId) setSelectedId(id);
          document.querySelector(`[data-task-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "Enter":
          if (focusedId) openTask(focusedId);
          break;
        case "x":
          if (current) dispatch({ type: "task/toggle", id: current });
          break;
        case "a":
          if (current) delegate(current, "copilot");
          break;
        case "Escape":
          if (selectedId) setSelectedId(null);
          else setFocusedId(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette, help, flat, focusedId, selectedId, newTask, openTask, delegate, dispatch, setView]);

  if (!ready) return <div className="h-full bg-bg" />;

  const sidebar = (
    <Sidebar
      view={view}
      setView={setView}
      openPalette={() => setPalette(true)}
      theme={theme}
      setTheme={setTheme}
      onNavigate={() => {
        setMobileNav(false);
        setSelectedId(null);
      }}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {apiReady === false && !bannerHidden && (
        <div className="flex items-center gap-2.5 border-b border-line bg-accent-soft px-4 py-2 text-[12.5px] text-fg">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-accent-text" />
          <span className="min-w-0 flex-1">
            Agents need an Anthropic API key. Add <code className="rounded bg-hover px-1">ANTHROPIC_API_KEY</code> to{" "}
            <code className="rounded bg-hover px-1">.env.local</code> and restart the server. Your tasks work without it.
          </span>
          <button aria-label="Dismiss" onClick={() => setBannerHidden(true)} className="text-fg-3 hover:text-fg">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="hidden md:block">{sidebar}</div>
        {mobileNav && (
          <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setMobileNav(false)}>
            <div className="slide-in h-full" onClick={(e) => e.stopPropagation()}>
              {sidebar}
            </div>
            <div className="flex-1 bg-black/30" />
          </div>
        )}

        <main className={cx("flex min-w-0 flex-1", selectedId && "max-md:hidden")}>
          {view === "agents" ? (
            <AgentsView onOpenRun={(id) => openTask(id, "agent")} onMenu={() => setMobileNav(true)} />
          ) : (
            <TaskList
              ref={quickAdd}
              view={view}
              groups={groups}
              selectedId={selectedId}
              focusedId={focusedId}
              onSelect={(id) => openTask(id)}
              query={query}
              setQuery={setQuery}
              onMenu={() => setMobileNav(true)}
            />
          )}
        </main>

        {selectedId && state.tasks[selectedId] && (
          <TaskDetail key={selectedId} taskId={selectedId} onClose={() => setSelectedId(null)} tab={tab} setTab={setTab} />
        )}
      </div>

      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        setView={setView}
        openTask={(id) => openTask(id)}
        selectedTaskId={selectedId ?? focusedId}
        newTask={newTask}
        toggleTheme={toggleTheme}
        delegate={delegate}
      />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />

      <div className="pointer-events-none fixed right-4 bottom-4 z-[90] flex flex-col gap-2">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              openTask(t.taskId, "agent");
              setToasts((ts) => ts.filter((x) => x.id !== t.id));
            }}
            className="pop-in pointer-events-auto flex w-[320px] items-center gap-3 rounded-xl bg-elevated p-3 text-left shadow-pop"
          >
            <AgentAvatar agentId={t.agentId} size={28} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-medium">
                {t.status === "needs_input" && <MessageCircleQuestion className="h-3.5 w-3.5 text-warn" />}
                {AGENTS[t.agentId].name} {t.status === "needs_input" ? "has a question" : "finished"}
              </span>
              <span className="block truncate text-[12px] text-fg-3">{t.title}</span>
            </span>
            <span className="text-[12px] font-medium text-accent-text">View</span>
          </button>
        ))}
      </div>
    </div>
  );
}
