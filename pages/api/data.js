import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

const SOURCES = [
  {
    tab:      'Reta-CTRY',
    vertical: 'Retail',
    range:    'A:E',
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
    range:    'A:E',
    columns: {
      country: 'products_sold_v2_country_code',
      month:   'products_sold_v2_order_activation_local_month',
      year:    'products_sold_v2_order_activation_local_year',
      gmv:     'products_sold_v2_total_product_revenue_eur',
      orders:  'products_sold_v2_total_orders_no_remake_or_split',
    }
  },
  {
    tab:      'Groceries-CTRY',
    vertical: 'Groceries',
    range:    'A:E',
    columns: {
      country: 'cities_country_code',
      month:   'bought_products_order_started_local_month',
      year:    'bought_products_order_started_local_year',
      gmv:     'bought_products_products_value_delivered_eur',
      orders:  'bought_products_number_of_distinct_delivered_orders',
    }
  },
  {
    tab:      'PartnerLvL',
    vertical: 'Partners',
    range:    'A:F',
    columns: {
      country: 'cities_country_code',
      month:   'bought_products_order_started_local_month',
      year:    'bought_products_order_started_local_year',
      partner: 'bought_products_store_name',
      gmv:     'bought_products_products_value_delivered_eur',
      orders:  'bought_products_number_of_distinct_delivered_orders',
    }
  },
  {
    tab:      'Part_CVR',
    vertical: 'PartnerCVR',
    range:    'A:G',
    columns: {
      country:        'qc_session_store_origin_country_code',
      month:          'qc_session_store_origin_p_creation_month',
      year:           'qc_session_store_origin_p_creation_year',
      partner:        'qc_session_store_origin_store_name',
      cvr:            'qc_session_store_origin_conversion_rate',
      sessions:       'qc_session_store_origin_number_of_sessions',
      orders_created: 'qc_session_store_origin_number_of_orders_created',
    }
  },
];

// ── Helpers ───────────────────────────────────────────────────
function r2(v) { return Math.round(v * 100) / 100; }

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parsePeriod(rawMonth, rawYear) {
  const s = String(rawMonth).trim();
  if (s.includes('-')) {
    const [y, m] = s.split('-');
    return { year: parseInt(y), month: parseInt(m) };
  }
  return { year: parseInt(rawYear), month: parseInt(s) };
}

function readRows(values, vertical, columns) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  const col = {};
  Object.keys(columns).forEach(k => { col[k] = headers.indexOf(columns[k]); });

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row     = values[i];
    const country = col.country >= 0 ? String(row[col.country] || '').trim() : '';
    const rawMonth = col.month  >= 0 ? row[col.month] : '';
    const rawYear  = col.year   >= 0 ? row[col.year]  : '';
    const { year, month } = parsePeriod(rawMonth, rawYear);
    const gmv     = col.gmv    >= 0 ? parseFloat(row[col.gmv])   || 0 : 0;
    const orders  = col.orders >= 0 ? parseInt(row[col.orders])  || 0 : 0;
    const partner        = col.partner        >= 0 ? String(row[col.partner]        || '').trim() : null;
    const cvr            = col.cvr            >= 0 ? parseFloat(row[col.cvr])        || 0 : null;
    const sessions       = col.sessions       >= 0 ? parseInt(row[col.sessions])     || 0 : null;
    const orders_created = col.orders_created >= 0 ? parseInt(row[col.orders_created])|| 0 : null;

    if (!country || !month || !year) continue;
    const period = `${year}-${String(month).padStart(2, '0')}`;

    const entry = { country, month, year, period, gmv, orders, vertical };
    if (partner        !== null) entry.partner        = partner;
    if (cvr            !== null) entry.cvr            = cvr;
    if (sessions       !== null) entry.sessions       = sessions;
    if (orders_created !== null) entry.orders_created = orders_created;
    rows.push(entry);
  }
  return rows;
}

// ── Aggregations ──────────────────────────────────────────────
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
    if (!pSet[r.period])  { pSet[r.period]  = true; periods.push(r.period); }
    if (!cSet[r.country]) { cSet[r.country] = true; countries.push(r.country); }
  });
  periods.sort();
  const first = periods[0];
  const last  = periods[periods.length - 1];

  const periodComparison = countries.map(c => {
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
        period: m.period,
        gmv:    r2(m.gmv),
        orders: m.orders,
        momGMV: prev && prev.gmv > 0 ? r2((m.gmv - prev.gmv) / prev.gmv * 100) : null,
      };
    });
  });

  const yoy = {};
  countries.forEach(c => {
    yoy[c] = periods.map(p => {
      const [y, m]    = p.split('-').map(Number);
      const prevP     = `${y - 1}-${String(m).padStart(2, '0')}`;
      const cur       = byCP[`${c}_${p}`]    || { gmv: 0 };
      const prev      = byCP[`${c}_${prevP}`] || { gmv: 0 };
      return {
        period:      p,
        gmv:         r2(cur.gmv),
        prevYearGMV: r2(prev.gmv),
        yoyGMV:      prev.gmv > 0 ? r2((cur.gmv - prev.gmv) / prev.gmv * 100) : null,
      };
    });
  });

  return { periodComparison, countryMoM, yoy };
}

