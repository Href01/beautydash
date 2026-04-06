import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// Per-source column mappings
// spreadsheetId is optional — defaults to SPREADSHEET_ID env var
const SOURCES = [
  {
    tab:      'Reta-CTRY',
    vertical: 'Retail',
    columns: {
      country: 'cities_country_code',
      month:   'bought_products_order_started_local_month',
      year:    'bought_products_order_started_local_year',
      gmv:     'bought_products_products_value_delivered_eur',
      orders:  'bought_products_number_of_distinct_delivered_orders',
    }
  },
  {
    tab:      'MFC-CTRY',
    vertical: 'MFC',
    columns: {
      country: 'products_sold_v2_country_code',
      month:   'products_sold_v2_order_activation_local_month',
      year:    'products_sold_v2_order_activation_local_year',
      gmv:     'products_sold_v2_total_product_revenue_eur',
      orders:  'products_sold_v2_total_orders_no_remake_or_split',
    }
  },
  {
    spreadsheetId: '19NJjIiVy777q6CmT8sDbzYCMYWZ3XyIrGWvHfgIMX6o',
    tab:      'Groceries-CTRY',
    vertical: 'Groceries',
    columns: {
      country: 'cities_country_code',
      month:   'bought_products_order_started_local_month',
      year:    'bought_products_order_started_local_year',
      gmv:     'bought_products_products_value_delivered_eur',
      orders:  'bought_products_number_of_distinct_delivered_orders',
    }
  },
];

function r2(v) { return Math.round(v * 100) / 100; }

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonth(raw) {
  const s = String(raw).trim();
  if (s.indexOf('-') !== -1) return parseInt(s.split('-')[1]);
  return parseInt(s);
}

function parseYear(rawMonth, rawYear) {
  const s = String(rawMonth).trim();
  if (s.indexOf('-') !== -1) return parseInt(s.split('-')[0]);
  return parseInt(rawYear);
}

function readRows(values, vertical, columns) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  const colIdx  = {};
  Object.keys(columns).forEach(key => {
    colIdx[key] = headers.indexOf(columns[key]);
  });
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row     = values[i];
    const country = colIdx.country >= 0 ? String(row[colIdx.country]).trim() : '';
    const rawMonth = colIdx.month  >= 0 ? row[colIdx.month] : '';
    const month    = parseMonth(rawMonth);
    const year     = parseYear(rawMonth, colIdx.year >= 0 ? row[colIdx.year] : 0);
    const gmv      = colIdx.gmv    >= 0 ? parseFloat(row[colIdx.gmv])  : 0;
    const orders   = colIdx.orders >= 0 ? parseInt(row[colIdx.orders]) : 0;
    if (!country || !month || !year || isNaN(gmv) || isNaN(orders)) continue;
    rows.push({
      country,
      month,
      year,
      period:   `${year}-${month < 10 ? '0' + month : month}`,
      gmv,
      orders,
      vertical,
    });
  }
  return rows;
}

function buildSummary(rows) {
  let totalGMV = 0, totalOrders = 0;
  const countries = {}, verticals = {};
  rows.forEach(r => {
    totalGMV    += r.gmv;
    totalOrders += r.orders;
    countries[r.country]  = true;
    verticals[r.vertical] = true;
  });
  return {
    totalGMV:    r2(totalGMV),
    totalOrders,
    aov:         totalOrders > 0 ? r2(totalGMV / totalOrders) : 0,
    countries:   Object.keys(countries).length,
    verticals:   Object.keys(verticals),
  };
}

function buildByCountry(rows) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.country]) map[r.country] = { country: r.country, gmv: 0, orders: 0 };
    map[r.country].gmv    += r.gmv;
    map[r.country].orders += r.orders;
  });
  return Object.values(map).map(c => ({
    country: c.country,
    gmv:     r2(c.gmv),
    orders:  c.orders,
    aov:     c.orders > 0 ? r2(c.gmv / c.orders) : 0,
  })).sort((a, b) => b.gmv - a.gmv);
}

function buildByCountryMonth(rows) {
  const map = {};
  rows.forEach(r => {
    const key = `${r.period}_${r.country}`;
    if (!map[key]) map[key] = { period: r.period, country: r.country, gmv: 0, orders: 0 };
    map[key].gmv    += r.gmv;
    map[key].orders += r.orders;
  });
  return Object.values(map).map(r => ({
    period:  r.period,
    country: r.country,
    gmv:     r2(r.gmv),
    orders:  r.orders,
    aov:     r.orders > 0 ? r2(r.gmv / r.orders) : 0,
  })).sort((a, b) => a.period.localeCompare(b.period));
}

function buildByVertical(rows) {
  const map = {};
  rows.forEach(r => {
    const key = `${r.period}_${r.vertical}`;
    if (!map[key]) map[key] = { period: r.period, vertical: r.vertical, gmv: 0, orders: 0 };
    map[key].gmv    += r.gmv;
    map[key].orders += r.orders;
  });
  return Object.values(map).map(r => ({
    period:   r.period,
    vertical: r.vertical,
    gmv:      r2(r.gmv),
    orders:   r.orders,
    aov:      r.orders > 0 ? r2(r.gmv / r.orders) : 0,
  })).sort((a, b) => a.period.localeCompare(b.period));
}

