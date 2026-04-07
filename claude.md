## DATA SOURCES — GOOGLE SHEETS
One spreadsheet, multiple tabs. Each tab = one vertical.

### ACTIVE TABS
**Reta-CTRY** → Retail beauty stores
- cities_country_code
- bought_products_order_started_local_month (format: "2025-01")
- bought_products_order_started_local_year
- bought_products_products_value_delivered_eur
- bought_products_number_of_distinct_delivered_orders

**MFC-CTRY** → Glovo dark stores
- products_sold_v2_country_code
- products_sold_v2_order_activation_local_month
- products_sold_v2_order_activation_local_year
- products_sold_v2_total_product_revenue_eur
- products_sold_v2_total_orders_no_remake_or_split

### FUTURE TABS (not yet active — follow same pattern when adding)
- Groc-CTRY → Groceries/supermarkets
- Partners-CTRY → Partner level scorecard
- Search-CTRY → In-store and out-of-store search data
- OPS-CTRY → Operational metrics (HC, prep time, uptime, cancellations)

### HOW TO ADD A NEW TAB
In `pages/api/data.js`, add one entry to SOURCES array:
```javascript
{
  tab:      'Groc-CTRY',
  vertical: 'Groceries',
  columns: {
    country: 'EXACT_COLUMN_NAME',
    month:   'EXACT_COLUMN_NAME',
    year:    'EXACT_COLUMN_NAME',
    gmv:     'EXACT_COLUMN_NAME',
    orders:  'EXACT_COLUMN_NAME',
  }
}
```
Everything else updates automatically.

---

## API RESPONSE STRUCTURE
```javascript
{
  meta: {
    lastUpdated,     // ISO timestamp
    totalRows,       // rows after partial month exclusion
    periodStart,     // e.g. "2024-01"
    periodEnd,       // e.g. "2026-03"
    currentPeriod,   // excluded partial month e.g. "2026-04"
    verticals,       // ['Retail', 'MFC']
  },
  summary: { totalGMV, totalOrders, aov, countries, verticals },

  // Pre-aggregated across ALL verticals — NO vertical field
  byCountry:      [{ country, gmv, orders, aov }],
  byCountryMonth: [{ period, country, gmv, orders, aov }],
  monthlyTotal:   [{ period, gmv, orders, aov, momGMV, momOrders }],

  // Has vertical field — USE THIS when vertical filter is active
  byVertical:             [{ period, vertical, gmv, orders, aov }],
  byVerticalCountryMonth: [{ period, country, vertical, gmv, orders, aov }],

  growth: {
    periodComparison: [{ country, firstPeriod, lastPeriod, firstGMV, lastGMV, gmvGrowth }],
    countryMoM:       { MA: [{ period, gmv, momGMV }], ... },
    yoy:              { MA: [{ period, gmv, prevYearGMV, yoyGMV }], ... },
  }
}
```

---

## STATE & FILTERS (all in index.js)
```javascript
selected       // array of country codes ['MA', 'KE', ...]
periodFilter   // 'all' | '2024' | '2025' | '2026' | 'l3m' | 'l6m'
verticalFilter // 'all' | 'Retail' | 'MFC' | 'Groceries' (add as tabs arrive)
```

---

## CRITICAL LOGIC — READ BEFORE TOUCHING INDEX.JS

**1. Partial month exclusion**
Current month is excluded at API level (`data.js`) AND frontend. Never show partial month data.

**2. Vertical filter data source**
verticalFilter === 'all'         → use byCountryMonth (fast, pre-aggregated)
verticalFilter === 'Retail/MFC'  → use byVerticalCountryMonth filtered by vertical
then rebuild monthlyTotal on frontend
byCountryMonth has NO vertical field — never try to filter it by vertical.

**3. filteredByCountry must always be recalculated**
Never use raw `byCountry` from API for display. Always recalculate from `getCountryMonthSource()` filtered by period + vertical. This ensures % GMV always adds to 100%.

**4. % GMV denominator**
Always use `filteredGMV` (sum of filteredByCountry) as denominator. Never use summary.totalGMV.

**5. Growth column**
Compares first vs last period of the FILTERED data. Not raw API growth object.

**6. RetailVsMFCChart**
Always shows both verticals regardless of verticalFilter. Uses `byVertical` and `byVerticalCountryMonth` directly with only period filter applied.

---

## MARKETS
| Code | Name | Status | Key Insight |
|------|------|--------|-------------|
| MA | Morocco | Mature, flat | ~62% of GMV, concentration risk |
| KE | Kenya | Growing | Strong growth, +57% spike Oct-25 unexplained |
| NG | Nigeria | Risk | High orders, lowest AOV (€4.32), monetization broken |
| UG | Uganda | Nascent | No MFC, no partner shortlist yet |
| CI | Ivory Coast | Sleeping giant | Highest retail AOV (€29.86), almost no orders |
| TN | Tunisia | Volatile | +99bps YoY but unstable, no MFC |

