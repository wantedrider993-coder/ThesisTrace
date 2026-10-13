/* ==========================================================================
   ThesisTrace — storage.js
   Small, safe wrapper over localStorage for the research workspace.

   Design notes
   ------------
   - Two keys are used:
       MAIN_KEY        the versioned workspace record
       QUARANTINE_KEY  raw payloads that could not be parsed, capped, for
                       manual inspection. Never auto-deleted.
   - Every read/write is wrapped in try/catch. Nothing here ever throws.
   - If localStorage is unavailable (private mode, disabled, sandboxed),
     reads return empty results and writes return { ok:false }.
   - Malformed JSON, wrong-shaped payloads, and invalid records are moved
     to quarantine and skipped, so the app boots with an empty workspace
     instead of a crash.

   The investigation object shape used here follows the schema fixed in the
   ThesisTrace architecture:
     { id, title, question, companyIds, hypotheses, notes, assumptions,
       sourceLinks, createdAtISO, updatedAtISO, schemaVersion }

   This module has NOT been executed or tested. Compatibility with existing
   files is by interface agreement with data.js / research.js / calc.js and
   with the shape described in the project architecture; app.js does not
   exist yet, so this file defines the interface app.js will consume.
   ========================================================================== */

export const MAIN_KEY = "thesistrace:v1:investigations";
export const QUARANTINE_KEY = "thesistrace:v1:quarantine";
export const STORAGE_SCHEMA_VERSION = 1;

const MAX_QUARANTINE_ENTRIES = 20;
const MAX_QUARANTINE_PAYLOAD_CHARS = 20000;
const MAX_INVESTIGATIONS = 500;

/* --------------------------------------------------------------------------
   Storage availability detection (never throws)
   -------------------------------------------------------------------------- */
let storageRef = null;
try {
  if (typeof window !== "undefined" && window.localStorage) {
    storageRef = window.localStorage;
  }
} catch (e) {
  storageRef = null;
}

let storageAvailable = false;
if (storageRef) {
  try {
    const probe = "__tt_probe__";
    storageRef.setItem(probe, "1");
    storageRef.removeItem(probe);
    storageAvailable = true;
  } catch (e) {
    storageAvailable = false;
  }
}

export function isStorageAvailable() {
  return storageAvailable;
}

/* --------------------------------------------------------------------------
   Low-level safe primitives (never throw)
   -------------------------------------------------------------------------- */
function safeRead(key) {
  if (!storageAvailable || !storageRef) return null;
  try {
    return storageRef.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeWrite(key, value) {
  if (!storageAvailable || !storageRef) {
    return { ok: false, reason: "unavailable" };
  }
  try {
    storageRef.setItem(key, value);
    return { ok: true, reason: null };
  } catch (e) {
    const isQuota =
      e && (e.name === "QuotaExceededError" ||
            e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            e.code === 22 || e.code === 1014);
    return { ok: false, reason: isQuota ? "quota" : "error" };
  }
}

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function newId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return "inv_" + t + "_" + r;
}

export function makeInvestigationId() {
  return newId();
}

/* --------------------------------------------------------------------------
   Quarantine
   -------------------------------------------------------------------------- */
function pushQuarantine(rawText, reason) {
  let list = [];
  try {
    const existing = safeRead(QUARANTINE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed)) list = parsed;
    }
  } catch (e) {
    list = [];
  }

  const entry = {
    at: new Date().toISOString(),
    reason: String(reason || "unreadable"),
    payload:
      typeof rawText === "string"
        ? rawText.slice(0, MAX_QUARANTINE_PAYLOAD_CHARS)
        : null
  };
  list.unshift(entry);
  if (list.length > MAX_QUARANTINE_ENTRIES) {
    list = list.slice(0, MAX_QUARANTINE_ENTRIES);
  }
  safeWrite(QUARANTINE_KEY, JSON.stringify(list));
}

export function listQuarantine() {
  const raw = safeRead(QUARANTINE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function clearQuarantine() {
  if (!storageAvailable) return { ok: false, reason: "unavailable" };
  return safeWrite(QUARANTINE_KEY, JSON.stringify([]));
}

/* --------------------------------------------------------------------------
   Envelope read/write
   -------------------------------------------------------------------------- */
function emptyEnvelope() {
  return { schemaVersion: STORAGE_SCHEMA_VERSION, investigations: [] };
}

function readEnvelope() {
  const raw = safeRead(MAIN_KEY);
  if (!raw) return emptyEnvelope();

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    pushQuarantine(raw, "invalid_json");
    return emptyEnvelope();
  }

  if (!isPlainObject(parsed)) {
    pushQuarantine(raw, "wrong_shape");
    return emptyEnvelope();
  }

  const list = Array.isArray(parsed.investigations)
    ? parsed.investigations
    : [];
  const clean = [];
  const bad = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (isPlainObject(item) && typeof item.id === "string" && item.id) {
      clean.push(item);
    } else {
      bad.push(item);
    }
  }
  if (bad.length > 0) {
    try {
      pushQuarantine(JSON.stringify(bad), "invalid_records");
    } catch (e) {
      /* ignore */
    }
  }

  const schemaVersion =
    typeof parsed.schemaVersion === "number"
      ? parsed.schemaVersion
      : STORAGE_SCHEMA_VERSION;

  return { schemaVersion, investigations: clean };
}

