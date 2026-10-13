/* ==========================================================================
   ThesisTrace — data.js  (complete, single file)
   Pure data. No DOM, no storage, no side effects.
   Exports: SCHEMA_VERSION, DATASET_META, INDUSTRIES, METRIC_META,
            SOURCES, COMPANIES, SECTOR_HYPOTHESES, SAMPLE_PROBLEMS,
            DATASET_COVERAGE_SNAPSHOT
   ========================================================================== */

export const SCHEMA_VERSION = 1;

/* --------------------------------------------------------------------------
   Dataset metadata.
   -------------------------------------------------------------------------- */
export const DATASET_META = {
  label: "ThesisTrace seed dataset",
  description:
    "A small, deliberately honest seed set. One real company (TCS) with " +
    "provisional figures awaiting page-level verification, plus one clearly " +
    "fictional sample company used to prove the multi-company architecture.",
  lastReviewed: null,
  coverageNote:
    "Coverage is intentionally narrow. Adding more companies is a data task, " +
    "not a code change: append a record to COMPANIES using the same schema.",
  honestyNote:
    "No value in this file is marked 'verified'. 'Provisional' means the " +
    "figure is from a reputable source reference but has NOT been confirmed " +
    "against the specific page, table, and units of the primary document. " +
    "'Sample' means the figure is fictional and used for teaching only.",
  knownGaps: [
    {
      companyId: "tcs",
      missingPeriod: "FY2025-26",
      reason:
        "No primary source document has been supplied for this fiscal year, " +
        "and the figures circulating in secondary references could not be " +
        "independently confirmed. Rather than carry unverified placeholders, " +
        "the period has been omitted entirely. It will be added once the " +
        "annual report is available and each figure can be checked against a " +
        "specific page and table."
    }
  ]
};

/* --------------------------------------------------------------------------
   Industries.
   -------------------------------------------------------------------------- */
export const INDUSTRIES = {
  it_services: {
    key: "it_services",
    name: "IT Services",
    description:
      "Software services, consulting, and outsourcing. Typically asset-light, " +
      "people-heavy, with high operating cash flow relative to reported profit.",
    relevantMetrics: [
      "revenue", "profit", "operatingCashFlow", "operatingExpenses",
      "otherIncome", "taxExpense", "capex", "workingCapitalChange"
    ],
    incomparableWith: ["banking", "financial_services"]
  },
  banking: {
    key: "banking",
    name: "Banking",
    description:
      "Banks and lending institutions. Debt and cash-flow measures from " +
      "industrial companies do not translate directly. Balance sheet " +
      "structure, net interest margin, and provisioning are the relevant axes.",
    relevantMetrics: [
      "revenue", "profit", "interestExpense", "totalDebt",
      "otherIncome", "taxExpense"
    ],
    incomparableWith: ["it_services", "manufacturing", "fmcg"]
  },
  financial_services: {
    key: "financial_services",
    name: "Financial Services",
    description:
      "Non-bank financial companies, insurers, and asset managers. Comparable " +
      "to banking in many respects; cash-flow framing differs from industrials.",
    relevantMetrics: [
      "revenue", "profit", "interestExpense", "totalDebt", "otherIncome"
    ],
    incomparableWith: ["it_services", "manufacturing"]
  },
  manufacturing: {
    key: "manufacturing",
    name: "Manufacturing",
    description:
      "Capital-intensive producers. Capital expenditure, debt, and working " +
      "capital cycles are central to understanding cash generation.",
    relevantMetrics: [
      "revenue", "profit", "operatingCashFlow", "operatingExpenses",
      "capex", "totalDebt", "interestExpense", "workingCapitalChange"
    ],
    incomparableWith: ["banking", "financial_services"]
  },
  pharma: {
    key: "pharma",
    name: "Pharmaceuticals",
    description:
      "Generic and research-driven pharmaceutical manufacturers. Capital " +
      "expenditure and research spending drive long-run competitiveness.",
    relevantMetrics: [
      "revenue", "profit", "operatingCashFlow", "operatingExpenses",
      "capex", "otherIncome"
    ],
    incomparableWith: []
  },
  energy: {
    key: "energy",
    name: "Energy",
    description:
      "Oil, gas, power, and renewables. Cyclical; capital-intensive; debt and " +
      "commodity price exposure dominate the earnings profile.",
    relevantMetrics: [
      "revenue", "profit", "operatingCashFlow", "capex", "totalDebt",
      "interestExpense"
    ],
    incomparableWith: []
  },
  auto: {
    key: "auto",
    name: "Automobiles",
    description:
      "Vehicle and component manufacturers. Cyclical, capex-heavy, with " +
      "working capital swings driven by dealer inventory.",
    relevantMetrics: [
      "revenue", "profit", "operatingCashFlow", "operatingExpenses",
      "capex", "totalDebt", "workingCapitalChange"
    ],
    incomparableWith: []
  },
  fmcg: {
    key: "fmcg",
    name: "Consumer Goods",
    description:
      "Branded fast-moving consumer goods. Asset-light, steady cash " +
      "generation, but working capital and ad spend shape reported margins.",
    relevantMetrics: [
      "revenue", "profit", "operatingCashFlow", "operatingExpenses", "capex"
    ],
    incomparableWith: ["banking", "financial_services"]
  },
  telecom: {
    key: "telecom",
    name: "Telecommunications",
    description:
      "Network operators. Extremely capex-heavy; debt and spectrum payments " +
      "materially shape both profit and cash flow.",
    relevantMetrics: [
      "revenue", "profit", "operatingCashFlow", "capex", "totalDebt",
      "interestExpense"
    ],
    incomparableWith: []
  }
};

