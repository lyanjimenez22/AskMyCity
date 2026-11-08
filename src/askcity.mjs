// AskMyCity core: rules router + Swarms escalation + Prune intake + code guardrail.
// No dependencies. Runs in Node 18+, Deno, and Base44 backend functions (uses global fetch).
//
// Flow:
//   1. Rules (free, instant): emergency check, then keyword match inside the user's city.
//   2. If rules are confident -> card from the catalog.
//   3. If rules tie or find nothing -> Prune (optional intake, cached) -> Swarms (Finder -> Judge).
//   4. Guardrail (code, no AI): the chosen id must exist in the catalog AND belong to the city.
//   5. The card text, link and phone ALWAYS come from the catalog. The AI only picks an id.

export const LANGS = ["es", "en", "ht"];
export const CITIES = ["miami", "gardens"];
export const ALLOWED_HOSTS = ["miami.gov", "miamigardens-fl.gov"];

export const CITY_CONTACT = {
  miami: { phone: "311", url: "https://www.miami.gov" },
  gardens: { phone: "305-622-8000", url: "https://www.miamigardens-fl.gov" },
};

const FALLBACK_COPY = {
  es: ["No lo sé", "No encontré una página oficial para eso en nuestra lista verificada.", "Llama al {phone} y explica lo que necesitas."],
  en: ["I don't know", "I could not find an official page for that in our verified list.", "Call {phone} and explain what you need."],
  ht: ["Mwen pa konnen", "Mwen pa jwenn yon paj ofisyèl pou sa nan lis nou verifye a.", "Rele {phone} epi esplike sa ou bezwen."],
};

const EMERGENCY_COPY = {
  es: ["Emergencia: llama al 911", "Si alguien está en peligro ahora mismo, esta app no es el canal correcto.", "Llama al 911 ahora."],
  en: ["Emergency: call 911", "If someone is in danger right now, this app is not the right channel.", "Call 911 now."],
  ht: ["Ijans: rele 911", "Si yon moun an danje kounye a, aplikasyon sa a pa bon chanèl la.", "Rele 911 kounye a."],
};

// Words that mean "danger right now". Deliberately specific: "emergencia" alone is NOT here,
// because "alertas de emergencia" is a normal question.
const EMERGENCY_TERMS = [
  "911", "incendio", "fuego", "herido", "herida", "sangrando", "disparo", "disparos", "no respira", "inconsciente",
  "fire", "injured", "bleeding", "shooting", "gunshot", "not breathing", "unconscious",
  "dife", "blese", "pa respire",
];

// The app must never tell someone they qualify.
const BANNED = /\b(qualify|qualifies|qualified|calificas|califica|calificar|kalifye)\b/i;

// ---------- text helpers ----------

export function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function prepare(text) {
  const norm = normalize(text);
  return { padded: ` ${norm} `, tokens: new Set(norm.split(" ").filter(Boolean)) };
}

function termMatches(prepared, term) {
  const t = normalize(term);
  if (!t) return false;
  if (t.includes(" ")) return prepared.padded.includes(` ${t} `);
  return prepared.tokens.has(t) || prepared.tokens.has(t + "s") || prepared.tokens.has(t + "es");
}

// ---------- step 1: rules ----------

