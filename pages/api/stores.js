import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const TAB = 'AfricaStores';
const RANGE = 'A:K';

// Column header → field. Order-independent: we resolve by header name.
const COLUMNS = {
  country:       'order_descriptors_order_country_code',
  store:         'stores_store_name',
  week:          'order_descriptors_order_activated_local_week',
  createdToDel:  'order_descriptors_average_order_created_delivery_duration',
  gmv:           'order_descriptors_partners_revenue_eur',
  orders:        'order_descriptors_number_of_delivered_orders',
  deliveryDur:   'order_descriptors_average_delivery_duration',
  cancelled:     'order_descriptors_number_of_cancelled_orders',
  oosCancelled:  'order_descriptors_number_of_cancelled_orders_due_to_partner_products_not_available',
  negRating:     'ratings_number_of_orders_with_negative_rating',
  rated:         'ratings_number_of_orders_with_store_rating',
};

// ── Helpers ───────────────────────────────────────────────────
function r2(v) { return Math.round(v * 100) / 100; }
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function int(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }

// Private key may arrive single- or double-escaped depending on how the env
// var was stored. Normalise any run of backslashes before n into a newline.
function normalizeKey(k) {
  if (!k) return k;
  return k.replace(/\\+n/g, '\n');
}

// Monday (ISO week start) of a given date, as YYYY-MM-DD.
function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();              // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ── Handler ───────────────────────────────────────────────────
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
    if (values.length < 2) {
      return res.status(200).json({ error: 'No data found in AfricaStores' });
    }

    const headers = values[0];
    const col = {};
    Object.keys(COLUMNS).forEach(k => { col[k] = headers.indexOf(COLUMNS[k]); });

    const currentWeek = weekStart(new Date());

    // Optional country filter — keeps the payload well under Next's 4MB limit.
    // meta (countries, weeks) is always derived from the full dataset so the
    // selectors stay complete regardless of which country is requested.
    const countryFilter = req.query.country
      ? String(req.query.country).trim().toUpperCase()
      : null;

    // Parse rows → group by country+store → weekly records.
    const storeMap = {};      // `${country}__${store}` → { country, store, weeks: {week: rec} }
    const weekSet = {};
    const countrySet = {};
    let usedRows = 0, skipped = 0;

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const country = String(row[col.country] || '').trim();
      const store   = String(row[col.store]   || '').trim();
      const week    = String(row[col.week]    || '').trim();

      // Skip blank weeks and the current (partial) week.
      if (!country || !store || !week || week === currentWeek) { skipped++; continue; }

      // Always record country/week for meta, even if filtered out below.
      weekSet[week] = true;
      countrySet[country] = true;

      // Apply country filter for the returned store records only.
      if (countryFilter && country !== countryFilter) { skipped++; continue; }

      const gmv          = num(row[col.gmv]);
      const orders       = int(row[col.orders]);
      const cancelled    = int(row[col.cancelled]);
      const oosCancelled = int(row[col.oosCancelled]);
      const negRating    = int(row[col.negRating]);
      const rated        = int(row[col.rated]);
      const deliveryDur  = num(row[col.deliveryDur]);
      const createdToDel = num(row[col.createdToDel]);

      const key = `${country}__${store}`;
      if (!storeMap[key]) storeMap[key] = { country, store, weeks: {} };

      // Same store can appear once per week; if duplicated, sum the additive fields.
      const w = storeMap[key].weeks[week] || {
        week, gmv: 0, orders: 0, cancelled: 0, oosCancelled: 0,
        negRating: 0, rated: 0, _durWeighted: 0, _createdWeighted: 0,
      };
      w.gmv          += gmv;
      w.orders       += orders;
      w.cancelled    += cancelled;
      w.oosCancelled += oosCancelled;
      w.negRating    += negRating;
      w.rated        += rated;
      // weight durations by orders so merges stay correct
      w._durWeighted     += deliveryDur  * orders;
      w._createdWeighted += createdToDel * orders;
      storeMap[key].weeks[week] = w;
      usedRows++;
    }

    const weeks = Object.keys(weekSet).sort();
    const countries = Object.keys(countrySet).sort();

    // Finalise: turn week maps into sorted arrays with derived rates.
    const stores = Object.values(storeMap).map(s => {
      const weekly = Object.values(s.weeks)
        .sort((a, b) => a.week.localeCompare(b.week))
        .map(w => {
          const totalOrdersWithCancel = w.orders + w.cancelled;
          return {
            week:         w.week,
            gmv:          r2(w.gmv),
            orders:       w.orders,
            aov:          w.orders > 0 ? r2(w.gmv / w.orders) : 0,
            cancelled:    w.cancelled,
            oosCancelled: w.oosCancelled,
            negRating:    w.negRating,
            rated:        w.rated,
            cancelRate:   totalOrdersWithCancel > 0 ? r2(w.cancelled / totalOrdersWithCancel * 100) : 0,
            // OOS rate (def. B): share of ALL demand lost to out-of-stock cancels
            oosRate:      totalOrdersWithCancel > 0 ? r2(w.oosCancelled / totalOrdersWithCancel * 100) : 0,
            negRate:      w.rated > 0 ? r2(w.negRating / w.rated * 100) : 0,
            deliveryDur:  w.orders > 0 ? r2(w._durWeighted / w.orders) : 0,
            createdToDel: w.orders > 0 ? r2(w._createdWeighted / w.orders) : 0,
          };
        });
      return { country: s.country, store: s.store, weekly };
    });

    const result = {
      meta: {
        lastUpdated: new Date().toISOString(),
        totalRows:   usedRows,
        skippedRows: skipped,
        currentWeek,                       // excluded partial week
        weeks,                             // all full weeks, ascending
        latestWeek:  weeks[weeks.length - 1],
        countries,
        storeCount:  stores.length,
      },
      stores,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(result);

  } catch (err) {
    console.error('stores API error:', err);
    res.status(500).json({ error: err.message });
  }
}
