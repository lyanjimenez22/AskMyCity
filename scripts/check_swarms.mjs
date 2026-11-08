// First live test of the Swarms key.
//   npm run check:swarms
// 1. Lists the models your key can use.
// 2. Sends a tiny 2-agent task to each of the three ways AskMyCity can call Swarms
//    and tells you which one works on your account (costs a fraction of a cent).
// The key is read from .env and is never printed.
import { readFileSync, existsSync } from "node:fs";
import { buildGraphRequest, buildSequentialRequest, buildAgentRequest } from "../src/askcity.mjs";

const envFile = new URL("../.env", import.meta.url);
const env = { ...process.env };
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!env.SWARMS_API_KEY) {
  console.error("Put SWARMS_API_KEY=... in .env first (create it at cloud.swarms.world/api-keys).");
  process.exit(1);
}
const base = env.SWARMS_BASE_URL || "https://api.swarms.world";
const model = env.SWARMS_MODEL || "gpt-5.4-mini";
const headers = { "Content-Type": "application/json", "x-api-key": env.SWARMS_API_KEY };

console.log("== 1. Models available to this key ==");
try {
  const res = await fetch(`${base}/v1/models/available`, { headers });
  console.log("HTTP", res.status);
  if (res.status === 401 || res.status === 403) {
    console.log("The key was rejected. Create a new one at cloud.swarms.world/api-keys and paste it again in .env.");
    process.exit(1);
  }
  const text = await res.text();
  console.log(text.slice(0, 1500));
  if (!text.includes(model)) console.log(`\nNote: "${model}" is not in that list. Pick one from the list and set SWARMS_MODEL.`);
} catch (e) {
  console.log("Could not reach Swarms:", e.message);
  process.exit(1);
}

const probe = (name) => ({
  agent_name: name,
  description: "health check",
  system_prompt: "Reply with exactly one word: OK",
  model_name: model,
  max_loops: 1,
  temperature: 0,
  max_tokens: 20,
});
const agents = [probe("ProbeA"), probe("ProbeB")];
const task = "Health check. Reply OK.";
const ways = [
  ["graph", "/v1/graph-workflow/completions", buildGraphRequest({ task, agents })],
  ["swarm", "/v1/swarm/completions", buildSequentialRequest({ task, agents })],
  ["agent", "/v1/agent/completions", buildAgentRequest({ agent: agents[0], task })],
];

console.log(`\n== 2. Which way works on this account (model ${model}) ==`);
const working = [];
for (const [name, path, body] of ways) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    console.log(`\n${name.padEnd(6)} ${path}  HTTP ${res.status}  ${Date.now() - started} ms`);
    console.log("  " + text.slice(0, 300).replace(/\s+/g, " "));
    if (res.ok) working.push(name);
  } catch (e) {
    console.log(`\n${name.padEnd(6)} ${path}  ${e.message}`);
  }
}

console.log("\n== Result ==");
if (!working.length) {
  console.log("None worked. Check credits (cloud.swarms.world -> Settings -> Credits) and the model name.");
  process.exit(1);
}
console.log(`Working: ${working.join(", ")}`);
console.log(`Set SWARMS_ENDPOINT=${working[0]} in .env and in Base44 Secrets so the app goes straight to it.`);
console.log("Then run: npm run eval:ai");