export function routeByRules(text, city, catalog) {
  const prepared = prepare(text);
  if (EMERGENCY_TERMS.some((t) => termMatches(prepared, t))) return { kind: "emergency", candidates: [] };

  const scored = catalog
    .map((r, order) => ({ r, order }))
    .filter(({ r }) => r.city === city)
    .map(({ r, order }) => {
      const matched = r.terms.filter((t) => termMatches(prepared, t));
      const score = matched.reduce((s, t) => s + (normalize(t).includes(" ") ? 2 : 1), 0);
      const longest = matched.reduce((m, t) => Math.max(m, normalize(t).length), 0);
      return { id: r.id, score, matched, longest, order };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: "no_match", candidates: [] };
  if (scored.length === 1 || scored[0].score > scored[1].score) {
    return { kind: "confident", id: scored[0].id, candidates: scored };
  }
  return { kind: "ambiguous", candidates: scored.filter((s) => s.score === scored[0].score) };
}

// Used only when the AI is not available: a tie between official entries should still show an
// official entry. Longest matched term wins (more specific); then catalog order.
export function tieBreak(candidates) {
  return [...candidates].sort((a, b) => b.longest - a.longest || a.order - b.order)[0]?.id ?? null;
}

// ---------- step 4: guardrail ----------

export function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export function guard(id, city, catalog) {
  if (id == null) return null;
  const r = catalog.find((x) => x.id === id);
  if (!r || r.city !== city || !isAllowedUrl(r.url)) return null;
  return r;
}

// ---------- cards (text only from the catalog or fixed copy) ----------

export function fallbackCard(city, lang, reason) {
  const c = CITY_CONTACT[city] ?? CITY_CONTACT.miami;
  const [title, meaning, step] = FALLBACK_COPY[lang] ?? FALLBACK_COPY.es;
  return { status: "fallback", id: null, title, meaning, step: step.replace("{phone}", c.phone), url: c.url, phone: c.phone, reason };
}

export function emergencyCard(lang) {
  const [title, meaning, step] = EMERGENCY_COPY[lang] ?? EMERGENCY_COPY.es;
  return { status: "emergency", id: null, title, meaning, step, url: null, phone: "911" };
}

export function buildCard(resource, lang, city) {
  const copy = resource.copy[lang] ?? resource.copy.es;
  const [title, meaning, step] = copy;
  if (BANNED.test(`${title} ${meaning} ${step}`)) return fallbackCard(city, lang, "banned_word_in_catalog");
  return {
    status: "answer",
    id: resource.id,
    kind: resource.kind,
    title,
    meaning,
    step,
    url: resource.url,
    phone: resource.phone,
    checked: resource.checked,
    verification: resource.verification?.status ?? "unknown",
  };
}

// ---------- step 3a: Prune intake (optional) ----------

const INTAKE_PROMPT =
  "You turn a resident's message (Spanish, English or Haitian Creole) into ONE short English sentence that names the city service they need. " +
  "Do not answer the question. Do not add facts, places, links or phone numbers. Output only the sentence.";

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function normalizeWithPrune({ text, env, fetchImpl = fetch, timeoutMs = 15000 }) {
  // Prune is an OpenAI-compatible endpoint. Verified live on Nov 8, 2026 (docs/ESTADO.md):
  // POST https://api.withprune.com/v1/chat/completions with "Authorization: Bearer <PRUNE_API_KEY>",
  // and the response carries a signed receipt in `prune_metadata.receipt_signature`.
  const base = env.PRUNE_BASE_URL || "https://api.withprune.com";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${env.PRUNE_API_KEY}` };
  const started = Date.now();
  const res = await fetchWithTimeout(
    fetchImpl,
    `${base}/v1/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: env.PRUNE_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 60,
        messages: [
          { role: "system", content: INTAKE_PROMPT },
          { role: "user", content: String(text).slice(0, 500) },
        ],
      }),
    },
    timeoutMs
  );
  if (!res.ok) throw new Error(`prune_http_${res.status}`);
  const json = await res.json();
  const receipt = {};
  res.headers?.forEach?.((value, key) => {
    if (key.toLowerCase().startsWith("x-prune")) receipt[key.toLowerCase()] = value;
  });
  const meta = json.prune_metadata ?? json.prune ?? json.receipt ?? null;
  // Only safe, non-secret receipt fields go into the trace.
  const bodyReceipt = meta
    ? { signed: typeof meta.receipt_signature === "string" && meta.receipt_signature.length > 0, cache: meta.cache_hit ?? meta.cache ?? null, cost_usd: meta.cost_usd ?? meta.cost ?? null }
    : null;
  const need = json.choices?.[0]?.message?.content?.trim() || null;
  const cacheFlag = String(receipt["x-prune-cache"] ?? receipt["x-prune-cache-hit"] ?? bodyReceipt?.cache ?? "").toLowerCase();
  return {
    need,
    cached: cacheFlag === "hit" || cacheFlag === "true",
    receipt: Object.keys(receipt).length ? receipt : bodyReceipt,
    latency_ms: Date.now() - started,
  };
}

// ---------- step 3b: Swarms (Finder -> Judge) ----------

export function catalogForPrompt(city, catalog) {
  return catalog
    .filter((r) => r.city === city)
    .map((r) => `- ${r.id} | ${r.copy.en[0]} | ${r.copy.en[1]}`)
    .join("\n");
}

