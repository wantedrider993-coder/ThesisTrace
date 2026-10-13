/* ==========================================================================
   ThesisTrace — research.js
   Turns SECTOR_HYPOTHESES in data.js into evaluated hypothesis cards.

   Rule-based. No external service, no AI inference, no fabricated sources.
   Never promotes a provisional or sample observation to a verified state.

   UNITS — growth figures in evidence strings are percent (8.9 = 8.9%).

   HYPOTHESIS STATUS (derived from directional evidence only)
   -----------------------------------------------------------
     "supported"              ≥1 supporting item, 0 contradicting items
     "contradicted"           ≥1 contradicting item, 0 supporting items
     "mixed"                  ≥1 of each
     "insufficient_evidence"  no directional item could be produced
     "data_incomplete"        a required metric has no observations at all

   DATA COMPLETENESS (independent of status)
   ------------------------------------------
     "complete"   every required metric present AND the analysis could be
                  performed with the aligned/consecutive periods available
     "partial"    at least one required metric missing OR the analysis could
                  not be performed for the periods available
     "missing"    no required metric has any finite observation

   EVIDENCE TIER
   -------------
   Derived ONLY from observations actually referenced by the input lists of
   supporting/contradicting items; when there are none, from investigatory
   items; when neither exists, "unusable". Unknown verification states never
   upgrade confidence.
   ========================================================================== */

import {
  metricSeries,
  pairedSeries,
  pctChange,
  operatingMargin,
  cashConversion,
  evidenceTierFromStates,
  evidenceTierLabel,
  describeObservation,
  areConsecutiveFYs,
  CASH_CONVERSION_LOW_THRESHOLD_PCT
} from "./calc.js";

import { SECTOR_HYPOTHESES, METRIC_META, INDUSTRIES } from "./data.js";

/* --------------------------------------------------------------------------
   Public entry point.
   -------------------------------------------------------------------------- */
export function evaluateCompany(company, question) {
  if (!company || !Array.isArray(company.observations)) {
    return {
      companyId: null,
      question: question || null,
      hypotheses: [],
      disclaimer:
        "No company record was supplied, so no hypotheses could be evaluated."
    };
  }

  const industry = INDUSTRIES[company.industryKey] || null;
  const sectorKey = industry ? industry.key : null;

  const applicable = SECTOR_HYPOTHESES.filter(function (h) {
    if (h.appliesToIndustries.indexOf("*") !== -1) return true;
    if (sectorKey && h.appliesToIndustries.indexOf(sectorKey) !== -1) return true;
    return false;
  });

  const hypotheses = applicable.map(function (template) {
    return buildHypothesisCard(company, template);
  });

  return {
    companyId: company.id,
    question: question || null,
    hypotheses: hypotheses,
    disclaimer:
      "Rule-based analysis. Hypotheses are prompts for investigation, not " +
      "conclusions. Correlation does not establish causation. Nothing here " +
      "is investment advice."
  };
}

/* --------------------------------------------------------------------------
   Build one hypothesis card.
   -------------------------------------------------------------------------- */
function buildHypothesisCard(company, template) {
  const required = template.requiredMetrics || [];
  const available = [];
  const missing = [];

  for (let i = 0; i < required.length; i += 1) {
    const key = required[i];
    const series = metricSeries(company, key);
    // A metric is "available" if at least one finite value exists. A metric
    // with only null-value observations is treated as missing.
    const hasFinite = series.some(function (p) { return p.value !== null; });
    if (hasFinite) {
      available.push({ metricKey: key, series: series });
    } else {
      missing.push({
        metricKey: key,
        need: (METRIC_META[key] && METRIC_META[key].label) || key
      });
    }
  }

  const evaluated = computeEvidence(company, template, available, missing);

  const status = deriveStatus(
    missing.length,
    available.length,
    evaluated.supporting,
    evaluated.contradicting
  );

  const dataCompleteness = deriveCompleteness(
    missing,
    available,
    evaluated.sufficiency
  );

  // EVIDENCE TIER — from observations referenced by directional evidence.
  // Fall back to investigatory items. Fall back to "unusable" if nothing.
  const directionalItems = evaluated.supporting.concat(evaluated.contradicting);
  const tierSourceItems = directionalItems.length > 0
    ? directionalItems
    : evaluated.investigatory;

  const tierStates = collectVerificationStates(tierSourceItems);
  const provenanceTier = evidenceTierFromStates(tierStates);

  return {
    id: template.id,
    title: template.title,
    description: template.description,
    status: status,
    dataCompleteness: dataCompleteness,
    sufficiency: evaluated.sufficiency,
    evidenceTier: provenanceTier,
    evidenceTierLabel: evidenceTierLabel(provenanceTier),
    supporting: evaluated.supporting,
    contradicting: evaluated.contradicting,
    investigatory: evaluated.investigatory,
    missing: missing,
    dataGaps: evaluated.dataGaps,
    nextStep: template.nextStep,
    uncertainty: template.uncertaintyBase,
    uncertaintyReason: template.uncertaintyReason
  };
}

