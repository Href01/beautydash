import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const TAB_NAME = 'Reta-CTRY';

const COLUMNS = {
  country: 'cities_country_code',
  month:   'bought_products_order_started_local_month',
  year:    'bought_products_order_started_local_year',
  gmv:     'bought_products_products_value_delivered_eur',
  orders:  'bought_products_number_of_distinct_delivered_orders',
};

function r2(v) { return Math.round(v * 100) / 100; }

function parseMonth(raw) {
  var s = String(raw).trim();
  if (s.indexOf('-') !== -1) return parseInt(s.split('-')[1]);
  return parseInt(s);
}

function readRows(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  const colIdx  = {};
  Object.keys(COLUMNS).forEach(key => {
    colIdx[key] = headers.indexOf(COLUMNS[key]);
  });
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row     = values[i];
    const country = colIdx.country >= 0 ? String(row[colIdx.country]).trim() : '';
    const month   = colIdx.month   >= 0 ? parseMonth(row[colIdx.month])      : 0;
    const year    = colIdx.year    >= 0 ? parseInt(row[colIdx.year])          : 0;
    const gmv     = colIdx.gmv     >= 0 ? parseFloat(row[colIdx.gmv])         : 0;
    const orders  = colIdx.orders  >= 0 ? parseInt(row[colIdx.orders])        : 0;
    if (!country || !month || !year || isNaN(gmv) || isNaN(orders)) continue;
    rows.push({
      country,
      month,
      year,
      period:   `${year}-${month < 10 ? '0' + month : month}`,
      gmv,
      orders,
      vertical: 'Retail',
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
      momGMV:    prev && prev.gmv > 0    ? r2((m.gmv - prev.gmv) / prev.gmv * 100)             : null,
      momOrders: prev && prev.orders > 0 ? r2((m.orders - prev.orders) / prev.orders * 100)    : null,
    };
  });
}

function buildGrowth(rows) {
  const byCP = {}, periods = [], periodSet = {}, countries = [], countrySet = {};
  rows.forEach(r => {
    const key = `${r.country}_${r.period}`;
    if (!byCP[key]) byCP[key] = { country: r.country, period: r.period, gmv: 0, orders: 0 };
    byCP[key].gmv    += r.gmv;
    byCP[key].orders += r.orders;
    if (!periodSet[r.period])   { periodSet[r.period]   = true; periods.push(r.period); }
    if (!countrySet[r.country]) { countrySet[r.country] = true; countries.push(r.country); }
  });
  periods.sort();
  const first = periods[0];
  const last  = periods[periods.length - 1];
  const comparison = countries.map(c => {
    const f = byCP[`${c}_${first}`] || { gmv: 0, orders: 0 };
    const l = byCP[`${c}_${last}`]  || { gmv: 0, orders: 0 };
    return {
      country:     c,
      firstPeriod: first,
      lastPeriod:  last,
      firstGMV:    r2(f.gmv),
      lastGMV:     r2(l.gmv),
      gmvGrowth:   f.gmv > 0 ? r2((l.gmv - f.gmv) / f.gmv * 100) : null,
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
  return { periodComparison: comparison, countryMoM };
}

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets   = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range:         `${TAB_NAME}!A:E`,
    });

    const rows = readRows(response.data.values);

    if (rows.length === 0) {
      return res.status(200).json({ error: 'No data found in sheet' });
    }

    const periods = [...new Set(rows.map(r => r.period))].sort();

    const result = {
      meta: {
        lastUpdated:  new Date().toISOString(),
        totalRows:    rows.length,
        periodStart:  periods[0],
        periodEnd:    periods[periods.length - 1],
        verticals:    ['Retail'],
      },
      summary:        buildSummary(rows),
      byCountry:      buildByCountry(rows),
      byCountryMonth: buildByCountryMonth(rows),
      monthlyTotal:   buildMonthlyTotal(rows),
      growth:         buildGrowth(rows),
      byVertical:     [],
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(result);

  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
}