export function buildSwarmsTask({ text, need, city, catalog }) {
  return [
    `Resident city: ${city === "gardens" ? "Miami Gardens" : "City of Miami"}`,
    `Resident message (original language): ${JSON.stringify(String(text).slice(0, 500))}`,
    need ? `Normalized need (English): ${JSON.stringify(need)}` : null,
    "Catalog of verified official pages. These ids are the ONLY allowed answers:",
    catalogForPrompt(city, catalog),
    "Pick the single id that best helps this resident, or null if none of them fits.",
  ]
    .filter(Boolean)
    .join("\n");
}

const INTAKE_AGENT_PROMPT =
  "You are Intake. Read the resident's message (Spanish, English or Haitian Creole) and restate, in one short English sentence, " +
  "the city service they need. Do not answer it. Do not invent facts.";

const FINDER_PROMPT =
  "You are Finder. Using ONLY the catalog in the task, choose the one catalog id that best matches the resident's need. " +
  "If nothing in the catalog fits, choose null. Reply with the id and one short reason.";

const JUDGE_PROMPT =
  "You are Judge. Check Finder's choice against the catalog in the task. The id must appear in the catalog exactly and must fit the need. " +
  "If it is not clearly supported, the answer is null. Never invent ids, links or phone numbers. " +
  'Respond with ONLY a JSON object and nothing else: {"id": "<catalog id or null>", "confidence": <number 0-1>, "reason": "<one short English sentence>"}';

export function buildSwarmsAgents({ model, includeIntake }) {
  const base = { model_name: model, max_loops: 1, temperature: 0, max_tokens: 400 };
  const agents = [
    { ...base, agent_name: "Finder", description: "Chooses the catalog entry", system_prompt: FINDER_PROMPT },
    { ...base, agent_name: "Judge", description: "Verifies the choice and outputs JSON", system_prompt: JUDGE_PROMPT },
  ];
  if (includeIntake) agents.unshift({ ...base, agent_name: "Intake", description: "Restates the need in English", system_prompt: INTAKE_AGENT_PROMPT });
  return agents;
}

export function buildGraphRequest({ task, agents }) {
  const names = agents.map((a) => a.agent_name);
  const edges = names.slice(0, -1).map((source, i) => ({ source, target: names[i + 1] }));
  return { name: "askmycity-router", task, agents, edges, entry_points: [names[0]], end_points: [names[names.length - 1]] };
}

export function buildSequentialRequest({ task, agents }) {
  return { name: "askmycity-router", description: "Finds the verified official page for a resident", swarm_type: "SequentialWorkflow", max_loops: 1, task, agents };
}

// Finds the Judge's JSON anywhere inside a Swarms response (the shape varies by endpoint).
export function extractDecision(response) {
  const found = [];
  const visit = (v) => {
    if (v == null) return;
    if (typeof v === "string") {
      const re = /\{[^{}]*"id"\s*:\s*(?:null|"[^"]*")[^{}]*\}/g;
      for (const m of v.match(re) ?? []) {
        try {
          found.push(JSON.parse(m));
        } catch {
          /* not JSON, ignore */
        }
      }
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (typeof v === "object") {
      if ("id" in v && (v.id === null || typeof v.id === "string") && "reason" in v) found.push(v);
      Object.values(v).forEach(visit);
    }
  };
  visit(response);
  return found.length ? found[found.length - 1] : null;
}

export function extractCost(response) {
  let cost = null;
  const visit = (v) => {
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (k === "total_cost" && typeof val === "number") cost = val;
        else visit(val);
      }
    }
  };
  visit(response);
  return cost;
}

// One agent call on /v1/agent/completions (the endpoint shown on the SharkByte Swarms flyer).
export function buildAgentRequest({ agent, task }) {
  const { agent_name, description, system_prompt, model_name, max_loops, temperature, max_tokens } = agent;
  return { agent_config: { agent_name, description, system_prompt, model_name, max_loops, temperature, max_tokens }, task };
}

// The text an agent wrote, whatever shape the response has (string, list of messages, or object).
export function extractAgentText(response) {
  const out = response?.outputs ?? response?.output ?? response?.result ?? response;
  if (typeof out === "string") return out;
  if (Array.isArray(out)) {
    const texts = out
      .map((m) => (typeof m === "string" ? m : typeof m?.content === "string" ? m.content : null))
      .filter(Boolean);
    if (texts.length) return texts[texts.length - 1];
  }
  return JSON.stringify(out);
}

