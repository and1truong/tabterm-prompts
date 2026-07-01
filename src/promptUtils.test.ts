import { describe, test, expect } from "bun:test";
import type { Prompt } from "../shared.ts";
import { defaultNewPromptCategoryId, filterPrompts, hotPromptIds, parseTags, sortPrompts } from "./promptUtils.ts";

const p = (over: Partial<Prompt> = {}): Prompt => ({
  id: "x", categoryId: null, label: "L", body: "b", tags: [], copyCount: 0,
  createdAt: 1, updatedAt: 1, ...over,
});

describe("parseTags", () => {
  test("splits, trims, drops empties, dedupes", () => {
    expect(parseTags(" git , x, ,git ")).toEqual(["git", "x"]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("filterPrompts", () => {
  const list = [p({ id: "a", label: "Refactor", body: "extract", tags: ["react"] }), p({ id: "b", label: "Query", body: "SELECT", tags: ["sql"] })];
  test("matches label, body, or tag (case-insensitive)", () => {
    expect(filterPrompts(list, "refac").map((x) => x.id)).toEqual(["a"]);
    expect(filterPrompts(list, "select").map((x) => x.id)).toEqual(["b"]);
    expect(filterPrompts(list, "sql").map((x) => x.id)).toEqual(["b"]);
  });
  test("empty query returns all", () => {
    expect(filterPrompts(list, "").map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("sortPrompts", () => {
  const list = [p({ id: "a", copyCount: 1, updatedAt: 10 }), p({ id: "b", copyCount: 5, updatedAt: 5 }), p({ id: "c", copyCount: 5, updatedAt: 9 })];
  test("used: by copyCount desc then recency", () => {
    expect(sortPrompts(list, "used").map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
  test("recent: by updatedAt desc", () => {
    expect(sortPrompts(list, "recent").map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
});

describe("defaultNewPromptCategoryId", () => {
  test("inherits the category the user is currently viewing", () => {
    expect(defaultNewPromptCategoryId("cat-x")).toBe("cat-x");
  });
  test("falls back to Unsorted (null) for all/unsorted", () => {
    expect(defaultNewPromptCategoryId("all")).toBeNull();
    expect(defaultNewPromptCategoryId("unsorted")).toBeNull();
  });
});

describe("hotPromptIds", () => {
  test("top 3 by usage with copyCount > 0", () => {
    const list = [p({ id: "a", copyCount: 0 }), p({ id: "b", copyCount: 9 }), p({ id: "c", copyCount: 5 }), p({ id: "d", copyCount: 3 }), p({ id: "e", copyCount: 1 })];
    expect(hotPromptIds(list)).toEqual(new Set(["b", "c", "d"]));
  });
  test("fewer than limit when most are uncopied", () => {
    const list = [p({ id: "a", copyCount: 0 }), p({ id: "b", copyCount: 2 })];
    expect(hotPromptIds(list)).toEqual(new Set(["b"]));
  });
});