/* --------------------------------------------------------------------------
   Metric metadata.
   -------------------------------------------------------------------------- */
export const METRIC_META = {
  revenue: {
    label: "Revenue from operations",
    shortLabel: "Revenue",
    format: "currency",
    group: "income",
    description:
      "Top-line revenue as reported in the statement of profit and loss."
  },
  profit: {
    label: "Profit for the year",
    shortLabel: "Profit",
    format: "currency",
    group: "income",
    description:
      "Profit for the year attributable to owners, as reported after tax and " +
      "exceptional items. Not the same as operating profit."
  },
  operatingCashFlow: {
    label: "Net cash from operating activities",
    shortLabel: "Operating cash flow",
    format: "currency",
    group: "cashflow",
    description:
      "Cash generated by operations after working-capital movements and tax, " +
      "before investing and financing activities."
  },
  operatingExpenses: {
    label: "Operating expenses",
    shortLabel: "Operating expenses",
    format: "currency",
    group: "income",
    description:
      "The sum of major expense lines that sit between revenue and operating " +
      "profit. The exact composition differs by sector."
  },
  otherIncome: {
    label: "Other income",
    shortLabel: "Other income",
    format: "currency",
    group: "income",
    description:
      "Non-operating income such as interest on investments or foreign " +
      "exchange gains. It can move reported profit without any change in the " +
      "core business."
  },
  exceptionalItems: {
    label: "Exceptional items",
    shortLabel: "Exceptional items",
    format: "currency",
    group: "income",
    description:
      "Unusual or non-recurring items disclosed separately. A positive number " +
      "is a gain; a negative number is a charge."
  },
  taxExpense: {
    label: "Tax expense",
    shortLabel: "Tax",
    format: "currency",
    group: "income",
    description: "Total tax expense for the period including deferred tax."
  },
  totalDebt: {
    label: "Total debt",
    shortLabel: "Total debt",
    format: "currency",
    group: "balance",
    description:
      "Short-term plus long-term borrowings. For banks and financial " +
      "companies this is a core operating item, not a financing overlay, and " +
      "must be interpreted differently."
  },
  cashAndEquivalents: {
    label: "Cash and cash equivalents",
    shortLabel: "Cash",
    format: "currency",
    group: "balance",
    description: "Cash plus short-term, highly liquid investments."
  },
  interestExpense: {
    label: "Interest expense",
    shortLabel: "Interest expense",
    format: "currency",
    group: "income",
    description: "Finance cost charged to the profit and loss statement."
  },
  workingCapitalChange: {
    label: "Change in working capital",
    shortLabel: "Working capital change",
    format: "currency",
    group: "cashflow",
    description:
      "Movement in receivables, inventory, and payables as reflected in the " +
      "cash flow statement. A negative number typically indicates cash was " +
      "absorbed by working capital."
  },
  capex: {
    label: "Capital expenditure",
    shortLabel: "Capex",
    format: "currency",
    group: "cashflow",
    description:
      "Cash spent on property, plant, equipment, and intangibles. Shown as " +
      "an outflow in investing activities."
  }
};

/* --------------------------------------------------------------------------
   Source registry.
   -------------------------------------------------------------------------- */
export const SOURCES = {
  tcs_ar_2023_24: {
    id: "tcs_ar_2023_24",
    title: "TCS Annual Report 2023–24",
    publisher: "Tata Consultancy Services Limited",
    url:
      "https://www.tcs.com/content/dam/tcs/investor-relations/financial-statements/2023-24/ar/annual-report-2023-2024.pdf",
    sourceType: "annual_report",
    note:
      "Official annual report PDF. Values attributed to this source in the " +
      "seed dataset have NOT been confirmed against a specific page, table, " +
      "and unit label. They remain provisional.",
    accessedISO: null
  },
  tcs_ar_2024_25: {
    id: "tcs_ar_2024_25",
    title: "TCS Annual Report 2024–25",
    publisher: "Tata Consultancy Services Limited",
    url:
      "https://www.tcs.com/content/dam/tcs/investor-relations/financial-statements/2024-25/ar/annual-report-2024-2025.pdf",
    sourceType: "annual_report",
    note:
      "Official annual report PDF. Values attributed to this source in the " +
      "seed dataset have NOT been confirmed against a specific page, table, " +
      "and unit label. They remain provisional.",
    accessedISO: null
  },
  tcs_ir_landing: {
    id: "tcs_ir_landing",
    title: "TCS Investor Relations — Financial Statements",
    publisher: "Tata Consultancy Services Limited",
    url: "https://www.tcs.com/investor-relations/financial-statements",
    sourceType: "ir_page",
    note:
      "Landing page for quarterly and annual filings. Provided as a " +
      "convenience link; no figure in this dataset is drawn from this page " +
      "alone.",
    accessedISO: null
  },
  tt_sample_company: {
    id: "tt_sample_company",
    title: "ThesisTrace teaching sample — fictional company",
    publisher: "ThesisTrace (educational content)",
    url: "https://thesistrace.local/sample",
    sourceType: "sample",
    note:
      "This source is fictional. It exists only to provide a second company " +
      "so that search, comparison, and hypothesis features can be exercised " +
      "without mixing in unverified real-world data. Numbers here are " +
      "invented and must never be presented as market information.",
    accessedISO: null
  }
};

