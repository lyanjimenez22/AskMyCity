// Run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  askCity, routeByRules, guard, isAllowedUrl, normalize, extractDecision, extractCost,
  buildGraphRequest, buildSwarmsAgents, tieBreak, LANGS,
} from "../src/askcity.mjs";

const catalog = JSON.parse(readFileSync(new URL("../data/resources.json", import.meta.url), "utf8"));

// ---------- catalog integrity ----------

test("every catalog entry is complete and official", () => {
  const ids = new Set();
  for (const r of catalog) {
    assert.ok(r.id && !ids.has(r.id), `duplicate or missing id: ${r.id}`);
    ids.add(r.id);
    assert.ok(["miami", "gardens"].includes(r.city), `${r.id}: bad city`);
    assert.ok(isAllowedUrl(r.url), `${r.id}: url not on an official domain`);
    assert.match(r.phone, /^(311|\d{3}-\d{3}-\d{4})( ext\. \d+)?$/, `${r.id}: bad phone`);
    assert.ok(r.terms.length > 0, `${r.id}: no terms`);
    for (const lang of LANGS) {
      assert.equal(r.copy[lang]?.length, 3, `${r.id}: copy.${lang} must have title, meaning, step`);
    }
    assert.ok(r.verification?.status, `${r.id}: missing verification status`);
  }
});

test("no card ever tells someone they qualify", () => {
  const banned = /\b(qualify|qualifies|qualified|calificas|califica|calificar|kalifye)\b/i;
  for (const r of catalog) for (const lang of LANGS) assert.doesNotMatch(r.copy[lang].join(" "), banned, `${r.id}/${lang}`);
});

// ---------- rules ----------

test("normalize removes accents and punctuation", () => {
  assert.equal(normalize("¿Cómo aplico a la Sección 8?"), "como aplico a la seccion 8");
});

test("emergency wins over a normal match", () => {
  assert.equal(routeByRules("a man is injured on the sidewalk", "miami", catalog).kind, "emergency");
});

test("'emergency alerts' is a normal question, not an emergency", () => {
  const r = routeByRules("how do I get emergency alerts", "gardens", catalog);
  assert.equal(r.kind, "confident");
  assert.equal(r.id, "gardens-alerts");
});

test("rules only look inside the user's city", () => {
  assert.equal(routeByRules("mi calle se inunda", "miami", catalog).id, "flood");
  assert.equal(routeByRules("mi calle se inunda", "gardens", catalog).id, "gardens-drainage");
});

test("the team's multiword synonym resolves the old tie without AI", () => {
  const r = routeByRules("tiraron basura en la esquina", "miami", catalog);
  assert.equal(r.kind, "confident");
  assert.equal(r.id, "dumping"); // "tiraron basura" (multiword, weight 2) beats "basura"
});

test("a keyword tie is reported as ambiguous", () => {
  const r = routeByRules("dejaron basura y escombros en la esquina", "miami", catalog);
  assert.equal(r.kind, "ambiguous");
  assert.deepEqual(r.candidates.map((c) => c.id).sort(), ["dumping", "trash"]);
});

// ---------- guardrail ----------

test("guardrail rejects invented ids and ids from the other city", () => {
  assert.equal(guard("made-up-page", "miami", catalog), null);
  assert.equal(guard("work", "miami", catalog), null); // work is a Miami Gardens entry
  assert.equal(guard("flood", "miami", catalog).id, "flood");
});

test("only official https domains are allowed", () => {
  assert.ok(isAllowedUrl("https://www.miami.gov/x"));
  assert.ok(isAllowedUrl("https://miamigardens-fl.gov/148/x"));
  assert.ok(!isAllowedUrl("https://miami.gov.evil.com/x"));
  assert.ok(!isAllowedUrl("http://www.miami.gov/x"));
});

// ---------- Swarms response parsing ----------

