## ARCHITECTURE

**Backend:** Google Apps Script web app — reads all Sheets tabs, aggregates, returns JSON.
**Frontend:** Next.js — `/api/data.js` is a thin proxy to `APPS_SCRIPT_URL`. No direct Sheets API calls.
**Deploy:** Vercel — auto-deploys on every push to `master`.

```
Browser → /api/data.js (proxy) → APPS_SCRIPT_URL → Google Sheets
```

---

## DATA SOURCES — GOOGLE SHEETS

All tabs live in spreadsheet `19NJjIiVy777q6CmT8sDbzYCMYWZ3XyIrGWvHfgIMX6o`.
The Apps Script (`CONFIG.sources`) defines which tabs to read and the column mapping per tab.

### ACTIVE TABS

**Reta-CTRY** → Retail beauty stores
- `cities_country_code`, `bought_products_order_started_local_month`, `bought_products_order_started_local_year`
- `bought_products_products_value_delivered_eur`, `bought_products_number_of_distinct_delivered_orders`

**MFC-CTRY** → Glovo dark stores
- `products_sold_v2_country_code`, `products_sold_v2_order_activation_local_month`, `products_sold_v2_order_activation_local_year`
- `products_sold_v2_total_product_revenue_eur`, `products_sold_v2_total_orders_no_remake_or_split`

**Groceries-CTRY** → Supermarkets/grocery vertical
- Same column names as Reta-CTRY

**PartnerLvL** → Partner-level Retail data
- Same as Reta-CTRY + `bought_products_store_name` (partner name)

### FUTURE TABS
- `Search-CTRY` → In-store / out-of-store search data
- `OPS-CTRY` → Operational metrics (prep time, uptime, cancellation rate)

### HOW TO ADD A NEW TAB
Add one entry to `CONFIG.sources` in the Apps Script. No changes needed in Next.js — everything updates automatically once the Apps Script is redeployed and cache is cleared.

---

## API RESPONSE STRUCTURE

`/api/data` proxies the Apps Script. The Apps Script returns:

```javascript
{
  meta: {
    lastUpdated,    // ISO timestamp
    totalRows,      // rows after partial month exclusion
    partnerRows,    // partner rows after exclusion
    periodStart,    // e.g. "2024-01"
    periodEnd,      // e.g. "2026-03"
    currentPeriod,  // excluded partial month e.g. "2026-04"
    verticals,      // ['Retail', 'MFC', 'Groceries']
  },
  summary: { totalGMV, totalOrders, aov, countries, verticals },

  // Pre-aggregated across ALL verticals — NO vertical field
  byCountry:      [{ country, gmv, orders, aov }],
  byCountryMonth: [{ period, country, gmv, orders, aov }],
  monthlyTotal:   [{ period, gmv, orders, aov, momGMV, momOrders }],

  // Has vertical field — use when vertical filter is active
  byVertical:             [{ period, vertical, gmv, orders, aov }],
  byVerticalCountryMonth: [{ period, country, vertical, gmv, orders, aov }],

  growth: {
    periodComparison: [{ country, firstPeriod, lastPeriod, firstGMV, lastGMV, gmvGrowth }],
    countryMoM:       { MA: [{ period, gmv, orders, momGMV }], ... },
    yoy:              { MA: [{ period, gmv, prevYearGMV, yoyGMV }], ... },
  },

  partners: {
    byPartnerMonth: [{ partner, country, period, gmv, orders, aov }],
    totals:         [{ partner, country, gmv, orders, aov, avgMonthlyGMV }],
  }
}
```

---

## STATE & FILTERS (all in `pages/index.js`)

```javascript
selected        // array of country codes ['MA', 'KE', ...]
periodFilter    // 'all' | '2024' | '2025' | '2026' | 'l3m' | 'l6m'
verticalFilter  // 'all' | 'Retail' | 'MFC' | 'Groceries'
```

---

## CRITICAL LOGIC — READ BEFORE TOUCHING INDEX.JS

**1. Partial month exclusion**
Current month excluded at Apps Script level. Never show partial month data.

**2. Vertical filter data source**
```
verticalFilter === 'all'          → getCountryMonthSource() returns byCountryMonth
verticalFilter === 'Retail|MFC|Groceries' → returns byVerticalCountryMonth filtered by vertical
```
`byCountryMonth` has NO vertical field — never filter it by vertical.

**3. filteredByCountry must always be recalculated**
Never use raw `byCountry` from API for display. Always recalculate from `getCountryMonthSource()` filtered by period + vertical. This ensures % GMV always sums to 100%.

**4. % GMV denominator**
Always use `filteredGMV` (sum of filteredByCountry) as denominator. Never use `summary.totalGMV`.

**5. Growth column (CountryTable)**
Compares full-year 2024 vs full-year 2025 GMV, computed from `allByCountryMonth` (unfiltered by period). Uses `getYoY()`.

**6. VerticalComparisonChart**
Always shows all verticals regardless of `verticalFilter`. Derives everything from `byVerticalCountryMonth` (country + period filtered) — no `byVertical` prop needed. Adding a new vertical to the Apps Script automatically adds it to this chart.

**7. Vertical strip KPIs (Retail/MFC/Groceries)**
Computed from `filteredVCM` which respects both period AND country filters.

