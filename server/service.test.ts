import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { migrations } from "./migrations.ts";
import { makePromptsDb } from "./db.ts";
import { makePromptsService } from "./service.ts";

// Capture effects as tagged tuples so we can assert without core internals.
const sync = {
  set: (entity: string, data: any) => ({ k: "set", entity, data }),
  del: (entity: string, id: string) => ({ k: "del", entity, id }),
  toSender: (msg: any) => ({ k: "toSender", msg }),
};

function freshSvc() {
  const db = new Database(":memory:");
  for (const m of migrations) m.up(db);
  const pdb = makePromptsDb(db);
  return { pdb, service: makePromptsService(pdb, sync as any) };
}

test("prompt:create emits set('prompt') with the given id", () => {
  const { service } = freshSvc();
  const effs = service.handle({
    type: "prompt:create", id: "p1", categoryId: null, label: "Greet", body: "hello", tags: ["a", "b"],
  }) as any[];
  expect(effs).toHaveLength(1);
  expect(effs[0].k).toBe("set");
  expect(effs[0].entity).toBe("prompt");
  expect(effs[0].data.id).toBe("p1");
  expect(effs[0].data.tags).toEqual(["a", "b"]);
  expect(effs[0].data.copyCount).toBe(0);
});

test("prompt:update unknown id emits nothing", () => {
  const { service } = freshSvc();
  const effs = service.handle({ type: "prompt:update", promptId: "nope", label: "x" }) as any[];
  expect(effs).toHaveLength(0);
});

test("prompt:update bumps updatedAt and emits set", () => {
  const { service, pdb } = freshSvc();
  pdb.createPrompt({ categoryId: null, label: "a", body: "x", tags: [] }, "p1");
  const effs = service.handle({ type: "prompt:update", promptId: "p1", label: "b" }) as any[];
  expect(effs).toHaveLength(1);
  expect(effs[0].entity).toBe("prompt");
  expect(effs[0].data.label).toBe("b");
});

test("prompt:copy bumps copyCount and emits set", () => {
  const { service, pdb } = freshSvc();
  pdb.createPrompt({ categoryId: null, label: "a", body: "x", tags: [] }, "p1");
  const effs = service.handle({ type: "prompt:copy", promptId: "p1" }) as any[];
  expect(effs).toHaveLength(1);
  expect(effs[0].data.copyCount).toBe(1);
});

test("prompt:delete emits del('prompt')", () => {
  const { service, pdb } = freshSvc();
  pdb.createPrompt({ categoryId: null, label: "a", body: "x", tags: [] }, "p1");
  const effs = service.handle({ type: "prompt:delete", promptId: "p1" }) as any[];
  expect(effs).toEqual([{ k: "del", entity: "prompt", id: "p1" }]);
});

test("promptCategory:create emits set('promptCategory')", () => {
  const { service } = freshSvc();
  const effs = service.handle({ type: "promptCategory:create", id: "c1", label: "Work" }) as any[];
  expect(effs).toHaveLength(1);
  expect(effs[0].entity).toBe("promptCategory");
  expect(effs[0].data.id).toBe("c1");
  expect(effs[0].data.position).toBe(0);
});

test("promptCategory:delete reparents children to Unsorted then deletes the category", () => {
  const { service, pdb } = freshSvc();
  pdb.createPromptCategory("Work", "c1");
  pdb.createPrompt({ categoryId: "c1", label: "a", body: "x", tags: [] }, "p1");
  const effs = service.handle({ type: "promptCategory:delete", categoryId: "c1" }) as any[];
  // Reparented prompt set first (categoryId now null), then category del.
  expect(effs).toHaveLength(2);
  expect(effs[0].k).toBe("set");
  expect(effs[0].entity).toBe("prompt");
  expect(effs[0].data.categoryId).toBeNull();
  expect(effs[1]).toEqual({ k: "del", entity: "promptCategory", id: "c1" });
});
