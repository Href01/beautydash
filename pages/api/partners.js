import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

function r2(v) { return Math.round(v * 100) / 100; }

function parseMonth(raw) {
  const s = String(raw).trim();
  return s.includes('-') ? parseInt(s.split('-')[1]) : parseInt(s);
}

function parseYear(rawMonth, rawYear) {
  const s = String(rawMonth).trim();
  return s.includes('-') ? parseInt(s.split('-')[0]) : parseInt(rawYear);
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
      range: 'PartnerLvL!A:F',
    });

    const values = response.data.values || [];
    if (values.length < 2) return res.status(200).json({ byPartner: [], byPartnerMonth: [] });

    const headers = values[0];
    const col = {
      country: headers.indexOf('cities_country_code'),
      month:   headers.indexOf('bought_products_order_started_local_month'),
      year:    headers.indexOf('bought_products_order_started_local_year'),
      partner: headers.indexOf('bought_products_store_name'),
      gmv:     headers.indexOf('bought_products_products_value_delivered_eur'),
      orders:  headers.indexOf('bought_products_number_of_distinct_delivered_orders'),
    };

    const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const row      = values[i];
      const country  = col.country >= 0 ? String(row[col.country]  || '').trim() : '';
      const partner  = col.partner >= 0 ? String(row[col.partner]  || '').trim() : '';
      const rawMonth = col.month   >= 0 ? row[col.month] : '';
      const month    = parseMonth(rawMonth);
      const year     = parseYear(rawMonth, col.year >= 0 ? row[col.year] : 0);
      const gmv      = col.gmv    >= 0 ? parseFloat(row[col.gmv])   || 0 : 0;
      const orders   = col.orders >= 0 ? parseInt(row[col.orders])  || 0 : 0;

      if (!country || !partner || !month || !year) continue;
      const period = `${year}-${String(month).padStart(2, '0')}`;
      if (period === currentPeriod) continue;

      rows.push({ country, partner, period, gmv, orders });
    }

    // Aggregate by partner+country (all-time)
    const partnerMap = {};
    rows.forEach(r => {
      const key = `${r.country}__${r.partner}`;
      if (!partnerMap[key]) partnerMap[key] = { country: r.country, partner: r.partner, gmv: 0, orders: 0 };
      partnerMap[key].gmv    += r.gmv;
      partnerMap[key].orders += r.orders;
    });
    const byPartner = Object.values(partnerMap).map(p => ({
      country: p.country,
      partner: p.partner,
      gmv:     r2(p.gmv),
      orders:  p.orders,
      aov:     p.orders > 0 ? r2(p.gmv / p.orders) : 0,
    })).sort((a, b) => b.gmv - a.gmv);

    // Monthly by partner+country
    const monthlyMap = {};
    rows.forEach(r => {
      const key = `${r.country}__${r.partner}__${r.period}`;
      if (!monthlyMap[key]) monthlyMap[key] = { country: r.country, partner: r.partner, period: r.period, gmv: 0, orders: 0 };
      monthlyMap[key].gmv    += r.gmv;
      monthlyMap[key].orders += r.orders;
    });
    const byPartnerMonth = Object.values(monthlyMap).map(r => ({
      country: r.country,
      partner: r.partner,
      period:  r.period,
      gmv:     r2(r.gmv),
      orders:  r.orders,
      aov:     r.orders > 0 ? r2(r.gmv / r.orders) : 0,
    })).sort((a, b) => a.period.localeCompare(b.period));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json({ byPartner, byPartnerMonth });

  } catch (err) {
    console.error('Partners API error:', err);
    res.status(500).json({ error: err.message });
  }
}