// Plan C: the same Finder -> Judge chain, one /v1/agent/completions call per agent.
// Each agent receives the task plus what the previous agents wrote.
async function runAgentChain({ baseUrl, headers, task, agents, fetchImpl, timeoutMs }) {
  const path = "/v1/agent/completions";
  const notes = [];
  const raw = [];
  let cost = null;
  for (const agent of agents) {
    const chainedTask = notes.length ? `${task}\n\nPrevious agents said:\n${notes.join("\n")}` : task;
    const res = await fetchWithTimeout(
      fetchImpl,
      `${baseUrl}${path}`,
      { method: "POST", headers, body: JSON.stringify(buildAgentRequest({ agent, task: chainedTask })) },
      timeoutMs,
    );
    if (!res.ok) throw Object.assign(new Error(`http_${res.status}`), { http: true });
    const json = await res.json();
    raw.push(json);
    notes.push(`${agent.agent_name}: ${extractAgentText(json).slice(0, 1500)}`);
    const c = extractCost(json);
    if (typeof c === "number") cost = (cost ?? 0) + c;
  }
  // The decision must come from the last agent (Judge), not from anything earlier in the chain.
  return { decision: extractDecision(raw[raw.length - 1]), cost_usd: cost, raw };
}

export async function resolveWithSwarms({ text, need, city, catalog, env, fetchImpl = fetch, timeoutMs = 45000 }) {
  // `catalog` here is the list of allowed choices: only the tied entries, or every entry of the city.
  const baseUrl = env.SWARMS_BASE_URL || "https://api.swarms.world";
  const model = env.SWARMS_MODEL || "gpt-5.4-mini"; // confirm with GET /v1/models/available
  const agents = buildSwarmsAgents({ model, includeIntake: !need });
  const task = buildSwarmsTask({ text, need, city, catalog });
  const headers = { "Content-Type": "application/json", "x-api-key": env.SWARMS_API_KEY };

  // Three ways to run the same agents. Live test (Nov 8): graph-workflow -> 403 premium_access_required,
  // SequentialWorkflow -> works. Default order: sequential swarm -> agent chain -> graph.
  // SWARMS_ENDPOINT = "swarm" or "agent" puts that one first (set it once check:swarms shows which works).
  const single = (path, body) => async () => {
    const res = await fetchWithTimeout(fetchImpl, `${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) }, timeoutMs);
    if (!res.ok) throw Object.assign(new Error(`http_${res.status}`), { http: true });
    const json = await res.json();
    return { decision: extractDecision(json), cost_usd: extractCost(json), raw: json };
  };
  let attempts = [
    ["/v1/swarm/completions", single("/v1/swarm/completions", buildSequentialRequest({ task, agents }))],
    ["/v1/agent/completions", () => runAgentChain({ baseUrl, headers, task, agents, fetchImpl, timeoutMs })],
    ["/v1/graph-workflow/completions", single("/v1/graph-workflow/completions", buildGraphRequest({ task, agents }))],
  ];
  const preferred = { graph: "/v1/graph-workflow/completions", swarm: "/v1/swarm/completions", agent: "/v1/agent/completions" }[env.SWARMS_ENDPOINT];
  if (preferred) attempts = [...attempts.filter(([p]) => p === preferred), ...attempts.filter(([p]) => p !== preferred)];

  const errors = [];
  for (const [path, run] of attempts) {
    const started = Date.now();
    try {
      const { decision, cost_usd, raw } = await run();
      // HTTP 200 but no Judge JSON anywhere (unexpected response shape): try the next way instead of giving up.
      // A Judge that answers {"id": null} is a real decision and is returned as is.
      if (!decision) {
        errors.push(`${path}: no_decision`);
        continue;
      }
      return { endpoint: path, decision, cost_usd, latency_ms: Date.now() - started, agents: agents.map((a) => a.agent_name), raw };
    } catch (e) {
      const why = e.http ? e.message : e.name === "AbortError" ? "timeout" : e.name === "SyntaxError" ? "bad_json" : "network_error";
      errors.push(`${path}: ${why}`);
    }
  }
  throw new Error(`swarms_failed (${errors.join("; ")})`);
}

// ---------- orchestrator ----------

// Adds the response shape Work's Base44 UI expects, next to `card`, so both UIs work with one function.
function withCompatFields(result) {
  const c = result.card;
  if (!c) return result;
  const status = c.status === "answer" ? "verified" : c.status === "emergency" ? "emergency" : "unverified";
  return {
    ...result,
    status,
    title: c.title,
    summary: c.meaning,
    nextStep: c.step,
    routing: result.mode,
    source: { id: c.id, url: c.url, phone: c.phone, checked: c.checked ?? null },
  };
}

export async function askCity(input, { catalog, env = {}, fetchImpl = fetch, useAI = true, includeRaw = false }) {
  const started = Date.now();
  // Accepts both contracts: {text, lang} (ours) and {question, language} (Work's LEEME).
  const city = CITIES.includes(input?.city) ? input.city : null;
  const rawLang = input?.lang ?? input?.language;
  const lang = LANGS.includes(rawLang) ? rawLang : "es";
  const text = String(input?.text ?? input?.question ?? "").trim().slice(0, 500);
  if (!city) return { error: "city must be 'miami' or 'gardens'" };

  const trace = { rules: null, prune: null, swarms: null };
  const done = (card, mode, extra = {}) => withCompatFields({ card, mode, trace, latency_ms: Date.now() - started, ...extra });
  if (!text) return done(fallbackCard(city, lang, "empty_question"), "rules");

  const rules = routeByRules(text, city, catalog);
  trace.rules = { kind: rules.kind, candidates: rules.candidates.map((c) => ({ id: c.id, score: c.score, matched: c.matched })) };

  const cardFor = (id, mode, reason, extra) => {
    const r = guard(id, city, catalog);
    return r ? done(buildCard(r, lang, city), mode, extra) : done(fallbackCard(city, lang, reason), mode, extra);
  };

  if (rules.kind === "emergency") return done(emergencyCard(lang), "rules");
  if (rules.kind === "confident") return cardFor(rules.id, "rules", "guardrail_rejected");

  const tiedIds = rules.kind === "ambiguous" ? rules.candidates.map((c) => c.id) : null;
  const aiOn = useAI && env.SWARMS_API_KEY;

  // No AI available: a tie still shows an official entry (tie-break); no match shows the city contact.
  if (!aiOn) {
    if (tiedIds) return cardFor(tieBreak(rules.candidates), "rules-tiebreak", "guardrail_rejected");
    return done(fallbackCard(city, lang, "rules_no_match"), "rules");
  }

  // AI path. On a tie, Swarms may only choose among the tied entries.
  const choices = tiedIds ? catalog.filter((r) => tiedIds.includes(r.id)) : catalog.filter((r) => r.city === city);
  let need = null;
  let cost = 0;
  if (env.PRUNE_API_KEY) {
    try {
      const p = await normalizeWithPrune({ text, env, fetchImpl });
      need = p.need;
      trace.prune = { need: p.need, cached: p.cached, receipt: p.receipt, latency_ms: p.latency_ms };
    } catch (e) {
      trace.prune = { error: String(e.message) };
    }
  }

  try {
    const s = await resolveWithSwarms({ text, need, city, catalog: choices, env, fetchImpl });
    trace.swarms = { endpoint: s.endpoint, agents: s.agents, choices: choices.map((r) => r.id), decision: s.decision, cost_usd: s.cost_usd, latency_ms: s.latency_ms };
    if (includeRaw) trace.swarms.raw = s.raw;
    if (typeof s.cost_usd === "number") cost += s.cost_usd;
    const id = s.decision?.id ?? null;
    const allowed = id != null && choices.some((r) => r.id === id);
    if (allowed) return cardFor(id, "swarms", "guardrail_rejected_ai_id", { cost_usd: cost });
    if (tiedIds) return cardFor(tieBreak(rules.candidates), "rules-tiebreak", "guardrail_rejected", { cost_usd: cost });
    return done(fallbackCard(city, lang, id ? "guardrail_rejected_ai_id" : "ai_returned_null"), "swarms", { cost_usd: cost });
  } catch (e) {
    trace.swarms = { error: String(e.message) };
    if (tiedIds) return cardFor(tieBreak(rules.candidates), "rules-tiebreak", "guardrail_rejected");
    return done(fallbackCard(city, lang, "ai_unavailable"), "rules");
  }
}