/* --------------------------------------------------------------------------
   Companies.
   ========================================================================== */

export const COMPANIES = [
  /* ----------------------------------------------------------------------
     Tata Consultancy Services — real company, PROVISIONAL figures.
     FY2025-26 intentionally omitted: no primary source available.
     ---------------------------------------------------------------------- */
  {
    id: "tcs",
    name: "Tata Consultancy Services Limited",
    ticker: "TCS",
    exchange: "NSE / BSE",
    industryKey: "it_services",
    country: "IN",
    reportingCurrency: "INR",
    reportingUnits: "crore",
    description:
      "Indian multinational information technology services and consulting " +
      "company. Seeded here as the prototype's one real-world company. It is " +
      "not the product's only intended coverage.",
    irUrl: "https://www.tcs.com/investor-relations/financial-statements",
    observations: [
      /* FY2023-24 */
      {
        metricKey: "revenue",
        value: 240893,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2023-24",
        periodStart: "2023-04-01",
        periodEnd: "2024-03-31",
        sourceId: "tcs_ar_2023_24",
        sourceNote:
          "Statement of profit and loss, consolidated, revenue from operations.",
        verification: "provisional",
        isCalculated: false,
        formula: null,
        limitations:
          "Value not yet confirmed against the specific page and table of the " +
          "2023–24 annual report. Treat as provisional until verified."
      },
      {
        metricKey: "profit",
        value: 46099,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2023-24",
        periodStart: "2023-04-01",
        periodEnd: "2024-03-31",
        sourceId: "tcs_ar_2023_24",
        sourceNote:
          "Statement of profit and loss, consolidated, profit for the year.",
        verification: "provisional",
        isCalculated: false,
        formula: null,
        limitations:
          "Value not yet confirmed against the specific page and table of the " +
          "2023–24 annual report. Treat as provisional until verified."
      },
      {
        metricKey: "operatingCashFlow",
        value: 44338,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2023-24",
        periodStart: "2023-04-01",
        periodEnd: "2024-03-31",
        sourceId: "tcs_ar_2023_24",
        sourceNote:
          "Cash flow statement, consolidated, net cash from operating activities.",
        verification: "provisional",
        isCalculated: false,
        formula: null,
        limitations:
          "Value not yet confirmed against the specific page and table of the " +
          "2023–24 annual report. Treat as provisional until verified."
      },
      /* FY2024-25 */
      {
        metricKey: "revenue",
        value: 255324,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2024-25",
        periodStart: "2024-04-01",
        periodEnd: "2025-03-31",
        sourceId: "tcs_ar_2024_25",
        sourceNote:
          "Statement of profit and loss, consolidated, revenue from operations.",
        verification: "provisional",
        isCalculated: false,
        formula: null,
        limitations:
          "Value not yet confirmed against the specific page and table of the " +
          "2024–25 annual report. Treat as provisional until verified."
      },
      {
        metricKey: "profit",
        value: 48797,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2024-25",
        periodStart: "2024-04-01",
        periodEnd: "2025-03-31",
        sourceId: "tcs_ar_2024_25",
        sourceNote:
          "Statement of profit and loss, consolidated, profit for the year.",
        verification: "provisional",
        isCalculated: false,
        formula: null,
        limitations:
          "Value not yet confirmed against the specific page and table of the " +
          "2024–25 annual report. Treat as provisional until verified."
      },
      {
        metricKey: "operatingCashFlow",
        value: 48908,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2024-25",
        periodStart: "2024-04-01",
        periodEnd: "2025-03-31",
        sourceId: "tcs_ar_2024_25",
        sourceNote:
          "Cash flow statement, consolidated, net cash from operating activities.",
        verification: "provisional",
        isCalculated: false,
        formula: null,
        limitations:
          "Value not yet confirmed against the specific page and table of the " +
          "2024–25 annual report. Treat as provisional until verified."
      }
    ]
  },

  /* ----------------------------------------------------------------------
     Meridian Systems — FICTIONAL sample company.
     All figures invented. verification: "sample" throughout.
     ---------------------------------------------------------------------- */
  {
    id: "meridian_sample",
    name: "Meridian Systems (fictional teaching sample)",
    ticker: "MERIDIAN",
    exchange: "Sample Exchange",
    industryKey: "it_services",
    country: "IN",
    reportingCurrency: "INR",
    reportingUnits: "crore",
    description:
      "Fictional IT services company invented solely for teaching and testing. " +
      "Revenue growth is modelled as slowing while margins compress, so the " +
      "research features have something to reason about. No figure here is real.",
    irUrl: "https://thesistrace.local/sample",
    observations: [
      /* FY2022-23 */
      {
        metricKey: "revenue",
        value: 10000,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2022-23",
        periodStart: "2022-04-01",
        periodEnd: "2023-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "profit",
        value: 1500,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2022-23",
        periodStart: "2022-04-01",
        periodEnd: "2023-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "operatingCashFlow",
        value: 1800,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2022-23",
        periodStart: "2022-04-01",
        periodEnd: "2023-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "operatingExpenses",
        value: 7800,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2022-23",
        periodStart: "2022-04-01",
        periodEnd: "2023-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      /* FY2023-24 */
      {
        metricKey: "revenue",
        value: 11200,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2023-24",
        periodStart: "2023-04-01",
        periodEnd: "2024-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "profit",
        value: 1620,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2023-24",
        periodStart: "2023-04-01",
        periodEnd: "2024-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "operatingCashFlow",
        value: 1400,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2023-24",
        periodStart: "2023-04-01",
        periodEnd: "2024-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "operatingExpenses",
        value: 8900,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2023-24",
        periodStart: "2023-04-01",
        periodEnd: "2024-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      /* FY2024-25 */
      {
        metricKey: "revenue",
        value: 11900,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2024-25",
        periodStart: "2024-04-01",
        periodEnd: "2025-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "profit",
        value: 1580,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2024-25",
        periodStart: "2024-04-01",
        periodEnd: "2025-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "operatingCashFlow",
        value: 1100,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2024-25",
        periodStart: "2024-04-01",
        periodEnd: "2025-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      },
      {
        metricKey: "operatingExpenses",
        value: 9900,
        unit: "crore",
        currency: "INR",
        scope: "consolidated",
        periodType: "annual",
        fy: "FY2024-25",
        periodStart: "2024-04-01",
        periodEnd: "2025-03-31",
        sourceId: "tt_sample_company",
        sourceNote: "Fictional teaching figure.",
        verification: "sample",
        isCalculated: false,
        formula: null,
        limitations: "Invented for teaching. Not a real company."
      }
    ]
  }
];

/* --------------------------------------------------------------------------
   Sector hypothesis templates.
   -------------------------------------------------------------------------- */
export const SECTOR_HYPOTHESES = [
  {
    id: "revenue_growth_slowdown",
    appliesToIndustries: ["*"],
    title: "Slower revenue growth is dragging reported profit growth.",
    description:
      "In businesses with a broadly fixed operating cost base, decelerating " +
      "revenue growth compresses incremental profit even if margins are stable.",
    requiredMetrics: ["revenue", "profit"],
    nextStep:
      "Compare constant-currency revenue growth with reported revenue growth, " +
      "and split by segment if segment data is available.",
    uncertaintyBase: "medium",
    uncertaintyReason:
      "Requires confirming that growth is genuinely slower in underlying " +
      "terms and not the result of currency or a segment mix shift."
  },
  {
    id: "margin_compression",
    appliesToIndustries: ["*"],
    title: "Operating margin compression is the primary drag on profit growth.",
    description:
      "If operating expenses grow faster than revenue, margins compress and " +
      "profit grows more slowly than revenue even with healthy top-line growth.",
    requiredMetrics: ["revenue", "operatingExpenses", "profit"],
    nextStep:
      "Compute operating margin (revenue minus operating expenses, over " +
      "revenue) for each period and inspect the direction of change.",
    uncertaintyBase: "medium",
    uncertaintyReason:
      "Margin direction is only as reliable as the operating-expense line, " +
      "which is often presented differently across reports."
  },
  {
    id: "cash_conversion_divergence",
    appliesToIndustries: ["*"],
    title: "Reported profit and operating cash flow are diverging.",
    description:
      "When profit rises but operating cash flow does not, or vice versa, " +
      "the gap usually reflects working-capital movements, non-cash items, " +
      "or a change in revenue recognition. It is a prompt to investigate, " +
      "not evidence of a problem by itself.",
    requiredMetrics: ["profit", "operatingCashFlow"],
    nextStep:
      "Compute operating cash flow as a percentage of reported profit for " +
      "each period, then inspect the working-capital movement line.",
    uncertaintyBase: "medium",
    uncertaintyReason:
      "A single period's divergence is common and benign. Sustained " +
      "divergence over multiple periods is the more informative signal."
  },
  {
    id: "other_income_or_exceptional",
    appliesToIndustries: ["*"],
    title:
      "Other income or exceptional items explain part of the reported profit pattern.",
    description:
      "Reported profit can diverge from operating performance when other " +
      "income, exceptional items, or a one-off tax effect moves the headline number.",
    requiredMetrics: ["profit", "otherIncome"],
    nextStep:
      "Separate other income and exceptional items from operating profit " +
      "for each period and compare operating profit growth to reported profit growth.",
    uncertaintyBase: "high",
    uncertaintyReason:
      "Without the underlying income-statement detail, the contribution of " +
      "non-operating items cannot be quantified."
  },
  {
    id: "working_capital_swing",
    appliesToIndustries: ["*"],
    title: "A working-capital swing is absorbing cash and reducing profit quality.",
    description:
      "Rising receivables or inventory, or faster payment to suppliers, can " +
      "convert reported profit into cash more slowly without any change in " +
      "the underlying business.",
    requiredMetrics: ["operatingCashFlow", "workingCapitalChange"],
    nextStep:
      "Inspect the working-capital movement line in the cash-flow statement " +
      "and compare it with revenue growth to see whether the swing is " +
      "proportionate.",
    uncertaintyBase: "high",
    uncertaintyReason:
      "Working-capital lines are aggregated in most cash-flow statements and " +
      "rarely isolate which component moved."
  },
  {
    id: "interest_burden",
    appliesToIndustries: ["manufacturing", "energy", "auto", "telecom"],
    title: "Rising interest expense is consuming a growing share of profit.",
    description:
      "In capital-intensive businesses, an increase in borrowing costs can " +
      "reduce profit growth independently of operating performance.",
    requiredMetrics: ["interestExpense", "profit"],
    nextStep:
      "Compare interest expense growth with revenue and profit growth, and " +
      "inspect the debt note in the balance sheet.",
    uncertaintyBase: "medium",
    uncertaintyReason:
      "Requires confirming that the interest line reflects recurring cost and " +
      "not a one-time charge."
  },
  {
    id: "banking_net_interest",
    appliesToIndustries: ["banking", "financial_services"],
    title: "Net interest margin compression is reducing profit growth.",
    description:
      "For banks and lenders, the spread between interest earned and " +
      "interest paid is a primary driver of profit. Compression here can " +
      "override growth in the loan book.",
    requiredMetrics: ["revenue", "interestExpense", "profit"],
    nextStep:
      "Obtain net interest income and interest-earning assets from the " +
      "investor presentation, then compute net interest margin per period.",
    uncertaintyBase: "high",
    uncertaintyReason:
      "Net interest margin requires figures (interest-earning assets, NPA " +
      "levels) that are not captured by a generic metric schema."
  }
];

/* --------------------------------------------------------------------------
   Prepared teaching problems.
   Six fixed exercises. None is presented as the single correct answer.
   -------------------------------------------------------------------------- */
export const SAMPLE_PROBLEMS = [
  {
    id: "problem_profit_growth_slowdown",
    category: "Corporate finance",
    title: "A company's profit growth has slowed. Why?",
    scenario:
      "Across three fiscal years, a fictional IT services company's revenue grew from " +
      "₹10,000 crore to ₹11,900 crore while profit moved from ₹1,500 crore to " +
      "₹1,580 crore. Profit growth stalled in the most recent year even " +
      "though revenue still rose. (Figures are from the ThesisTrace teaching " +
      "sample company. The same analytical pattern can be run on real TCS " +
      "figures from the Company Explorer.)",
    approaches: [
      {
        title: "Revenue-led explanation",
        summary:
          "Slower revenue growth reduces the incremental profit generated by " +
          "a fixed cost base.",
        evidenceToLookFor: [
          "Revenue growth rate by year.",
          "Constant-currency revenue growth.",
          "Segment-level revenue split."
        ],
        benefits: ["Directly observable from reported figures."],
        drawbacks: ["Does not explain why growth slowed in the first place."],
        risks: ["Confusing a currency effect with a demand effect."],
        uncertainty: "medium",
        nextTest:
          "Compare reported revenue growth with constant-currency revenue " +
          "growth in the same period."
      },
      {
        title: "Cost-led explanation",
        summary:
          "Operating costs grew faster than revenue, compressing margin.",
        evidenceToLookFor: [
          "Operating expenses by year.",
          "Operating margin direction.",
          "Wage or input-cost disclosures."
        ],
        benefits: [
          "Directly testable if the expense line is reported.",
          "Distinguishes a margin problem from a growth problem."
        ],
        drawbacks: [
          "Requires expense-line detail that is not always presented consistently."
        ],
        risks: [
          "Assuming margin compression without computing margin from actual figures."
        ],
        uncertainty: "medium",
        nextTest:
          "Compute operating margin (revenue minus operating expenses, over " +
          "revenue) per period; then check whether margin expanded or contracted."
      },
      {
        title: "Non-operating explanation",
        summary:
          "Other income, exceptional items, or a tax change moved reported " +
          "profit independently of the operating business.",
        evidenceToLookFor: [
          "Other income by year.",
          "Exceptional items disclosure.",
          "Effective tax rate per period."
        ],
        benefits: [
          "Explains a divergence between operating performance and headline profit."
        ],
        drawbacks: [
          "Requires line-item disclosure that is often in the notes, not the " +
          "summary statement."
        ],
        risks: ["Treating a one-off item as a recurring trend."],
        uncertainty: "high",
        nextTest:
          "Build operating profit (revenue minus operating expenses) per " +
          "period and compare its growth to reported profit growth."
      }
    ],
    cannotConclude:
      "Reported profit and revenue growth alone cannot establish causation. " +
      "Any of the three approaches above may be partially true. A conclusion " +
      "requires the missing evidence each approach lists, plus a longer time " +
      "series than two or three periods."
  },
  {
    id: "problem_profit_vs_ocf",
    category: "Cash quality",
    title: "Reported profit is rising, but operating cash flow is falling.",
    scenario:
      "A company reports growing profit but declining operating cash flow " +
      "over the same period. Is this a warning sign?",
    approaches: [
      {
        title: "Working-capital absorption",
        summary:
          "Rising receivables or inventory, or faster supplier payments, " +
          "converted profit into cash more slowly.",
        evidenceToLookFor: [
          "Working-capital movement line in the cash-flow statement.",
          "Days sales outstanding and days inventory outstanding, if disclosed.",
          "Revenue recognition policy notes."
        ],
        benefits: [
          "Directly consistent with the reported cash-flow statement."
        ],
        drawbacks: [
          "Working-capital lines are usually aggregated; the specific driver " +
          "may not be visible."
        ],
        risks: [
          "Assuming a working-capital problem when the real driver is revenue recognition."
        ],
        uncertainty: "medium",
        nextTest:
          "Compare receivables growth with revenue growth over the same period."
      },
      {
        title: "Non-cash gains inflating profit",
        summary:
          "Profit includes a non-cash item (fair-value gain, deferred tax " +
          "credit, or one-off item) that does not affect operating cash flow.",
        evidenceToLookFor: [
          "Other income and exceptional items disclosure.",
          "Deferred tax movement.",
          "Non-cash reconciling items in the cash-flow statement."
        ],
        benefits: [
          "Explains the divergence without needing working-capital detail."
        ],
        drawbacks: [
          "Requires reading the notes to the accounts, not just the summary."
        ],
        risks: [
          "Treating a one-off non-cash gain as a permanent quality problem."
        ],
        uncertainty: "medium",
        nextTest:
          "Recompute profit excluding other income and exceptional items, " +
          "then compare that adjusted figure with operating cash flow."
      },
      {
        title: "Benign timing difference",
        summary:
          "A single year's divergence is common and often reverses. It is not, " +
          "by itself, evidence of a problem.",
        evidenceToLookFor: [
          "Three-to-five-year series of profit and operating cash flow.",
          "Whether the divergence reverses in a subsequent period."
        ],
        benefits: ["Avoids over-reading a single data point."],
        drawbacks: ["Requires a longer history than a two-period snapshot."],
        risks: ["Under-reacting to a sustained divergence."],
        uncertainty: "low",
        nextTest:
          "Extend the series to five years and compute the ratio of operating " +
          "cash flow to profit for each year."
      }
    ],
    cannotConclude:
      "A profit-versus-cash divergence is a prompt to investigate, not proof " +
      "of aggressive accounting. Some of the most stable businesses have " +
      "occasional working-capital swings that reverse within a year. Only a " +
      "sustained, unexplained divergence across multiple periods justifies " +
      "deeper scrutiny."
  },
  {
    id: "problem_margin_compression",
    category: "Margins",
    title: "Revenue grew, but profit did not. Where did the money go?",
    scenario:
      "A company's revenue grew 12% while reported profit fell 3% over the " +
      "same period. Where did the incremental revenue go?",
    approaches: [
      {
        title: "Direct cost inflation",
        summary:
          "Input or wage costs rose faster than the company could pass on " +
          "through pricing.",
        evidenceToLookFor: [
          "Operating expenses growth vs revenue growth.",
          "Cost-per-unit or cost-per-employee disclosures.",
          "Management commentary on input costs."
        ],
        benefits: ["Directly testable from the income statement."],
        drawbacks: [
          "Cost lines are aggregated; the specific driver may not be visible."
        ],
        risks: [
          "Assuming a permanent cost shift when the real driver is a one-off " +
          "step-up in a specific year."
        ],
        uncertainty: "medium",
        nextTest:
          "Compute operating expenses growth and revenue growth over three " +
          "years. If cost growth consistently outpaces revenue growth, the " +
          "explanation strengthens."
      },
      {
        title: "Mix shift toward lower-margin business",
        summary:
          "The company sold more of a lower-margin product or served more of " +
          "a lower-margin customer segment, so average margin fell even as " +
          "total revenue grew.",
        evidenceToLookFor: [
          "Segment revenue and segment margin disclosure.",
          "Geographic or channel mix commentary."
        ],
        benefits: [
          "Explains divergence without requiring a cost-inflation story."
        ],
        drawbacks: [
          "Segment margin disclosure is inconsistent across companies."
        ],
        risks: ["Confusing a mix shift with a pricing problem."],
        uncertainty: "high",
        nextTest:
          "Reconstruct revenue growth by segment. If the fastest-growing " +
          "segment has the lowest disclosed margin, the mix-shift explanation " +
          "gains support."
      },
      {
        title: "Pricing pressure",
        summary:
          "Realized prices fell even though volumes held up, reducing margin " +
          "per unit.",
        evidenceToLookFor: [
          "Realizations per unit, where disclosed.",
          "Revenue per customer or per employee.",
          "Competitive commentary from management."
        ],
        benefits: [
          "Consistent with margin compression alongside revenue growth."
        ],
        drawbacks: [
          "Realization data is rarely disclosed outside commodities."
        ],
        risks: [
          "Attributing a mix shift to pricing when the two are not separable " +
          "from public data."
        ],
        uncertainty: "high",
        nextTest:
          "Compare revenue growth with volume growth if volume is disclosed " +
          "separately."
      }
    ],
    cannotConclude:
      "One period of margin compression is common and often reverses. Before " +
      "treating it as a trend, examine three to five years of margin data " +
      "and check whether any single year contains a one-off cost item."
  },
  {
    id: "problem_debt_interest",
    category: "Leverage",
    title: "Debt is rising and interest expense is eating into profit.",
    scenario:
      "A capital-intensive company has grown revenue over five years but its " +
      "interest expense has grown faster. Debt has risen every year.",
    approaches: [
      {
        title: "Growth capex is driving the debt",
        summary:
          "The company is borrowing to fund capacity expansion and the " +
          "interest burden is a temporary cost of that growth.",
        evidenceToLookFor: [
          "Capital expenditure as a percentage of operating cash flow.",
          "Commissioning dates and capacity additions.",
          "Debt-to-equity direction, not just level."
        ],
        benefits: [
          "If true, the leverage may be self-correcting once the new capacity " +
          "contributes revenue."
        ],
        drawbacks: [
          "Distinguishing growth capex from maintenance capex is often " +
          "impossible from the cash-flow statement alone."
        ],
        risks: [
          "Assuming that all capex-driven borrowing is benign; some capacity " +
          "additions do not earn their cost of capital."
        ],
        uncertainty: "medium",
        nextTest:
          "Compare the growth rate of operating cash flow with the growth " +
          "rate of interest expense over five years."
      },
      {
        title: "Margins are too thin to service the debt",
        summary:
          "The underlying business does not generate enough operating profit " +
          "to comfortably cover the debt it has taken on.",
        evidenceToLookFor: [
          "Interest coverage ratio (operating profit over interest expense).",
          "Cash flow after maintenance capex against debt service."
        ],
        benefits: [
          "Directly testable from the income statement and cash-flow statement."
        ],
        drawbacks: [
          "Maintenance capex is usually not separately disclosed."
        ],
        risks: [
          "One year's coverage ratio is not a sufficient basis for a " +
          "conclusion about long-run sustainability."
        ],
        uncertainty: "medium",
        nextTest:
          "Compute interest coverage for each of the past five years and " +
          "check whether the trend is deteriorating or stable."
      },
      {
        title: "Refinancing at higher rates",
        summary:
          "The company has not added debt but has refinanced at higher rates " +
          "or moved to a floating-rate structure.",
        evidenceToLookFor: [
          "Weighted-average cost of debt, if disclosed.",
          "Breakdown of fixed-rate versus floating-rate borrowings.",
          "Borrowing note in the annual report."
        ],
        benefits: [
          "If true, the trend is a rate-cycle issue, not a solvency issue."
        ],
        drawbacks: [
          "Rarely broken out at the summary level; requires reading the notes."
        ],
        risks: [
          "Assuming rate-driven cost increases will reverse when rates fall, " +
          "without checking the borrowing mix."
        ],
        uncertainty: "high",
        nextTest:
          "Read the borrowing note in the annual report for the maturity " +
          "profile and interest-rate structure."
      }
    ],
    cannotConclude:
      "Rising debt and rising interest expense are not by themselves evidence " +
      "of distress. In capital-intensive sectors they can accompany a " +
      "productive expansion. Neither are they automatically benign. The " +
      "conclusion depends on what the borrowed money is being spent on, which " +
      "the cash-flow statement alone rarely reveals."
  },
  {
    id: "problem_compare_across_sector",
    category: "Comparison",
    title: "Comparing two companies in the same sector.",
    scenario:
      "Two IT services companies, similar revenue in year one, diverge over " +
      "three years. One grows revenue 25% and profit 20%. The other grows " +
      "revenue 30% and profit 12%. Which is the better business?",
    approaches: [
      {
        title: "Margin-persistence view",
        summary:
          "The company with steadier margins is showing more durable " +
          "unit economics, even if growth is slower.",
        evidenceToLookFor: [
          "Operating margin per year for each company.",
          "Management commentary on pricing and utilization.",
          "Employee attrition and wage-cost disclosures."
        ],
        benefits: [
          "Focuses attention on durability, not just headline growth."
        ],
        drawbacks: [
          "Margin persistence in a services business is heavily influenced by " +
          "utilisation and pricing power, which are cyclical."
        ],
        risks: [
          "Assuming a stable margin is permanent without checking the mix " +
          "of deals."
        ],
        uncertainty: "medium",
        nextTest:
          "Compute operating margin for each company for five years and check " +
          "the standard deviation, not just the average."
      },
      {
        title: "Reinvestment view",
        summary:
          "The faster-growing company may be sacrificing margin to build " +
          "capability or win strategic deals, with a longer payback.",
        evidenceToLookFor: [
          "Deal wins and total contract value disclosure.",
          "Sales and marketing expense as a percentage of revenue.",
          "Capex and acquisitions."
        ],
        benefits: [
          "Explains why margin compression can accompany a healthy strategy."
        ],
        drawbacks: [
          "Deal-win disclosures are rarely comparable between companies."
        ],
        risks: [
          "Treating every margin sacrifice as strategic when some is " +
          "operational weakness."
        ],
        uncertainty: "high",
        nextTest:
          "Look for management guidance on when margins are expected to " +
          "stabilise, and check whether the timeline has slipped."
      },
      {
        title: "Non-operating contamination",
        summary:
          "Reported profit growth may reflect other income, tax effects, or " +
          "exceptional items rather than operating performance.",
        evidenceToLookFor: [
          "Operating profit vs reported profit for each company.",
          "Effective tax rate for each company.",
          "Exceptional items disclosure."
        ],
        benefits: [
          "Ensures the comparison is actually about operating performance."
        ],
        drawbacks: [
          "Operating profit is not always presented as a single line."
        ],
        risks: [
          "Comparing a company's reported profit with another's operating " +
          "profit, which is not like-with-like."
        ],
        uncertainty: "medium",
        nextTest:
          "Reconstruct operating profit (revenue minus operating expenses) " +
          "for both companies for each year before drawing conclusions."
      }
    ],
    cannotConclude:
      "Neither faster growth nor steadier margin is automatically 'better'. " +
      "The two companies may be pursuing different strategies, serving " +
      "different segments, or operating under different accounting policies. " +
      "A comparison that ignores those differences can produce a confident " +
      "but wrong conclusion."
  },
  {
    id: "problem_growth_not_quality",
    category: "Interpretation",
    title: "Revenue grew 40%. Does that mean the business is healthy?",
    scenario:
      "A company reports 40% revenue growth. Its operating cash flow fell, " +
      "its receivables rose sharply, and profit grew only 5%.",
    approaches: [
      {
        title: "Genuine demand expansion",
        summary:
          "The company is winning new business faster than its industry, and " +
          "the cash and receivables effects are temporary consequences of that growth.",
        evidenceToLookFor: [
          "Industry growth rate for the same period.",
          "Customer concentration and new-customer disclosure.",
          "Order book or backlog, if disclosed."
        ],
        benefits: [
          "If true, cash and profit should catch up over the next 1-2 periods."
        ],
        drawbacks: [
          "Distinguishing growth-driven receivables from collection problems " +
          "requires disclosure that is often missing."
        ],
        risks: [
          "Assuming every receivables increase will convert to cash."
        ],
        uncertainty: "medium",
        nextTest:
          "Compare receivables growth with revenue growth over the same " +
          "period, and check next period's cash conversion."
      },
      {
        title: "Revenue recognition change",
        summary:
          "A change in accounting policy or the timing of revenue recognition " +
          "has moved revenue forward without changing the underlying business.",
        evidenceToLookFor: [
          "Changes in accounting policy in the notes.",
          "Revenue-recognition-policy description.",
          "Comparative figures being restated."
        ],
        benefits: [
          "Explains a sudden step-up in revenue without an operational cause."
        ],
        drawbacks: [
          "Policy changes are sometimes disclosed in a single line and easy " +
          "to miss."
        ],
        risks: [
          "Over-attributing a genuine demand increase to an accounting change."
        ],
        uncertainty: "high",
        nextTest:
          "Read the accounting-policy note for revenue recognition and check " +
          "whether comparative figures were restated."
      },
      {
        title: "Low-quality growth",
        summary:
          "The growth is being achieved through generous credit terms, " +
          "channel stuffing, or lower-margin business, none of which is " +
          "durable.",
        evidenceToLookFor: [
          "Days sales outstanding trend.",
          "Gross-margin direction alongside revenue growth.",
          "Segment-mix change."
        ],
        benefits: [
          "Explains the divergence between revenue growth and profit or cash."
        ],
        drawbacks: [
          "There is no single line that proves this; it requires cumulative " +
          "evidence."
        ],
        risks: [
          "Labelling a company's growth as low-quality without longitudinal " +
          "evidence."
        ],
        uncertainty: "high",
        nextTest:
          "Compute days sales outstanding for each of the past four periods " +
          "and check whether the trend is deteriorating."
      }
    ],
    cannotConclude:
      "Revenue growth is one input, not a verdict. Without profit, cash " +
      "conversion, and receivables behaviour alongside it, a 40% growth " +
      "figure cannot support any conclusion about the health of the business."
  }
];

/* --------------------------------------------------------------------------
   Coverage snapshot.
   -------------------------------------------------------------------------- */
export const DATASET_COVERAGE_SNAPSHOT = {
  companies: 2,
  realCompanies: 1,
  sampleCompanies: 1,
  observations: 18,
  tcsPeriods: ["FY2023-24", "FY2024-25"],
  tcsMetrics: ["revenue", "profit", "operatingCashFlow"],
  samplePeriods: ["FY2022-23", "FY2023-24", "FY2024-25"],
  sampleMetrics: ["revenue", "profit", "operatingCashFlow", "operatingExpenses"],
  verifiedObservations: 0,
  provisionalObservations: 6,
  sampleObservations: 12,
  unavailableObservations: 0,
  note:
    "Zero observations are marked verified because no figure has been " +
    "confirmed against a specific page and table of the primary source " +
    "document by the ThesisTrace maintainer. Every non-sample figure is " +
    "provisional until that check is completed."
};

/* ==========================================================================
   End of data.js.
   ========================================================================== */