function buildByVerticalCountryMonth(rows) {
  const map = {};
  rows.forEach(r => {
    const key = `${r.period}_${r.country}_${r.vertical}`;
    if (!map[key]) map[key] = { period: r.period, country: r.country, vertical: r.vertical, gmv: 0, orders: 0 };
    map[key].gmv    += r.gmv;
    map[key].orders += r.orders;
  });
  return Object.values(map).map(r => ({
    period:   r.period,
    country:  r.country,
    vertical: r.vertical,
    gmv:      r2(r.gmv),
    orders:   r.orders,
    aov:      r.orders > 0 ? r2(r.gmv / r.orders) : 0,
  })).sort((a, b) => a.period.localeCompare(b.period));
}

function buildMonthlyTotal(rows) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.period]) map[r.period] = { period: r.period, gmv: 0, orders: 0 };
    map[r.period].gmv    += r.gmv;
    map[r.period].orders += r.orders;
  });
  const sorted = Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
  return sorted.map((m, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    return {
      period:    m.period,
      gmv:       r2(m.gmv),
      orders:    m.orders,
      aov:       m.orders > 0 ? r2(m.gmv / m.orders) : 0,
      momGMV:    prev && prev.gmv > 0    ? r2((m.gmv - prev.gmv) / prev.gmv * 100)          : null,
      momOrders: prev && prev.orders > 0 ? r2((m.orders - prev.orders) / prev.orders * 100) : null,
    };
  });
}

function buildGrowth(rows) {
  const byCP = {}, periods = [], pSet = {}, countries = [], cSet = {};
  rows.forEach(r => {
    const key = `${r.country}_${r.period}`;
    if (!byCP[key]) byCP[key] = { country: r.country, period: r.period, gmv: 0, orders: 0 };
    byCP[key].gmv    += r.gmv;
    byCP[key].orders += r.orders;
    if (!pSet[r.period])   { pSet[r.period]   = true; periods.push(r.period); }
    if (!cSet[r.country])  { cSet[r.country]  = true; countries.push(r.country); }
  });
  periods.sort();
  const first = periods[0];
  const last  = periods[periods.length - 1];

  const comparison = countries.map(c => {
    const f = byCP[`${c}_${first}`] || { gmv: 0, orders: 0 };
    const l = byCP[`${c}_${last}`]  || { gmv: 0, orders: 0 };
    return {
      country: c, firstPeriod: first, lastPeriod: last,
      firstGMV: r2(f.gmv), lastGMV: r2(l.gmv),
      gmvGrowth: f.gmv > 0 ? r2((l.gmv - f.gmv) / f.gmv * 100) : null,
    };
  });

  const countryMoM = {};
  countries.forEach(c => {
    const cp = periods.map(p => byCP[`${c}_${p}`] || { country: c, period: p, gmv: 0, orders: 0 });
    countryMoM[c] = cp.map((m, i) => {
      const prev = i > 0 ? cp[i - 1] : null;
      return {
        period:  m.period,
        gmv:     r2(m.gmv),
        momGMV:  prev && prev.gmv > 0 ? r2((m.gmv - prev.gmv) / prev.gmv * 100) : null,
      };
    });
  });

  const yoy = {};
  countries.forEach(c => {
    yoy[c] = periods.map(p => {
      const [y, m]     = p.split('-').map(Number);
      const prevYearP  = `${y - 1}-${String(m).padStart(2, '0')}`;
      const cur        = byCP[`${c}_${p}`]         || { gmv: 0 };
      const prev       = byCP[`${c}_${prevYearP}`] || { gmv: 0 };
      return {
        period:      p,
        gmv:         r2(cur.gmv),
        prevYearGMV: r2(prev.gmv),
        yoyGMV:      prev.gmv > 0 ? r2((cur.gmv - prev.gmv) / prev.gmv * 100) : null,
      };
    });
  });

  return { periodComparison: comparison, countryMoM, yoy };
}

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:  process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Group sources by spreadsheet ID, then fetch each spreadsheet in parallel
    const bySheet = {};
    SOURCES.forEach((s, i) => {
      const id = s.spreadsheetId || SPREADSHEET_ID;
      if (!bySheet[id]) bySheet[id] = [];
      bySheet[id].push({ ...s, _idx: i });
    });

    const sheetEntries = Object.entries(bySheet);
    const responses = await Promise.all(
      sheetEntries.map(([id, sources]) =>
        sheets.spreadsheets.values.batchGet({
          spreadsheetId: id,
          ranges: sources.map(s => `${s.tab}!A:E`),
        }).then(res => ({ sources, valueRanges: res.data.valueRanges || [] }))
      )
    );

    // Parse all rows from all sources
    let allRows = [];
    responses.forEach(({ sources, valueRanges }) => {
      valueRanges.forEach((valueRange, i) => {
        const source = sources[i];
        const rows   = readRows(valueRange.values, source.vertical, source.columns);
        allRows      = allRows.concat(rows);
      });
    });

    if (allRows.length === 0) {
      return res.status(200).json({ error: 'No data found in any sheet' });
    }

    // Exclude current partial month
    const currentPeriod = getCurrentPeriod();
    const rows          = allRows.filter(r => r.period !== currentPeriod);
    const periods       = [...new Set(rows.map(r => r.period))].sort();

    const result = {
      meta: {
        lastUpdated:    new Date().toISOString(),
        totalRows:      rows.length,
        periodStart:    periods[0],
        periodEnd:      periods[periods.length - 1],
        currentPeriod,
        verticals:      SOURCES.map(s => s.vertical),
      },
      summary:                buildSummary(rows),
      byCountry:              buildByCountry(rows),
      byCountryMonth:         buildByCountryMonth(rows),
      byVertical:             buildByVertical(rows),
      byVerticalCountryMonth: buildByVerticalCountryMonth(rows),
      monthlyTotal:           buildMonthlyTotal(rows),
      growth:                 buildGrowth(rows),
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(result);

  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
}