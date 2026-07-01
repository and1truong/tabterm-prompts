// {{name}} template tokens inside a prompt body. The name is trimmed, so
// `{{ topic }}` and `{{topic}}` are the same variable. One source of truth for
// the token shape, shared by parse + substitute so they always agree.
const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

// Variable names found in `body`, in first-appearance order, deduped.
export function parseVariables(body: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const m of body.matchAll(TOKEN)) {
    const name = m[1];
    if (!seen.has(name)) { seen.add(name); names.push(name); }
  }
  return names;
}

// Replace each {{name}} with values[name]. A missing or whitespace-only value
// leaves the original token untouched (lossless — the user can fill it later).
export function substituteVariables(body: string, values: Record<string, string>): string {
  return body.replace(TOKEN, (token, rawName) => {
    const v = values[rawName.trim()];
    return v && v.trim() ? v : token;
  });
}
