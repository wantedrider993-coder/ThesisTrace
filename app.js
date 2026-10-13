/* ==========================================================================
   ThesisTrace — app.js
   Main application controller.

   - Hash router for the seven top-level sections plus two sub-routes
     (company/:id and workspace/:id).
   - One renderer per view. Every view returns a DOM fragment built with
     safe DOM APIs. No user input is ever inserted via innerHTML.
   - A tiny SVG bar-chart generator (no external libraries).
   - CSV and print-based report export.
   - Workspace persistence via storage.js.

   Not executed or tested in this environment.
   ========================================================================== */

import {
  DATASET_META,
  INDUSTRIES,
  METRIC_META,
  SOURCES,
  COMPANIES,
  SAMPLE_PROBLEMS,
  DATASET_COVERAGE_SNAPSHOT
} from "./data.js";

import {
  metricSeries,
  listFiscalYears,
  listMetrics,
  verificationBreakdown,
  findObservation,
  comparability
} from "./calc.js";

import {
  evaluateCompany,
  summarizeResearch
} from "./research.js";

import {
  isStorageAvailable,
  listInvestigations,
  getInvestigation,
  saveInvestigation,
  deleteInvestigation,
  duplicateInvestigation,
  makeInvestigationId
} from "./storage.js";

/* ==========================================================================
   DOM references and state
   ========================================================================== */
const el = {
  viewRoot: document.getElementById("view-root"),
  main: document.getElementById("main"),
  sidebar: document.getElementById("sidebar"),
  scrim: document.getElementById("scrim"),
  drawerOpen: document.getElementById("drawer-open"),
  drawerClose: document.getElementById("drawer-close"),
  quickForm: document.getElementById("quick-search-form"),
  quickInput: document.getElementById("quick-search"),
  newInv: document.getElementById("new-investigation-btn"),
  toasts: document.getElementById("toasts"),
  modalRoot: document.getElementById("modal-root"),
  sidebarStatus: document.getElementById("sidebar-status")
};

const state = {
  quickSearchQuery: "",
  compareSelected: [],
  compareMetric: "revenue",
  researchCompanyId: COMPANIES[0] ? COMPANIES[0].id : null,
  researchQuestion: "",
  activeInvestigationId: null
};

/* ==========================================================================
   Safe DOM helpers
   ========================================================================== */
const SVG_NS = "http://www.w3.org/2000/svg";

function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = String(v);
      else if (k === "dataset") { for (const dk of Object.keys(v)) node.dataset[dk] = v[dk]; }
      else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "href") node.setAttribute("href", String(v));
      else if (k === "value") node.value = v;
      else if (k === "checked" || k === "selected" || k === "disabled") { if (v) node.setAttribute(k, ""); }
      else node.setAttribute(k, String(v));
    }
  }
  appendAll(node, children);
  return node;
}

function s(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === null || v === undefined) continue;
      node.setAttribute(k, String(v));
    }
  }
  appendAll(node, children);
  return node;
}

function appendAll(parent, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) appendAll(parent, c);
    else if (c instanceof Node) parent.appendChild(c);
    else parent.appendChild(document.createTextNode(String(c)));
  }
}

function frag(...children) {
  const f = document.createDocumentFragment();
  appendAll(f, children);
  return f;
}

/* ==========================================================================
   Formatting
   ========================================================================== */
const NUM_FMT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const NUM_FMT_2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function fmtCurrency(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const u = unit ? " " + unit : "";
  return "₹" + NUM_FMT.format(value) + u;
}

function fmtRatio(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return NUM_FMT_2.format(value) + "×";
}

function fmtPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return NUM_FMT_2.format(value) + "%";
}

function titleCase(s) {
  if (!s) return "";
  return String(s).replace(/(^|[_\s-])([a-z])/g, (_, a, b) => a.replace(/[_-]/, " ") + b.toUpperCase());
}

function metricLabel(key) {
  const m = METRIC_META[key];
  return m && m.label ? m.label : titleCase(key);
}

function industryName(key) {
  const i = INDUSTRIES[key];
  return i && i.name ? i.name : titleCase(key);
}

/* ==========================================================================
   Verification pills
   ========================================================================== */
function verificationLabel(v) {
  switch (v) {
    case "verified": return "Verified";
    case "calculated": return "Calculated";
    case "provisional": return "Provisional";
    case "sample": return "Sample";
    case "unavailable": return "Unavailable";
    default: return "Unknown";
  }
}

function verificationPill(v) {
  const cls = ["verified", "calculated", "provisional", "sample", "unavailable"].indexOf(v) >= 0 ? v : "neutral";
  return h("span", { class: "pill " + cls }, verificationLabel(v));
}

function tierPill(tier) {
  const map = { high: "verified", medium: "provisional", low: "sample" };
  const cls = map[tier] || "unavailable";
  return h("span", { class: "pill " + cls }, tier ? titleCase(tier) : "Unusable");
}

function statusPill(status) {
  return h("span", { class: "pill neutral no-dot" }, titleCase(status || "unknown"));
}

/* ==========================================================================
   Toast
   ========================================================================== */
function toast(msg, kind) {
  if (!el.toasts) return;
  const node = h("div", { class: "toast" + (kind ? " " + kind : "") }, msg);
  el.toasts.appendChild(node);
  setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 4000);
}

/* ==========================================================================
   Modal
   ========================================================================== */
function showModalRoot() {
  if (!el.modalRoot) return;
  el.modalRoot.hidden = false;
  // Inline style overrides .modal-root { display: flex } from styles.css.
  // Setting it to "" removes the inline value so the stylesheet applies.
  el.modalRoot.style.display = "";
}

function hideModalRoot() {
  if (!el.modalRoot) return;
  el.modalRoot.hidden = true;
  // Inline style has the highest priority, so display:none reliably hides
  // the overlay even though the author rule sets display:flex.
  el.modalRoot.style.display = "none";
}

function openModal(title, bodyNode, actions) {
  if (!el.modalRoot) return;
  el.modalRoot.replaceChildren();
  const close = () => { el.modalRoot.replaceChildren(); hideModalRoot(); };
  const body = h("div", { class: "modal-body" }, bodyNode);
  const foot = h("div", { class: "modal-foot" });
  if (actions) for (const a of actions) foot.appendChild(a);
  const cancelBtn = h("button", { class: "btn btn-secondary", type: "button", onclick: close }, "Cancel");
  foot.appendChild(cancelBtn);
  const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "modal-head" },
      h("h3", { text: title }),
      h("button", { class: "btn-icon btn-ghost", type: "button", "aria-label": "Close", onclick: close }, "×")
    ),
    body,
    foot
  );
  el.modalRoot.appendChild(modal);
  showModalRoot();
  return close;
}