function collectVerificationStates(items) {
  const states = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || !Array.isArray(item.inputs)) continue;
    for (let j = 0; j < item.inputs.length; j += 1) {
      const inp = item.inputs[j];
      if (inp && typeof inp.verification === "string") states.push(inp.verification);
    }
  }
  return states;
}

/* --------------------------------------------------------------------------
   STATUS AND COMPLETENESS
   -------------------------------------------------------------------------- */
function deriveStatus(missingCount, availableCount, supporting, contradicting) {
  if (missingCount > 0 && availableCount === 0) return "data_incomplete";
  const hasSupport = supporting.length > 0;
  const hasContra = contradicting.length > 0;
  if (hasSupport && !hasContra) return "supported";
  if (hasContra && !hasSupport) return "contradicted";
  if (hasSupport && hasContra) return "mixed";
  return "insufficient_evidence";
}

/* Completeness is separate from directional status. It reflects whether the
   required metrics and the aligned/consecutive periods needed for the
   intended analysis actually exist. `sufficiency` is set by each branch:
     "sufficient"           — the analysis could be performed with the
                              aligned/consecutive periods available
     "insufficient_periods" — required metrics present but the analysis could
                              not be performed for the periods available
     "no_required_data"     — no required metric has any finite observation
     "schema_unsupported"   — hypothesis requires data the schema lacks
*/
function deriveCompleteness(missing, available, sufficiency) {
  if (sufficiency === "no_required_data") return "missing";
  if (missing.length > 0 && available.length === 0) return "missing";
  if (sufficiency === "sufficient" && missing.length === 0) return "complete";
  return "partial";
}

/* --------------------------------------------------------------------------
   EVIDENCE COMPUTATION
   Evidence item shape:
     {
       fy,          // FY the claim refers to (or null)
       fys,         // optional "FY→FY ..." range string
       metricKeys,  // array of metric keys
       statement,   // human-readable string
       inputs,      // array of describeObservation results
       derivation,  // operation performed
       status       // "ok" | "insufficient_data"
     }
   Supporting and contradicting items require an actual valid calculation;
   presence of data alone never produces a directional item.
   -------------------------------------------------------------------------- */
