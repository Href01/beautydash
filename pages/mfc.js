import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { fmt, fmtPct, trendColor, COUNTRIES, COUNTRY_META } from '../lib/constants';

const CAT_COLORS = ['#FFC244','#00A082','#3B82F6','#8B5CF6','#EC4899','#F97316','#10B981','#EF4444','#06B6D4','#F59E0B','#84CC16','#A78BFA'];
const axisStyle  = { fontSize: 11, fill: '#9CA3AF' };
const gridStyle  = { strokeDasharray: '3 3', stroke: '#374151', opacity: 0.25 };

function ChartTooltip({ active, payload, label, isPct }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-xl text-xs min-w-[160px]">
      <p className="font-bold text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
            <span className="text-gray-500 dark:text-gray-400 max-w-[120px] truncate">{entry.name}</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">
            {entry.value == null ? '—' : isPct ? `${Number(entry.value) > 0 ? '+' : ''}${Number(entry.value).toFixed(1)}%` : fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const PERIOD_FILTERS = [
  { label: 'All time', value: 'all' },
  { label: '2024',     value: '2024' },
  { label: '2025',     value: '2025' },
  { label: '2026',     value: '2026' },
  { label: 'L3M',      value: 'l3m' },
  { label: 'L6M',      value: 'l6m' },
];

function filterByPeriod(rows, periodFilter) {
  if (!rows) return [];
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  return rows.filter(r => {
    if (!r.period) return false;
    if (periodFilter === 'all')  return true;
    if (periodFilter === '2024') return r.period.startsWith('2024');
    if (periodFilter === '2025') return r.period.startsWith('2025');
    if (periodFilter === '2026') return r.period.startsWith('2026');
    if (periodFilter === 'l3m' || periodFilter === 'l6m') {
      const [y, m]     = r.period.split('-').map(Number);
      const monthsDiff = (nowYear - y) * 12 + (nowMonth + 1 - m);
      const limit      = periodFilter === 'l3m' ? 3 : 6;
      return monthsDiff >= 0 && monthsDiff <= limit;
    }
    return true;
  });
}

// Compute MoM for a set of monthly rows grouped by keyFn
// Returns { key: momPct } for last two periods in the set
function computeMoM(monthlyRows, keyFn, valueFn) {
  // Build per-key sorted period list
  const byKey = {};
  monthlyRows.forEach(r => {
    const k = keyFn(r);
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(r);
  });
  const result = {};
  Object.entries(byKey).forEach(([k, list]) => {
    list.sort((a, b) => a.period.localeCompare(b.period));
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    const lastVal = valueFn(last);
    const prevVal = prev ? valueFn(prev) : null;
    result[k] = prevVal && prevVal > 0 ? (lastVal - prevVal) / prevVal * 100 : null;
  });
  return result;
}

// Collapse country-level monthly rows into L2-level monthly rows
function toL2Monthly(countryL2Rows) {
  const map = {};
  countryL2Rows.forEach(r => {
    const key = `${r.l2}__${r.period}`;
    if (!map[key]) map[key] = { l2: r.l2, period: r.period, gmv: 0, orders: 0 };
    map[key].gmv    += r.gmv;
    map[key].orders += r.orders;
  });
  return Object.values(map);
}

// Collapse country-level monthly rows into L3-level monthly rows
function toL3Monthly(countryL3Rows) {
  const map = {};
  countryL3Rows.forEach(r => {
    const key = `${r.l2}__${r.l3}__${r.period}`;
    if (!map[key]) map[key] = { l2: r.l2, l3: r.l3, period: r.period, gmv: 0, orders: 0 };
    map[key].gmv    += r.gmv;
    map[key].orders += r.orders;
  });
  return Object.values(map);
}

function FilterTag({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold">
      <span className="text-green-400">◆</span>{label}: <span className="font-black">{value}</span>
    </span>
  );
}

export default function MFCPage() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [dark, setDark]             = useState(true);
  const [selected, setSelected]     = useState(COUNTRIES);
  const [periodFilter, setPeriod]   = useState('all');
  const [selectedL2, setSelectedL2] = useState(null);
  const [chartLevel, setChartLevel] = useState('l2');   // 'l2' | 'l3'
  const [activeCats, setActiveCats] = useState([]);      // selected category keys

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  useEffect(() => {
    fetch('/api/mfc')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const toggle = (c) => setSelected(prev =>
    prev.includes(c) ? (prev.length > 1 ? prev.filter(x => x !== c) : prev) : [...prev, c]
  );

  if (loading) return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (error) return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <p className="text-sm text-red-500 font-mono bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>
        </div>
      </div>
    </div>
  );

  const { byCountryL2Month, byCountryL3Month, meta } = data;

  // ── Apply country + period filters ────────────────────────────
  const filtCL2 = filterByPeriod(byCountryL2Month, periodFilter)
    .filter(r => selected.includes(r.country));
  const filtCL3 = filterByPeriod(byCountryL3Month, periodFilter)
    .filter(r => selected.includes(r.country));

  // ── L2 aggregation (from country-filtered data) ───────────────
  const l2MonthlyFiltered = toL2Monthly(filtCL2);
  const l2Map = {};
  l2MonthlyFiltered.forEach(r => {
    if (!l2Map[r.l2]) l2Map[r.l2] = { l2: r.l2, gmv: 0, orders: 0 };
    l2Map[r.l2].gmv    += r.gmv;
    l2Map[r.l2].orders += r.orders;
  });
  const l2Rows = Object.values(l2Map)
    .map(r => ({ ...r, aov: r.orders > 0 ? r.gmv / r.orders : 0 }))
    .sort((a, b) => b.gmv - a.gmv);

  const totalGMV    = l2Rows.reduce((s, r) => s + r.gmv, 0);
  const totalOrders = l2Rows.reduce((s, r) => s + r.orders, 0);

  // MoM uses the country-filtered monthly L2 data
  const momL2GMV    = computeMoM(l2MonthlyFiltered, r => r.l2, r => r.gmv);
  const momL2Orders = computeMoM(l2MonthlyFiltered, r => r.l2, r => r.orders);

  // ── L3 aggregation (from country-filtered data) ───────────────
  const l3MonthlyFiltered = toL3Monthly(
    selectedL2 ? filtCL3.filter(r => r.l2 === selectedL2) : filtCL3
  );
  const l3Map = {};
  l3MonthlyFiltered.forEach(r => {
    const key = `${r.l2}__${r.l3}`;
    if (!l3Map[key]) l3Map[key] = { l2: r.l2, l3: r.l3, gmv: 0, orders: 0 };
    l3Map[key].gmv    += r.gmv;
    l3Map[key].orders += r.orders;
  });
  const l3Rows = Object.values(l3Map)
    .map(r => ({ ...r, aov: r.orders > 0 ? r.gmv / r.orders : 0 }))
    .sort((a, b) => b.gmv - a.gmv);

  const l3TotalGMV = selectedL2 ? (l2Map[selectedL2]?.gmv || totalGMV) : totalGMV;
  const momL3GMV   = computeMoM(l3MonthlyFiltered, r => `${r.l2}__${r.l3}`, r => r.gmv);

  // ── Country × L2 weight breakdown ────────────────────────────
  const countryMap = {};
  filtCL2.forEach(r => {
    if (!countryMap[r.country]) countryMap[r.country] = { country: r.country, total: 0, byL2: {} };
    countryMap[r.country].total        += r.gmv;
    countryMap[r.country].byL2[r.l2]   = (countryMap[r.country].byL2[r.l2] || 0) + r.gmv;
  });
  const countryRows = Object.values(countryMap).sort((a, b) => b.total - a.total);
  const allL2s = [...new Set(filtCL2.map(r => r.l2))].sort();

  // ── Chart data ───────────────────────────────────────────────
  // For charts, L3 is independent of table drill-down (uses all L3)
  const chartL3Monthly = toL3Monthly(filtCL3);

  const chartSource = chartLevel === 'l2' ? l2MonthlyFiltered : chartL3Monthly;
  const getCatKey   = r => chartLevel === 'l2' ? r.l2 : `${r.l2} · ${r.l3}`;

  // All available categories ranked by GMV
  const catGMVMap = {};
  chartSource.forEach(r => {
    const k = getCatKey(r);
    catGMVMap[k] = (catGMVMap[k] || 0) + r.gmv;
  });
  const allCats    = Object.entries(catGMVMap).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const top5       = allCats.slice(0, 5);
  const shownCats  = activeCats.length > 0 ? activeCats.filter(c => allCats.includes(c)) : top5;

  // Monthly GMV per period per category
  const chartPeriods = [...new Set(chartSource.map(r => r.period))].sort();
  const gmvChartData = chartPeriods.map(period => {
    const point = { period };
    shownCats.forEach(cat => {
      const row = chartSource.find(r => getCatKey(r) === cat && r.period === period);
      point[cat] = row?.gmv ?? null;
    });
    return point;
  });

  // MoM % per period per category
  const momChartData = chartPeriods.map((period, i) => {
    const point = { period };
    if (i === 0) return point;
    const prevPeriod = chartPeriods[i - 1];
    shownCats.forEach(cat => {
      const cur  = chartSource.find(r => getCatKey(r) === cat && r.period === period);
      const prev = chartSource.find(r => getCatKey(r) === cat && r.period === prevPeriod);
      point[cat] = cur && prev && prev.gmv > 0 ? (cur.gmv - prev.gmv) / prev.gmv * 100 : null;
    });
    return point;
  });

  const toggleCat = (cat) => setActiveCats(prev =>
    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
  );

  // ── Filter summary labels ─────────────────────────────────────
  const periodLabel = PERIOD_FILTERS.find(f => f.value === periodFilter)?.label || 'All time';
  const countryLabel = selected.length === COUNTRIES.length
    ? 'All markets'
    : selected.map(c => `${COUNTRY_META[c]?.flag} ${c}`).join(', ');
  const filteredPeriods = [...new Set(filtCL2.map(r => r.period))].sort();
  const lastTwoPeriods = filteredPeriods.slice(-2);

  return (
    <div className={dark ? 'dark' : ''}>
      <Head><title>MFC Deep Dive · Glovo Beauty Africa</title></Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-sm font-black text-white">M</span>
              </div>
              <div>
                <h1 className="font-black text-gray-900 dark:text-white text-sm">MFC Deep Dive · Category Analysis</h1>
                <p className="text-xs text-gray-400">{meta?.periodStart} → {meta?.periodEnd} · {meta?.totalRows?.toLocaleString()} rows · current month excluded</p>
              </div>
              <Link href="/" className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                ← Main Dashboard
              </Link>
            </div>
            <button onClick={() => setDark(!dark)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </header>

        {/* ── Sticky filter bar ─────────────────────────────────── */}
        <div className="sticky top-[57px] z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-screen-2xl mx-auto px-6 py-2.5 flex flex-wrap gap-x-6 gap-y-2 items-center">

            {/* Markets */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Markets:</span>
              {COUNTRIES.map(c => (
                <button key={c} onClick={() => toggle(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    selected.includes(c) ? 'text-black shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                  style={selected.includes(c) ? { background: COUNTRY_META[c]?.color } : {}}>
                  {COUNTRY_META[c]?.flag} {c}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

            {/* Period */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Period:</span>
              {PERIOD_FILTERS.map(f => (
                <button key={f.value} onClick={() => setPeriod(f.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    periodFilter === f.value
                      ? 'bg-green-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {lastTwoPeriods.length === 2 && (
              <>
                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
                <span className="text-xs text-gray-400">
                  MoM: <span className="font-bold text-gray-600 dark:text-gray-300">{lastTwoPeriods[0]}</span> → <span className="font-bold text-gray-600 dark:text-gray-300">{lastTwoPeriods[1]}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">

          {/* ── KPIs ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'MFC GMV',        value: fmt(totalGMV),                        sub: 'sum across selected countries & period', color: 'border-green-500' },
              { label: 'Orders',         value: totalOrders.toLocaleString(),          sub: 'sum across selected countries & period', color: 'border-blue-400'  },
              { label: 'AOV',            value: `€${totalOrders > 0 ? (totalGMV / totalOrders).toFixed(2) : '0.00'}`, sub: 'GMV ÷ orders', color: 'border-yellow-400' },
              { label: 'L2 Categories', value: l2Rows.length,                        sub: `${l3Rows.length} L3 subcategories active`, color: 'border-purple-400' },
            ].map(k => (
              <div key={k.label} className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 ${k.color}`}>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{k.label}</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{k.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Charts ──────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* Chart controls */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Monthly GMV & MoM Evolution</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Left: absolute GMV per month · Right: month-over-month % change · both respect country & period filters
                  </p>
                </div>
                {/* Level toggle */}
                <div className="flex gap-1 flex-shrink-0">
                  {['l2', 'l3'].map(lvl => (
                    <button key={lvl} onClick={() => { setChartLevel(lvl); setActiveCats([]); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        chartLevel === lvl
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}>
                      {lvl.toUpperCase()} view
                    </button>
                  ))}
                </div>
              </div>

              {/* Category selector */}
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">
                  Select categories to display — default: top 5 by GMV · {shownCats.length} shown
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allCats.map((cat, i) => {
                    const color   = CAT_COLORS[i % CAT_COLORS.length];
                    const isShown = shownCats.includes(cat);
                    const isDefault = activeCats.length === 0 && top5.includes(cat);
                    return (
                      <button key={cat} onClick={() => toggleCat(cat)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                          isShown
                            ? 'text-white border-transparent'
                            : 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                        }`}
                        style={isShown ? { background: color, borderColor: color } : {}}>
                        {cat}
                        {isDefault && activeCats.length === 0 && <span className="ml-1 opacity-60">★</span>}
                      </button>
                    );
                  })}
                  {activeCats.length > 0 && (
                    <button onClick={() => setActiveCats([])}
                      className="px-2.5 py-1 rounded-full text-xs font-bold text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400">
                      reset to top 5
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Two charts side by side */}
            <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-gray-100 dark:divide-gray-700">

              {/* GMV value trend */}
              <div className="p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Monthly GMV — absolute value per {chartLevel.toUpperCase()} category
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={gmvChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={fmt} tick={axisStyle} tickLine={false} axisLine={false} width={65} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {shownCats.map((cat, i) => (
                      <Line key={cat} type="monotone" dataKey={cat}
                        stroke={CAT_COLORS[allCats.indexOf(cat) % CAT_COLORS.length]}
                        strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* MoM % evolution */}
              <div className="p-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  MoM % evolution — month-over-month GMV growth per {chartLevel.toUpperCase()}
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={momChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={v => `${Number(v).toFixed(0)}%`} tick={axisStyle} tickLine={false} axisLine={false} width={50} />
                    <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1} />
                    <Tooltip content={<ChartTooltip isPct />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {shownCats.map((cat, i) => (
                      <Line key={cat} type="monotone" dataKey={cat}
                        stroke={CAT_COLORS[allCats.indexOf(cat) % CAT_COLORS.length]}
                        strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── L2 Category Table ───────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">L2 Category Breakdown</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Aggregated across <span className="font-semibold">{countryLabel}</span> · <span className="font-semibold">{periodLabel}</span> · click a row to drill into L3
                  </p>
                </div>
                <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 flex-shrink-0 space-y-0.5">
                  <p><span className="font-bold text-gray-600 dark:text-gray-300">% GMV / % Orders</span> = share of column total</p>
                  <p><span className="font-bold text-gray-600 dark:text-gray-300">MoM</span> = last month vs previous month</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-3 text-left">L2 Category</th>
                    <th className="px-5 py-3 text-right">GMV</th>
                    <th className="px-5 py-3 text-right">% of Total GMV</th>
                    <th className="px-5 py-3 text-right">Orders</th>
                    <th className="px-5 py-3 text-right">% of Total Orders</th>
                    <th className="px-5 py-3 text-right">AOV</th>
                    <th className="px-5 py-3 text-right">MoM GMV</th>
                    <th className="px-5 py-3 text-right">MoM Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {l2Rows.map(row => {
                    const gmvPct    = totalGMV    > 0 ? row.gmv    / totalGMV    * 100 : 0;
                    const ordersPct = totalOrders > 0 ? row.orders / totalOrders * 100 : 0;
                    const isActive  = selectedL2 === row.l2;
                    return (
                      <tr key={row.l2} onClick={() => setSelectedL2(isActive ? null : row.l2)}
                        className={`cursor-pointer transition-colors ${
                          isActive ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                        }`}>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            {isActive && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
                            {row.l2}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{fmt(row.gmv)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(gmvPct, 100)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">{gmvPct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{row.orders.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(ordersPct, 100)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">{ordersPct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-200">€{row.aov.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-bold ${trendColor(momL2GMV[row.l2])}`}>
                            {momL2GMV[row.l2] != null ? fmtPct(momL2GMV[row.l2]) : '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-bold ${trendColor(momL2Orders[row.l2])}`}>
                            {momL2Orders[row.l2] != null ? fmtPct(momL2Orders[row.l2]) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-900 font-bold text-sm">
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">Total</td>
                    <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{fmt(totalGMV)}</td>
                    <td className="px-5 py-3 text-right text-gray-500">100%</td>
                    <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{totalOrders.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-gray-500">100%</td>
                    <td className="px-5 py-3 text-right text-gray-900 dark:text-white">
                      €{totalOrders > 0 ? (totalGMV / totalOrders).toFixed(2) : '0.00'}
                    </td>
                    <td className="px-5 py-3" /><td className="px-5 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── L3 Drill-down Table ─────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">
                    L3 Subcategories
                    {selectedL2 && <span className="ml-2 text-green-500 font-black">· {selectedL2}</span>}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedL2
                      ? <>Subcategories within <span className="font-semibold">{selectedL2}</span> · % column = share of that L2's GMV · click L2 row again to reset</>
                      : <>All L3 subcategories · % column = share of total MFC GMV · click an L2 row above to filter</>
                    }
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">{l3Rows.length} subcategories</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-3 text-left">L2</th>
                    <th className="px-5 py-3 text-left">L3 Subcategory</th>
                    <th className="px-5 py-3 text-right">GMV</th>
                    <th className="px-5 py-3 text-right">% of {selectedL2 ? 'L2 GMV' : 'Total GMV'}</th>
                    <th className="px-5 py-3 text-right">Orders</th>
                    <th className="px-5 py-3 text-right">AOV</th>
                    <th className="px-5 py-3 text-right">MoM GMV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {l3Rows.map(row => {
                    const pct    = l3TotalGMV > 0 ? row.gmv / l3TotalGMV * 100 : 0;
                    const momKey = `${row.l2}__${row.l3}`;
                    return (
                      <tr key={momKey} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                        <td className="px-5 py-3 text-xs text-gray-400">{row.l2}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{row.l3}</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{fmt(row.gmv)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-green-400" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{row.orders.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-200">€{row.aov.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-bold ${trendColor(momL3GMV[momKey])}`}>
                            {momL3GMV[momKey] != null ? fmtPct(momL3GMV[momKey]) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Country × L2 Weight Table ───────────────────────────── */}
          {countryRows.length > 0 && allL2s.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white">% GMV Weight by Country × L2</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Each cell = that L2's share of <span className="font-semibold">that country's</span> total MFC GMV · rows sum to 100% · <span className="font-semibold">{periodLabel}</span>
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2 flex-shrink-0">
                    <p>e.g. MA 45% Haircare = 45% of Morocco's MFC GMV is Haircare</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-5 py-3 text-left">Country</th>
                      <th className="px-5 py-3 text-right">Total GMV</th>
                      {allL2s.map(l2 => (
                        <th key={l2} className="px-3 py-3 text-right">
                          <span className="block max-w-[100px] truncate ml-auto" title={l2}>{l2}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {countryRows.map(row => {
                      const meta = COUNTRY_META[row.country] || {};
                      return (
                        <tr key={row.country} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span>{meta.flag || '🌍'}</span>
                              <span className="font-bold text-gray-900 dark:text-white">{row.country}</span>
                              <span className="text-xs text-gray-400">{meta.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{fmt(row.total)}</td>
                          {allL2s.map(l2 => {
                            const val = row.byL2[l2] || 0;
                            const pct = row.total > 0 ? val / row.total * 100 : 0;
                            return (
                              <td key={l2} className="px-3 py-3 text-right">
                                {pct > 0 ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className={`text-xs font-bold ${pct > 30 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                      {pct.toFixed(1)}%
                                    </span>
                                    <span className="text-xs text-gray-400">{fmt(val)}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-200 dark:text-gray-700 text-xs">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