/* ==========================================================================
   Router
   ========================================================================== */
function parseRoute() {
  const hash = location.hash || "#/dashboard";
  const path = hash.replace(/^#\/?/, "");
  const parts = path.split("/").filter(Boolean);
  return { name: parts[0] || "dashboard", params: parts.slice(1) };
}

function navigate(hash) {
  if (location.hash === hash) { render(); }
  else { location.hash = hash; }
}

function updateActiveNav(name) {
  const map = {
    company: "companies",
    workspace: "workspace"
  };
  const target = map[name] || name;
  const items = document.querySelectorAll("[data-nav]");
  for (const it of items) {
    if (it.dataset.nav === target) it.setAttribute("aria-current", "page");
    else it.removeAttribute("aria-current");
  }
}

function render() {
  if (!el.viewRoot) return;
  const route = parseRoute();
  let node;
  try {
    const fn = views[route.name] || views.notFound;
    node = fn(route.params);
  } catch (e) {
    node = errorView(e);
  }

  // Capture focus before the subtree is replaced. The view function has
  // already returned a detached fragment; document.activeElement is still
  // the currently focused element from the previous render.
  const active = document.activeElement;
  const activeId = active && typeof active.id === "string" && active.id ? active.id : null;
  let selStart = null, selEnd = null;
  if (active && typeof active.selectionStart === "number" && typeof active.selectionEnd === "number") {
    selStart = active.selectionStart;
    selEnd = active.selectionEnd;
  }

  el.viewRoot.replaceChildren(node);
  updateActiveNav(route.name);
  closeDrawer();
  window.scrollTo(0, 0);

  // Restore focus only when the same id still exists in the new tree.
  if (activeId) {
    const next = document.getElementById(activeId);
    if (next && typeof next.focus === "function") {
      try { next.focus({ preventScroll: true }); } catch (e) { try { next.focus(); } catch (e2) { /* ignore */ } }
      if (selStart !== null && typeof next.setSelectionRange === "function") {
        try { next.setSelectionRange(selStart, selEnd); } catch (e) { /* input type does not support ranges */ }
      }
    }
  }
}

/* ==========================================================================
   Common view helpers
   ========================================================================== */
function pageHead(title, sub, crumbs) {
  const parts = [];
  if (crumbs && crumbs.length) {
    const cb = h("nav", { class: "breadcrumbs", "aria-label": "Breadcrumb" });
    for (let i = 0; i < crumbs.length; i++) {
      const c = crumbs[i];
      if (i > 0) cb.appendChild(h("span", { class: "sep" }, "›"));
      if (c.href) cb.appendChild(h("a", { href: c.href, text: c.label }));
      else cb.appendChild(document.createTextNode(c.label));
    }
    parts.push(cb);
  }
  parts.push(h("h1", { class: "page-title", text: title }));
  if (sub) parts.push(h("p", { class: "page-sub", text: sub }));
  return frag(...parts);
}

function card(...children) {
  return h("div", { class: "card" }, ...children);
}

function emptyState(title, message, actions) {
  return h("div", { class: "state" },
    h("h3", { text: title }),
    h("p", { class: "muted", text: message }),
    actions || null
  );
}

function errorView(e) {
  return frag(
    pageHead("Something went wrong"),
    card(
      h("div", { class: "callout danger" },
        h("strong", { text: "This view could not be rendered. " }),
        document.createTextNode(e && e.message ? e.message : "Unknown error.")
      ),
      h("button", { class: "btn btn-secondary mt12", type: "button", onclick: () => navigate("#/dashboard") }, "Back to dashboard")
    )
  );
}

function kpi(label, value, meta, badges) {
  return h("div", { class: "kpi" },
    h("div", { class: "kpi-label", text: label }),
    h("div", { class: "kpi-value", text: value }),
    meta ? h("div", { class: "kpi-meta", text: meta }) : null,
    badges ? h("div", { class: "mc-badges mt8" }, ...badges) : null
  );
}

/* ==========================================================================
   Charts — small SVG bar chart
   ========================================================================== */
function chartEmpty(title) {
  return h("div", { class: "chart-wrap" },
    title ? h("div", { class: "chart-title", text: title }) : null,
    h("div", { class: "chart-empty" }, "No data available for this selection.")
  );
}

function barChart(title, points, opts) {
  const o = opts || {};
  const valid = (points || []).filter(p => p && p.value !== null && Number.isFinite(p.value));
  if (valid.length === 0) return chartEmpty(title);

  const W = 640, H = 220;
  const pad = { l: 68, r: 16, t: 16, b: 44 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;

  const values = valid.map(p => p.value);
  const maxV = Math.max.apply(null, values);
  const minV = Math.min(0, Math.min.apply(null, values));
  const range = (maxV - minV) || 1;

  const step = cw / valid.length;
  const barW = Math.max(6, step * 0.55);

  const group = s("g");
  // y-axis grid (4 lines)
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const frac = i / ticks;
    const y = pad.t + ch - frac * ch;
    const v = minV + frac * range;
    group.appendChild(s("line", {
      class: "grid-line",
      x1: pad.l, y1: y, x2: pad.l + cw, y2: y
    }));
    group.appendChild(s("text", {
      class: "axis-label",
      x: pad.l - 8, y: y + 3,
      "text-anchor": "end"
    }, NUM_FMT.format(Math.round(v))));
  }

  // bars
  for (let i = 0; i < valid.length; i++) {
    const p = valid[i];
    const zeroY = pad.t + ch - ((0 - minV) / range) * ch;
    const valueY = pad.t + ch - ((p.value - minV) / range) * ch;
    const x = pad.l + i * step + (step - barW) / 2;
    const y = Math.min(zeroY, valueY);
    const hgt = Math.max(1, Math.abs(zeroY - valueY));
    group.appendChild(s("rect", {
      class: i === valid.length - 1 ? "bar-alt" : "bar",
      x: x, y: y, width: barW, height: hgt, rx: 2
    }));
    group.appendChild(s("text", {
      class: "axis-label",
      x: pad.l + i * step + step / 2,
      y: H - pad.b + 16,
      "text-anchor": "middle"
    }, p.fy));
  }

  // baseline
  group.appendChild(s("line", {
    class: "axis-line",
    x1: pad.l, y1: pad.t + ch, x2: pad.l + cw, y2: pad.t + ch
  }));

  const svgEl = s("svg", {
    class: "chart-svg",
    viewBox: "0 0 " + W + " " + H,
    role: "img",
    "aria-label": title || "Bar chart"
  }, group);

  return h("div", { class: "chart-wrap" },
    title ? h("div", { class: "chart-title", text: title }) : null,
    svgEl,
    o.legend ? h("div", { class: "chart-legend" }, ...o.legend) : null
  );
}

/* ==========================================================================
   CSV export
   ========================================================================== */
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const str = String(v);
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function downloadBlob(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
    toast("Downloaded " + filename, "ok");
  } catch (e) {
    toast("Download failed.", "error");
  }
}

