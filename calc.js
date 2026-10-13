/* ==========================================================================
   ThesisTrace — calc.js
   Pure financial-calculation functions. No DOM, no storage, no side effects.

   UNITS
   -----
   Percent (unit: "percent"):   pctChange, cagr, margin, operatingMargin,
                                cashConversion
     8.9 means 8.9%.
   Ratio (unit: "ratio"):       debtToCash, interestCoverage
   Summary (unit: "summary"):   trendSummary — value is an object.

   RESULT SHAPE
   ------------
   Every scalar calculation returns { status, value, unit, formula, note }.
   trendSummary may additionally include a `diagnostics` object that exposes
   fiscal-year presence and gap information even when status is not "ok".

   status ∈ { "ok", "insufficient_data", "undefined_base", "incompatible" }.
   A scalar calculation NEVER returns "ok" with NaN or Infinity: the computed
   value is passed through Number.isFinite() before being returned, and a
   non-finite result is converted to "undefined_base" with an explanatory note.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Centralized heuristic constants.
   -------------------------------------------------------------------------- */

/* Cash conversion heuristic used by research.js's cash_conversion_divergence.
   A ratio below this percentage of reported profit is treated as a PROMPT
   FOR INVESTIGATION, not as proof of poor earnings quality or of a real
   divergence. It is a convention for this prototype, not a universal rule. */
export const CASH_CONVERSION_LOW_THRESHOLD_PCT = 90;

/* --------------------------------------------------------------------------
   Internal helpers
   -------------------------------------------------------------------------- */

function numFrom(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "object" && "value" in v) {
    const n = v.value;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  }
  return null;
}

function result(status, value, unit, formula, note, diagnostics) {
  const r = {
    status: status,
    value: status === "ok" ? value : null,
    unit: unit,
    formula: formula,
    note: note || null
  };
  if (diagnostics !== undefined) r.diagnostics = diagnostics;
  return r;
}

function okOrOverflow(computed, unit, formula, noteIfOverflow) {
  if (typeof computed !== "number" || !Number.isFinite(computed)) {
    return result(
      "undefined_base", null, unit, formula,
      noteIfOverflow || "The computed result is not a finite number; check the inputs."
    );
  }
  return result("ok", computed, unit, formula, null);
}

/* --------------------------------------------------------------------------
   FISCAL-YEAR ADJACENCY
   -------------------------------------------------------------------------- */
export function areConsecutiveFYs(fyA, fyB) {
  const parse = function (fy) {
    const m = /^FY(\d{4})-(\d{2})$/.exec(String(fy || ""));
    if (!m) return null;
    return parseInt(m[1], 10);
  };
  const a = parse(fyA);
  const b = parse(fyB);
  if (a === null || b === null) return false;
  return b === a + 1;
}

/* --------------------------------------------------------------------------
   PERCENT CHANGE — unit: "percent"
   -------------------------------------------------------------------------- */
export function pctChange(prevRaw, currRaw) {
  const prev = numFrom(prevRaw);
  const curr = numFrom(currRaw);

  if (prev === null || curr === null) {
    return result(
      "insufficient_data", null, "percent",
      "(current − previous) ÷ |previous| × 100",
      "One or both values are missing or not numeric."
    );
  }
  if (prev === 0) {
    return result(
      "undefined_base", null, "percent",
      "(current − previous) ÷ |previous| × 100",
      "Conventional percent change is not meaningful when the base is zero."
    );
  }
  const computed = ((curr - prev) / Math.abs(prev)) * 100;
  const r = okOrOverflow(
    computed, "percent",
    "(current − previous) ÷ |previous| × 100",
    "The percent change is not a finite number; check the input range."
  );
  if (r.status === "ok" && prev < 0) {
    r.note = "Base is negative; the sign of the result should be read with care.";
  }
  return r;
}

/* --------------------------------------------------------------------------
   YEAR-OVER-YEAR GROWTH SERIES
   -------------------------------------------------------------------------- */
export function yoyGrowth(series) {
  const out = [];
  if (!Array.isArray(series) || series.length < 2) return out;
  for (let i = 1; i < series.length; i += 1) {
    out.push({
      fromIndex: i - 1,
      toIndex: i,
      from: series[i - 1],
      to: series[i],
      result: pctChange(series[i - 1], series[i])
    });
  }
  return out;
}

