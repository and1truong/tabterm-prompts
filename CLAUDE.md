# tabterm-prompts

The **prompts** module for [tabterm](https://github.com/and1truong/tabterm), extracted into
its own repository — a personal library of reusable prompt snippets (`id: prompts`):
named categories, `{{variable}}` interpolation, tags, and a copy count over a global set of
saved prompts. A tabterm *module*, not a standalone app: it has no server/SPA of its own; it
activates inside a tabterm host through the `@tabterm/module-host` contract.

## Toolchain

- **Runtime + package manager: [Bun](https://bun.sh)** (required ≥1.3.5, see `package.json` engines).
  Use `bun` for everything. Do **not** use `npm`, `yarn`, or `pnpm`. Lockfile is `bun.lock`.
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`) — or `make typecheck`.
- **Test:** `bun test` (service + var/util tests) — or `make test`.
- **Full local gate:** `make check` (typecheck + test).
- **Build:** `make build` → `dist/modules/prompts/{client.js,server.js}`.
- `make help` lists every target.

## Architecture

The module talks to the host **only** through `@tabterm/module-host` plus its own files —
no deep imports into a host's `src/`. It owns everything it needs:

- `shared.ts` — the prompts domain + wire types (`Prompt`, `PromptCategory`, and the
  `prompt:*` / `promptCategory:*` message union). Copied from the host at extraction so
  the module has no deep import.
- `server.ts` — server entry: `activate(host)` runs the migration, builds the db + service,
  routes `prompt`/`promptCategory` messages through `host.onMessage`, and registers a
  `GET /list` route returning every category + prompt for the client's initial load.
- `server/db.ts` — the SQLite data layer over the two tables: create/update/delete/copy for
  prompts and create/update/delete for categories.
- `server/migrations.ts` — the `prompt_categories` + `prompts` schema (v1). Column shapes
  are byte-identical to the tables core used to own, so existing prompt libraries survive
  the cutover untouched.
- `server/service.ts` — maps each client message to db ops and `host.sync` effects
  (`set`/`del`/`toSender`).
- `src/index.tsx` — client entry: `activate(host)` seeds the store from `/list`, then
  registers the prompt-manager **modal**, a tools-menu item, a palette action, and the
  `⌘⇧P` shortcut. UI lives in `PromptManager.tsx`, with `store.ts` selectors over
  `host.store`, plus `promptVars`/`promptUtils`/clipboard/relTime/uuid helpers.

## Host contract (`@tabterm/module-host`)

- **Vendored** under `vendor/module-host/`, resolved via `file:./vendor/module-host` — no
  registry dependency. Pinned to a tagged snapshot (see `vendor/README.md`).
- Refresh it with `make vendor TABTERM=<path-to-tabterm>` when the contract changes, then
  bump `vendor/module-host/package.json` and re-tag.
- `react` / `react-dom` are **host-provided** at runtime (externalized in the module
  build) — declared here as peer/dev deps for typecheck + tests only. `lucide-react` is a
  real dependency and is bundled into `client.js`.

## Building / consuming this module

This repo ships **source** and builds its own **self-contained** artifacts. `make build`
(`scripts/build-modules.ts`) compiles:
- `src/index.tsx` → `dist/modules/prompts/client.js` (ESM, react/react-dom external,
  no code-splitting, no CSS — Tailwind classes only; lucide-react inlined);
- `server.ts` → `dist/modules/prompts/server.js` (`--target bun`).

A tabterm host loads these two files via its `modules:` config. See `README.md`.

## Conventions

- Surgical changes; match existing style. The module's clean host-only boundary is the
  whole point of the extraction — never reach back into a host's internals.
- Tests are colocated (`*.test.ts`) and self-contained (a fake `sync` captures effects as
  tagged tuples, so they assert without any host internals).