function downloadCSV(filename, rows) {
  const lines = rows.map(r => r.map(csvEscape).join(","));
  downloadBlob(filename, lines.join("\r\n"), "text/csv;charset=utf-8");
}

/* ==========================================================================
   Views
   ========================================================================== */
const views = {};

/* ---------- Dashboard ---------- */
views.dashboard = function () {
  const meta = DATASET_META || {};
  const snap = DATASET_COVERAGE_SNAPSHOT || {};
  const saved = isStorageAvailable() ? listInvestigations() : [];

  const kpis = h("div", { class: "grid grid-kpi" },
    kpi("Companies", String(snap.companies || COMPANIES.length), "in directory"),
    kpi("Observations", String(snap.observations || 0), "financial data points"),
    kpi("Verified", String(snap.verifiedObservations || 0), "checked against primary sources"),
    kpi("Provisional", String(snap.provisionalObservations || 0), "awaiting page-level check"),
    kpi("Sample", String(snap.sampleObservations || 0), "fictional, teaching only"),
    kpi("Saved investigations", String(saved.length), isStorageAvailable() ? "in this browser" : "storage unavailable")
  );

  const freshness = h("div", { class: "freshness" },
    h("div", { class: "fr-item" }, h("strong", { text: "Dataset" }), document.createTextNode(meta.label || "ThesisTrace seed")),
    h("div", { class: "fr-item" }, h("strong", { text: "Last reviewed" }), document.createTextNode(meta.lastReviewed || "Not yet reviewed")),
    h("div", { class: "fr-item" }, h("strong", { text: "Storage" }), document.createTextNode(isStorageAvailable() ? "Available" : "Unavailable in this browser"))
  );

  const recent = saved.slice(0, 5).map(inv =>
    h("div", { class: "inv-row", onclick: () => navigate("#/workspace/" + inv.id) },
      h("div", null,
        h("div", { class: "inv-title", text: inv.title || "Untitled investigation" }),
        h("div", { class: "inv-meta" },
          (inv.companyIds && inv.companyIds.length ? inv.companyIds.length + " company" + (inv.companyIds.length > 1 ? "ies" : "") + " · " : "") +
          (inv.updatedAtISO ? new Date(inv.updatedAtISO).toLocaleString() : "saved")
        )
      ),
      h("div", { class: "inv-actions" }, h("span", { class: "btn btn-secondary btn-sm" }, "Open"))
    )
  );

  return frag(
    pageHead("Dashboard", "A financial research workspace. Explore multiple possible explanations, weigh evidence, and see where data is missing."),
    freshness,
    kpis,
    h("h2", null, "Start"),
    card(
      h("p", { class: "lead", text: "Open the Research Explorer to build an investigation around a company and a question. Hypotheses are presented side by side with their evidence, contradictions, and next steps." }),
      h("div", { class: "row mt8" },
        h("a", { class: "btn btn-teal", href: "#/research" }, "Open Research Explorer"),
        h("a", { class: "btn btn-secondary", href: "#/companies" }, "Browse companies"),
        h("a", { class: "btn btn-secondary", href: "#/learn" }, "Sample problems")
      )
    ),
    h("h2", null, "Recent investigations"),
    saved.length ? h("div", { class: "inv-list" }, ...recent) : emptyState("No investigations yet", "Your saved research will appear here. Everything is stored only in this browser's localStorage."),
    h("h2", null, "Data honesty"),
    card(
      h("div", { class: "callout info" }, h("strong", { text: "Every figure carries a state. " }), document.createTextNode("“Verified” means checked against a primary source. Nothing in this seed dataset is currently marked verified — TCS figures are provisional, and the Meridian sample is fictional. The product surfaces this in every table and chart.")),
      h("div", { class: "callout warn mt8" }, h("strong", { text: "Not investment advice. " }), document.createTextNode("Findings are prompts for investigation. Correlation does not establish causation.")),
      meta.knownGaps && meta.knownGaps.length ? h("div", { class: "callout mt8" },
        h("strong", { text: "Known gaps: " }),
        document.createTextNode(meta.knownGaps.map(g => (g.companyId + " · " + g.missingPeriod)).join(", "))
      ) : null
    )
  );
};

/* ---------- Company Explorer ---------- */
views.companies = function () {
  const q = (state.quickSearchQuery || "").trim().toLowerCase();
  const industriesPresent = Array.from(new Set(COMPANIES.map(c => c.industryKey))).sort();

  const searchInput = h("input", {
    id: "companies-search",
    type: "search",
    value: state.quickSearchQuery,
    placeholder: "Name, ticker, or industry",
    "aria-label": "Search companies",
    oninput: (e) => { state.quickSearchQuery = e.target.value; render(); }
  });

  const industrySelect = h("select", {
    id: "companies-industry",
    "aria-label": "Filter by industry",
    onchange: (e) => { state.industryFilter = e.target.value; render(); }
  }, h("option", { value: "" }, "All industries"),
     ...industriesPresent.map(k => h("option", { value: k, selected: state.industryFilter === k }, industryName(k))));

  const filterBar = h("div", { class: "filterbar" },
    h("div", { class: "field" }, h("label", { text: "Search" }), searchInput),
    h("div", { class: "field" }, h("label", { text: "Industry" }), industrySelect)
  );

  let filtered = COMPANIES;
  if (q) {
    filtered = filtered.filter(c =>
      (c.name || "").toLowerCase().indexOf(q) >= 0 ||
      (c.ticker || "").toLowerCase().indexOf(q) >= 0 ||
      industryName(c.industryKey).toLowerCase().indexOf(q) >= 0
    );
  }
  if (state.industryFilter) filtered = filtered.filter(c => c.industryKey === state.industryFilter);

  if (filtered.length === 0) {
    return frag(
      pageHead("Company Explorer", "Search and filter the companies in the directory."),
      filterBar,
      emptyState("No companies match", "Try a different search or clear the filters.")
    );
  }

  const cards = filtered.map(c => {
    const periods = listFiscalYears(c);
    const metrics = listMetrics(c);
    const breakdown = verificationBreakdown(c);
    const total = c.observations ? c.observations.length : 0;
    const verifiedCount = breakdown.verified + breakdown.calculated;
    return h("a", { class: "company-card", href: "#/company/" + c.id },
      h("div", { class: "cc-top" },
        h("div", null,
          h("div", { class: "cc-name", text: c.name }),
          h("div", { class: "cc-tick", text: (c.ticker || "—") + " · " + (c.exchange || "") })
        ),
        h("div", null, verificationPill(dominantVerification(breakdown)))
      ),
      h("div", { class: "cc-desc", text: c.description || "" }),
      h("div", { class: "cc-meta" },
        h("span", null, industryName(c.industryKey)),
        h("span", null, "FY: " + (periods.length ? periods[0] + "–" + periods[periods.length - 1] : "—")),
        h("span", null, metrics.length + " metric" + (metrics.length === 1 ? "" : "s")),
        h("span", null, total + " observation" + (total === 1 ? "" : "s")),
        verifiedCount > 0 ? h("span", null, verifiedCount + " verified") : null
      )
    );
  });

  return frag(
    pageHead("Company Explorer", "Companies in the directory. Presence here does not imply that verified financial statements are available."),
    filterBar,
    h("div", { class: "grid grid-cards" }, ...cards)
  );
};