/* --------------------------------------------------------------------------
   MARGIN — unit: "percent"
   -------------------------------------------------------------------------- */
export function margin(numeratorRaw, revenueRaw) {
  const num = numFrom(numeratorRaw);
  const rev = numFrom(revenueRaw);
  if (num === null || rev === null) {
    return result(
      "insufficient_data", null, "percent",
      "(numerator ÷ revenue) × 100",
      "Numerator or revenue is missing or not numeric."
    );
  }
  if (rev <= 0) {
    return result(
      "undefined_base", null, "percent",
      "(numerator ÷ revenue) × 100",
      "Revenue is zero or negative; margin is not meaningful."
    );
  }
  return okOrOverflow(
    (num / rev) * 100, "percent",
    "(numerator ÷ revenue) × 100",
    "The margin is not a finite number; check the input range."
  );
}

/* --------------------------------------------------------------------------
   OPERATING MARGIN — unit: "percent"
   -------------------------------------------------------------------------- */
export function operatingMargin(revenueRaw, operatingExpensesRaw) {
  const rev = numFrom(revenueRaw);
  const opx = numFrom(operatingExpensesRaw);
  if (rev === null || opx === null) {
    return result(
      "insufficient_data", null, "percent",
      "((revenue − operating expenses) ÷ revenue) × 100",
      "Revenue or operating expenses is missing or not numeric."
    );
  }
  if (rev <= 0) {
    return result(
      "undefined_base", null, "percent",
      "((revenue − operating expenses) ÷ revenue) × 100",
      "Revenue is zero or negative; margin is not meaningful."
    );
  }
  return okOrOverflow(
    ((rev - opx) / rev) * 100, "percent",
    "((revenue − operating expenses) ÷ revenue) × 100",
    "The operating margin is not a finite number; check the input range."
  );
}

/* --------------------------------------------------------------------------
   CASH CONVERSION — unit: "percent"
   -------------------------------------------------------------------------- */
export function cashConversion(ocfRaw, profitRaw) {
  const ocf = numFrom(ocfRaw);
  const p = numFrom(profitRaw);
  if (ocf === null || p === null) {
    return result(
      "insufficient_data", null, "percent",
      "(operating cash flow ÷ reported profit) × 100",
      "Operating cash flow or profit is missing."
    );
  }
  if (p <= 0) {
    return result(
      "undefined_base", null, "percent",
      "(operating cash flow ÷ reported profit) × 100",
      "Reported profit is zero or negative; the ratio is not meaningful."
    );
  }
  return okOrOverflow(
    (ocf / p) * 100, "percent",
    "(operating cash flow ÷ reported profit) × 100",
    "The cash conversion is not a finite number; check the input range."
  );
}

/* --------------------------------------------------------------------------
   DEBT TO CASH — unit: "ratio"
   -------------------------------------------------------------------------- */
export function debtToCash(debtRaw, cashRaw) {
  const debt = numFrom(debtRaw);
  const cash = numFrom(cashRaw);
  if (debt === null || cash === null) {
    return result(
      "insufficient_data", null, "ratio",
      "total debt ÷ cash and equivalents",
      "Debt or cash is missing."
    );
  }
  if (cash <= 0) {
    return result(
      "undefined_base", null, "ratio",
      "total debt ÷ cash and equivalents",
      "Cash is zero or negative; the ratio is not meaningful."
    );
  }
  return okOrOverflow(
    debt / cash, "ratio",
    "total debt ÷ cash and equivalents",
    "The debt-to-cash ratio is not a finite number; check the input range."
  );
}

/* --------------------------------------------------------------------------
   INTEREST COVERAGE — unit: "ratio"
   -------------------------------------------------------------------------- */
export function interestCoverage(ebitRaw, interestRaw) {
  const ebit = numFrom(ebitRaw);
  const int = numFrom(interestRaw);
  if (ebit === null || int === null) {
    return result(
      "insufficient_data", null, "ratio",
      "EBIT ÷ interest expense",
      "EBIT or interest expense is missing."
    );
  }
  if (int <= 0) {
    return result(
      "undefined_base", null, "ratio",
      "EBIT ÷ interest expense",
      "Interest expense is zero or negative; coverage is not meaningful."
    );
  }
  return okOrOverflow(
    ebit / int, "ratio",
    "EBIT ÷ interest expense",
    "Interest coverage is not a finite number; check the input range."
  );
}

