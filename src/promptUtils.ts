import type { Prompt } from "../shared.ts";

// "a, b ,,a" → ["a","b"]: split on commas, trim, drop empties, de-dup (order kept).
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const t = raw.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

// Case-insensitive substring match across label, body, or any tag. Empty query = all.
export function filterPrompts(prompts: Prompt[], query: string): Prompt[] {
  const q = query.trim().toLowerCase();
  if (!q) return prompts;
  return prompts.filter(
    (p) =>
      p.label.toLowerCase().includes(q) ||
      p.body.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export type PromptSort = "used" | "recent";

export function sortPrompts(prompts: Prompt[], sort: PromptSort): Prompt[] {
  const copy = [...prompts];
  if (sort === "used") {
    copy.sort((a, b) => b.copyCount - a.copyCount || b.updatedAt - a.updatedAt);
  } else {
    copy.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return copy;
}

// Category to preselect for a new prompt: the one the user is viewing, else null (Unsorted).
// `cat` is the prompt-manager selection — "all", "unsorted", or a category id.
export function defaultNewPromptCategoryId(cat: string): string | null {
  return cat === "all" || cat === "unsorted" ? null : cat;
}

// ids of the `limit` most-used prompts (copyCount > 0), used to badge "hot" rows.
export function hotPromptIds(prompts: Prompt[], limit = 3): Set<string> {
  return new Set(
    sortPrompts(prompts, "used")
      .filter((p) => p.copyCount > 0)
      .slice(0, limit)
      .map((p) => p.id),
  );
}
