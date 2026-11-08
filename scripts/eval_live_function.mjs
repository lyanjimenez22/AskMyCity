// Runs the 42 evaluation questions through the function that is DEPLOYED in Base44
// (backend/askCity.function.js), as a public (non-admin) user, with no network calls.
//   npm run eval:live
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url);
const source = readFileSync(new URL("backend/askCity.function.js", root), "utf8");
// Replace the Base44 imports with stubs: an anonymous user and no secrets (the public path).
const stubbed =
  "const createClientFromRequest = () => ({ auth: { me: async () => null } });\nconst secrets = { get: () => undefined };\n" +
  source.replace(/^import .*$/gm, "");
const file = join(mkdtempSync(join(tmpdir(), "askcity-live-")), "fn.mjs");
writeFileSync(file, stubbed);
const { default: askCity } = await import(pathToFileURL(file));

const questions = JSON.parse(readFileSync(new URL("eval/questions.json", root), "utf8"));
let correct = 0, confidentWrong = 0, invented = 0;
const misses = [];
for (const q of questions) {
  const req = new Request("https://app.example/functions/askCity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q.text, city: q.city, language: q.lang }),
    duplex: "half",
  });
  const out = await (await askCity(req)).json();
  const got = out.status === "emergency" ? "EMERGENCY" : out.status === "verified" ? out.source?.id : null;
  const ok = got === q.expected || (q.also_ok ?? []).includes(got);
  if (ok) correct++;
  else {
    if (out.status === "verified" && q.expected !== null) confidentWrong++;
    misses.push(`  #${q.n} [${q.city}/${q.lang}] "${q.text}" -> got ${got ?? "fallback"}, expected ${q.expected ?? "fallback"}`);
  }
  const url = out.source?.url ?? "";
  if (url && !/^https:\/\/(www\.)?(miami\.gov|miamigardens-fl\.gov|miamidade\.gov)(\/|$)/.test(url)) {
    invented++;
    misses.push(`  (link not on an official government domain) #${q.n}: ${url}`);
  }
}
const byLang = ["es", "en", "ht"].map((l) => {
  const qs = questions.filter((q) => q.lang === l);
  return `${l}: ${qs.length - misses.filter((m) => m.includes(`/${l}]`)).length}/${qs.length}`;
}).join(", ");
const summary = { mode: "deployed Base44 function, public user", questions: questions.length, correct, accuracy: `${((100 * correct) / questions.length).toFixed(1)}%`, by_language: byLang, confident_wrong: confidentWrong, non_official_links: invented };
console.log(summary);
console.log("\nMisses:\n" + misses.join("\n"));
writeFileSync(new URL("eval/RESULTS-live-function.md", root), `# Deployed function, public path (no AI)\n\n\`\`\`\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\nMisses:\n\n${misses.join("\n")}\n`);
