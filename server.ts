import type { ServerHost } from "@tabterm/module-host/server";
import { migrations } from "./server/migrations.ts";
import { makePromptsDb } from "./server/db.ts";
import { makePromptsService } from "./server/service.ts";

export default function activate(host: ServerHost) {
  host.migrate(migrations);
  const pdb = makePromptsDb(host.db);
  const service = makePromptsService(pdb, host.sync);
  const off = host.onMessage(["prompt", "promptCategory"], (msg) => service.handle(msg));
  host.registerRoute("GET", "/list", () => {
    const { prompts, categories } = pdb.listAll();
    return Response.json({ prompts, categories });
  });
  return () => off();
}