test("extractDecision finds the Judge JSON inside text", () => {
  const response = { outputs: { Finder: "I pick dumping.", Judge: 'Here it is: {"id": "dumping", "confidence": 0.9, "reason": "Someone threw trash on the street."}' } };
  assert.equal(extractDecision(response).id, "dumping");
});

test("extractDecision handles a null answer", () => {
  assert.equal(extractDecision({ output: '{"id": null, "confidence": 0.2, "reason": "Not in catalog."}' }).id, null);
});

test("extractCost reads usage.total_cost", () => {
  assert.equal(extractCost({ usage: { total_cost: 0.0031 } }), 0.0031);
});

test("graph request chains agents in order", () => {
  const body = buildGraphRequest({ task: "t", agents: buildSwarmsAgents({ model: "m", includeIntake: true }) });
  assert.deepEqual(body.edges, [{ source: "Intake", target: "Finder" }, { source: "Finder", target: "Judge" }]);
  assert.deepEqual(body.entry_points, ["Intake"]);
  assert.deepEqual(body.end_points, ["Judge"]);
});

// ---------- full pipeline with fake APIs ----------

function fakeFetch(handlers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    for (const [match, reply] of handlers) {
      if (url.includes(match)) {
        const { status = 200, json = {}, headers = {} } = typeof reply === "function" ? reply() : reply;
        return new Response(JSON.stringify(json), { status, headers });
      }
    }
    return new Response("{}", { status: 404 });
  };
  fn.calls = calls;
  return fn;
}

const ENV = { SWARMS_API_KEY: "test-swarms", PRUNE_API_KEY: "test-prune" };

test("confident questions never call the AI (free and instant)", async () => {
  const f = fakeFetch([]);
  const out = await askCity({ text: "hay un bache enorme", city: "miami", lang: "es" }, { catalog, env: ENV, fetchImpl: f });
  assert.equal(out.card.id, "pothole");
  assert.equal(out.mode, "rules");
  assert.equal(f.calls.length, 0);
});

test("ambiguous question goes Prune -> Swarms and returns the catalog card", async () => {
  const f = fakeFetch([
    ["/v1/chat/completions", { json: { choices: [{ message: { content: "Report illegal dumping on a street corner." } }], prune_metadata: { receipt_signature: "sig-abc" } } }],
    ["/v1/swarm/completions", { json: { status: "success", output: [{ role: "Judge", content: '{"id":"dumping","confidence":0.92,"reason":"Illegal dumping."}' }], usage: { total_cost: 0.002 } } }],
  ]);
  const out = await askCity({ text: "dejaron basura y escombros en la esquina", city: "miami", lang: "es" }, { catalog, env: ENV, fetchImpl: f });
  assert.equal(out.mode, "swarms");
  assert.equal(out.card.id, "dumping");
  assert.equal(out.card.url, catalog.find((r) => r.id === "dumping").url);
  assert.equal(out.cost_usd, 0.002);
  assert.ok(f.calls[0].url.endsWith("/v1/chat/completions"));
  assert.equal(f.calls[0].init.headers.Authorization, "Bearer test-prune");
  assert.equal(out.trace.prune.receipt.signed, true);
  assert.doesNotMatch(JSON.stringify(out), /sig-abc/); // the signature itself is not echoed back
  assert.equal(f.calls[1].init.headers["x-api-key"], "test-swarms");
  // With a Prune intake, the Swarms workflow is Finder -> Judge.
  assert.deepEqual(f.calls[1].body.agents.map((a) => a.agent_name), ["Finder", "Judge"]);
});

test("if the AI invents an id, the guardrail returns the 'I don't know' card", async () => {
  const f = fakeFetch([["/v1/swarm/completions", { json: { output: '{"id":"miami-free-money","confidence":0.99,"reason":"x"}' } }]]);
  const out = await askCity({ text: "the road in front of my house has a big hole", city: "miami", lang: "en" }, { catalog, env: { SWARMS_API_KEY: "k" }, fetchImpl: f });
  assert.equal(out.card.status, "fallback");
  assert.equal(out.card.reason, "guardrail_rejected_ai_id");
  assert.equal(out.card.phone, "311");
});

