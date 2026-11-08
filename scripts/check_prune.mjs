// First live test of the Prune key.
//   npm run check:prune
// Sends the same tiny question twice through the Prune proxy, exactly like the app does,
// and shows whether it works, the receipt headers, and whether the second call was cached.
// The key is read from .env and is never printed.
import { readFileSync, existsSync } from "node:fs";
import { normalizeWithPrune } from "../src/askcity.mjs";

const envFile = new URL("../.env", import.meta.url);
const env = { ...process.env };
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!env.PRUNE_API_KEY) {
  console.error("Put PRUNE_API_KEY=... in .env first.");
  process.exit(1);
}

const question = "tiraron basura en la esquina";
for (const round of [1, 2]) {
  try {
    const out = await normalizeWithPrune({ text: question, env });
    console.log(`\nCall ${round}: OK in ${out.latency_ms} ms`);
    console.log("  need:", out.need);
    console.log("  cached:", out.cached);
    console.log("  receipt:", JSON.stringify(out.receipt));
  } catch (e) {
    console.log(`\nCall ${round}: FAILED (${e.message})`);
    if (/401|403/.test(e.message)) console.log("  The Prune key was rejected, or no provider is connected. In Prune: Connect -> Providers (add the provider), then Connect -> API Keys.");
    if (/404/.test(e.message)) console.log("  Wrong path. Ask the Prune table for the OpenAI-compatible URL and put it in PRUNE_BASE_URL.");
    if (/400|422/.test(e.message)) console.log("  The model name may be wrong. Ask Prune which model to use and set PRUNE_MODEL.");
    process.exit(1);
  }
}
console.log("\nIf call 2 says cached: true (or the receipt shows a cache hit), Prune is fully working.");
console.log("If both calls work but nothing says cached, the app still works; show the Prune dashboard (Requests) as evidence.");
