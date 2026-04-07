import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

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

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:  process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets   = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'MFCs_L3!A:G',
    });

    const values = response.data.values || [];
    if (values.length < 2) {
      return res.status(200).json({ byL2Month: [], byL3Month: [], byCountryL2Month: [] });
    }

    const headers = values[0];
    const col = {
      country: headers.indexOf('products_sold_v2_country_code'),
      year:    headers.indexOf('products_sold_v2_order_activation_local_year'),
      l2:      headers.indexOf('products_sold_v2_product_category_level_two'),
      l3:      headers.indexOf('products_sold_v2_product_category_level_three'),
      month:   headers.indexOf('products_sold_v2_order_activation_local_month'),
      gmv:     headers.indexOf('products_sold_v2_total_product_revenue_eur'),
      orders:  headers.indexOf('products_sold_v2_total_orders_no_remake_or_split'),
    };

    const currentPeriod = getCurrentPeriod();
    const rows = [];

    for (let i = 1; i < values.length; i++) {
      const row     = values[i];
      const country = col.country >= 0 ? String(row[col.country] || '').trim() : '';
      const l2      = col.l2      >= 0 ? String(row[col.l2]      || '').trim() : '';
      const l3      = col.l3      >= 0 ? String(row[col.l3]      || '').trim() : '';
      const rawMonth = col.month  >= 0 ? row[col.month] : '';
      const rawYear  = col.year   >= 0 ? row[col.year]  : '';
      const { year, month } = parsePeriod(rawMonth, rawYear);
      const gmv    = col.gmv    >= 0 ? parseFloat(row[col.gmv])  || 0 : 0;
      const orders = col.orders >= 0 ? parseInt(row[col.orders]) || 0 : 0;

      if (!country || !l2 || !month || !year) continue;
      const period = `${year}-${String(month).padStart(2, '0')}`;
      if (period === currentPeriod) continue;

      rows.push({ country, l2, l3, period, gmv, orders });
    }

    // ── byL2Month: aggregate by l2 + period ───────────────────
    const l2MonthMap = {};
    rows.forEach(r => {
      const key = `${r.l2}__${r.period}`;
      if (!l2MonthMap[key]) l2MonthMap[key] = { l2: r.l2, period: r.period, gmv: 0, orders: 0 };
      l2MonthMap[key].gmv    += r.gmv;
      l2MonthMap[key].orders += r.orders;
    });
    const byL2Month = Object.values(l2MonthMap).map(r => ({
      l2: r.l2, period: r.period,
      gmv: r2(r.gmv), orders: r.orders,
      aov: r.orders > 0 ? r2(r.gmv / r.orders) : 0,
    })).sort((a, b) => a.period.localeCompare(b.period));

    // ── byL3Month: aggregate by l2 + l3 + period ──────────────
    const l3MonthMap = {};
    rows.forEach(r => {
      const key = `${r.l2}__${r.l3}__${r.period}`;
      if (!l3MonthMap[key]) l3MonthMap[key] = { l2: r.l2, l3: r.l3 || '(none)', period: r.period, gmv: 0, orders: 0 };
      l3MonthMap[key].gmv    += r.gmv;
      l3MonthMap[key].orders += r.orders;
    });
    const byL3Month = Object.values(l3MonthMap).map(r => ({
      l2: r.l2, l3: r.l3, period: r.period,
      gmv: r2(r.gmv), orders: r.orders,
      aov: r.orders > 0 ? r2(r.gmv / r.orders) : 0,
    })).sort((a, b) => a.period.localeCompare(b.period));

    // ── byCountryL2Month: aggregate by country + l2 + period ──
    const cL2MonthMap = {};
    rows.forEach(r => {
      const key = `${r.country}__${r.l2}__${r.period}`;
      if (!cL2MonthMap[key]) cL2MonthMap[key] = { country: r.country, l2: r.l2, period: r.period, gmv: 0, orders: 0 };
      cL2MonthMap[key].gmv    += r.gmv;
      cL2MonthMap[key].orders += r.orders;
    });
    const byCountryL2Month = Object.values(cL2MonthMap).map(r => ({
      country: r.country, l2: r.l2, period: r.period,
      gmv: r2(r.gmv), orders: r.orders,
      aov: r.orders > 0 ? r2(r.gmv / r.orders) : 0,
    })).sort((a, b) => a.period.localeCompare(b.period));

    const periods = [...new Set(rows.map(r => r.period))].sort();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json({
      meta: { periodStart: periods[0], periodEnd: periods[periods.length - 1], currentPeriod, totalRows: rows.length },
      byL2Month,
      byL3Month,
      byCountryL2Month,
    });

  } catch (err) {
    console.error('MFC API error:', err);
    res.status(500).json({ error: err.message });
  }
}