/* --------------------------------------------------------------------------
   CAGR — unit: "percent"
   -------------------------------------------------------------------------- */
export function cagr(firstRaw, lastRaw, yearsRaw) {
  const first = numFrom(firstRaw);
  const last = numFrom(lastRaw);
  const years = numFrom(yearsRaw);
  if (first === null || last === null || years === null) {
    return result(
      "insufficient_data", null, "percent",
      "((last ÷ first)^(1 ÷ years) − 1) × 100",
      "One or more inputs are missing."
    );
  }
  if (first <= 0 || years <= 0) {
    return result(
      "undefined_base", null, "percent",
      "((last ÷ first)^(1 ÷ years) − 1) × 100",
      "CAGR requires a positive starting value and a positive number of years."
    );
  }
  return okOrOverflow(
    (Math.pow(last / first, 1 / years) - 1) * 100, "percent",
    "((last ÷ first)^(1 ÷ years) − 1) × 100",
    "The computed CAGR is not a finite number; check the input range."
  );
}

/* --------------------------------------------------------------------------
   TREND SUMMARY — unit: "summary"
   Sorts by FY label. Distinguishes FYs with null values from FYs with no
   observation at all. Requires ≥ 2 finite points to report a numeric trend.
   On insufficient data, still exposes FY presence and gap information
   through `diagnostics`, without claiming a numeric trend.

   On success, value = {
     min, max, mean, first, last, direction, count,
     presentFYs, nullValueFYs, missingFYs, points
   }.
   diagnostics = { presentFYs, nullValueFYs, missingFYs, count }.
   -------------------------------------------------------------------------- */
export function trendSummary(points) {
  const formula =
    "min / max / mean / first / last / direction / count / " +
    "presentFYs / nullValueFYs / missingFYs";

  if (!Array.isArray(points)) {
    return result(
      "insufficient_data", null, "summary", formula,
      "No series supplied.",
      { presentFYs: [], nullValueFYs: [], missingFYs: [], count: 0 }
    );
  }

  const sorted = points.slice().sort(function (a, b) {
    return String((a && a.fy) || "").localeCompare(String((b && b.fy) || ""));
  });

  const presentFYs = [];
  const nullValueFYs = [];
  const finitePoints = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i];
    if (!p || typeof p !== "object") continue;
    const fy = p.fy || null;
    if (!fy) continue;
    presentFYs.push(fy);
    if (p.value === null || p.value === undefined) {
      nullValueFYs.push(fy);
      continue;
    }
    const v = numFrom(p.value);
    if (v === null) {
      nullValueFYs.push(fy);
    } else {
      finitePoints.push({ fy: fy, v: v });
    }
  }

  // Range-based missing FYs: FY labels between the first and last present
  // that are not present at all (no observation, null or otherwise).
  const missingFYs = presentFYs.length >= 2
    ? computeMissingFYs(presentFYs[0], presentFYs[presentFYs.length - 1], presentFYs)
    : [];

  const diagnostics = {
    presentFYs: presentFYs,
    nullValueFYs: nullValueFYs,
    missingFYs: missingFYs,
    count: finitePoints.length
  };

  if (finitePoints.length < 2) {
    return result(
      "insufficient_data", null, "summary", formula,
      "Fewer than two numeric observations are available (found " +
        finitePoints.length + ").",
      diagnostics
    );
  }

  const values = finitePoints.map(function (p) { return p.v; });
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const mean = values.reduce(function (a, b) { return a + b; }, 0) / values.length;

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !Number.isFinite(mean)
  ) {
    return result(
      "undefined_base", null, "summary", formula,
      "One or more derived statistics (min, max, mean) is not a finite " +
        "number; check the input values.",
      diagnostics
    );
  }

  const firstP = finitePoints[0];
  const lastP = finitePoints[finitePoints.length - 1];

  let direction;
  if (lastP.v > firstP.v) direction = "up";
  else if (lastP.v < firstP.v) direction = "down";
  else direction = "flat";

  return result(
    "ok",
    {
      min: min, max: max, mean: mean,
      first: firstP.v, last: lastP.v,
      direction: direction,
      count: finitePoints.length,
      presentFYs: presentFYs,
      nullValueFYs: nullValueFYs,
      missingFYs: missingFYs,
      points: finitePoints
    },
    "summary", formula, null, diagnostics
  );
}

