import { useEffect, useMemo, useState } from "react";
import { Copy, Folder, Layers, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useHost } from "./useHost.ts";
import { usePromptsAll, useCategoriesAll } from "./store.ts";
import { uuid } from "./uuid.ts";
import { relTime } from "./relTime.ts";
import { copyText } from "./clipboard.ts";
import { parseVariables, substituteVariables } from "./promptVars.ts";
import { defaultNewPromptCategoryId, filterPrompts, hotPromptIds, parseTags, sortPrompts, type PromptSort } from "./promptUtils.ts";
import type { Prompt, PromptCategory } from "../shared.ts";

// Modal id used by the host to open/close this surface (⌘⇧P, Tools menu, palette).
export const MODAL_ID = "prompts";

type CatSel = "all" | "unsorted" | string;
type EditDraft = { id: string | null; label: string; body: string; tagsStr: string; categoryId: string | null };

export function PromptManager() {
  const host = useHost();
  const dismiss = () => host.ui.closeModal(MODAL_ID);
  const prompts = usePromptsAll(host);
  const categories = useCategoriesAll(host);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PromptSort>("used");
  const [cat, setCat] = useState<CatSel>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newCatLabel, setNewCatLabel] = useState<string | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  const all = useMemo(() => Object.values(prompts), [prompts]);
  const scoped = useMemo(() => {
    if (cat === "all") return all;
    if (cat === "unsorted") return all.filter((p) => p.categoryId === null);
    return all.filter((p) => p.categoryId === cat);
  }, [all, cat]);
  const filtered = useMemo(() => filterPrompts(scoped, query), [scoped, query]);
  const sorted = useMemo(() => sortPrompts(filtered, sort), [filtered, sort]);
  const hot = useMemo(() => hotPromptIds(scoped), [scoped]);
  const catList = useMemo(() => Object.values(categories).sort((a, b) => a.position - b.position), [categories]);

  useEffect(() => {
    if (sorted.length === 0) { if (selectedId !== null) setSelectedId(null); return; }
    if (!selectedId || !sorted.some((p) => p.id === selectedId)) setSelectedId(sorted[0].id);
  }, [sorted, selectedId]);

  const selected = selectedId ? prompts[selectedId] ?? null : null;
  const vars = useMemo(() => (selected ? parseVariables(selected.body) : []), [selected]);
  useEffect(() => { setVarValues({}); }, [selectedId]);
  const countFor = (sel: CatSel) =>
    sel === "all" ? all.length : sel === "unsorted" ? all.filter((p) => p.categoryId === null).length
      : all.filter((p) => p.categoryId === sel).length;

  const doCopy = async (p: Prompt) => {
    const ok = await copyText(substituteVariables(p.body, varValues));
    host.send({ type: "prompt:copy", promptId: p.id });
    setToast(ok ? `Copied "${p.label}"` : `Copy failed — select & ⌘C`);
    window.setTimeout(() => setToast(null), 1600);
  };
  const startEdit = (p: Prompt | null) =>
    setEdit({ id: p?.id ?? null, label: p?.label ?? "", body: p?.body ?? "", tagsStr: (p?.tags ?? []).join(", "), categoryId: p ? p.categoryId : defaultNewPromptCategoryId(cat) });
  const saveEdit = () => {
    if (!edit) return;
    const label = edit.label.trim();
    if (!label) return;
    const tags = parseTags(edit.tagsStr);
    if (edit.id) {
      host.send({ type: "prompt:update", promptId: edit.id, label, body: edit.body, tags, categoryId: edit.categoryId });
    } else {
      const id = uuid();
      host.send({ type: "prompt:create", id, categoryId: edit.categoryId, label, body: edit.body, tags });
      setSelectedId(id);
    }
    setEdit(null);
  };

  const addCategory = () => {
    const label = (newCatLabel ?? "").trim();
    if (!label) return;
    host.send({ type: "promptCategory:create", id: uuid(), label });
    setNewCatLabel(null);
  };
  const onDeleteCategory = (id: string) => {
    host.send({ type: "promptCategory:delete", categoryId: id });
    if (cat === id) setCat("all");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (edit) { if (e.key === "Escape") { e.preventDefault(); setEdit(null); } return; }
    if (e.key === "Escape") { e.preventDefault(); dismiss(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!sorted.length) return;
      const idx = sorted.findIndex((p) => p.id === selectedId);
      const next = e.key === "ArrowDown" ? (idx + 1) % sorted.length : (idx - 1 + sorted.length) % sorted.length;
      setSelectedId(sorted[next].id);
    } else if (e.key === "Enter" && selected) {
      e.preventDefault();
      void doCopy(selected);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4" onClick={dismiss} onKeyDown={onKey} tabIndex={-1}>
      <div onClick={(e) => e.stopPropagation()} className="relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl overflow-hidden"
        style={{ width: "min(1120px, 97vw)", height: "min(86vh, 860px)" }}>

        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <span className="w-7 h-7 rounded-lg grid place-items-center bg-[var(--brand-bg)] text-[var(--brand-fg)] text-sm">✦</span>
          <h1 className="text-[15px] font-semibold">Prompt manager</h1>
          <span className="text-[11px] text-[var(--faint)] bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5">⌘⇧P</span>
          <div className="ml-auto flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2.5 h-9" style={{ width: "min(420px, 40vw)" }}>
            <Search size={14} className="text-[var(--muted)] shrink-0" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, tag, or content…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[var(--text)] placeholder:text-[var(--faint)]" />
          </div>
          <button onClick={dismiss} title="Close (esc)" className="w-8 h-8 grid place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"><X size={15} /></button>
        </div>

        {/* body */}
        <div className="flex-1 flex min-h-0">
          {/* categories */}
          <div className="w-56 shrink-0 border-r border-[var(--border)] p-2 overflow-y-auto">
            <div className="px-2 pt-1 text-[11px] uppercase tracking-wide text-[var(--faint)]" style={{ paddingBottom: 8 }}>Categories</div>
            <CatRow icon={<Layers size={14} />} label="All" count={countFor("all")} active={cat === "all"} onClick={() => setCat("all")} />
            {catList.map((c) => (
              <CatRow key={c.id} icon={<Folder size={14} />} label={c.label} count={countFor(c.id)} active={cat === c.id} onClick={() => setCat(c.id)} onDelete={() => onDeleteCategory(c.id)} />
            ))}
            <CatRow icon={<Folder size={14} />} label="Unsorted" count={countFor("unsorted")} active={cat === "unsorted"} onClick={() => setCat("unsorted")} />
            {newCatLabel === null ? (
              <button onClick={() => setNewCatLabel("")} className="flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg text-[13px] text-[var(--accent-soft)] hover:bg-[var(--hover)]"><Plus size={14} /> New category</button>
            ) : (
              <input autoFocus value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} onBlur={addCategory}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } if (e.key === "Escape") setNewCatLabel(null); }}
                placeholder="Category name" className="mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[13px] outline-none" />
            )}
          </div>

          {/* list */}
          <div className="w-[336px] shrink-0 border-r border-[var(--border)] flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
              <span className="text-[12px] text-[var(--faint)]">Sort</span>
              <div className="flex bg-[var(--bg)] border border-[var(--border)] rounded-md p-0.5">
                {(["used", "recent"] as PromptSort[]).map((s) => (
                  <button key={s} onClick={() => setSort(s)} className={`px-2 py-0.5 rounded text-[11px] font-semibold ${sort === s ? "bg-[var(--accent)] text-[#1a1200]" : "text-[var(--faint)]"}`}>{s === "used" ? "Most used" : "Recent"}</button>
                ))}
              </div>
              <button onClick={() => startEdit(null)} className="ml-auto flex items-center gap-1 text-[var(--accent)] text-[12px] font-semibold px-2 py-1 rounded-md hover:bg-[var(--hover)]"><Plus size={13} /> New</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sorted.length === 0 && <div className="text-[13px] text-[var(--faint)] px-4 text-center" style={{ paddingTop: 32, paddingBottom: 32 }}>No prompts.</div>}
              {sorted.map((p) => (
                <div key={p.id} onClick={() => setSelectedId(p.id)} onDoubleClick={() => startEdit(p)}
                  className={`px-3 py-2.5 border-b border-[var(--border)] cursor-pointer ${selectedId === p.id ? "bg-[var(--hover)] shadow-[inset_2px_0_0_var(--accent)]" : "hover:bg-[var(--hover)]"}`}>
                  <div className="text-[13.5px] text-[var(--text)] mb-1.5 leading-tight">{p.label}</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.tags.slice(0, 3).map((t) => <span key={t} className="text-[11px] text-[var(--muted)] bg-[var(--bg)] border border-[var(--border)] rounded-full px-1.5">#{t}</span>)}
                    <span className="ml-auto flex items-center gap-2">
                      <span className={`text-[11px] rounded-full px-1.5 border ${hot.has(p.id) ? "bg-[var(--brand-bg)] text-[var(--brand-fg)] border-[var(--accent-soft)] font-semibold" : "bg-[var(--bg)] text-[var(--muted)] border-[var(--border)]"}`}>⎘ {p.copyCount}</span>
                      <span className="text-[11px] text-[var(--faint)]">{relTime(p.updatedAt)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center border-t border-[var(--border)] text-[12px] text-[var(--faint)]" style={{ minHeight: 57, padding: "0 16px" }}>
              {sorted.length === filtered.length ? `${countFor(cat)} prompts` : `${sorted.length} of ${countFor(cat)} prompts`}
            </div>
          </div>

          {/* detail */}
          <div className="flex-1 flex flex-col min-w-0">
            {edit ? (
              <PromptEditor edit={edit} setEdit={setEdit} onSave={saveEdit} onCancel={() => setEdit(null)} categories={catList}
                onDelete={selected ? () => { host.send({ type: "prompt:delete", promptId: selected.id }); setEdit(null); } : undefined} />
            ) : selected ? (
              <>
                <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
                  <h2 className="text-lg font-semibold" style={{ marginBottom: 10 }}>{selected.label}</h2>
                  <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 14 }}>
                    {selected.categoryId && categories[selected.categoryId] && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--brand-fg)] bg-[var(--brand-bg)] border border-[var(--accent-soft)] rounded px-2 py-0.5 font-semibold"><Folder size={11} /> {categories[selected.categoryId]!.label}</span>
                    )}
                    {selected.tags.map((t) => <span key={t} className="text-[11px] text-[var(--muted)] bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-0.5">#{t}</span>)}
                  </div>
                  <pre className="mono text-[12.5px] leading-[1.55] text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded-lg whitespace-pre-wrap" style={{ padding: 14 }}>{selected.body}</pre>
                  {vars.length > 0 && (
                    <div className="border-t border-[var(--border)]" style={{ marginTop: 16, paddingTop: 16 }}>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--faint)]" style={{ marginBottom: 8 }}>Variables <span className="normal-case tracking-normal">— filled in on copy</span></div>
                      <div className="flex flex-col gap-2.5">
                        {vars.map((name) => (
                          <label key={name} className="flex flex-col gap-1">
                            <span className="mono text-[11px] text-[var(--muted)]">{`{{${name}}}`}</span>
                            <input value={varValues[name] ?? ""} onChange={(e) => setVarValues((v) => ({ ...v, [name]: e.target.value }))} placeholder={name}
                              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2.5 px-4 border-t border-[var(--border)]" style={{ minHeight: 57 }}>
                  <span className="text-[12px] text-[var(--faint)]"><b className={hot.has(selected.id) ? "text-[var(--accent)]" : "text-[var(--muted)]"}>Copied {selected.copyCount} times</b> · Last modified {relTime(selected.updatedAt)}</span>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => void doCopy(selected)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border-2)] text-[13px] hover:bg-[var(--hover)]"><Copy size={14} /> Copy</button>
                    <button onClick={() => startEdit(selected)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--accent)] text-[#1a1200] text-[13px] font-semibold"><Pencil size={14} /> Edit</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 grid place-items-center text-[var(--faint)] text-sm">Select or create a prompt.</div>
            )}
          </div>
        </div>

        {toast && <div className="absolute left-1/2 bottom-4 -translate-x-1/2 bg-[var(--accent)] text-[#1a1200] text-[12.5px] font-semibold py-1.5 rounded-lg shadow-lg" style={{ paddingLeft: 14, paddingRight: 14 }}>{toast}</div>}
      </div>
    </div>
  );
}

function CatRow({ icon, label, count, active, onClick, onDelete }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void; onDelete?: () => void }) {
  return (
    <div className="group relative flex items-center">
      <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] ${active ? "bg-[var(--active)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}>
        <span className={active ? "text-[var(--accent)]" : "text-[var(--faint)]"}>{icon}</span>
        <span className="flex-1 text-left truncate">{label}</span>
        <span className={`text-[11px] text-[var(--faint)] bg-[var(--bg)] border border-[var(--border)] rounded-full px-1.5 transition-opacity duration-150 ${onDelete ? "group-hover:opacity-0" : ""}`}>{count}</span>
      </button>
      {onDelete && (
        <button onClick={onDelete} title="Delete category (moves prompts to Unsorted)"
          className="pointer-events-none group-hover:pointer-events-auto absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded text-[var(--faint)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:text-[var(--orange)]">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function PromptEditor({ edit, setEdit, onSave, onCancel, categories, onDelete }: {
  edit: EditDraft; setEdit: (d: EditDraft) => void; onSave: () => void; onCancel: () => void;
  categories: PromptCategory[]; onDelete?: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-[14px] font-semibold">{edit.id ? "Edit prompt" : "New prompt"}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        <label className="text-[11px] uppercase tracking-wide text-[var(--faint)] mb-1.5">Label</label>
        <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
        <label className="text-[11px] uppercase tracking-wide text-[var(--faint)] mb-1.5" style={{ marginTop: 16 }}>Body <span className="normal-case tracking-normal text-[var(--faint)]">— copied to clipboard on select</span></label>
        <textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="mono flex-1 min-h-[180px] w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] leading-[1.55] outline-none focus:border-[var(--accent)] resize-none" />
        <label className="text-[11px] uppercase tracking-wide text-[var(--faint)] mb-1.5" style={{ marginTop: 16 }}>Tags <span className="normal-case tracking-normal text-[var(--faint)]">— comma-separated</span></label>
        <input value={edit.tagsStr} onChange={(e) => setEdit({ ...edit, tagsStr: e.target.value })} placeholder="git, react" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
        <label className="text-[11px] uppercase tracking-wide text-[var(--faint)] mb-1.5" style={{ marginTop: 16 }}>Category</label>
        <select value={edit.categoryId ?? ""} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-[13px] outline-none focus:border-[var(--accent)]">
          <option value="">Unsorted</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 px-4 border-t border-[var(--border)]" style={{ minHeight: 57 }}>
        {onDelete && <button onClick={onDelete} className="text-[13px] text-[var(--orange)] hover:underline">Delete</button>}
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="h-8 px-3 rounded-lg border border-[var(--border-2)] text-[13px] hover:bg-[var(--hover)]">Cancel</button>
          <button onClick={onSave} className="h-8 px-3 rounded-lg bg-[var(--accent)] text-[#1a1200] text-[13px] font-semibold">Save</button>
        </div>
      </div>
    </div>
  );
}
