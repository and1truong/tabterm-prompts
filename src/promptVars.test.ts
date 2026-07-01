import { describe, test, expect } from "bun:test";
import { parseVariables, substituteVariables } from "./promptVars.ts";

describe("parseVariables", () => {
  test("no variables → empty", () => {
    expect(parseVariables("just plain text")).toEqual([]);
  });
  test("one variable", () => {
    expect(parseVariables("learn about {{topic}}")).toEqual(["topic"]);
  });
  test("multiple variables in first-seen order", () => {
    expect(parseVariables("{{a}} then {{b}} then {{c}}")).toEqual(["a", "b", "c"]);
  });
  test("repeated variable is deduped", () => {
    expect(parseVariables("{{topic}} and again {{topic}}")).toEqual(["topic"]);
  });
  test("trims spaces inside braces", () => {
    expect(parseVariables("{{ topic }}")).toEqual(["topic"]);
    expect(parseVariables("{{ topic }} vs {{topic}}")).toEqual(["topic"]);
  });
});

describe("substituteVariables", () => {
  test("fills provided values", () => {
    expect(substituteVariables("learn about {{topic}}", { topic: "rust" })).toBe("learn about rust");
  });
  test("replaces every occurrence of a repeated token", () => {
    expect(substituteVariables("{{x}}-{{x}}", { x: "1" })).toBe("1-1");
  });
  test("missing value leaves the token literal", () => {
    expect(substituteVariables("hi {{name}}", {})).toBe("hi {{name}}");
  });
  test("empty / whitespace-only value leaves the token literal", () => {
    expect(substituteVariables("hi {{name}}", { name: "" })).toBe("hi {{name}}");
    expect(substituteVariables("hi {{name}}", { name: "   " })).toBe("hi {{name}}");
  });
  test("substitutes some, leaves others literal", () => {
    expect(substituteVariables("{{a}} {{b}}", { a: "X" })).toBe("X {{b}}");
  });
  test("matches spaced tokens too", () => {
    expect(substituteVariables("hi {{ name }}", { name: "Sam" })).toBe("hi Sam");
  });
});
