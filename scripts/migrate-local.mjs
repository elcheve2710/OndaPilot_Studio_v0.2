import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Applies drizzle/ migrations to the local D1 database that `npm run dev` uses (.wrangler/state).
const root = fileURLToPath(new URL("..", import.meta.url));
const hostingPath = `${root}.openai/hosting.json`;
const { d1 = "DB" } = existsSync(hostingPath) ? JSON.parse(readFileSync(hostingPath, "utf8")) : {};
const config = `${root}.wrangler/local-d1.json`;

mkdirSync(`${root}.wrangler`, { recursive: true });
writeFileSync(config, JSON.stringify({
  name: "ondapilot-local",
  compatibility_date: "2026-05-15",
  // Must match the placeholder database in vite.config.ts so both point at the same local file.
  d1_databases: [{ binding: d1, database_name: "site-creator-d1", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: "../drizzle" }],
}, null, 2));

const result = spawnSync(process.execPath, [
  `${root}node_modules/wrangler/bin/wrangler.js`, "d1", "migrations", "apply", d1,
  "--local", "--config", config, "--persist-to", `${root}.wrangler/state`,
], { stdio: "inherit", env: { ...process.env, CI: "1" } });
process.exit(result.status ?? 1);
