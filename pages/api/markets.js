import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const TAB = 'AfricaStores';
const RANGE = 'A:K';

const COLUMNS = {
  country:      'order_descriptors_order_country_code',
  store:        'stores_store_name',
  week:         'order_descriptors_order_activated_local_week',
  gmv:          'order_descriptors_partners_revenue_eur',
  orders:       'order_descriptors_number_of_delivered_orders',
  deliveryDur:  'order_descriptors_average_delivery_duration',
  cancelled:    'order_descriptors_number_of_cancelled_orders',
  oosCancelled: 'order_descriptors_number_of_cancelled_orders_due_to_partner_products_not_available',
  negRating:    'ratings_number_of_orders_with_negative_rating',
  rated:        'ratings_number_of_orders_with_store_rating',
};

function r2(v) { return Math.round(v * 100) / 100; }
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function int(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
function normalizeKey(k) { return k ? k.replace(/\\+n/g, '\n') : k; }

function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:  normalizeKey(process.env.GOOGLE_PRIVATE_KEY),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TAB}!${RANGE}`,
    });

    const values = resp.data.values || [];
    if (values.length < 2) return res.status(200).json({ error: 'No data in AfricaStores' });

    const headers = values[0];
    const col = {};
    Object.keys(COLUMNS).forEach(k => { col[k] = headers.indexOf(COLUMNS[k]); });

    const currentWeek = weekStart(new Date());

    // country → week → aggregate
    const agg = {};               // `${country}__${week}` → bucket
    const weekSet = {}, countrySet = {};

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const country = String(row[col.country] || '').trim();
      const store   = String(row[col.store]   || '').trim();
      const week    = String(row[col.week]    || '').trim();
      if (!country || !store || !week || week === currentWeek) continue;

      weekSet[week] = true;
      countrySet[country] = true;

      const key = `${country}__${week}`;
      const b = agg[key] || (agg[key] = {
        country, week, gmv: 0, orders: 0, cancelled: 0, oosCancelled: 0,
        negRating: 0, rated: 0, _durWeighted: 0, stores: {},
      });
      const orders = int(row[col.orders]);
      b.gmv          += num(row[col.gmv]);
      b.orders       += orders;
      b.cancelled    += int(row[col.cancelled]);
      b.oosCancelled += int(row[col.oosCancelled]);
      b.negRating    += int(row[col.negRating]);
      b.rated        += int(row[col.rated]);
      b._durWeighted += num(row[col.deliveryDur]) * orders;
      b.stores[store] = (b.stores[store] || 0) + num(row[col.gmv]);  // per-store GMV
    }

    const weeks = Object.keys(weekSet).sort();
    const countries = Object.keys(countrySet).sort();

    // GMV concentration of a per-store map: top-1 / top-3 share + HHI (0-10000).
    function concentration(storeMap) {
      const vals = Object.values(storeMap).sort((a, b) => b - a);
      const total = vals.reduce((s, x) => s + x, 0) || 1;
      const top1 = (vals[0] || 0) / total * 100;
      const top3 = vals.slice(0, 3).reduce((s, x) => s + x, 0) / total * 100;
      const hhi = vals.reduce((s, x) => s + Math.pow(x / total * 100, 2), 0);
      return { top1: r2(top1), top3: r2(top3), hhi: Math.round(hhi) };
    }

    const markets = {};
    countries.forEach(c => {
      // buckets for this country, ascending by week
      const buckets = Object.values(agg).filter(b => b.country === c)
        .sort((a, b) => a.week.localeCompare(b.week));
      let prevStores = null;
      markets[c] = buckets.map(b => {
        const cancelDenom = b.orders + b.cancelled;
        const keys = new Set(Object.keys(b.stores));
        let newStores = 0, churnedStores = 0;
        if (prevStores) {
          keys.forEach(k => { if (!prevStores.has(k)) newStores++; });
          prevStores.forEach(k => { if (!keys.has(k)) churnedStores++; });
        }
        prevStores = keys;
        const conc = concentration(b.stores);
        return {
          week:        b.week,
          gmv:         r2(b.gmv),
          orders:      b.orders,
          aov:         b.orders > 0 ? r2(b.gmv / b.orders) : 0,
          stores:      keys.size,
          newStores,
          churnedStores,
          top1Share:   conc.top1,
          top3Share:   conc.top3,
          hhi:         conc.hhi,
          cancelRate:  cancelDenom > 0 ? r2(b.cancelled / cancelDenom * 100) : 0,
          oosRate:     cancelDenom > 0 ? r2(b.oosCancelled / cancelDenom * 100) : 0,
          negRate:     b.rated > 0 ? r2(b.negRating / b.rated * 100) : 0,
          deliveryDur: b.orders > 0 ? r2(b._durWeighted / b.orders) : 0,
        };
      });
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json({
      meta: {
        lastUpdated: new Date().toISOString(),
        currentWeek,
        weeks,
        latestWeek: weeks[weeks.length - 1],
        countries,
      },
      markets,
    });
  } catch (err) {
    console.error('markets API error:', err);
    res.status(500).json({ error: err.message });
  }
}
