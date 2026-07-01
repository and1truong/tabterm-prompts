import type { ClientHost } from "@tabterm/module-host/client";
import { Sparkles } from "lucide-react";
import { PromptManager, MODAL_ID } from "./PromptManager.tsx";
import { HostCtx } from "./useHost.ts";

export default function activate(host: ClientHost) {
  // Seed the store once so the prompt library is ready before first open. After
  // this, live edits arrive via module:patch. Idempotent (patches by id).
  (async () => {
    try {
      const res = await fetch("/api/modules/prompts/r/list");
      if (!res.ok) return;
      const { prompts, categories } = await res.json();
      for (const p of prompts ?? []) host.store.patch({ entity: "prompt", op: "set", data: p });
      for (const c of categories ?? []) host.store.patch({ entity: "promptCategory", op: "set", data: c });
    } catch { /* offline / transient — live edits still arrive via module:patch */ }
  })();

  const open = () => host.ui.openModal(MODAL_ID);

  const offUI = host.ui.registerUI({
    modal: {
      id: MODAL_ID,
      component: () => (
        <HostCtx.Provider value={host}>
          <PromptManager />
        </HostCtx.Provider>
      ),
    },
    toolsMenuItem: {
      id: "prompts",
      icon: <Sparkles size={14} className="text-[var(--muted)]" />,
      label: "Prompt Manager",
      onClick: open,
    },
  });
  const offPalette = host.ui.registerPaletteAction({
    id: "prompts:open",
    title: "Open prompt manager",
    run: open,
  });
  // ⌘⇧P — the modifier is implied; the host matches this before its built-ins.
  const offShortcut = host.ui.registerShortcut({
    id: "prompts:toggle",
    key: "p",
    shift: true,
    run: open,
  });

  return () => { offUI(); offPalette(); offShortcut(); };
}
