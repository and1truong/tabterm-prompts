import type { Effect } from "@tabterm/module-host/server";
import type { PromptClientMessage } from "../shared.ts";
import type { makePromptsDb } from "./db.ts";

type Sync = {
  set(entity: string, data: unknown): Effect;
  del(entity: string, id: string): Effect;
  toSender(msg: unknown): Effect;
};

export function makePromptsService(pdb: ReturnType<typeof makePromptsDb>, sync: Sync) {
  function handle(msg: PromptClientMessage): Effect[] {
    switch (msg.type) {
      case "prompt:create":
        return [sync.set("prompt", pdb.createPrompt({ categoryId: msg.categoryId, label: msg.label, body: msg.body, tags: msg.tags }, msg.id))];
      case "prompt:update": {
        const p = pdb.updatePrompt(msg.promptId, { label: msg.label, body: msg.body, tags: msg.tags, categoryId: msg.categoryId });
        return p ? [sync.set("prompt", p)] : [];
      }
      case "prompt:delete": {
        const r = pdb.deletePrompt(msg.promptId);
        return r ? [sync.del("prompt", r.deletedId)] : [];
      }
      case "prompt:copy": {
        const p = pdb.bumpPromptCopy(msg.promptId);
        return p ? [sync.set("prompt", p)] : [];
      }
      case "promptCategory:create":
        return [sync.set("promptCategory", pdb.createPromptCategory(msg.label, msg.id))];
      case "promptCategory:update": {
        const c = pdb.updatePromptCategory(msg.categoryId, { label: msg.label, position: msg.position });
        return c ? [sync.set("promptCategory", c)] : [];
      }
      case "promptCategory:delete": {
        const r = pdb.deletePromptCategory(msg.categoryId);
        return r ? [...r.reparented.map((p) => sync.set("prompt", p)), sync.del("promptCategory", r.deletedId)] : [];
      }
      default:
        return [];
    }
  }
  return { handle };
}
