import Anthropic from "@anthropic-ai/sdk";
import { AGENT_CONFIG, ToolInputs, type ClientToolName } from "@/lib/server/agent-config";
import { AGENTS } from "@/lib/agents";
import type {
  AgentAction,
  AgentEvent,
  AgentRequest,
  PendingInput,
  Priority,
  Source,
  StepIcon,
  TaskSnapshot,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Beta = Anthropic.Beta.Messages.BetaMessage;
type BetaParam = Anthropic.Beta.Messages.BetaMessageParam;
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;
type ContentParam = Anthropic.Beta.Messages.BetaContentBlockParam;

const MODEL = process.env.AGENT_MODEL || "claude-opus-5-5";
const MAX_TURNS = 14;

const uid = () => Math.random().toString(36).slice(2, 10);

function describeTask(t: TaskSnapshot): string {
  const lines = [
    `Title: ${t.title}`,
    `List: ${t.listName}`,
    `Priority: ${["", "P1 urgent", "P2 high", "P3 medium", "none"][t.priority]}`,
    `Due: ${t.due ?? "not set"}`,
  ];
  if (t.notes.trim()) lines.push(`Notes:\n${t.notes.trim()}`);
  if (t.subtasks.length)
    lines.push(`Subtasks:\n${t.subtasks.map((s) => `- [${s.done ? "x" : " "}] ${s.title}`).join("\n")}`);
  if (t.deliverables.length)
    lines.push(
      `Saved deliverables:\n${t.deliverables
        .map((d) => `### ${d.title}\n${d.content.length > 4000 ? d.content.slice(0, 4000) + "\n…" : d.content}`)
        .join("\n\n")}`,
    );
  return lines.join("\n");
}

function buildUserMessage(req: AgentRequest): BetaParam {
  const ctx = `<task>\n${describeTask(req.task)}\n</task>\nToday is ${req.today}.`;
  const { input } = req;
  if (input.type === "start") {
    const ask = input.instruction?.trim() || "Work on this task.";
    return { role: "user", content: `${ctx}\n\n${ask}` };
  }
  // A reply: either the answer to an ask_user call, or a follow-up message.
  if (input.pending) {
    const content: ContentParam[] = [
      ...(input.pending.partialResults as ToolResult[]),
      { type: "tool_result", tool_use_id: input.pending.toolUseId, content: `The user answered: ${input.text}` },
    ];
    return { role: "user", content };
  }
  return {
    role: "user",
    content: `<task_update>\nCurrent state of the task:\n${describeTask(req.task)}\n</task_update>\n\n${input.text}`,
  };
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
  if (err instanceof Anthropic.PermissionDeniedError)
    return "This API key doesn't have access to the model. Try setting AGENT_MODEL.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the API. Try again in a moment.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the Anthropic API. Check your connection.";
  if (err instanceof Anthropic.APIError) return `API error (${err.status ?? "unknown"}): ${err.message}`;
  if (err instanceof Error && /authentication method/i.test(err.message))
    return "No Anthropic credentials found. Add ANTHROPIC_API_KEY to .env.local and restart the server.";
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

const asPriority = (n: number | undefined) => (n ? (Math.min(4, Math.max(1, n)) as Priority) : undefined);

// Runs one client tool. Returns the action to apply in the browser and the
// text result Claude sees.
function runClientTool(
  name: ClientToolName,
  input: unknown,
): { action?: AgentAction; result: string; step?: { label: string; icon: StepIcon }; ask?: string } {
  switch (name) {
    case "add_subtasks": {
      const { subtasks } = ToolInputs.add_subtasks.parse(input);
      const items = subtasks.map((s) => ({ id: uid(), title: s.title, estimateMinutes: s.estimate_minutes }));
      return {
        action: { type: "add_subtasks", subtasks: items },
        result: `Added ${items.length} subtasks.`,
        step: { label: `Added ${items.length} subtask${items.length === 1 ? "" : "s"}`, icon: "subtasks" },
      };
    }
    case "update_task": {
      const i = ToolInputs.update_task.parse(input);
      const patch = {
        title: i.title,
        priority: asPriority(i.priority),
        due: i.due_date,
        notesAppend: i.notes_append,
      };
      const changed = [
        i.title && "title",
        i.priority && `priority → P${i.priority}`,
        i.due_date !== undefined && (i.due_date ? `due → ${i.due_date}` : "cleared due date"),
        i.notes_append && "notes",
      ].filter(Boolean);
      return {
        action: { type: "update_task", patch },
        result: changed.length ? `Updated: ${changed.join(", ")}.` : "Nothing to update.",
        step: { label: `Updated task${changed.length ? `: ${changed.join(", ")}` : ""}`, icon: "edit" },
      };
    }
    case "save_deliverable": {
      const d = ToolInputs.save_deliverable.parse(input);
      return {
        action: { type: "save_deliverable", deliverable: { id: uid(), title: d.title, content: d.content } },
        result: `Saved "${d.title}" to the task.`,
      };
    }
    case "create_task": {
      const t = ToolInputs.create_task.parse(input);
      return {
        action: {
          type: "create_task",
          task: { id: uid(), title: t.title, notes: t.notes, due: t.due_date, priority: asPriority(t.priority) },
        },
        result: `Created task "${t.title}".`,
        step: { label: `Created task “${t.title}”`, icon: "task" },
      };
    }
    case "ask_user": {
      const { question } = ToolInputs.ask_user.parse(input);
      return { result: "", ask: question };
    }
  }
}

export async function POST(request: Request) {
  const req = (await request.json()) as AgentRequest;
  const config = AGENT_CONFIG[req.agentId];
  if (!config || !AGENTS[req.agentId]) return new Response("Unknown agent", { status: 400 });

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client went away */
        }
      };

      let client: Anthropic;
      try {
        client = new Anthropic();
      } catch {
        send({ type: "error", message: "No Anthropic credentials found. Add ANTHROPIC_API_KEY to .env.local and restart." });
        controller.close();
        return;
      }

      const history = req.history as BetaParam[];
      const messages: BetaParam[] = [...history, buildUserMessage(req)];
      // Messages not yet confirmed to the client. The new user message is
      // only committed together with a complete assistant turn so the
      // stored history never ends mid-exchange.
      let uncommitted: BetaParam[] = [messages[messages.length - 1]];
      let jsonRetries = 0;

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const stream = client.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 32000,
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
              thinking: { type: "adaptive", display: "summarized" },
              output_config: { effort: config.effort },
              system: [{ type: "text", text: config.system, cache_control: { type: "ephemeral" } }],
              tools: config.tools,
              messages,
            },
            { signal: abort.signal },
          );

          // Track which tool block is currently streaming so we can show a
          // live preview of deliverables as they are written.
          let streamingTool: string | null = null;
          let lastDraftAt = 0;
          stream.on("streamEvent", (ev) => {
            if (ev.type === "content_block_start") {
              const b = ev.content_block;
              streamingTool = b.type === "tool_use" ? b.name : null;
              if (b.type === "tool_use" && b.name === "save_deliverable")
                send({ type: "draft", title: "", content: "" });
            } else if (ev.type === "content_block_stop") {
              if (streamingTool === "save_deliverable") send({ type: "draft", title: "", content: "", done: true });
              streamingTool = null;
              send({ type: "block_end" });
            }
          });
          stream.on("text", (delta) => send({ type: "text", delta }));
          stream.on("thinking", (delta) => send({ type: "thinking", delta }));
          stream.on("inputJson", (_partial, snapshot) => {
            if (streamingTool !== "save_deliverable") return;
            const now = Date.now();
            if (now - lastDraftAt < 120) return;
            lastDraftAt = now;
            const s = (snapshot ?? {}) as { title?: string; content?: string };
            send({ type: "draft", title: s.title ?? "", content: s.content ?? "" });
          });
          stream.on("contentBlock", (block) => {
            if (block.type === "server_tool_use") {
              const input = block.input as { query?: string; url?: string };
              if (block.name === "web_search")
                send({ type: "step", icon: "search", label: "Searched the web", detail: input.query });
              else if (block.name === "web_fetch")
                send({ type: "step", icon: "read", label: "Read a page", detail: input.url });
            } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
              const sources: Source[] = block.content
                .filter((r) => r.type === "web_search_result")
                .slice(0, 5)
                .map((r) => ({ title: r.title, url: r.url }));
              if (sources.length) send({ type: "sources", sources });
            }
          });

          let message: Beta;
          try {
            message = await stream.finalMessage();
            jsonRetries = 0;
          } catch (err) {
            // A tool input that isn't parseable JSON at all: re-issue the turn.
            if (err instanceof Anthropic.APIError || abort.signal.aborted || jsonRetries++ >= 2) throw err;
            continue;
          }

          send({ type: "usage", outputTokens: message.usage.output_tokens });

          if (message.stop_reason === "refusal") {
            send({ type: "error", message: "The agent declined to continue with this request." });
            break;
          }

          if (message.stop_reason === "pause_turn") {
            messages.push({ role: "assistant", content: message.content });
            uncommitted.push(messages[messages.length - 1]);
            continue;
          }

          const toolUses = message.content.filter(
            (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use",
          );

          if (toolUses.length === 0) {
            messages.push({ role: "assistant", content: message.content });
            uncommitted.push(messages[messages.length - 1]);
            send({ type: "append", messages: uncommitted });
            uncommitted = [];
            break;
          }

          if (message.stop_reason === "max_tokens") {
            send({ type: "error", message: "The agent's output was cut off. Try a narrower request." });
            break;
          }

          const assistant: BetaParam = { role: "assistant", content: message.content };
          const results: ToolResult[] = [];
          let ask: { id: string; question: string } | null = null;

          for (const tu of toolUses) {
            const name = tu.name as ClientToolName;
            if (!(name in ToolInputs)) {
              results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Unknown tool ${tu.name}` });
              continue;
            }
            const check = ToolInputs[name].safeParse(tu.input);
            if (!check.success) {
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                is_error: true,
                content: `Invalid input: ${check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
              });
              continue;
            }
            const out = runClientTool(name, tu.input);
            if (out.ask !== undefined) {
              ask = { id: tu.id, question: out.ask };
              continue;
            }
            if (out.action) send({ type: "action", action: out.action });
            if (out.step) send({ type: "step", ...out.step });
            results.push({ type: "tool_result", tool_use_id: tu.id, content: out.result });
          }

          messages.push(assistant);
          uncommitted.push(assistant);

          if (ask) {
            // Pause: the answer arrives in the next request together with
            // the other results from this turn.
            send({ type: "append", messages: uncommitted });
            const pending: PendingInput = { toolUseId: ask.id, question: ask.question, partialResults: results };
            send({ type: "await_input", pending });
            uncommitted = [];
            break;
          }

          messages.push({ role: "user", content: results });
          uncommitted.push(messages[messages.length - 1]);
          send({ type: "append", messages: uncommitted });
          uncommitted = [];

          if (turn === MAX_TURNS - 1)
            send({ type: "error", message: "The agent hit its step limit. Reply to let it continue." });
        }
        send({ type: "done" });
      } catch (err) {
        if (!abort.signal.aborted) send({ type: "error", message: friendlyError(err) });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