test("SequentialWorkflow is tried first (graph-workflow is premium-only on our account)", async () => {
  const f = fakeFetch([
    ["/v1/graph-workflow/completions", { status: 403, json: { detail: "premium_access_required" } }],
    ["/v1/swarm/completions", { json: { status: "success", output: [{ role: "Judge", content: '{"id":"pothole","confidence":0.8,"reason":"Hole in the road."}' }] } }],
  ]);
  const out = await askCity({ text: "the road in front of my house has a big hole", city: "miami", lang: "en" }, { catalog, env: { SWARMS_API_KEY: "k" }, fetchImpl: f });
  assert.equal(out.card.id, "pothole");
  assert.equal(out.trace.swarms.endpoint, "/v1/swarm/completions");
  assert.equal(f.calls[0].body.swarm_type, "SequentialWorkflow");
  assert.ok(!f.calls.some((c) => c.url.includes("graph-workflow")));
});

test("if graph and swarm are both refused, it runs Finder -> Judge as separate agent calls", async () => {
  let n = 0;
  const f = fakeFetch([
    ["/v1/graph-workflow/completions", { status: 403, json: { detail: "premium only" } }],
    ["/v1/swarm/completions", { status: 403, json: { detail: "premium only" } }],
    [
      "/v1/agent/completions",
      () =>
        ++n === 1
          ? { json: { outputs: [{ role: "Finder", content: "pothole: the resident describes a hole in the road" }], usage: { total_cost: 0.001 } } }
          : { json: { outputs: [{ role: "Judge", content: '{"id":"pothole","confidence":0.9,"reason":"Hole in the road."}' }], usage: { total_cost: 0.002 } } },
    ],
  ]);
  const out = await askCity({ text: "the road in front of my house has a big hole", city: "miami", lang: "en" }, { catalog, env: { SWARMS_API_KEY: "k", PRUNE_API_KEY: "" }, fetchImpl: f });
  assert.equal(out.card.id, "pothole");
  assert.equal(out.mode, "swarms");
  assert.equal(out.trace.swarms.endpoint, "/v1/agent/completions");
  const agentCalls = f.calls.filter((c) => c.url.endsWith("/v1/agent/completions"));
  // No Prune key -> Intake runs inside Swarms, so the chain is Intake -> Finder -> Judge.
  assert.deepEqual(agentCalls.map((c) => c.body.agent_config.agent_name), ["Intake", "Finder", "Judge"]);
  assert.equal(agentCalls[0].body.agent_config.model_name, "gpt-5.4-mini");
  assert.match(agentCalls[2].body.task, /Previous agents said:/);
  assert.match(agentCalls[2].body.task, /Finder: /);
  assert.ok(Math.abs(out.cost_usd - 0.005) < 1e-9); // 0.001 + 0.002 + 0.002, summed across the chain
});

test("SWARMS_ENDPOINT=agent goes straight to the agent chain", async () => {
  const f = fakeFetch([["/v1/agent/completions", { json: { outputs: '{"id":"dumping","confidence":0.9,"reason":"Illegal dumping."}' } }]]);
  const out = await askCity({ text: "dejaron basura y escombros en la esquina", city: "miami", lang: "es" }, { catalog, env: { SWARMS_API_KEY: "k", SWARMS_ENDPOINT: "agent" }, fetchImpl: f });
  assert.equal(out.card.id, "dumping");
  assert.ok(f.calls.every((c) => c.url.endsWith("/v1/agent/completions")));
});