function computeMissingFYs(startFY, endFY, presentFYs) {
  const parse = function (fy) {
    const m = /^FY(\d{4})-(\d{2})$/.exec(String(fy || ""));
    if (!m) return null;
    return parseInt(m[1], 10);
  };
  const start = parse(startFY);
  const end = parse(endFY);
  if (start === null || end === null || end < start) return [];
  const present = new Set(presentFYs);
  const out = [];
  for (let y = start; y <= end; y += 1) {
    const next = String((y + 1) % 100).padStart(2, "0");
    const label = "FY" + y + "-" + next;
    if (!present.has(label)) out.push(label);
  }
  return out;
}

/* --------------------------------------------------------------------------
   COMPARABILITY
   -------------------------------------------------------------------------- */
export function comparability(a, b) {
  const reasons = [];
  if (!a || !b) {
    return { comparable: false, reasons: ["One side is missing."] };
  }
  if (a.currency && b.currency && a.currency !== b.currency) {
    reasons.push("Different reporting currencies (" + a.currency + " vs " + b.currency + ").");
  }
  if (a.unit && b.unit && a.unit !== b.unit) {
    reasons.push("Different units (" + a.unit + " vs " + b.unit + ").");
  }
  if (a.scope && b.scope && a.scope !== b.scope) {
    reasons.push("Different statement scope (" + a.scope + " vs " + b.scope + ").");
  }
  if (a.periodType && b.periodType && a.periodType !== b.periodType) {
    reasons.push("Different period type (" + a.periodType + " vs " + b.periodType + ").");
  }
  if (a.fy && b.fy && a.fy !== b.fy) {
    reasons.push("Different fiscal years (" + a.fy + " vs " + b.fy + ").");
  }
  return { comparable: reasons.length === 0, reasons: reasons };
}

/* --------------------------------------------------------------------------
   OBSERVATION LOOKUP
   -------------------------------------------------------------------------- */
export function findObservation(company, metricKey, fy, scope) {
  if (!company || !Array.isArray(company.observations)) return null;
  const wantedScope = scope || null;
  for (let i = 0; i < company.observations.length; i += 1) {
    const o = company.observations[i];
    if (
      o.metricKey === metricKey &&
      o.fy === fy &&
      (wantedScope === null || o.scope === wantedScope)
    ) {
      return o;
    }
  }
  return null;
}

/* --------------------------------------------------------------------------
   METRIC SERIES — sorted by FY, null-value observations retained.
   -------------------------------------------------------------------------- */
export function metricSeries(company, metricKey) {
  if (!company || !Array.isArray(company.observations)) return [];
  return company.observations
    .filter(function (o) { return o.metricKey === metricKey; })
    .map(function (o) {
      return { fy: o.fy, value: numFrom(o), observation: o };
    })
    .sort(function (a, b) { return String(a.fy).localeCompare(String(b.fy)); });
}

/* --------------------------------------------------------------------------
   PAIRED SERIES — period-aligned.
   -------------------------------------------------------------------------- */
export function pairedSeries(company, keyA, keyB) {
  const aRows = metricSeries(company, keyA);
  const bRows = metricSeries(company, keyB);
  const mapA = new Map(aRows.map(function (r) { return [r.fy, r]; }));
  const mapB = new Map(bRows.map(function (r) { return [r.fy, r]; }));
  const years = Array.from(new Set([]
    .concat(Array.from(mapA.keys()))
    .concat(Array.from(mapB.keys()))
  )).sort(function (x, y) { return String(x).localeCompare(String(y)); });

  const pairs = [];
  const gaps = [];
  for (let i = 0; i < years.length; i += 1) {
    const fy = years[i];
    const a = mapA.get(fy) || null;
    const b = mapB.get(fy) || null;
    if (!a || !b) {
      const missing = [];
      if (!a) missing.push("a");
      if (!b) missing.push("b");
      gaps.push({ fy: fy, missing: missing.join(",") });
      continue;
    }
    if (a.value === null || b.value === null) {
      const missing = [];
      if (a.value === null) missing.push("a");
      if (b.value === null) missing.push("b");
      gaps.push({ fy: fy, missing: missing.join(",") });
      continue;
    }
    pairs.push({ fy: fy, a: a, b: b });
  }
  return { pairs: pairs, gaps: gaps, aKey: keyA, bKey: keyB };
}

