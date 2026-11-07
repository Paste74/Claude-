import type { AgentId } from "./types";

// Agent catalogue shared by the UI and the server. Prompts and tools live
// in lib/server/agent-config.ts so they never ship to the browser.

export interface AgentMeta {
  id: AgentId;
  name: string;
  tagline: string;
  description: string;
  color: string; // CSS color for the avatar
  suggestions: string[];
}

export const AGENTS: Record<AgentId, AgentMeta> = {
  copilot: {
    id: "copilot",
    name: "Copilot",
    tagline: "Takes the task as far as it can",
    description:
      "A generalist that plans, researches and drafts. It chooses the right approach for the task and asks when it needs your input.",
    color: "#7c5cff",
    suggestions: ["Get this done for me", "What's the fastest way to finish this?"],
  },
  planner: {
    id: "planner",
    name: "Planner",
    tagline: "Breaks work into concrete steps",
    description:
      "Turns a fuzzy task into a short, ordered checklist with time estimates, and suggests a realistic due date and priority.",
    color: "#0ea5e9",
    suggestions: ["Break this into steps", "Plan this for a 2-hour block"],
  },
  researcher: {
    id: "researcher",
    name: "Researcher",
    tagline: "Searches the web and writes a sourced brief",
    description:
      "Searches and reads the web, compares options, and saves a concise brief with citations to the task.",
    color: "#10b981",
    suggestions: ["Research the options", "Find the best three choices and compare them"],
  },
  writer: {
    id: "writer",
    name: "Writer",
    tagline: "Drafts emails, docs and posts",
    description:
      "Writes the thing the task needs: an email, a message, an outline or a document, saved as a draft on the task.",
    color: "#f59e0b",
    suggestions: ["Draft it for me", "Write a short, friendly email"],
  },
};

export const AGENT_LIST = Object.values(AGENTS);