test("a 200 response with no Judge JSON tries the next way instead of giving up", async () => {
  const f = fakeFetch([
    ["/v1/swarm/completions", { json: { job_id: "abc", status: "queued" } }],
    ["/v1/agent/completions", { json: { outputs: '{"id":"pothole","confidence":0.8,"reason":"Hole in the road."}' } }],
  ]);
  const out = await askCity({ text: "the road in front of my house has a big hole", city: "miami", lang: "en" }, { catalog, env: { SWARMS_API_KEY: "k" }, fetchImpl: f });
  assert.equal(out.card.id, "pothole");
  assert.equal(out.trace.swarms.endpoint, "/v1/agent/completions");
});

test("if Swarms is down, the user still gets the official phone", async () => {
  const f = fakeFetch([["/v1/", { status: 500 }]]);
  const out = await askCity({ text: "el pasto está altísimo", city: "gardens", lang: "es" }, { catalog, env: { SWARMS_API_KEY: "k" }, fetchImpl: f });
  assert.equal(out.card.status, "fallback");
  assert.equal(out.card.phone, "305-622-8000");
});

test("API keys never appear in the response", async () => {
  const f = fakeFetch([["/v1/", { status: 500 }]]);
  const out = await askCity({ text: "algo raro", city: "miami", lang: "es" }, { catalog, env: { SWARMS_API_KEY: "secret-123", PRUNE_API_KEY: "secret-456" }, fetchImpl: f });
  assert.doesNotMatch(JSON.stringify(out), /secret-/);
});

// ---------- tie handling (Ronald's rule + Swarms restricted to the tie) ----------

test("without AI, a tie shows the entry with the longest matched term, never the 311 card", async () => {
  const r = routeByRules("dejaron basura y escombros en la esquina", "miami", catalog);
  assert.equal(tieBreak(r.candidates), "dumping"); // "escombros" (9) beats "basura" (6)
  const out = await askCity({ text: "dejaron basura y escombros en la esquina", city: "miami", lang: "es" }, { catalog, useAI: false });
  assert.equal(out.card.id, "dumping");
  assert.equal(out.mode, "rules-tiebreak");
});

test("on a tie, Swarms only sees the tied entries", async () => {
  const f = fakeFetch([["/v1/swarm/completions", { json: { output: '{"id":"dumping","confidence":0.9,"reason":"Illegal dumping."}' } }]]);
  const out = await askCity({ text: "dejaron basura y escombros en la esquina", city: "miami", lang: "es" }, { catalog, env: { SWARMS_API_KEY: "k" }, fetchImpl: f });
  const task = f.calls[0].body.task;
  assert.match(task, /- dumping \|/);
  assert.match(task, /- trash \|/);
  assert.doesNotMatch(task, /- flood \|/);
  assert.deepEqual(out.trace.swarms.choices.sort(), ["dumping", "trash"]);
  assert.equal(out.mode, "swarms");
});

test("on a tie, an AI answer outside the tie falls back to the tie-break, not to 311", async () => {
  const f = fakeFetch([["/v1/swarm/completions", { json: { output: '{"id":"flood","confidence":0.9,"reason":"x"}' } }]]);
  const out = await askCity({ text: "dejaron basura y escombros en la esquina", city: "miami", lang: "es" }, { catalog, env: { SWARMS_API_KEY: "k" }, fetchImpl: f });
  assert.equal(out.card.id, "dumping");
  assert.equal(out.mode, "rules-tiebreak");
});

test("Miami and Miami Gardens job questions go to their own city's program", () => {
  assert.equal(routeByRules("busco trabajo", "miami", catalog).id, "jobs-miami");
  assert.equal(routeByRules("busco trabajo", "gardens", catalog).id, "work");
});

test("accepts Work's contract {question, language} and returns its fields", async () => {
  const out = await askCity({ question: "No puedo pagar la renta", language: "en", city: "miami" }, { catalog, useAI: false });
  assert.equal(out.status, "verified");
  assert.equal(out.title, "Help with rent");
  assert.equal(out.source.id, "rent");
  assert.ok(out.source.url.startsWith("https://www.miami.gov"));
  assert.equal(out.card.id, "rent");
});