function dominantVerification(breakdown) {
  if (!breakdown) return "unavailable";
  if (breakdown.verified > 0) return "verified";
  if (breakdown.calculated > 0) return "calculated";
  if (breakdown.provisional > 0) return "provisional";
  if (breakdown.sample > 0) return "sample";
  return "unavailable";
}

/* ---------- Company profile ---------- */
views.company = function (params) {
  const id = params[0];
  const company = COMPANIES.find(c => c.id === id);
  if (!company) {
    return frag(
      pageHead("Company not found", null, [{ label: "Companies", href: "#/companies" }, { label: "Not found" }]),
      emptyState("Not in the directory", "This company ID is not present in the dataset.", h("a", { class: "btn btn-secondary", href: "#/companies" }, "Back to companies"))
    );
  }

  const periods = listFiscalYears(company);
  const metrics = listMetrics(company);
  const breakdown = verificationBreakdown(company);
  const industry = INDUSTRIES[company.industryKey] || null;

  const header = card(
    h("div", { class: "row" },
      h("div", null,
        h("h2", { class: "mt0", text: company.name }),
        h("div", { class: "muted small", text: (company.ticker || "") + (company.exchange ? " · " + company.exchange : "") + (industry ? " · " + industry.name : "") })
      ),
      h("div", { class: "spacer" }),
      verificationPill(dominantVerification(breakdown))
    ),
    h("p", { class: "mt12", text: company.description || "" }),
    h("div", { class: "row tight mt8" },
      h("span", { class: "small muted" }, "Reporting: " + (company.reportingCurrency || "—") + " in " + (company.reportingUnits || "—")),
      h("span", { class: "small muted" }, "Periods: " + (periods.length ? periods.join(", ") : "none")),
      company.irUrl ? h("a", { class: "small", href: company.irUrl, target: "_blank", rel: "noopener noreferrer" }, "Investor relations ↗") : null
    )
  );

  // KPI for latest FY, per metric available
  const latestFY = periods.length ? periods[periods.length - 1] : null;
  const kpis = [];
  if (latestFY) {
    for (const mk of metrics) {
      const obs = findObservation(company, mk, latestFY);
      if (!obs) continue;
      const meta = METRIC_META[mk] || {};
      kpis.push(kpi(meta.shortLabel || metricLabel(mk), fmtCurrency(obs.value, obs.unit), latestFY, [verificationPill(obs.verification)]));
    }
  }
  const kpiRow = kpis.length ? h("div", { class: "grid grid-kpi" }, ...kpis) : null;

  // Charts per metric
  const charts = metrics.map(mk => {
    const series = metricSeries(company, mk);
    return barChart(metricLabel(mk), series, {
      legend: [
        h("span", null, h("span", { class: "sw", style: "background:#234866" }), "Earlier period"),
        h("span", null, h("span", { class: "sw", style: "background:#14a3a3" }), "Latest period")
      ]
    });
  });

  // Table of all observations
  const table = observationsTable(company);

  // Source references used
  const usedSources = Array.from(new Set(company.observations.map(o => o.sourceId))).map(sid => SOURCES[sid]).filter(Boolean);
  const sourceBlock = usedSources.length ? h("div", { class: "mt16" },
    h("h4", null, "Source documents"),
    ...usedSources.map(src => h("div", { class: "source-block" },
      h("div", { class: "sb-row" }, h("span", { class: "sb-key" }, "Title"), h("span", { class: "sb-val" }, src.title || "—")),
      h("div", { class: "sb-row" }, h("span", { class: "sb-key" }, "Publisher"), h("span", { class: "sb-val" }, src.publisher || "—")),
      h("div", { class: "sb-row" }, h("span", { class: "sb-key" }, "Type"), h("span", { class: "sb-val" }, src.sourceType || "—")),
      src.url ? h("div", { class: "sb-row" }, h("span", { class: "sb-key" }, "URL"), h("a", { class: "sb-val", href: src.url, target: "_blank", rel: "noopener noreferrer" }, src.url)) : null,
      src.note ? h("div", { class: "sb-row" }, h("span", { class: "sb-key" }, "Note"), h("span", { class: "sb-val" }, src.note)) : null
    ))
  ) : null;

  return frag(
    pageHead(company.name, null, [{ label: "Companies", href: "#/companies" }, { label: company.ticker || company.id }]),
    header,
    kpiRow ? frag(h("h2", null, "Latest period (" + latestFY + ")"), kpiRow) : null,
    h("h2", null, "Trends"),
    h("div", { class: "grid grid-2" }, ...charts),
    h("h2", null, "All reported observations"),
    table,
    sourceBlock,
    h("h2", null, "Next step"),
    card(
      h("p", { text: "Open this company in the Research Explorer to build a multi-hypothesis investigation around a specific question." }),
      h("div", { class: "row" },
        h("button", { class: "btn btn-teal", type: "button", onclick: () => { state.researchCompanyId = company.id; navigate("#/research"); } }, "Open in Research Explorer"),
        h("button", { class: "btn btn-secondary", type: "button", onclick: () => { state.compareSelected = [company.id]; navigate("#/compare"); } }, "Add to comparison")
      )
    )
  );
};

