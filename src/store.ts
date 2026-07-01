import type { ClientHost } from "@tabterm/module-host/client";
import type { Prompt, PromptCategory } from "../shared.ts";

// Stable empty references — the module store initializes state to {} so these
// buckets are undefined until their first patch. Returning `?? {}` inline would
// allocate a fresh object every getSnapshot call, breaking useSyncExternalStore's
// Object.is snapshot check and causing an infinite render loop on initial mount.
const EMPTY_PROMPTS: Record<string, Prompt> = {};
const EMPTY_CATEGORIES: Record<string, PromptCategory> = {};

export function usePromptsAll(host: ClientHost): Record<string, Prompt> {
  return host.store.use((s) => (s.prompt as Record<string, Prompt> | undefined) ?? EMPTY_PROMPTS);
}

export function useCategoriesAll(host: ClientHost): Record<string, PromptCategory> {
  return host.store.use((s) => (s.promptCategory as Record<string, PromptCategory> | undefined) ?? EMPTY_CATEGORIES);
}
