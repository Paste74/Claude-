import {
  BookOpen,
  FilePlus2,
  FileText,
  Globe,
  Info,
  ListChecks,
  PenLine,
  Route,
  Search,
  Sparkles,
  SquarePen,
  Telescope,
} from "lucide-react";
import type { AgentId, StepIcon } from "@/lib/types";

export function AgentGlyph({ agentId, size }: { agentId: AgentId; size: number }) {
  const props = { width: size, height: size, strokeWidth: 2.2 };
  switch (agentId) {
    case "copilot":
      return <Sparkles {...props} />;
    case "planner":
      return <Route {...props} />;
    case "researcher":
      return <Telescope {...props} />;
    case "writer":
      return <PenLine {...props} />;
  }
}

export function StepGlyph({ icon, className }: { icon: StepIcon; className?: string }) {
  const p = { className: className ?? "h-3.5 w-3.5", strokeWidth: 2 };
  switch (icon) {
    case "search":
      return <Search {...p} />;
    case "read":
      return <BookOpen {...p} />;
    case "subtasks":
      return <ListChecks {...p} />;
    case "edit":
      return <SquarePen {...p} />;
    case "deliverable":
      return <FileText {...p} />;
    case "task":
      return <FilePlus2 {...p} />;
    case "info":
      return <Info {...p} />;
  }
}

export { Globe };