function observationsTable(company) {
  if (!company.observations || company.observations.length === 0) return emptyState("No observations", "This company record has no financial data attached.");
  const headerRow = h("tr", null,
    h("th", null, "Fiscal year"),
    h("th", null, "Metric"),
    h("th", { class: "num" }, "Value"),
    h("th", null, "Scope"),
    h("th", null, "Verification"),
    h("th", null, "Source")
  );
  const rows = company.observations.slice().sort((a, b) => {
    const fy = String(a.fy).localeCompare(String(b.fy));
    if (fy !== 0) return fy;
    return String(a.metricKey).localeCompare(String(b.metricKey));
  }).map(o => {
    const src = SOURCES[o.sourceId];
    return h("tr", null,
      h("td", { text: o.fy }),
      h("td", { text: metricLabel(o.metricKey) }),
      h("td", { class: "num", text: fmtCurrency(o.value, o.unit) }),
      h("td", { text: o.scope || "—" }),
      h("td", null, verificationPill(o.verification)),
      h("td", null, src ? h("a", { href: src.url, target: "_blank", rel: "noopener noreferrer" }, src.title || src.id) : document.createTextNode("—"))
    );
  });
  return h("div", { class: "table-wrap" },
    h("table", null,
      h("thead", null, headerRow),
      h("tbody", null, ...rows)
    ),
    h("div", { class: "table-note" }, "Values are exactly as stored in the dataset. “Provisional” and “sample” states are not upgraded to “verified” anywhere in this interface.")
  );
}

/* ---------- Compare ---------- */
views.compare = function () {
  const picker = h("div", { class: "compare-picker" },
    ...COMPANIES.map(c => {
      const on = state.compareSelected.indexOf(c.id) >= 0;
      return h("button", {
        class: "chip",
        type: "button",
        "aria-pressed": on ? "true" : "false",
        onclick: () => {
          if (on) state.compareSelected = state.compareSelected.filter(x => x !== c.id);
          else state.compareSelected = state.compareSelected.concat([c.id]);
          render();
        }
      }, c.ticker ? c.ticker + " — " + c.name : c.name);
    })
  );

  const allMetrics = Array.from(new Set([].concat.apply([], COMPANIES.map(c => listMetrics(c)))));
  const metricSelect = h("select", {
    "aria-label": "Metric to compare",
    onchange: (e) => { state.compareMetric = e.target.value; render(); }
  }, ...allMetrics.map(k => h("option", { value: k, selected: state.compareMetric === k }, metricLabel(k))));

  const filterBar = h("div", { class: "filterbar" },
    h("div", { class: "field", style: "flex:1 1 260px" }, h("label", { text: "Companies" }), picker),
    h("div", { class: "field" }, h("label", { text: "Metric" }), metricSelect)
  );

  const chosen = COMPANIES.filter(c => state.compareSelected.indexOf(c.id) >= 0);
  if (chosen.length < 2) {
    return frag(
      pageHead("Compare", "Compare like with like. Only comparable periods, currencies, units, and scopes should be read together."),
      filterBar,
      emptyState("Select two or more companies", "Pick companies above to see their reported values side by side for the chosen metric.")
    );
  }

  // Collect FYs across chosen companies
  const fySet = new Set();
  for (const c of chosen) for (const fy of listFiscalYears(c)) fySet.add(fy);
  const fys = Array.from(fySet).sort((a, b) => String(a).localeCompare(String(b)));

  // Comparability check across selected companies (currency/unit/scope)
  const warnings = [];
  const first = chosen[0];
  for (let i = 1; i < chosen.length; i++) {
    const cmp = comparability(
      { currency: first.reportingCurrency, unit: first.reportingUnits, scope: (findObservation(first, state.compareMetric, (listFiscalYears(first)[0] || "")) || {}).scope, periodType: "annual", fy: null },
      { currency: chosen[i].reportingCurrency, unit: chosen[i].reportingUnits, scope: (findObservation(chosen[i], state.compareMetric, (listFiscalYears(chosen[i])[0] || "")) || {}).scope, periodType: "annual", fy: null }
    );
    if (!cmp.comparable) {
      warnings.push(first.name + " vs " + chosen[i].name + ": " + cmp.reasons.join(" "));
    }
  }

  const headerRow = h("tr", null,
    h("th", null, "Fiscal year"),
    ...chosen.map(c => h("th", { class: "num" }, c.ticker || c.name))
  );
  const rows = fys.map(fy => {
    const cells = [h("td", { text: fy })];
    for (const c of chosen) {
      const obs = findObservation(c, state.compareMetric, fy);
      if (obs && obs.value !== null && Number.isFinite(obs.value)) {
        cells.push(h("td", { class: "num" },
          fmtCurrency(obs.value, obs.unit),
          h("span", { class: "note" }, verificationLabel(obs.verification))
        ));
      } else {
        cells.push(h("td", { class: "num td-unavailable" }, "—"));
      }
    }
    return h("tr", null, ...cells);
  });

  const csvButton = h("button", {
    class: "btn btn-secondary btn-sm",
    type: "button",
    onclick: () => {
      const rowsCsv = [["Fiscal year"].concat(chosen.map(c => c.ticker || c.name))];
      for (const fy of fys) {
        const line = [fy];
        for (const c of chosen) {
          const obs = findObservation(c, state.compareMetric, fy);
          line.push(obs && obs.value !== null ? String(obs.value) : "");
        }
        rowsCsv.push(line);
      }
      downloadCSV("thesistrace-compare-" + state.compareMetric + ".csv", rowsCsv);
    }
  }, "Export CSV");

  return frag(
    pageHead("Compare", "Values are shown per fiscal year for the chosen metric. Missing observations are left blank, not filled in."),
    filterBar,
    warnings.length ? h("div", { class: "callout warn mb16" },
      h("strong", { text: "Comparability notes: " }),
      ...warnings.map((w, i) => h("div", { key: i, text: w }))
    ) : null,
    h("div", { class: "row mb8" },
      h("h2", { class: "mt0", style: "margin-bottom:0" }, metricLabel(state.compareMetric)),
      h("div", { class: "spacer" }),
      csvButton
    ),
    h("div", { class: "table-wrap" },
      h("table", null,
        h("thead", null, headerRow),
        h("tbody", null, ...rows)
      ),
      h("div", { class: "table-note" }, "A blank cell means there is no observation for that fiscal year in the dataset. It is not zero.")
    )
  );
};