function computeEvidence(company, template, available, missing) {
  const supporting = [];
  const contradicting = [];
  const investigatory = [];
  const dataGaps = [];
  let sufficiency = "insufficient_periods";

  switch (template.id) {

    /* ================================================================ */
    case "revenue_growth_slowdown": {
      const revSeries = metricSeries(company, "revenue"); // sorted, keeps nulls
      const profSeries = metricSeries(company, "profit");
      const profObs = profSeries.filter(function (p) { return p.value !== null; });

      // Step 1: build consecutive YoY comparisons from the SORTED series,
      // preserving null-value FYs so they show up as gaps rather than being
      // silently removed.
      const comparisons = [];
      for (let i = 1; i < revSeries.length; i += 1) {
        const prev = revSeries[i - 1];
        const curr = revSeries[i];

        if (!areConsecutiveFYs(prev.fy, curr.fy)) {
          dataGaps.push({
            fy: curr.fy,
            missing: "a",
            note: "Revenue is not contiguous with " + prev.fy +
              "; comparison skipped."
          });
          continue;
        }
        if (prev.value === null && curr.value === null) {
          dataGaps.push({
            fy: curr.fy,
            missing: "a,b",
            note: "Revenue is null in both " + prev.fy + " and " + curr.fy + "."
          });
          continue;
        }
        if (prev.value === null) {
          dataGaps.push({
            fy: prev.fy,
            missing: "a",
            note: "Revenue value is null in " + prev.fy + "."
          });
          continue;
        }
        if (curr.value === null) {
          dataGaps.push({
            fy: curr.fy,
            missing: "b",
            note: "Revenue value is null in " + curr.fy + "."
          });
          continue;
        }
        const chg = pctChange(prev.value, curr.value);
        if (chg.status !== "ok") continue;
        comparisons.push({
          fromFY: prev.fy,
          toFY: curr.fy,
          change: chg,
          fromObs: prev.observation,
          toObs: curr.observation
        });
      }

      // Step 2: chain comparisons — earlier.toFY must equal later.fromFY.
      let chainedComparisonsCount = 0;
      let directionalCount = 0;

      for (let i = 1; i < comparisons.length; i += 1) {
        const earlier = comparisons[i - 1];
        const later = comparisons[i];
        if (earlier.toFY !== later.fromFY) {
          dataGaps.push({
            fy: later.toFY,
            missing: "a",
            note: "Growth-rate comparison skipped: " + earlier.toFY +
              " does not chain to " + later.fromFY + "."
          });
          continue;
        }
        chainedComparisonsCount += 1;
        const delta = later.change.value - earlier.change.value;
        const pairFys = earlier.fromFY + "→" + earlier.toFY +
          " then " + later.fromFY + "→" + later.toFY;
        const inputs = [
          describeObservation(earlier.fromObs),
          describeObservation(earlier.toObs),
          describeObservation(later.fromObs),
          describeObservation(later.toObs)
        ];
        const base =
          "Revenue growth was " + fmtPct(earlier.change.value) + " in " +
          earlier.fromFY + "→" + earlier.toFY + ", then " +
          fmtPct(later.change.value) + " in " +
          later.fromFY + "→" + later.toFY + ".";

        if (delta < -0.01) {
          supporting.push({
            fy: later.toFY, fys: pairFys,
            metricKeys: ["revenue"],
            statement: base +
              " Growth decelerated across these chained consecutive periods.",
            inputs: inputs,
            derivation: "pctChange (chained consecutive pairs)",
            status: "ok"
          });
          directionalCount += 1;
        } else if (delta > 0.01) {
          contradicting.push({
            fy: later.toFY, fys: pairFys,
            metricKeys: ["revenue"],
            statement: base +
              " Growth accelerated across these chained consecutive periods.",
            inputs: inputs,
            derivation: "pctChange (chained consecutive pairs)",
            status: "ok"
          });
          directionalCount += 1;
        }
      }

      if (chainedComparisonsCount === 0) {
        // The analysis could not be performed at all.
        sufficiency = "insufficient_periods";
        let reason;
        if (comparisons.length < 2) {
          reason =
            "Fewer than two consecutive revenue-growth rates could be " +
            "computed (found " + comparisons.length + "). A chained " +
            "comparison of growth rates requires at least three consecutive " +
            "fiscal years of revenue with finite values.";
        } else {
          reason =
            "Consecutive revenue-growth rates exist but none chain end-to-end " +
            "(gaps or non-adjacent periods intervene), so the growth rates " +
            "cannot be compared as a continuous sequence.";
        }
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["revenue"],
          statement: reason,
          inputs: comparisons.reduce(function (acc, c) {
            return acc.concat([
              describeObservation(c.fromObs),
              describeObservation(c.toObs)
            ]);
          }, []),
          derivation: "pctChange (chained consecutive pairs)",
          status: "insufficient_data"
        });
      } else {
        // The analysis could be performed.
        sufficiency = "sufficient";
        if (directionalCount === 0) {
          investigatory.push({
            fy: null, fys: null,
            metricKeys: ["revenue"],
            statement:
              "Chained consecutive revenue-growth comparisons were made " +
              "(" + chainedComparisonsCount + " in total), but the growth " +
              "rates were effectively unchanged within the tolerance used " +
              "(±0.01 percentage point). No directional evidence for a " +
              "slowdown or acceleration could be formed.",
            inputs: comparisons.reduce(function (acc, c) {
              return acc.concat([
                describeObservation(c.fromObs),
                describeObservation(c.toObs)
              ]);
            }, []),
            derivation: "pctChange (chained consecutive pairs)",
            status: "ok"
          });
        }
      }

      // Context: profit series presence is not directional for this hypothesis.
      if (profObs.length >= 2) {
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["revenue", "profit"],
          statement:
            "Profit observations are also present. The revenue-growth " +
            "pattern above describes only the top line; it does not by " +
            "itself establish why reported profit moved.",
          inputs: profObs.map(function (p) { return describeObservation(p.observation); }),
          derivation: "context only",
          status: "ok"
        });
      }
      break;
    }

    /* ================================================================ */
    case "margin_compression": {
      const paired = pairedSeries(company, "revenue", "operatingExpenses");
      for (let i = 0; i < paired.gaps.length; i += 1) dataGaps.push(paired.gaps[i]);

      const margins = [];
      for (let i = 0; i < paired.pairs.length; i += 1) {
        const p = paired.pairs[i];
        const m = operatingMargin(p.a.value, p.b.value);
        if (m.status === "ok") {
          margins.push({
            fy: p.fy, margin: m,
            revObs: p.a.observation, opxObs: p.b.observation
          });
        }
      }

      let adjacentCount = 0;
      let directionalCount = 0;

      for (let i = 1; i < margins.length; i += 1) {
        const prev = margins[i - 1];
        const curr = margins[i];
        if (!areConsecutiveFYs(prev.fy, curr.fy)) {
          dataGaps.push({
            fy: curr.fy, missing: "a,b",
            note: "Margin comparison skipped across non-contiguous periods " +
              "(" + prev.fy + " to " + curr.fy + ")."
          });
          continue;
        }
        adjacentCount += 1;
        const delta = curr.margin.value - prev.margin.value;
        const inputs = [
          describeObservation(prev.revObs),
          describeObservation(prev.opxObs),
          describeObservation(curr.revObs),
          describeObservation(curr.opxObs)
        ];
        const base =
          "Operating margin was " + fmtPct(prev.margin.value) + " in " +
          prev.fy + " and " + fmtPct(curr.margin.value) + " in " + curr.fy + ".";
        if (delta < -0.01) {
          supporting.push({
            fy: curr.fy, fys: prev.fy + "→" + curr.fy,
            metricKeys: ["revenue", "operatingExpenses"],
            statement: base + " This is a contraction across these adjacent periods.",
            inputs: inputs,
            derivation: "operatingMargin per adjacent aligned period",
            status: "ok"
          });
          directionalCount += 1;
        } else if (delta > 0.01) {
          contradicting.push({
            fy: curr.fy, fys: prev.fy + "→" + curr.fy,
            metricKeys: ["revenue", "operatingExpenses"],
            statement: base + " This is an expansion across these adjacent periods, not a contraction.",
            inputs: inputs,
            derivation: "operatingMargin per adjacent aligned period",
            status: "ok"
          });
          directionalCount += 1;
        }
      }

      if (adjacentCount === 0) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["revenue", "operatingExpenses"],
          statement:
            "Operating margin could be computed for " + margins.length +
            " period(s), but no two of them are adjacent, so a margin trend " +
            "cannot be formed. Aligned adjacent periods are required.",
          inputs: margins.reduce(function (acc, m) {
            return acc.concat([
              describeObservation(m.revObs),
              describeObservation(m.opxObs)
            ]);
          }, []),
          derivation: "operatingMargin per adjacent aligned period",
          status: "insufficient_data"
        });
      } else if (directionalCount === 0) {
        sufficiency = "sufficient";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["revenue", "operatingExpenses"],
          statement:
            "Adjacent aligned operating-margin comparisons were made (" +
            adjacentCount + " in total), but none exceeded the tolerance " +
            "used (±0.01 percentage point). No directional evidence for " +
            "compression or expansion could be formed.",
          inputs: margins.reduce(function (acc, m) {
            return acc.concat([
              describeObservation(m.revObs),
              describeObservation(m.opxObs)
            ]);
          }, []),
          derivation: "operatingMargin per adjacent aligned period",
          status: "ok"
        });
      } else {
        sufficiency = "sufficient";
      }
      break;
    }

    /* ================================================================ */
    case "cash_conversion_divergence": {
      const paired = pairedSeries(company, "profit", "operatingCashFlow");
      for (let i = 0; i < paired.gaps.length; i += 1) dataGaps.push(paired.gaps[i]);

      const ratios = [];
      for (let i = 0; i < paired.pairs.length; i += 1) {
        const p = paired.pairs[i];
        const r = cashConversion(p.b.value, p.a.value);
        if (r.status === "ok") {
          ratios.push({
            fy: p.fy, ratio: r,
            profitObs: p.a.observation, ocfObs: p.b.observation
          });
        }
      }

      if (ratios.length === 0) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["profit", "operatingCashFlow"],
          statement:
            "Operating cash flow as a percentage of reported profit could " +
            "not be computed for any aligned period with positive profit.",
          inputs: [],
          derivation: "cashConversion per aligned period",
          status: "insufficient_data"
        });
        break;
      }

      sufficiency = "sufficient";
      for (let i = 0; i < ratios.length; i += 1) {
        const r = ratios[i];
        const inputs = [
          describeObservation(r.profitObs),
          describeObservation(r.ocfObs)
        ];
        if (r.ratio.value < CASH_CONVERSION_LOW_THRESHOLD_PCT) {
          supporting.push({
            fy: r.fy, fys: r.fy,
            metricKeys: ["profit", "operatingCashFlow"],
            statement:
              "In " + r.fy + ", operating cash flow was " +
              fmtPct(r.ratio.value) + " of reported profit, below the " +
              "ThesisTrace investigative threshold of " +
              CASH_CONVERSION_LOW_THRESHOLD_PCT + "%. This is a prompt for " +
              "investigation; it is not by itself proof of a divergence or " +
              "of poor earnings quality. A single period below the threshold " +
              "may reflect ordinary timing.",
            inputs: inputs,
            derivation: "cashConversion per aligned period",
            status: "ok"
          });
        } else {
          contradicting.push({
            fy: r.fy, fys: r.fy,
            metricKeys: ["profit", "operatingCashFlow"],
            statement:
              "In " + r.fy + ", operating cash flow was " +
              fmtPct(r.ratio.value) + " of reported profit, at or above the " +
              "ThesisTrace investigative threshold of " +
              CASH_CONVERSION_LOW_THRESHOLD_PCT + "%, which does not " +
              "indicate a divergence.",
            inputs: inputs,
            derivation: "cashConversion per aligned period",
            status: "ok"
          });
        }
      }
      break;
    }

    /* ================================================================ */
    case "other_income_or_exceptional": {
      const paired = pairedSeries(company, "profit", "otherIncome");
      for (let i = 0; i < paired.gaps.length; i += 1) dataGaps.push(paired.gaps[i]);

      if (paired.pairs.length < 2) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["profit", "otherIncome"],
          statement:
            "Other income and profit are aligned for only " +
            paired.pairs.length + " period(s). A relationship cannot be " +
            "argued from fewer than two. Presence of the data alone does " +
            "not establish any contribution.",
          inputs: paired.pairs.reduce(function (acc, p) {
            return acc.concat([
              describeObservation(p.a.observation),
              describeObservation(p.b.observation)
            ]);
          }, []),
          derivation: "pairedSeries(profit, otherIncome)",
          status: "insufficient_data"
        });
        break;
      }

      // Build shares only where profit > 0 and share is finite.
      const shares = [];
      for (let i = 0; i < paired.pairs.length; i += 1) {
        const p = paired.pairs[i];
        if (p.a.value > 0) {
          const share = (p.b.value / p.a.value) * 100;
          if (Number.isFinite(share)) {
            shares.push({
              fy: p.fy, share: share,
              profitObs: p.a.observation, otherObs: p.b.observation
            });
          }
        }
      }

      if (shares.length < 2) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["profit", "otherIncome"],
          statement:
            "Other income as a share of reported profit can be computed for " +
            "fewer than two periods (reported profit must be positive). A " +
            "trend cannot be established.",
          inputs: paired.pairs.reduce(function (acc, p) {
            return acc.concat([
              describeObservation(p.a.observation),
              describeObservation(p.b.observation)
            ]);
          }, []),
          derivation: "(other income ÷ reported profit) × 100 per period",
          status: "insufficient_data"
        });
        break;
      }

      // Compare adjacent fiscal years only. Never bridge missing years.
      let adjacentCount = 0;
      let directionalCount = 0;
      for (let i = 1; i < shares.length; i += 1) {
        const prev = shares[i - 1];
        const curr = shares[i];
        if (!areConsecutiveFYs(prev.fy, curr.fy)) {
          dataGaps.push({
            fy: curr.fy, missing: "a,b",
            note:
              "Other-income share comparison skipped across non-contiguous " +
              "periods (" + prev.fy + " to " + curr.fy + ")."
          });
          continue;
        }
        adjacentCount += 1;
        const delta = curr.share - prev.share;
        const inputs = [
          describeObservation(prev.profitObs),
          describeObservation(prev.otherObs),
          describeObservation(curr.profitObs),
          describeObservation(curr.otherObs)
        ];
        const base =
          "Other income was " + fmtPct(prev.share) + " of reported profit in " +
          prev.fy + " and " + fmtPct(curr.share) + " in " + curr.fy + ".";
        if (delta > 0.01) {
          supporting.push({
            fy: curr.fy, fys: prev.fy + "→" + curr.fy,
            metricKeys: ["profit", "otherIncome"],
            statement:
              base + " The share rose across these adjacent periods. This " +
              "describes a pattern; it does not establish that other income " +
              "caused the movement in reported profit.",
            inputs: inputs,
            derivation:
              "(other income ÷ reported profit) × 100 per adjacent period",
            status: "ok"
          });
          directionalCount += 1;
        } else if (delta < -0.01) {
          contradicting.push({
            fy: curr.fy, fys: prev.fy + "→" + curr.fy,
            metricKeys: ["profit", "otherIncome"],
            statement:
              base + " The share fell across these adjacent periods, so " +
              "other income is not increasing its contribution to reported " +
              "profit.",
            inputs: inputs,
            derivation:
              "(other income ÷ reported profit) × 100 per adjacent period",
            status: "ok"
          });
          directionalCount += 1;
        }
      }

      if (adjacentCount === 0) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["profit", "otherIncome"],
          statement:
            "Other-income share could be computed for " + shares.length +
            " period(s), but none of them are adjacent, so a within-period " +
            "share trend cannot be formed.",
          inputs: shares.reduce(function (acc, s) {
            return acc.concat([
              describeObservation(s.profitObs),
              describeObservation(s.otherObs)
            ]);
          }, []),
          derivation:
            "(other income ÷ reported profit) × 100 per adjacent period",
          status: "insufficient_data"
        });
      } else if (directionalCount === 0) {
        sufficiency = "sufficient";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["profit", "otherIncome"],
          statement:
            "Adjacent aligned share comparisons were made (" + adjacentCount +
            " in total), but the share was effectively unchanged within the " +
            "tolerance used (±0.01 percentage point). No directional " +
            "evidence for or against a contribution could be formed.",
          inputs: shares.reduce(function (acc, s) {
            return acc.concat([
              describeObservation(s.profitObs),
              describeObservation(s.otherObs)
            ]);
          }, []),
          derivation:
            "(other income ÷ reported profit) × 100 per adjacent period",
          status: "ok"
        });
      } else {
        sufficiency = "sufficient";
      }
      break;
    }

    /* ================================================================ */
    case "working_capital_swing": {
      const paired = pairedSeries(company, "operatingCashFlow", "workingCapitalChange");
      for (let i = 0; i < paired.gaps.length; i += 1) dataGaps.push(paired.gaps[i]);

      if (paired.pairs.length < 2) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["operatingCashFlow", "workingCapitalChange"],
          statement:
            "Operating cash flow and working-capital movement are aligned " +
            "for only " + paired.pairs.length + " period(s). A descriptive " +
            "grouping cannot be formed from fewer than two. Presence of a " +
            "working-capital line by itself does not support a conclusion.",
          inputs: paired.pairs.reduce(function (acc, p) {
            return acc.concat([
              describeObservation(p.a.observation),
              describeObservation(p.b.observation)
            ]);
          }, []),
          derivation: "pairedSeries(operatingCashFlow, workingCapitalChange)",
          status: "insufficient_data"
        });
        break;
      }

      const absorbing = paired.pairs.filter(function (p) { return p.b.value < 0; });
      const releasing = paired.pairs.filter(function (p) { return p.b.value > 0; });

      if (absorbing.length === 0 || releasing.length === 0) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["operatingCashFlow", "workingCapitalChange"],
          statement:
            "Working-capital movements across the aligned periods are all " +
            "in the same direction (all absorbing or all releasing), so a " +
            "contrast between absorbing and releasing periods cannot be " +
            "formed. No descriptive comparison can be made from this dataset.",
          inputs: paired.pairs.reduce(function (acc, p) {
            return acc.concat([
              describeObservation(p.a.observation),
              describeObservation(p.b.observation)
            ]);
          }, []),
          derivation: "pairedSeries(operatingCashFlow, workingCapitalChange)",
          status: "insufficient_data"
        });
        break;
      }

      const avgAbsorbing =
        absorbing.reduce(function (s, p) { return s + p.a.value; }, 0) / absorbing.length;
      const avgReleasing =
        releasing.reduce(function (s, p) { return s + p.a.value; }, 0) / releasing.length;

      if (!Number.isFinite(avgAbsorbing) || !Number.isFinite(avgReleasing)) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["operatingCashFlow", "workingCapitalChange"],
          statement:
            "The grouped averages are not finite numbers, so the descriptive " +
            "comparison cannot be formed safely.",
          inputs: paired.pairs.reduce(function (acc, p) {
            return acc.concat([
              describeObservation(p.a.observation),
              describeObservation(p.b.observation)
            ]);
          }, []),
          derivation:
            "average operatingCashFlow grouped by workingCapitalChange sign",
          status: "insufficient_data"
        });
        break;
      }

      sufficiency = "sufficient";
      const inputs = paired.pairs.reduce(function (acc, p) {
        return acc.concat([
          describeObservation(p.a.observation),
          describeObservation(p.b.observation)
        ]);
      }, []);
      const statement =
        "Average operating cash flow was " +
        avgAbsorbing.toLocaleString("en-IN") +
        " in periods where working capital absorbed cash (" +
        absorbing.length + " period(s)) versus " +
        avgReleasing.toLocaleString("en-IN") +
        " in periods where working capital released cash (" +
        releasing.length + " period(s)). This is a descriptive comparison " +
        "of grouped averages; it is not proof that working-capital movements " +
        "caused the difference in cash flow, and other drivers may dominate.";

      if (avgAbsorbing < avgReleasing) {
        supporting.push({
          fy: null, fys: null,
          metricKeys: ["operatingCashFlow", "workingCapitalChange"],
          statement:
            statement + " Directionally, the grouped averages are consistent " +
            "with working capital absorbing cash.",
          inputs: inputs,
          derivation:
            "average operatingCashFlow grouped by workingCapitalChange sign (descriptive)",
          status: "ok"
        });
      } else {
        contradicting.push({
          fy: null, fys: null,
          metricKeys: ["operatingCashFlow", "workingCapitalChange"],
          statement:
            statement + " The grouped averages do not show lower cash flow in " +
            "absorbing periods, which weakens the working-capital explanation.",
          inputs: inputs,
          derivation:
            "average operatingCashFlow grouped by workingCapitalChange sign (descriptive)",
          status: "ok"
        });
      }
      break;
    }

    /* ================================================================ */
    case "interest_burden": {
      const intSeries = metricSeries(company, "interestExpense");
      const intObs = intSeries.filter(function (p) { return p.value !== null; });

      if (intObs.length < 2) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["interestExpense"],
          statement:
            "Interest expense is present for fewer than two periods, so a " +
            "descriptive pattern over time cannot be formed.",
          inputs: intObs.map(function (p) { return describeObservation(p.observation); }),
          derivation: "pctChange over consecutive interest-expense periods",
          status: "insufficient_data"
        });
        break;
      }

      let adjacentCount = 0;
      for (let i = 1; i < intObs.length; i += 1) {
        const prev = intObs[i - 1];
        const curr = intObs[i];
        if (!areConsecutiveFYs(prev.fy, curr.fy)) {
          dataGaps.push({
            fy: curr.fy, missing: "a",
            note: "Interest expense is not contiguous with " + prev.fy + "."
          });
          continue;
        }
        const chg = pctChange(prev.value, curr.value);
        if (chg.status !== "ok") continue;
        adjacentCount += 1;
        const inputs = [
          describeObservation(prev.observation),
          describeObservation(curr.observation)
        ];
        // Strictly descriptive. This hypothesis does not have a supporting
        // denominator in the current schema (no EBIT, no debt service
        // schedule), so rising interest expense is NOT treated as evidence
        // of financial distress, and falling interest expense is NOT
        // treated as evidence against it.
        investigatory.push({
          fy: curr.fy, fys: prev.fy + "→" + curr.fy,
          metricKeys: ["interestExpense"],
          statement:
            "Interest expense was " + prev.value.toLocaleString("en-IN") +
            " in " + prev.fy + " and " + curr.value.toLocaleString("en-IN") +
            " in " + curr.fy + " (" + fmtPct(chg.value) + " change). This " +
            "describes the reported interest line only. Rising interest " +
            "expense is not, by itself, evidence of financial distress; it " +
            "can reflect higher borrowing to fund growth, a rate-cycle " +
            "effect on floating-rate debt, or refinancing. Falling interest " +
            "expense is not, by itself, evidence against financial stress. " +
            "Assessing interest burden requires additional metrics not " +
            "carried by the current data schema (for example EBIT or " +
            "operating cash flow relative to interest and debt service).",
          inputs: inputs,
          derivation: "pctChange over consecutive interest-expense periods",
          status: "ok"
        });
      }

      if (adjacentCount === 0) {
        sufficiency = "insufficient_periods";
        investigatory.push({
          fy: null, fys: null,
          metricKeys: ["interestExpense"],
          statement:
            "Interest expense is present for " + intObs.length +
            " period(s), but none of them are adjacent, so a descriptive " +
            "pattern over time cannot be formed.",
          inputs: intObs.map(function (p) { return describeObservation(p.observation); }),
          derivation: "pctChange over consecutive interest-expense periods",
          status: "insufficient_data"
        });
      } else {
        sufficiency = "sufficient";
      }
      break;
    }

    /* ================================================================ */
    case "banking_net_interest": {
      sufficiency = "schema_unsupported";
      investigatory.push({
        fy: null, fys: null,
        metricKeys: ["revenue", "interestExpense", "profit"],
        statement:
          "Net interest margin analysis requires inputs (interest-earning " +
          "assets, NPA levels, net interest income) that are not captured " +
          "by the current data schema. This hypothesis cannot be evaluated " +
          "from the observations available.",
        inputs: [],
        derivation: "unsupported by schema",
        status: "insufficient_data"
      });
      break;
    }

    default:
      break;
  }

  return {
    supporting: supporting,
    contradicting: contradicting,
    investigatory: investigatory,
    dataGaps: dataGaps,
    sufficiency: sufficiency
  };
}

/* --------------------------------------------------------------------------
   Formatting helper. Receives a value already in percent units.
   -------------------------------------------------------------------------- */
function fmtPct(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "not computable";
  return v.toFixed(1) + "%";
}

/* --------------------------------------------------------------------------
   Summary helper for dashboard / coverage pages.
   -------------------------------------------------------------------------- */
export function summarizeResearch(company) {
  const r = evaluateCompany(company, null);
  const counts = {
    supported: 0,
    contradicted: 0,
    mixed: 0,
    insufficient_evidence: 0,
    data_incomplete: 0
  };
  for (let i = 0; i < r.hypotheses.length; i += 1) {
    const s = r.hypotheses[i].status;
    if (counts[s] !== undefined) counts[s] += 1;
  }
  return {
    total: r.hypotheses.length,
    supported: counts.supported,
    contradicted: counts.contradicted,
    mixed: counts.mixed,
    insufficient_evidence: counts.insufficient_evidence,
    data_incomplete: counts.data_incomplete
  };
}

/* --------------------------------------------------------------------------
   Trend-only helper for sample-problem view.
   -------------------------------------------------------------------------- */
export function metricTrend(company, metricKey) {
  return { series: metricSeries(company, metricKey) };
          }