## COLORS
```javascript
// Countries
MA: '#FFC244', KE: '#00A082', TN: '#3B82F6'
CI: '#8B5CF6', UG: '#EC4899', NG: '#F97316'
// Verticals
Retail: '#FFC244', MFC: '#00A082', Groceries: '#3B82F6'
```

---

## WHAT'S BUILT (Layer 1 — Market Health ✅)
- KPI cards: GMV, Orders, AOV, Active Markets — all respond to filters
- Vertical summary strip (Retail % vs MFC %)
- GMV trend line chart by country
- Total monthly GMV bar chart
- GMV by country horizontal bar chart
- MoM growth % line chart
- Retail vs MFC stacked comparison chart
- Country breakdown table: GMV, %, Orders, AOV, Growth, Status, Insight
- Auto-generated insights panel with urgency flags
- Period filter: All / 2024 / 2025 / 2026 / L3M / L6M
- Market filter: toggle individual countries
- Vertical filter: All / Retail / MFC
- Dark/light mode toggle
- Refresh button
- Current partial month excluded automatically

---

## WHAT TO BUILD NEXT

### Layer 2 — Demand Signals
**Data needed:** Search tab (in-store + out-of-store search)
**Charts to build:**
- Top searched terms with zero results per country → assortment gap
- Search volume trend per country
- Search-to-order CVR

**New columns expected:**
- country, period, search_term, search_count, result_count, orders_generated

### Layer 3 — Partner Performance
**Data needed:** Partners tab
**Charts to build:**
- Partner scorecard table: GMV, Orders, CVR, AOV, HC (cancellation rate), replenishment %
- Replenishment % vs CVR scatter plot (key insight from strategy deck)
- Partner ranking per country
- Partners below 50% replenishment threshold flagged

**New columns expected:**
- country, period, partner_name, gmv, orders, cvr, hc_rate, replenishment_pct, sku_count

### Layer 4 — Groceries Vertical
**Just add Groc-CTRY tab to SOURCES in data.js**
All existing charts auto-update. Add 'Groceries' to VERTICAL_FILTERS array in index.js.

### Layer 5 — OPS Metrics
**Data needed:** OPS tab
**Metrics:** prep time, delivery time, uptime %, cancellation rate per partner per country
**Charts:** OPS scorecard, correlation with CVR

### Layer 6 — Market Recommendations
**No new data needed**
Auto-generated per market based on all layers above.
Combine: growth trend + partner performance + search gaps + OPS issues → action items per POC.

---

## KNOWN BUGS FIXED — DO NOT REINTRODUCE
| Bug | Root cause | Fix |
|-----|-----------|-----|
| Growth showing -100% | Partial month used as last period | Exclude current month at API level |
| % GMV over 100% | Mixed all-time byCountry with filtered totalGMV | Recalculate byCountry from filtered source |
| MoM chart missing first month | Always slicing first period | Filter points where all countries are null instead |
| Blank charts on vertical filter | byCountryMonth has no vertical field | Switch to byVerticalCountryMonth when vertical selected |
| Private key error on Vercel | Key format issue | Use .split('\\n').join('\n') |

---

## STYLING RULES
- Tailwind only — no inline styles except dynamic colors
- Dark mode: always include dark: variant for bg and text
- Cards: `bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6`
- Labels: `text-xs font-bold uppercase tracking-wider text-gray-400`
- Values: `text-3xl font-black text-gray-900 dark:text-white`
- Accent colors: yellow-400 (primary), green-500 (positive), red-400 (negative/alert)
- Never use purple gradients or Inter font (generic AI aesthetic)

---

## DEPLOY WORKFLOW
```bash
git add .
git commit -m "description"
git push origin master
# Vercel auto-deploys on every push to master
```

## ENV VARIABLES
GOOGLE_SPREADSHEET_ID         # from sheet URL
GOOGLE_SERVICE_ACCOUNT_EMAIL  # from service account JSON
GOOGLE_PRIVATE_KEY            # from service account JSON — keep \n as literal

## POC CONTACTS
- MA / TN → Najoua Makboul
- KE / UG → Rosemary Kamunge
- CI / NG → Pierre-Emmanuel Soumahoro

---

## STRATEGY CONTEXT (for insights generation)
- Beauty = 1.7% of Q-Com GMV — underpenetrated vs €624M TAM
- Target CVR = 10% (benchmark: Dm Serbia 21%, True Cosmetics KE 9%)
- Replenishment drives CVR — shampoo/body wash > colour cosmetics/fragrances
- Authenticity is #1 consumer barrier in Africa (67% of online beauty found counterfeit)
- Supermarkets cover replenishment but can't replace beauty specialists
- Parapharmacy model strongest in MA (Para Vita 82.6% replenishment)
- SSA pharmacies are health-first — can't fully cover beauty need
- Partner selection problem not market problem — need 50% replenishment threshold
- KE Oct-25 spike (+57% MoM) unexplained — investigate and replicate
- CI sleeping giant: highest AOV (€29.86) but almost no orders (4,670 total)
- NG monetization broken: 8.68% of orders but only 4.15% of GMV