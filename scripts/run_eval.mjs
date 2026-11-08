// Runs every question in eval/questions.json through the real pipeline and scores it.
//   node scripts/run_eval.mjs          -> rules only (no AI, no keys needed)
//   node scripts/run_eval.mjs --ai     -> rules + Prune + Swarms (needs SWARMS_API_KEY in .env)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { askCity, routeByRules, CITY_CONTACT } from "../src/askcity.mjs";

const root = new URL("..", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("data/resources.json", root), "utf8"));
const questions = JSON.parse(readFileSync(new URL("eval/questions.json", root), "utf8"));

function loadEnv() {
  const env = { ...process.env };
  const file = new URL(".env", root);
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const useAI = process.argv.includes("--ai");
const env = loadEnv();
if (useAI && !env.SWARMS_API_KEY) {
  console.error("--ai needs SWARMS_API_KEY in .env");
  process.exit(1);
}

const officialUrls = new Set([...catalog.map((r) => r.url), ...Object.values(CITY_CONTACT).map((c) => c.url)]);
const rows = [];
for (const q of questions) {
  const rules = routeByRules(q.text, q.city, catalog);
  const out = await askCity(q, { catalog, env, useAI });
  const card = out.card;
  const predicted = card.status === "emergency" ? "EMERGENCY" : card.id;
  const ok = predicted === q.expected || (q.also_ok ?? []).includes(predicted);
  rows.push({
    n: q.n,
    city: q.city,
    lang: q.lang,
    text: q.text,
    expected: q.expected,
    predicted,
    ok,
    rules_kind: rules.kind,
    mode: out.mode,
    confident_wrong: out.mode === "rules" && card.status === "answer" && !ok,
    tiebreak_wrong: out.mode === "rules-tiebreak" && !ok,
    invented_link: card.url != null && !officialUrls.has(card.url),
    cost_usd: out.cost_usd ?? 0,
    latency_ms: out.latency_ms,
    swarms_error: out.trace?.swarms?.error ?? null,
  });
  process.stdout.write(ok ? "." : "x");
}
console.log("\n");

const n = rows.length;
const count = (f) => rows.filter(f).length;
const pct = (k) => `${((100 * k) / n).toFixed(1)}%`;
const byLang = ["es", "en", "ht"].map((l) => {
  const sub = rows.filter((r) => r.lang === l);
  return `${l}: ${sub.filter((r) => r.ok).length}/${sub.length}`;
});
const summary = {
  mode: useAI ? "rules + Prune + Swarms" : "rules only",
  date: new Date().toISOString(),
  questions: n,
  correct: count((r) => r.ok),
  accuracy: pct(count((r) => r.ok)),
  by_language: byLang.join(", "),
  answered_by_rules: count((r) => r.rules_kind === "confident" || r.rules_kind === "emergency"),
  escalated_to_ai: count((r) => r.rules_kind === "ambiguous" || r.rules_kind === "no_match"),
  confident_wrong: count((r) => r.confident_wrong),
  tiebreak_wrong: count((r) => r.tiebreak_wrong),
  invented_links: count((r) => r.invented_link),
  total_ai_cost_usd: rows.reduce((s, r) => s + (r.cost_usd || 0), 0),
  swarms_errors: count((r) => r.swarms_error),
};

console.log(summary);
console.log("\nMisses:");
for (const r of rows.filter((r) => !r.ok)) {
  console.log(`  #${r.n} [${r.city}/${r.lang}] "${r.text}" -> got ${r.predicted ?? "fallback"}, expected ${r.expected} (rules: ${r.rules_kind}, mode: ${r.mode})`);
}

const tag = useAI ? "ai" : "rules";
writeFileSync(new URL(`eval/results-${tag}.json`, root), JSON.stringify({ summary, rows }, null, 2) + "\n");
const md = [
  `# Evaluation results (${summary.mode})`,
  "",
  `Run: ${summary.date}`,
  "",
  "| Metric | Value |",
  "| --- | --- |",
  `| Questions (es/en/ht, 2 cities) | ${n} |`,
  `| Correct | ${summary.correct} (${summary.accuracy}) |`,
  `| By language | ${summary.by_language} |`,
  `| Answered by rules (free, instant) | ${summary.answered_by_rules} |`,
  `| Escalated to AI | ${summary.escalated_to_ai} |`,
  `| Confident but wrong (most dangerous error) | ${summary.confident_wrong} |`,
  `| Tie-break picked a less specific official page | ${summary.tiebreak_wrong} |`,
  `| Invented links | ${summary.invented_links} |`,
  `| AI cost for the whole run (USD) | ${summary.total_ai_cost_usd.toFixed(4)} |`,
  "",
  "## Misses",
  "",
  ...rows.filter((r) => !r.ok).map((r) => `- #${r.n} (${r.city}/${r.lang}) "${r.text}": got \`${r.predicted ?? "fallback"}\`, expected \`${r.expected}\` (rules: ${r.rules_kind})`),
  "",
].join("\n");
writeFileSync(new URL(`eval/RESULTS-${tag}.md`, root), md);
console.log(`\nWrote eval/RESULTS-${tag}.md and eval/results-${tag}.json`);
