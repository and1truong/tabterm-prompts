import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import type { Prompt, PromptCategory } from "../shared.ts";

// ---- Row types ---------------------------------------------------------------

interface PromptCategoryRow {
  id: string; label: string; position: number; created_at: number;
}
interface PromptRow {
  id: string; category_id: string | null; label: string; body: string;
  tags: string; copy_count: number; created_at: number; updated_at: number;
}

// ---- Mappers -----------------------------------------------------------------

function toPromptCategory(r: PromptCategoryRow): PromptCategory {
  return { id: r.id, label: r.label, position: r.position, createdAt: r.created_at };
}
function toPrompt(r: PromptRow): Prompt {
  let tags: string[] = [];
  try { tags = JSON.parse(r.tags) ?? []; } catch { tags = []; }
  return {
    id: r.id, categoryId: r.category_id, label: r.label, body: r.body, tags,
    copyCount: r.copy_count, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ---- Factory -----------------------------------------------------------------

export function makePromptsDb(db: Database) {
  const q = {
    allPromptCategories: db.query<PromptCategoryRow, []>(
      "SELECT * FROM prompt_categories ORDER BY position",
    ),
    allPrompts: db.query<PromptRow, []>("SELECT * FROM prompts ORDER BY updated_at DESC"),
    getPromptCategory: db.query<PromptCategoryRow, [string]>(
      "SELECT * FROM prompt_categories WHERE id = ?",
    ),
    insertPromptCategory: db.query(
      "INSERT INTO prompt_categories (id, label, position) VALUES (?, ?, ?)",
    ),
    updatePromptCategoryLabel: db.query("UPDATE prompt_categories SET label = ? WHERE id = ?"),
    updatePromptCategoryPos: db.query("UPDATE prompt_categories SET position = ? WHERE id = ?"),
    deletePromptCategoryRow: db.query("DELETE FROM prompt_categories WHERE id = ?"),
    maxPromptCategoryPos: db.query<{ p: number | null }, []>(
      "SELECT MAX(position) AS p FROM prompt_categories",
    ),
    promptsInCategory: db.query<PromptRow, [string]>(
      "SELECT * FROM prompts WHERE category_id = ?",
    ),
    unsetPromptCategory: db.query("UPDATE prompts SET category_id = NULL WHERE category_id = ?"),

    getPrompt: db.query<PromptRow, [string]>("SELECT * FROM prompts WHERE id = ?"),
    insertPrompt: db.query(
      "INSERT INTO prompts (id, category_id, label, body, tags) VALUES (?, ?, ?, ?, ?)",
    ),
    updatePromptFields: db.query("UPDATE prompts SET label = ?, body = ? WHERE id = ?"),
    updatePromptTags: db.query("UPDATE prompts SET tags = ? WHERE id = ?"),
    setPromptCategory: db.query("UPDATE prompts SET category_id = ? WHERE id = ?"),
    bumpPromptCopyCount: db.query(
      "UPDATE prompts SET copy_count = copy_count + 1 WHERE id = ?",
    ),
    bumpPromptUpdated: db.query("UPDATE prompts SET updated_at = unixepoch() WHERE id = ?"),
    deletePromptRow: db.query("DELETE FROM prompts WHERE id = ?"),
  };

  // ---- CRUD functions --------------------------------------------------------

  function createPromptCategory(label: string, id: string = randomUUID()): PromptCategory {
    const position = (q.maxPromptCategoryPos.get()?.p ?? -1) + 1;
    q.insertPromptCategory.run(id, label, position);
    return toPromptCategory(q.getPromptCategory.get(id)!);
  }

  function updatePromptCategory(
    categoryId: string,
    patch: { label?: string; position?: number },
  ): PromptCategory | null {
    const existing = q.getPromptCategory.get(categoryId);
    if (!existing) return null;
    if (patch.label !== undefined) q.updatePromptCategoryLabel.run(patch.label, categoryId);
    if (patch.position !== undefined) q.updatePromptCategoryPos.run(patch.position, categoryId);
    return toPromptCategory(q.getPromptCategory.get(categoryId)!);
  }

  // Deleting a category reparents its prompts to Unsorted (null) atomically.
  function deletePromptCategory(
    categoryId: string,
  ): { deletedId: string; reparented: Prompt[] } | null {
    if (!q.getPromptCategory.get(categoryId)) return null;
    const childIds = q.promptsInCategory.all(categoryId).map((r) => r.id);
    db.transaction(() => {
      q.unsetPromptCategory.run(categoryId);
      q.deletePromptCategoryRow.run(categoryId);
    })();
    const reparented = childIds
      .map((id) => q.getPrompt.get(id))
      .filter((r): r is PromptRow => r !== null)
      .map(toPrompt);
    return { deletedId: categoryId, reparented };
  }

  function createPrompt(
    input: { categoryId: string | null; label: string; body: string; tags: string[] },
    id: string = randomUUID(),
  ): Prompt {
    q.insertPrompt.run(id, input.categoryId, input.label, input.body, JSON.stringify(input.tags));
    return toPrompt(q.getPrompt.get(id)!);
  }

  function updatePrompt(
    promptId: string,
    patch: { label?: string; body?: string; tags?: string[]; categoryId?: string | null },
  ): Prompt | null {
    const existing = q.getPrompt.get(promptId);
    if (!existing) return null;
    const touched =
      patch.label !== undefined || patch.body !== undefined || patch.tags !== undefined;
    if (patch.label !== undefined || patch.body !== undefined) {
      q.updatePromptFields.run(patch.label ?? existing.label, patch.body ?? existing.body, promptId);
    }
    if (patch.tags !== undefined) q.updatePromptTags.run(JSON.stringify(patch.tags), promptId);
    if (patch.categoryId !== undefined && patch.categoryId !== existing.category_id) {
      q.setPromptCategory.run(patch.categoryId, promptId);
    }
    if (touched) q.bumpPromptUpdated.run(promptId);
    return toPrompt(q.getPrompt.get(promptId)!);
  }

  function bumpPromptCopy(promptId: string): Prompt | null {
    if (!q.getPrompt.get(promptId)) return null;
    q.bumpPromptCopyCount.run(promptId); // NOTE: no updated_at bump — by design
    return toPrompt(q.getPrompt.get(promptId)!);
  }

  function deletePrompt(promptId: string): { deletedId: string } | null {
    if (!q.getPrompt.get(promptId)) return null;
    q.deletePromptRow.run(promptId);
    return { deletedId: promptId };
  }

  function listAll(): { prompts: Prompt[]; categories: PromptCategory[] } {
    return {
      prompts: q.allPrompts.all().map(toPrompt),
      categories: q.allPromptCategories.all().map(toPromptCategory),
    };
  }

  return {
    createPromptCategory,
    updatePromptCategory,
    deletePromptCategory,
    createPrompt,
    updatePrompt,
    bumpPromptCopy,
    deletePrompt,
    listAll,
  };
}