function writeEnvelope(env) {
  const list = Array.isArray(env && env.investigations)
    ? env.investigations.slice(0, MAX_INVESTIGATIONS)
    : [];
  const payload = JSON.stringify({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    investigations: list
  });
  return safeWrite(MAIN_KEY, payload);
}

/* --------------------------------------------------------------------------
   Record normalisation
   -------------------------------------------------------------------------- */
export function normalizeInvestigation(input) {
  const now = new Date().toISOString();
  const src = isPlainObject(input) ? input : {};

  const id =
    typeof src.id === "string" && src.id ? src.id : newId();

  const title =
    typeof src.title === "string" && src.title.trim()
      ? src.title.slice(0, 300)
      : "Untitled investigation";

  const question =
    typeof src.question === "string" ? src.question.slice(0, 2000) : "";

  const companyIds = Array.isArray(src.companyIds)
    ? src.companyIds
        .filter(function (x) { return typeof x === "string"; })
        .slice(0, 50)
    : [];

  const hypotheses = Array.isArray(src.hypotheses)
    ? src.hypotheses.filter(isPlainObject).slice(0, 100)
    : [];

  const notes =
    typeof src.notes === "string" ? src.notes.slice(0, 50000) : "";

  const assumptions =
    typeof src.assumptions === "string"
      ? src.assumptions.slice(0, 20000)
      : "";

  const sourceLinks = Array.isArray(src.sourceLinks)
    ? src.sourceLinks
        .filter(function (l) {
          return isPlainObject(l) && typeof l.url === "string" && l.url;
        })
        .map(function (l) {
          return {
            label: typeof l.label === "string" ? l.label.slice(0, 300) : "",
            url: l.url.slice(0, 2000)
          };
        })
        .slice(0, 100)
    : [];

  const createdAtISO =
    typeof src.createdAtISO === "string" && src.createdAtISO
      ? src.createdAtISO
      : now;

  return {
    id: id,
    title: title,
    question: question,
    companyIds: companyIds,
    hypotheses: hypotheses,
    notes: notes,
    assumptions: assumptions,
    sourceLinks: sourceLinks,
    createdAtISO: createdAtISO,
    updatedAtISO: now,
    schemaVersion: STORAGE_SCHEMA_VERSION
  };
}

/* --------------------------------------------------------------------------
   Public API
   -------------------------------------------------------------------------- */
export function listInvestigations() {
  return readEnvelope().investigations;
}

export function getInvestigation(id) {
  if (typeof id !== "string" || !id) return null;
  const list = listInvestigations();
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

export function saveInvestigation(input) {
  if (!storageAvailable) {
    return { ok: false, reason: "unavailable", investigation: null };
  }
  const inv = normalizeInvestigation(input);
  const env = readEnvelope();
  let found = false;
  for (let i = 0; i < env.investigations.length; i += 1) {
    if (env.investigations[i].id === inv.id) {
      env.investigations[i] = inv;
      found = true;
      break;
    }
  }
  if (!found) env.investigations.unshift(inv);

  const w = writeEnvelope(env);
  return {
    ok: w.ok,
    reason: w.reason || null,
    investigation: w.ok ? inv : null
  };
}

export function deleteInvestigation(id) {
  if (!storageAvailable) {
    return { ok: false, reason: "unavailable", removed: false };
  }
  if (typeof id !== "string" || !id) {
    return { ok: false, reason: "invalid_id", removed: false };
  }
  const env = readEnvelope();
  const before = env.investigations.length;
  env.investigations = env.investigations.filter(function (x) {
    return x.id !== id;
  });
  if (env.investigations.length === before) {
    return { ok: true, reason: null, removed: false };
  }
  const w = writeEnvelope(env);
  return { ok: w.ok, reason: w.reason || null, removed: w.ok };
}

export function duplicateInvestigation(id) {
  const src = getInvestigation(id);
  if (!src) {
    return { ok: false, reason: "not_found", investigation: null };
  }
  const copyInput = {
    id: newId(),
    title: (src.title || "Untitled") + " (copy)",
    question: src.question,
    companyIds: src.companyIds,
    hypotheses: src.hypotheses,
    notes: src.notes,
    assumptions: src.assumptions,
    sourceLinks: src.sourceLinks
  };
  const copy = normalizeInvestigation(copyInput);
  if (!storageAvailable) {
    return { ok: false, reason: "unavailable", investigation: copy };
  }
  const env = readEnvelope();
  env.investigations.unshift(copy);
  const w = writeEnvelope(env);
  return {
    ok: w.ok,
    reason: w.reason || null,
    investigation: w.ok ? copy : null
  };
}

export function clearAllInvestigations() {
  if (!storageAvailable) return { ok: false, reason: "unavailable" };
  return writeEnvelope(emptyEnvelope());
}
