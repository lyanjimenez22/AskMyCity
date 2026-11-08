// Opens every official URL in the catalog and reports the HTTP status.
// A judge can click any link, so every one must load.   node scripts/check_links.mjs
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../data/resources.json", import.meta.url), "utf8"));
let bad = 0;
for (const r of catalog) {
  try {
    const res = await fetch(r.url, { redirect: "follow", headers: { "User-Agent": "AskMyCity link checker" } });
    const flag = res.ok ? "OK " : "BAD";
    if (!res.ok) bad++;
    console.log(`${flag} ${res.status}  ${r.id.padEnd(20)} ${r.url}${res.url !== r.url ? `  -> ${res.url}` : ""}`);
  } catch (e) {
    bad++;
    console.log(`ERR ---  ${r.id.padEnd(20)} ${r.url}  (${e.message})`);
  }
}
console.log(`\n${catalog.length - bad}/${catalog.length} links load.`);
process.exit(bad ? 1 : 0);