/* --------------------------------------------------------------------------
   LISTS
   -------------------------------------------------------------------------- */
export function listFiscalYears(company) {
  if (!company || !Array.isArray(company.observations)) return [];
  const set = new Set();
  for (let i = 0; i < company.observations.length; i += 1) set.add(company.observations[i].fy);
  return Array.from(set).sort(function (a, b) { return String(a).localeCompare(String(b)); });
}

export function listMetrics(company) {
  if (!company || !Array.isArray(company.observations)) return [];
  const set = new Set();
  for (let i = 0; i < company.observations.length; i += 1) set.add(company.observations[i].metricKey);
  return Array.from(set).sort();
}

/* --------------------------------------------------------------------------
   VERIFICATION BREAKDOWN
   -------------------------------------------------------------------------- */
export function verificationBreakdown(company, metricKey) {
  const counts = {
    verified: 0, calculated: 0, provisional: 0,
    sample: 0, unavailable: 0, missing: 0
  };
  if (!company || !Array.isArray(company.observations)) return counts;
  const list = metricKey
    ? company.observations.filter(function (o) { return o.metricKey === metricKey; })
    : company.observations;
  for (let i = 0; i < list.length; i += 1) {
    const v = list[i].verification;
    if (counts[v] !== undefined) counts[v] += 1;
    else counts.missing += 1;
  }
  return counts;
}

/* --------------------------------------------------------------------------
   EVIDENCE TIER — from verification state of the observations actually used.
   Unknown or absent verification states downgrade to "unusable"; sample and
   provisional are never upgraded above "low" and "medium" respectively.
   -------------------------------------------------------------------------- */
export function evidenceTier(observations) {
  if (!Array.isArray(observations) || observations.length === 0) return "unusable";
  const states = observations.map(function (o) { return o && o.verification; });
  return evidenceTierFromStates(states);
}

export function evidenceTierFromStates(states) {
  if (!Array.isArray(states) || states.length === 0) return "unusable";
  // Unknown or unavailable downgrades to unusable.
  for (let i = 0; i < states.length; i += 1) {
    const s = states[i];
    if (s === undefined || s === null || s === "unavailable") return "unusable";
    if (s !== "verified" && s !== "calculated" && s !== "provisional" && s !== "sample") {
      return "unusable";
    }
  }
  // Any sample caps at "low".
  if (states.indexOf("sample") !== -1) return "low";
  // Any provisional caps at "medium".
  if (states.indexOf("provisional") !== -1) return "medium";
  // Otherwise everything is verified or calculated → high.
  return "high";
}

export function evidenceTierLabel(tier) {
  switch (tier) {
    case "high":
      return "All inputs referenced in evidence are verified or calculated from verified inputs.";
    case "medium":
      return "At least one input referenced in evidence is provisional; treat the result as indicative.";
    case "low":
      return "At least one input referenced in evidence is a teaching sample; do not draw real-world conclusions.";
    default:
      return "No usable inputs were referenced in this analysis, or their verification state is unknown.";
  }
}

/* --------------------------------------------------------------------------
   OBSERVATION DESCRIPTOR used for evidence provenance.
   -------------------------------------------------------------------------- */
export function describeObservation(obs) {
  if (!obs) {
    return {
      metricKey: null, fy: null, value: null,
      verification: "unavailable", scope: null,
      currency: null, unit: null
    };
  }
  const val = (typeof obs.value === "number" && Number.isFinite(obs.value)) ? obs.value : null;
  return {
    metricKey: obs.metricKey || null,
    fy: obs.fy || null,
    value: val,
    verification: obs.verification || "unavailable",
    scope: obs.scope || null,
    currency: obs.currency || null,
    unit: obs.unit || null
  };
}
