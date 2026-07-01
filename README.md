# @tabterm/module-prompts

The **prompts** module for [tabterm](https://github.com/and1truong/tabterm) — a personal
library of reusable prompt snippets (`id: prompts`), extracted from the monorepo
(`modules/prompts/`) into its own repository.

- **Global library** — prompts are not workspace- or session-scoped; they are a personal
  set of reusable text snippets, organized into named **categories** (plus a virtual
  **Unsorted** bucket for `categoryId IS NULL`).
- **Command palette + ⌘⇧P** — open the prompt manager modal from the tools menu, the
  command palette ("Open prompt manager"), or the `⌘⇧P` shortcut.
- **Variables** — a prompt body can contain `{{name}}` tokens; the manager prompts for each
  variable and substitutes before copying. Tags and a per-prompt copy count round it out.

The server half owns two tables (`prompt_categories`, `prompts`), routes `prompt:*` /
`promptCategory:*` messages to a small service, and exposes a `GET /list` route that returns
every category + prompt for the initial client load. Mutations broadcast via `host.sync`.

## Layout

```
shared.ts            Prompts domain + wire types (Prompt, PromptCategory,
                     the prompt:* / promptCategory:* message union)
server.ts            Server entry — activate(host): migrate, wire the service to
                     prompt:*/promptCategory:* messages, register GET /list
server/db.ts         SQLite data layer over the two tables (create/update/delete/copy)
server/migrations.ts The prompt_categories + prompts schema (v1)
server/service.ts    Maps client messages to db ops + host.sync effects
src/index.tsx        Client entry — activate(host): registers the modal, tools-menu
                     item, palette action, and ⌘⇧P shortcut
src/PromptManager.tsx     The prompt-manager modal UI (categories + prompt list)
src/store.ts              host.store selectors for prompts/categories
src/promptVars.ts         {{name}} token parse + substitute (unit-tested)
src/promptUtils.ts        tag parsing + prompt search/filter helpers (unit-tested)
src/{clipboard,relTime,uuid,useHost}.*   copy + UI helpers
scripts/build-modules.ts  Builds the two self-contained dist artifacts
```

The module talks to the host **only** through `@tabterm/module-host` (the type-only
contract) plus its own files — no deep imports into tabterm's `src/`. It owns its
DB schema (`host.migrate`), its message routing (`host.onMessage`), its route
(`host.registerRoute`), and its UI (`host.ui.registerUI` / `registerPaletteAction` /
`registerShortcut`). See `docs/modules.md` in tabterm for the full host API.

## Development

```sh
bun install        # resolves lucide-react + links @tabterm/module-host
bun run typecheck  # tsc --noEmit
bun test           # prompts service + var/util tests
make build         # -> dist/modules/prompts/{client.js,server.js}
```

`@tabterm/module-host` (the type-only host contract) is **vendored** under
`vendor/module-host/` and resolved via `file:./vendor/module-host` (see `package.json`
devDependencies) — no npm/registry dependency. To update it, run
`make vendor TABTERM=<path-to-tabterm>`.

## Consuming this module in tabterm

Unlike a monorepo module, this repo builds its own artifacts. `make build` emits two
self-contained files under `dist/modules/prompts/`:

- **`client.js`** — ESM client bundle. `react`/`react-dom` stay external (host-provided at
  runtime); `lucide-react` is inlined. No CSS (Tailwind classes only). Default export is
  `activate(host)`.
- **`server.js`** — server half (`--target bun` ESM). Default export is `activate(host)`.

Point tabterm's config at them:

```yaml
modules:
  - { id: prompts, enabled: true,
      client: ~/dirs/tabterm-prompts/dist/modules/prompts/client.js,
      server: ~/dirs/tabterm-prompts/dist/modules/prompts/server.js }
```

Rebuild here (`make build`) whenever the module changes; tabterm picks up the new bundles
on its next load.
