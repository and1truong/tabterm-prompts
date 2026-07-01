// Prompt-manager domain + wire types. Source of truth once core's copies are
// removed. Prompts are global (not workspace- or session-scoped): a personal
// library of reusable text snippets, organized into named categories.

export interface PromptCategory {
  id: string;
  label: string;
  position: number;
  createdAt: number;
}

export interface Prompt {
  id: string;
  categoryId: string | null; // null = "Unsorted"
  label: string;
  body: string;
  tags: string[];
  copyCount: number;
  createdAt: number;
  updatedAt: number;
}

// Client -> server (prompt:* / promptCategory:* members).
export type PromptClientMessage =
  | { type: "prompt:create"; id: string; categoryId: string | null; label: string; body: string; tags: string[] }
  | { type: "prompt:update"; promptId: string; label?: string; body?: string; tags?: string[]; categoryId?: string | null }
  | { type: "prompt:delete"; promptId: string }
  | { type: "prompt:copy"; promptId: string }
  | { type: "promptCategory:create"; id: string; label: string }
  | { type: "promptCategory:update"; categoryId: string; label?: string; position?: number }
  | { type: "promptCategory:delete"; categoryId: string };