/* ---------- Research Explorer ---------- */
views.research = function () {
  if (COMPANIES.length === 0) {
    return frag(pageHead("Research Explorer", "No companies are available to analyse."), emptyState("No companies", "Add at least one company to data.js to use this view."));
  }

  const companySelect = h("select", {
    "aria-label": "Company",
    onchange: (e) => { state.researchCompanyId = e.target.value; render(); }
  }, ...COMPANIES.map(c => h("option", { value: c.id, selected: state.researchCompanyId === c.id }, c.name)));

  const questionInput = h("textarea", {
    "aria-label": "Research question",
    placeholder: "Example: Why has this company's profit growth slowed?",
    value: state.researchQuestion,
    oninput: (e) => { state.researchQuestion = e.target.value; }
  });

  const runBtn = h("button", { class: "btn btn-teal", type: "button", onclick: () => { render(); } }, "Evaluate hypotheses");

  const saveBtn = h("button", { class: "btn btn-secondary", type: "button", onclick: () => { saveCurrentResearch(); } }, "Save to workspace");

  const company = COMPANIES.find(c => c.id === state.researchCompanyId) || COMPANIES[0];
  const result = evaluateCompany(company, state.researchQuestion);

  const cards = result.hypotheses.map(renderHypothesis);

  return frag(
    pageHead("Research Explorer", "Rule-based analysis. Multiple hypotheses are shown side by side. Correlation does not establish causation."),
    card(
      h("div", { class: "inline-fields" },
        h("div", { class: "field", style: "flex:1 1 240px" }, h("label", { text: "Company" }), companySelect),
        h("div", { class: "field", style: "flex:2 1 320px" }, h("label", { text: "Question (optional)" }), questionInput)
      ),
      h("div", { class: "row mt8" }, runBtn, saveBtn)
    ),
    h("div", { class: "callout info mt16" }, result.disclaimer),
    h("h2", null, "Hypotheses (" + result.hypotheses.length + ")"),
    h("div", null, ...cards)
  );
};

function saveCurrentResearch() {
  if (!isStorageAvailable()) { toast("Storage is unavailable in this browser.", "error"); return; }
  const company = COMPANIES.find(c => c.id === state.researchCompanyId) || COMPANIES[0];
  const suggested = state.researchQuestion && state.researchQuestion.trim() ? state.researchQuestion.trim().slice(0, 80) : ("Investigation — " + (company ? company.name : "Untitled"));
  const input = h("input", { type: "text", value: suggested, "aria-label": "Investigation title" });
  const close = openModal("Save investigation", h("div", { class: "field" }, h("label", { text: "Title" }), input), [
    h("button", { class: "btn btn-teal", type: "button", onclick: () => {
      const res = saveInvestigation({
        id: makeInvestigationId(),
        title: input.value || suggested,
        question: state.researchQuestion || "",
        companyIds: company ? [company.id] : [],
        hypotheses: [],
        notes: "",
        assumptions: "",
        sourceLinks: []
      });
      if (!res.ok) { toast("Could not save: " + (res.reason || "unknown"), "error"); return; }
      toast("Investigation saved.", "ok");
      close();
      state.activeInvestigationId = res.investigation.id;
      navigate("#/workspace/" + res.investigation.id);
    } }, "Save")
  ]);
}

function renderHypothesis(hyp) {
  const section = (cls, title, items) => {
    if (!items || items.length === 0) return null;
    return h("div", { class: "hyp-section hyp-evidence " + cls },
      h("h4", null, title),
      h("ul", null, ...items.map(it => h("li", null,
        document.createTextNode(it.statement || ""),
        it.metricKeys ? h("span", { class: "tag" }, it.metricKeys.join(", ")) : null
      )))
    );
  };

  const missingItems = (hyp.missing || []).map(m => "Required input: " + (m.need || m.metricKey));
  const gapItems = (hyp.dataGaps || []).map(g => g.note || (g.fy + " · missing " + g.missing));

  return h("div", { class: "hyp", "data-uncertainty": hyp.uncertainty || "medium" },
    h("div", { class: "hyp-head" },
      h("h3", { class: "hyp-title", text: hyp.title }),
      h("div", { class: "row tight" }, statusPill(hyp.status), tierPill(hyp.evidenceTier))
    ),
    h("p", { class: "hyp-desc", text: hyp.description }),
    section("supporting", "Supporting evidence", hyp.supporting),
    section("contradicting", "Contradicting evidence", hyp.contradicting),
    section("missing", "Missing or unavailable inputs", (hyp.missing || []).map(m => ({ statement: "Required input: " + (m.need || m.metricKey) }))),
    hyp.investigatory && hyp.investigatory.length ? h("div", { class: "hyp-section" },
      h("h4", null, "Additional notes"),
      h("ul", null, ...hyp.investigatory.map(it => h("li", null, document.createTextNode(it.statement || ""))))
    ) : null,
    hyp.dataGaps && hyp.dataGaps.length ? h("div", { class: "hyp-section" },
      h("h4", null, "Data gaps"),
      h("ul", null, ...gapItems.map(g => h("li", null, document.createTextNode(g))))
    ) : null,
    h("div", { class: "hyp-next" }, h("strong", null, "Next step: "), document.createTextNode(hyp.nextStep || "—")),
    h("div", { class: "hyp-uncertainty" },
      h("strong", null, "Uncertainty (" + (hyp.uncertainty || "unknown") + "): "),
      document.createTextNode(hyp.uncertaintyReason || "—"),
      h("div", { class: "tiny muted mt4" }, hyp.evidenceTierLabel || "")
    )
  );
}

/* ---------- Workspace ---------- */
views.workspace = function (params) {
  if (params && params[0]) return workspaceEditor(params[0]);
  return workspaceList();
};

function workspaceList() {
  if (!isStorageAvailable()) {
    return frag(
      pageHead("My Workspace", "Saved investigations."),
      emptyState("Storage is unavailable", "This browser has disabled localStorage or is running in private mode. Saved investigations cannot be loaded or stored here.")
    );
  }
  const invs = listInvestigations();
  if (invs.length === 0) {
    return frag(
      pageHead("My Workspace", "Saved investigations."),
      emptyState("No investigations saved", "Use the Research Explorer to build a hypothesis set, then click “Save to workspace”.", h("a", { class: "btn btn-teal mt12", href: "#/research" }, "Open Research Explorer"))
    );
  }
  const rows = invs.map(inv => h("div", { class: "inv-row", onclick: () => navigate("#/workspace/" + inv.id) },
    h("div", null,
      h("div", { class: "inv-title", text: inv.title || "Untitled investigation" }),
      h("div", { class: "inv-meta", text: (inv.question ? inv.question.slice(0, 90) : "No question") + " · updated " + (inv.updatedAtISO ? new Date(inv.updatedAtISO).toLocaleString() : "—") })
    ),
    h("div", { class: "inv-actions" },
      h("button", { class: "btn btn-secondary btn-sm", type: "button", onclick: (e) => {
        e.stopPropagation();
        const res = duplicateInvestigation(inv.id);
        if (res && res.ok && res.investigation) {
          toast("Duplicated.", "ok");
          render();
        } else {
          const reason = res && res.reason ? res.reason : "unknown";
          toast("Duplicate failed: " + reason, "error");
        }
      } }, "Duplicate"),
      h("button", { class: "btn btn-danger btn-sm", type: "button", onclick: (e) => {
        e.stopPropagation();
        if (!confirm("Delete this investigation? This cannot be undone.")) return;
        const r = deleteInvestigation(inv.id);
        if (r.ok && r.removed) { toast("Deleted.", "ok"); render(); }
        else toast("Could not delete.", "error");
      } }, "Delete")
    )
  ));
  return frag(
    pageHead("My Workspace", "Saved investigations. Stored only in this browser."),
    h("div", { class: "inv-list" }, ...rows)
  );
}

