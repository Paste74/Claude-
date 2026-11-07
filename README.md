# Tempo: a to-do list with agents

Tempo is a fast, keyboard-first to-do app where you can hand any task to an AI agent. The agent works in the background: it breaks tasks into steps, researches on the web, and writes drafts, and its results land directly on the task.

## Features

**Tasks**
- Natural-language quick add: `Send deck to Sam tomorrow p1 #work` sets the due date, priority and list as you type.
- Smart views: Today (with overdue), Upcoming (grouped by day), All tasks, Completed, and your own color-coded lists.
- A task panel with notes, subtasks (with progress and time estimates), and saved drafts.
- A command palette (`⌘K`), full keyboard navigation, light and dark themes, and a mobile layout.
- Everything is saved locally in your browser.

**Agents**

| Agent | What it does |
|---|---|
| **Copilot** | Generalist: picks the right mix of planning, research and drafting |
| **Planner** | Breaks the task into a concrete checklist with estimates, and sets the due date and priority |
| **Researcher** | Searches and reads the web, then saves a short brief with sources |
| **Writer** | Drafts the email, message or doc the task needs |

- **Live activity**: watch the agent think, search, read pages and write drafts as it happens.
- **Agents change the task directly**: subtasks, field updates, follow-up tasks and deliverables appear as the agent works.
- **Asks when it matters**: an agent can pause with a question ("Who should the email go to?"). The task is flagged *Needs you*, and the agent continues once you answer.
- **Keep iterating**: reply to any finished run ("make it shorter") and the agent continues with full context.
- **Agents hub**: one place for what's running, what needs you and what's ready to review, plus notifications when runs finish.
- Hand a task to an agent from quick add, from the task panel, from the palette, or by pressing `A`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Task management works without a key; agents need one.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `N` | New task |
| `J` / `K` | Move selection |
| `Enter` | Open task |
| `X` | Complete task |
| `A` | Hand the selected task to Copilot |
| `G` then `T` / `U` / `G` | Go to Today / Upcoming / Agents |
| `Esc` | Close panel |
| `?` | Show shortcuts |

## How it works

- **Next.js App Router + React 19 + Tailwind CSS v4.** State lives in a reducer (`lib/store.tsx`) that is saved to `localStorage`.
- **Agent loop** (`app/api/agent/route.ts`): a streaming tool-use loop on the Claude API (`claude-opus-5-5` with adaptive thinking). It streams newline-delimited JSON events to the browser: text, reasoning summaries, steps, sources, live draft previews, and task actions.
- **Tools**: `add_subtasks`, `update_task`, `save_deliverable`, `create_task` and `ask_user` are tools defined by the app. The server validates their inputs with Zod and turns them into actions the browser applies to your task. The Researcher and Copilot also get Anthropic's server-side `web_search` and `web_fetch`.
- **Conversation history** is stored with each run and is only ever appended to, so follow-ups and answers to questions resume with full context, and prompt caching stays effective.
- **Refusal fallback**: requests opt into the API's server-side fallback (`fallbacks: "default"`), so a request the model declines is retried on a suitable fallback model.
- Agent prompts and tools are defined in `lib/server/agent-config.ts`. Set `AGENT_MODEL` to use a different model.

## Project layout

```
app/api/agent/route.ts      streaming agent loop
app/api/status/route.ts     API-key check for the setup banner
lib/server/agent-config.ts  agent prompts, tools, input schemas
lib/store.tsx               state, persistence, agent run streaming
lib/parse.ts                natural-language quick add
lib/views.ts                Today / Upcoming / list grouping
components/                 UI (sidebar, list, task panel, agent timeline, palette)
```