**8. EvolutionChart**
Computes MoM live from `filteredByCountryMonth` — respects both country and vertical filters automatically. Toggle: GMV % / Orders % / AOV.

---

## MARKETS
| Code | Name | Status | Key Insight |
|------|------|--------|-------------|
| MA | Morocco | Mature, flat | ~62% of GMV, concentration risk |
| KE | Kenya | Growing | Strong growth, Oct-25 spike unexplained |
| NG | Nigeria | Risk | High orders, lowest AOV (€4.32), monetization broken |
| UG | Uganda | Nascent | No MFC, no partner shortlist yet |
| CI | Ivory Coast | Sleeping giant | Highest retail AOV (€29.86), almost no orders |
| TN | Tunisia | Volatile | +99bps YoY but unstable, no MFC |

## POC CONTACTS
- MA / TN → Najoua Makboul
- KE / UG → Rosemary Kamunge
- CI / NG → Pierre-Emmanuel Soumahoro

---

## COLORS
```javascript
// Countries
MA: '#FFC244', KE: '#00A082', TN: '#3B82F6'
CI: '#8B5CF6', UG: '#EC4899', NG: '#F97316'

// Verticals
Retail: '#FFC244', MFC: '#00A082', Groceries: '#3B82F6'
```

---

## WHAT'S BUILT

### Layer 1 — Market Health ✅
- KPI cards: GMV, Orders, AOV, Active Markets — all respond to filters
- Vertical summary strip: Retail / MFC / Groceries GMV + % share
- GMV trend line chart by country
- Total monthly GMV bar chart
- Country share horizontal bar chart
- MoM evolution chart with toggle: GMV % / Orders % / AOV (EvolutionChart)
- Vertical Comparison chart: KPI header + line trend + country stacked bars (all verticals, auto-discovers new ones)
- Country breakdown table: GMV, %, Orders, AOV, YoY growth (2024 vs 2025), Status, Smart Insight
- Partner table: rank, partner, country, GMV, % share, orders, AOV, last MoM
- Auto-generated insights panel with urgency flags
- Period filter: All / 2024 / 2025 / 2026 / L3M / L6M
- Country toggle filter
- Vertical filter: All / Retail / MFC / Groceries
- Dark/light mode, Refresh button
- Smart insights per country (computed from actual metrics — growth, AOV rank, GMV share, recent momentum)

---

## WHAT TO BUILD NEXT

### Layer 2 — Partner Deep Dive
Currently showing basic partner table (GMV, orders, AOV, last MoM).
Still missing: CVR, sessions, replenishment %, HC rate.
**Data needed:** extend PartnerLvL tab with these columns, or add a new tab.
**Charts to add:**
- Replenishment % vs CVR scatter (key insight from strategy deck)
- Partners below 50% replenishment threshold flagged in red
- Partner trend sparklines

### Layer 3 — Demand Signals
**Data needed:** Search tab (`Search-CTRY`)
**Charts to build:**
- Top searched terms with zero results → assortment gap
- Search volume trend per country
- Search-to-order CVR

**Expected columns:** `country, period, search_term, search_count, result_count, orders_generated`

### Layer 4 — OPS Metrics
**Data needed:** OPS tab (`OPS-CTRY`)
**Metrics:** prep time, delivery time, uptime %, cancellation rate per country
**Charts:** OPS scorecard, correlation with CVR

### Layer 5 — Market Recommendations
No new data needed. Auto-generate action items per POC by combining all layers.

---

## KNOWN BUGS FIXED — DO NOT REINTRODUCE
| Bug | Root cause | Fix |
|-----|-----------|-----|
| Growth showing -100% | Partial month used as last period | Exclude current month in Apps Script |
| % GMV over 100% | Mixed all-time byCountry with filtered totalGMV | Recalculate byCountry from filtered source |
| MoM chart missing first month | Always slicing first period | Filter points where all countries are null |
| Blank charts on vertical filter | byCountryMonth has no vertical field | Switch to byVerticalCountryMonth |
| VerticalComparisonChart crash | selectedCountries prop missing | Always pass selectedCountries |
| Vertical strip ignoring country filter | retailGMV/mfcGMV computed without country filter | Use filteredVCM (period + country filtered) |
| EvolutionChart ignoring vertical filter | Used pre-computed growth.countryMoM | Compute MoM live from filteredByCountryMonth |

---

## STYLING RULES
- Tailwind only — no inline styles except dynamic colors from `COUNTRY_META`
- Dark mode: always include `dark:` variant for bg and text
- Cards: `bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6`
- Labels: `text-xs font-bold uppercase tracking-wider text-gray-400`
- Values: `text-3xl font-black text-gray-900 dark:text-white`
- Accent colors: yellow-400 (primary), green-500 (positive), red-400 (negative/alert)
- Never use purple gradients or Inter font

---

## ENV VARIABLES
```
APPS_SCRIPT_URL   # deployed Apps Script web app URL (exec endpoint)
```
The Google service account vars (`GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) are no longer used — auth is handled inside the Apps Script.

## DEPLOY WORKFLOW
```bash
git add .
git commit -m "description"
git push origin master
# Vercel auto-deploys on push to master
# After Apps Script changes: run clearCache() in Apps Script editor
```

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