function workspaceEditor(id) {
  if (!isStorageAvailable()) {
    return frag(pageHead("Workspace"), emptyState("Storage unavailable", "The saved investigation cannot be loaded."));
  }
  const inv = getInvestigation(id);
  if (!inv) {
    return frag(
      pageHead("Not found", null, [{ label: "Workspace", href: "#/workspace" }, { label: "Not found" }]),
      emptyState("Investigation not found", "It may have been deleted in another tab.", h("a", { class: "btn btn-secondary", href: "#/workspace" }, "Back to workspace"))
    );
  }

  const titleInput = h("input", { type: "text", value: inv.title || "", "aria-label": "Title" });
  const questionInput = h("textarea", { "aria-label": "Question" }, inv.question || "");
  const notesInput = h("textarea", { "aria-label": "Notes" }, inv.notes || "");
  const assumptionsInput = h("textarea", { "aria-label": "Assumptions" }, inv.assumptions || "");

  const companies = (inv.companyIds || []).map(id2 => COMPANIES.find(c => c.id === id2)).filter(Boolean);

  const hypCards = [];
  for (const c of companies) {
    const result = evaluateCompany(c, inv.question || "");
    for (const hyp of result.hypotheses) hypCards.push(h("div", null,
      h("div", { class: "small muted mb8", text: c.name }),
      renderHypothesis(hyp)
    ));
  }

  const saveBtn = h("button", { class: "btn btn-teal", type: "button", onclick: () => {
    const r = saveInvestigation({
      id: inv.id,
      title: titleInput.value,
      question: questionInput.value,
      companyIds: inv.companyIds,
      hypotheses: inv.hypotheses,
      notes: notesInput.value,
      assumptions: assumptionsInput.value,
      sourceLinks: inv.sourceLinks,
      createdAtISO: inv.createdAtISO
    });
    if (!r.ok) { toast("Save failed: " + (r.reason || "unknown"), "error"); return; }
    toast("Saved.", "ok");
    render();
  } }, "Save changes");

  const dupBtn = h("button", { class: "btn btn-secondary", type: "button", onclick: () => {
    const r = duplicateInvestigation(inv.id);
    if (r.ok && r.investigation) { toast("Duplicated.", "ok"); navigate("#/workspace/" + r.investigation.id); }
    else toast("Duplicate failed.", "error");
  } }, "Duplicate");

  const printBtn = h("button", { class: "btn btn-secondary", type: "button", onclick: () => { window.print(); } }, "Print report");

  const backLink = h("a", { class: "btn btn-secondary", href: "#/workspace" }, "Back to list");

  const reportHeader = h("div", { class: "report-preview" },
    h("h1", { text: inv.title || "Untitled investigation" }),
    h("div", { class: "meta" },
      "Created " + (inv.createdAtISO ? new Date(inv.createdAtISO).toLocaleString() : "—") +
      " · Updated " + (inv.updatedAtISO ? new Date(inv.updatedAtISO).toLocaleString() : "—")
    ),
    inv.question ? h("div", { class: "report-section" }, h("h2", null, "Research question"), h("p", { text: inv.question })) : null,
    h("div", { class: "report-section" }, h("h2", null, "Companies"), h("p", { text: companies.length ? companies.map(c => c.name).join(", ") : "—" })),
    notesInput.value ? h("div", { class: "report-section" }, h("h2", null, "Notes"), h("p", { text: notesInput.value })) : null,
    assumptionsInput.value ? h("div", { class: "report-section" }, h("h2", null, "Assumptions"), h("p", { text: assumptionsInput.value })) : null,
    h("div", { class: "report-section" }, h("h2", null, "Hypotheses"), h("div", null, ...hypCards)),
    h("div", { class: "report-section" }, h("h2", null, "Disclaimer"), h("p", { text: "Rule-based analysis. Not investment advice. Correlation does not establish causation." }))
  );

  return frag(
    pageHead(inv.title || "Investigation", null, [{ label: "Workspace", href: "#/workspace" }, { label: "Editor" }]),
    h("div", { class: "row mb16" }, backLink, saveBtn, dupBtn, printBtn),
    card(
      h("div", { class: "field" }, h("label", { text: "Title" }), titleInput),
      h("div", { class: "field" }, h("label", { text: "Question" }), questionInput),
      h("div", { class: "field" }, h("label", { text: "Notes" }), notesInput),
      h("div", { class: "field" }, h("label", { text: "Assumptions" }), assumptionsInput)
    ),
    h("h2", null, "Report preview"),
    reportHeader
  );
}

/* ---------- Sample problems ---------- */
views.learn = function () {
  const items = SAMPLE_PROBLEMS.map(p => h("div", { class: "sample" },
    h("div", { class: "sample-tag" }, "Prepared demonstration"),
    h("h3", { text: p.title }),
    h("div", { class: "small muted mb8", text: p.category }),
    h("p", { text: p.scenario }),
    h("h4", null, "Approaches"),
    ...p.approaches.map(a => h("div", { class: "approach" },
      h("h4", null, a.title),
      h("p", { text: a.summary }),
      h("div", { class: "small" }, h("strong", null, "Look for: "), document.createTextNode((a.evidenceToLookFor || []).join("; "))),
      a.benefits && a.benefits.length ? h("div", { class: "small" }, h("strong", null, "Benefits: "), document.createTextNode(a.benefits.join("; "))) : null,
      a.drawbacks && a.drawbacks.length ? h("div", { class: "small" }, h("strong", null, "Drawbacks: "), document.createTextNode(a.drawbacks.join("; "))) : null,
      a.risks && a.risks.length ? h("div", { class: "small" }, h("strong", null, "Risks: "), document.createTextNode(a.risks.join("; "))) : null,
      a.uncertainty ? h("div", { class: "small" }, h("strong", null, "Uncertainty: "), document.createTextNode(a.uncertainty)) : null,
      a.nextTest ? h("div", { class: "small mt4" }, h("strong", null, "Next test: "), document.createTextNode(a.nextTest)) : null
    )),
    h("div", { class: "cannot-conclude" }, h("strong", null, "What cannot be concluded: "), document.createTextNode(p.cannotConclude || ""))
  ));

  return frag(
    pageHead("Sample Problems", "Prepared teaching exercises. Each shows multiple possible explanations, evidence to look for, and what cannot be concluded from the data."),
    h("div", { class: "callout sample mb16" }, h("strong", null, "These are prepared demonstrations, not live AI output and not investment advice.")),
    h("div", null, ...items)
  );
};

