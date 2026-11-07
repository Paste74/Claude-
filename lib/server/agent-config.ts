import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AgentId } from "../types";

type Tool = Anthropic.Beta.Messages.BetaToolUnion;

// ---- Client tools: executed by applying an action to the user's task ----

export const ToolInputs = {
  add_subtasks: z.object({
    subtasks: z
      .array(
        z.object({
          title: z.string().min(1),
          estimate_minutes: z.number().int().positive().optional(),
        }),
      )
      .min(1)
      .max(20),
  }),
  update_task: z.object({
    title: z.string().min(1).optional(),
    priority: z.number().int().min(1).max(4).optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    notes_append: z.string().optional(),
  }),
  save_deliverable: z.object({
    title: z.string().min(1),
    content: z.string().min(1),
  }),
  create_task: z.object({
    title: z.string().min(1),
    notes: z.string().optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    priority: z.number().int().min(1).max(4).optional(),
  }),
  ask_user: z.object({
    question: z.string().min(1),
  }),
} as const;

export type ClientToolName = keyof typeof ToolInputs;

const CLIENT_TOOLS: Record<ClientToolName, Tool> = {
  add_subtasks: {
    name: "add_subtasks",
    description:
      "Append subtasks (checklist items) to the user's task. Each subtask should be a concrete, verb-first action that can be completed in one sitting. Optionally include a time estimate in minutes.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        subtasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              estimate_minutes: { type: "integer" },
            },
            required: ["title"],
          },
        },
      },
      required: ["subtasks"],
    },
  },
  update_task: {
    name: "update_task",
    description:
      "Update fields on the user's task. priority: 1 urgent, 2 high, 3 medium, 4 none. due_date: YYYY-MM-DD, or null to clear it. notes_append: text appended to the task's notes. Only change what is clearly useful; don't overwrite choices the user already made without a reason.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        priority: { type: "integer", enum: [1, 2, 3, 4] },
        due_date: { type: ["string", "null"] },
        notes_append: { type: "string" },
      },
    },
  },
  save_deliverable: {
    name: "save_deliverable",
    description:
      "Save a finished work product to the task as a deliverable the user can copy, such as a draft email, research brief, plan or document. Content is GitHub-flavored markdown. Call this once per finished piece; to revise, save a new version with the same title.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title", "content"],
    },
  },
  create_task: {
    name: "create_task",
    description:
      "Create a separate follow-up task in the same list as the current task, for work that is distinct from it (for example 'Book the venue' after researching venues). Use sparingly.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        notes: { type: "string" },
        due_date: { type: "string" },
        priority: { type: "integer", enum: [1, 2, 3, 4] },
      },
      required: ["title"],
    },
  },
  ask_user: {
    name: "ask_user",
    description:
      "Ask the user one short question when you cannot do good work without their answer (for example a missing recipient, budget or preference). The run pauses until they reply. Don't ask about things you can reasonably assume; state assumptions instead.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
};

const WEB_SEARCH: Tool = { type: "web_search_20260209", name: "web_search", max_uses: 6 };
const WEB_FETCH: Tool = { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 };

// ---- Agent definitions ----

const SHARED = `You are an agent inside Tempo, a to-do app. The user hands you one of their tasks and you do real work on it, using tools to change the task directly. The user sees your tool calls as they happen, and reads your messages in a narrow side panel.

How to work:
- Do the work rather than describing what you would do. Anything the user should keep goes into the task through tools: subtasks, field updates, or a saved deliverable.
- When something important is missing, make a reasonable assumption and say what you assumed. Use ask_user only when a wrong guess would waste the work.
- You cannot send emails, make purchases, book things or contact anyone. Prepare everything so the user can do that in one step.
- Finish with a brief message (two to four sentences, or a few bullets): what you did, and what the user should do next. Don't repeat the content of a deliverable in your message.
- Write plainly and concretely. Use markdown sparingly in messages.`;

interface AgentConfig {
  system: string;
  tools: Tool[];
  effort: "low" | "medium" | "high";
}

export const AGENT_CONFIG: Record<AgentId, AgentConfig> = {
  copilot: {
    effort: "medium",
    system: `${SHARED}

Your role: Copilot, a generalist. Decide what would move this task furthest toward done: plan it into subtasks, research it on the web, draft what it needs, or a combination. Prefer producing the actual output (a draft, a brief, a decision) over only planning. Keep scope to the task you were given.`,
    tools: [
      CLIENT_TOOLS.add_subtasks,
      CLIENT_TOOLS.update_task,
      CLIENT_TOOLS.save_deliverable,
      CLIENT_TOOLS.create_task,
      CLIENT_TOOLS.ask_user,
      WEB_SEARCH,
      WEB_FETCH,
    ],
  },
  planner: {
    effort: "medium",
    system: `${SHARED}

Your role: Planner. Turn the task into a short, ordered checklist with add_subtasks: usually 3 to 8 steps, each concrete and verb-first, with realistic minute estimates. Skip steps the task's existing subtasks already cover. If the task has no due date or priority and a sensible one is clear from context, set it with update_task and say why. Mention the first step the user should take.`,
    tools: [CLIENT_TOOLS.add_subtasks, CLIENT_TOOLS.update_task, CLIENT_TOOLS.create_task, CLIENT_TOOLS.ask_user],
  },
  researcher: {
    effort: "high",
    system: `${SHARED}

Your role: Researcher. Use web_search and web_fetch to gather current, reliable information for the task, then save one brief with save_deliverable. The brief should lead with the answer or recommendation, compare options in a small table when there are several, and cite sources as markdown links inline. Prefer primary and recent sources, and note when information may be out of date. Keep it scannable: aim for under 400 words.`,
    tools: [CLIENT_TOOLS.save_deliverable, CLIENT_TOOLS.add_subtasks, CLIENT_TOOLS.ask_user, WEB_SEARCH, WEB_FETCH],
  },
  writer: {
    effort: "medium",
    system: `${SHARED}

Your role: Writer. Produce the piece of writing the task needs (an email, message, post, outline or document) and save it with save_deliverable. Match the register to the audience; default to warm, clear and brief. For emails, include a subject line at the top as "**Subject:** ...". Use [brackets] for details only the user can fill in, and keep them few.`,
    tools: [CLIENT_TOOLS.save_deliverable, CLIENT_TOOLS.update_task, CLIENT_TOOLS.ask_user],
  },
};