function buildPartners(rows) {
  if (!rows.length) return { byPartnerMonth: [], totals: [] };

  const monthlyMap = {};
  rows.forEach(r => {
    if (!r.partner) return;
    const key = `${r.partner}__${r.country}__${r.period}`;
    if (!monthlyMap[key]) monthlyMap[key] = { partner: r.partner, country: r.country, period: r.period, gmv: 0, orders: 0 };
    monthlyMap[key].gmv    += r.gmv;
    monthlyMap[key].orders += r.orders;
  });

  const byPartnerMonth = Object.values(monthlyMap).map(r => ({
    partner: r.partner,
    country: r.country,
    period:  r.period,
    gmv:     r2(r.gmv),
    orders:  r.orders,
    aov:     r.orders > 0 ? r2(r.gmv / r.orders) : 0,
  })).sort((a, b) => a.period.localeCompare(b.period));

  const totalsMap = {};
  byPartnerMonth.forEach(r => {
    const key = `${r.partner}__${r.country}`;
    if (!totalsMap[key]) totalsMap[key] = { partner: r.partner, country: r.country, gmv: 0, orders: 0, months: 0 };
    totalsMap[key].gmv    += r.gmv;
    totalsMap[key].orders += r.orders;
    totalsMap[key].months++;
  });

  const totals = Object.values(totalsMap).map(p => ({
    partner:       p.partner,
    country:       p.country,
    gmv:           r2(p.gmv),
    orders:        p.orders,
    aov:           p.orders > 0 ? r2(p.gmv / p.orders) : 0,
    avgMonthlyGMV: p.months > 0 ? r2(p.gmv / p.months) : 0,
  })).sort((a, b) => b.gmv - a.gmv);

  return { byPartnerMonth, totals };
}

function buildPartnerCVR(rows) {
  if (!rows.length) return [];

  // Aggregate sessions + orders_created per partner+country+period
  // CVR = orders_created / sessions (blended, not average of CVRs)
  const map = {};
  rows.forEach(r => {
    if (!r.partner) return;
    const key = `${r.partner}__${r.country}__${r.period}`;
    if (!map[key]) map[key] = { partner: r.partner, country: r.country, period: r.period, sessions: 0, orders_created: 0 };
    map[key].sessions       += r.sessions       || 0;
    map[key].orders_created += r.orders_created || 0;
  });

  return Object.values(map).map(r => ({
    partner:        r.partner,
    country:        r.country,
    period:         r.period,
    sessions:       r.sessions,
    orders_created: r.orders_created,
    cvr:            r.sessions > 0 ? r2(r.orders_created / r.sessions * 100) : 0,
  })).sort((a, b) => a.period.localeCompare(b.period));
}

// ── Handler ───────────────────────────────────────────────────
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

    // Fetch all tabs in one batchGet
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: SOURCES.map(s => `${s.tab}!${s.range}`),
    });

    const currentPeriod = getCurrentPeriod();
    let allRows = [], partnerRows = [], cvrRows = [];

    (response.data.valueRanges || []).forEach((vr, i) => {
      const source = SOURCES[i];
      const rows   = readRows(vr.values, source.vertical, source.columns)
        .filter(r => r.period !== currentPeriod);

      if (source.vertical === 'Partners')    partnerRows = partnerRows.concat(rows);
      else if (source.vertical === 'PartnerCVR') cvrRows = cvrRows.concat(rows);
      else                                   allRows     = allRows.concat(rows);
    });

    if (allRows.length === 0) {
      return res.status(200).json({ error: 'No data found in any sheet' });
    }

    const periods = [...new Set(allRows.map(r => r.period))].sort();

    const result = {
      meta: {
        lastUpdated:   new Date().toISOString(),
        totalRows:     allRows.length,
        partnerRows:   partnerRows.length,
        periodStart:   periods[0],
        periodEnd:     periods[periods.length - 1],
        currentPeriod,
        verticals:     ['Retail', 'MFC', 'Groceries'],
      },
      summary:                buildSummary(allRows),
      byCountry:              buildByCountry(allRows),
      byCountryMonth:         buildByCountryMonth(allRows),
      byVertical:             buildByVertical(allRows),
      byVerticalCountryMonth: buildByVerticalCountryMonth(allRows),
      monthlyTotal:           buildMonthlyTotal(allRows),
      growth:                 buildGrowth(allRows),
      partners: {
        ...buildPartners(partnerRows),
        cvrByPartnerMonth: buildPartnerCVR(cvrRows),
      },
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(result);

  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
}