/* ---------- Data coverage ---------- */
views.coverage = function () {
  const meta = DATASET_META || {};
  const snap = DATASET_COVERAGE_SNAPSHOT || {};

  const legend = h("div", { class: "cov-legend" },
    h("span", null, h("span", { class: "pill verified" }, "Verified"), " checked against primary source"),
    h("span", null, h("span", { class: "pill calculated" }, "Calculated"), " derived from verified inputs"),
    h("span", null, h("span", { class: "pill provisional" }, "Provisional"), " awaiting page-level check"),
    h("span", null, h("span", { class: "pill sample" }, "Sample"), " fictional, teaching only"),
    h("span", null, h("span", { class: "pill unavailable" }, "Unavailable"), " no data")
  );

  // Company × metric × period table
  const headerRow = h("tr", null,
    h("th", null, "Company"),
    h("th", null, "Metric"),
    h("th", null, "Fiscal years"),
    h("th", null, "Count"),
    h("th", null, "Verification")
  );
  const rows = [];
  for (const c of COMPANIES) {
    const metrics = listMetrics(c);
    for (const mk of metrics) {
      const series = metricSeries(c, mk);
      const fys = series.filter(p => p.value !== null).map(p => p.fy);
      const breakdown = verificationBreakdown(c, mk);
      const dom = dominantVerification(breakdown);
      rows.push(h("tr", null,
        h("td", { text: c.name }),
        h("td", { text: metricLabel(mk) }),
        h("td", { text: fys.length ? fys.join(", ") : "—" }),
        h("td", { class: "num", text: String(fys.length) }),
        h("td", null, verificationPill(dom))
      ));
    }
  }

  const gapList = (meta.knownGaps || []).map(g => h("li", null,
    document.createTextNode(g.companyId + " · " + g.missingPeriod + " — " + (g.reason || ""))
  ));

  return frag(
    pageHead("Data Coverage", "What is actually in the dataset, and how it is labelled."),
    h("div", { class: "callout info" },
      h("strong", { text: meta.label || "Dataset" }), document.createTextNode(". " + (meta.description || ""))
    ),
    h("h2", null, "Summary"),
    h("div", { class: "grid grid-kpi" },
      kpi("Companies", String(snap.companies || COMPANIES.length), (snap.realCompanies || 0) + " real, " + (snap.sampleCompanies || 0) + " sample"),
      kpi("Observations", String(snap.observations || 0), "financial data points"),
      kpi("Verified", String(snap.verifiedObservations || 0), "checked against a primary source"),
      kpi("Provisional", String(snap.provisionalObservations || 0), "awaiting verification"),
      kpi("Sample", String(snap.sampleObservations || 0), "fictional, teaching only"),
      kpi("Unavailable", String(snap.unavailableObservations || 0), "explicitly missing")
    ),
    h("h2", null, "Verification legend"),
    legend,
    h("h2", null, "Company · metric · period coverage"),
    h("div", { class: "table-wrap" },
      h("table", null,
        h("thead", null, headerRow),
        h("tbody", null, ...rows)
      )
    ),
    gapList.length ? frag(h("h2", null, "Known gaps"), h("div", { class: "callout warn" }, h("ul", null, ...gapList))) : null,
    h("h2", null, "Honesty notes"),
    card(
      h("p", { text: meta.honestyNote || "" }),
      h("p", { class: "muted", text: meta.coverageNote || "" })
    )
  );
};

/* ---------- Not found ---------- */
views.notFound = function () {
  return frag(
    pageHead("Page not found", null),
    emptyState("This route does not exist", "Check the navigation menu.", h("a", { class: "btn btn-secondary", href: "#/dashboard" }, "Back to dashboard"))
  );
};

/* ==========================================================================
   Drawer / global wire-up
   ========================================================================== */
function openDrawer() {
  if (!el.sidebar || !el.scrim) return;
  el.sidebar.classList.add("open");
  el.scrim.hidden = false;
  if (el.drawerOpen) el.drawerOpen.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  if (!el.sidebar || !el.scrim) return;
  el.sidebar.classList.remove("open");
  el.scrim.hidden = true;
  if (el.drawerOpen) el.drawerOpen.setAttribute("aria-expanded", "false");
}

if (el.drawerOpen) el.drawerOpen.addEventListener("click", openDrawer);
if (el.drawerClose) el.drawerClose.addEventListener("click", closeDrawer);
if (el.scrim) el.scrim.addEventListener("click", closeDrawer);

if (el.quickForm) {
  el.quickForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state.quickSearchQuery = el.quickInput ? el.quickInput.value : "";
    navigate("#/companies");
  });
}

if (el.newInv) {
  el.newInv.addEventListener("click", () => {
    state.researchQuestion = "";
    navigate("#/research");
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDrawer();
    if (el.modalRoot && !el.modalRoot.hidden) { el.modalRoot.replaceChildren(); hideModalRoot(); }
  }
  if (e.key === "/" && document.activeElement !== (el.quickInput || document.body)) {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      if (el.quickInput) el.quickInput.focus();
    }
  }
});

window.addEventListener("hashchange", render);

/* ==========================================================================
   Boot
   ========================================================================== */
function updateSidebarStatus() {
  if (!el.sidebarStatus) return;
  const snap = DATASET_COVERAGE_SNAPSHOT || {};
  const companies = snap.companies || COMPANIES.length;
  const observations = snap.observations || 0;
  const storage = isStorageAvailable() ? "storage ready" : "storage unavailable";
  el.sidebarStatus.textContent = companies + " companies · " + observations + " observations · " + storage;
}

function boot() {
  hideModalRoot();
  updateSidebarStatus();
  if (!location.hash) location.hash = "#/dashboard";
  render();
}

boot();
