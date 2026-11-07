"use client";

import { CheckCircle2, Menu, Search, Sparkles, X } from "lucide-react";
import { forwardRef } from "react";
import { useStore } from "@/lib/store";
import type { ViewId } from "@/lib/types";
import { groupsForView, latestRun, viewTitle, type Group } from "@/lib/views";
import { QuickAdd, type QuickAddHandle } from "./QuickAdd";
import { TaskRow } from "./TaskRow";
import { cx, IconButton } from "./ui";

export const TaskList = forwardRef<
  QuickAddHandle,
  {
    view: ViewId;
    groups: Group[];
    selectedId: string | null;
    focusedId: string | null;
    onSelect: (id: string) => void;
    query: string;
    setQuery: (q: string) => void;
    onMenu: () => void;
  }
>(function TaskList({ view, groups, selectedId, focusedId, onSelect, query, setQuery, onMenu }, ref) {
  const { state, listById } = useStore();
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);
  const listView = view.startsWith("list:");
  const list = listView ? listById(view.slice(5)) : null;
  const subtitle =
    view === "today"
      ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : undefined;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-bg">
      <header className="flex h-12 shrink-0 items-center gap-2 px-4 md:px-8">
        <IconButton label="Open menu" className="md:hidden" onClick={onMenu}>
          <Menu className="h-4 w-4" />
        </IconButton>
        <div className="ml-auto flex items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter"
              className="h-8 w-36 rounded-lg bg-transparent pr-7 pl-8 text-[13px] outline-none transition-all placeholder:text-fg-3 hover:bg-hover focus:w-52 focus:bg-surface focus:shadow-card"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-3 hover:text-fg">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 pb-24 md:px-8">
          <div className="mb-5 pt-4">
            <h1 className="flex items-center gap-2.5 text-[24px] font-semibold tracking-[-0.02em]">
              {list && <span className="h-3.5 w-3.5 rounded" style={{ background: list.color }} />}
              {viewTitle(state, view)}
            </h1>
            {subtitle && <p className="mt-0.5 text-[13px] text-fg-3">{subtitle}</p>}
          </div>

          {view !== "completed" && (
            <div className="mb-5">
              <QuickAdd ref={ref} view={view} onCreated={onSelect} />
            </div>
          )}

          {total === 0 ? (
            <EmptyState view={view} filtered={!!query} />
          ) : (
            groups.map((g) => (
              <div key={g.id} className="mb-5">
                {g.title && (
                  <div
                    className={cx(
                      "mb-1 flex items-center gap-2 border-b border-line px-3 pb-1.5 text-[12.5px] font-semibold",
                      g.tone === "danger" ? "text-danger" : "text-fg-2",
                    )}
                  >
                    {g.title}
                    <span className="font-normal text-fg-3">{g.tasks.length}</span>
                  </div>
                )}
                <div className="flex flex-col">
                  {g.tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      list={listById(t.listId)}
                      run={latestRun(state, t)}
                      selected={selectedId === t.id}
                      focused={focusedId === t.id}
                      showList={!listView}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
});

function EmptyState({ view, filtered }: { view: ViewId; filtered: boolean }) {
  if (filtered)
    return <div className="py-16 text-center text-[13px] text-fg-3">No tasks match your filter.</div>;
  const isToday = view === "today";
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        {view === "completed" ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </div>
      <p className="text-[14px] font-medium">
        {view === "completed" ? "Nothing completed yet" : isToday ? "You're clear for today" : "Nothing here yet"}
      </p>
      <p className="mt-1 max-w-[320px] text-[13px] text-fg-3">
        {view === "completed"
          ? "Finished tasks will show up here."
          : `Add a task above${isToday ? " and it's due today" : ""}. Hand it to an agent and it starts working right away.`}
      </p>
    </div>
  );
}
