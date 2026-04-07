import { useState, useEffect } from 'react';
import Head from 'next/head';
import KPICard from '../components/KPICard';
import CountryTable from '../components/CountryTable';
import PartnersTable from '../components/PartnersTable';
import InsightsPanel from '../components/InsightsPanel';
import { GMVTrendChart, MonthlyTotalChart, CountryShareChart, EvolutionChart, VerticalComparisonChart } from '../components/Charts';
import { fmt, COUNTRIES, COUNTRY_META } from '../lib/constants';

const PERIOD_FILTERS = [
  { label: 'All time', value: 'all' },
  { label: '2024',     value: '2024' },
  { label: '2025',     value: '2025' },
  { label: '2026',     value: '2026' },
  { label: 'L3M',      value: 'l3m' },
  { label: 'L6M',      value: 'l6m' },
];

const VERTICAL_FILTERS = [
  { label: 'All',       value: 'all' },
  { label: 'Retail',    value: 'Retail' },
  { label: 'MFC',       value: 'MFC' },
  { label: 'Groceries', value: 'Groceries' },
];

export default function Dashboard() {
  const [data, setData]                     = useState(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [dark, setDark]                     = useState(true);
  const [selected, setSelected]             = useState(COUNTRIES);
  const [periodFilter, setPeriodFilter]     = useState('all');
  const [verticalFilter, setVerticalFilter] = useState('all');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (c) => setSelected(prev =>
    prev.includes(c)
      ? (prev.length > 1 ? prev.filter(x => x !== c) : prev)
      : [...prev, c]
  );

  // ── Loading ───────────────────────────────────────────────────
  if (loading) return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading beauty data...</p>
        </div>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────
  if (error) return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Connection Error</h2>
          <p className="text-sm text-red-500 mb-4 font-mono bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-yellow-400 text-black font-bold rounded-lg text-sm">
            Retry
          </button>
        </div>
      </div>
    </div>
  );

  // ── Data processing ───────────────────────────────────────────
  const {
    summary,
    byCountryMonth,
    byVerticalCountryMonth,
    monthlyTotal,
    growth,
    partners,
    meta,
  } = data;

  const currentPeriod = meta?.currentPeriod ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // ── Period filter ─────────────────────────────────────────────
  const filterByPeriod = (rows) => {
    if (!rows) return [];
    const now      = new Date();
    const nowYear  = now.getFullYear();
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
  };

  // ── Choose right data source based on vertical filter ─────────
  // All     → byCountryMonth (pre-aggregated, no vertical field)
  // Retail/MFC → byVerticalCountryMonth filtered by vertical
  const getCountryMonthSource = () => {
    if (verticalFilter === 'all') return byCountryMonth;
    return (byVerticalCountryMonth || []).filter(r => r.vertical === verticalFilter);
  };

  const getMonthlyTotalSource = () => {
    if (verticalFilter === 'all') return monthlyTotal;
    // Rebuild monthly total from byVerticalCountryMonth for selected vertical
    const filtered = (byVerticalCountryMonth || []).filter(r => r.vertical === verticalFilter);
    const map = {};
    filtered.forEach(r => {
      if (!map[r.period]) map[r.period] = { period: r.period, gmv: 0, orders: 0 };
      map[r.period].gmv    += r.gmv;
      map[r.period].orders += r.orders;
    });
    const sorted = Object.values(map).sort((a, b) => a.period.localeCompare(b.period));
    return sorted.map((m, i) => {
      const prev = i > 0 ? sorted[i - 1] : null;
      return {
        ...m,
        aov:       m.orders > 0 ? m.gmv / m.orders : 0,
        momGMV:    prev && prev.gmv > 0    ? (m.gmv - prev.gmv) / prev.gmv * 100          : null,
        momOrders: prev && prev.orders > 0 ? (m.orders - prev.orders) / prev.orders * 100 : null,
      };
    });
  };

  // ── Apply filters ─────────────────────────────────────────────
  const filteredMonthlyTotal   = filterByPeriod(getMonthlyTotalSource());
  const filteredByCountryMonth = filterByPeriod(getCountryMonthSource())
    .filter(r => selected.includes(r.country));
  const filteredPeriods        = [...new Set(filteredMonthlyTotal.map(m => m.period))].sort();
  const filteredPartnerMonth   = filterByPeriod(partners?.byPartnerMonth || [])
    .filter(r => selected.includes(r.country));

  // ── Recalculate byCountry from filtered source ────────────────
  const filteredByCountry = COUNTRIES.map(country => {
    const rows   = filterByPeriod(getCountryMonthSource()).filter(r => r.country === country);
    const gmv    = rows.reduce((s, r) => s + r.gmv, 0);
    const orders = rows.reduce((s, r) => s + r.orders, 0);
    return { country, gmv, orders, aov: orders > 0 ? gmv / orders : 0 };
  }).filter(c => c.gmv > 0 || c.orders > 0);

  // ── KPI summary ───────────────────────────────────────────────
  const filteredGMV    = filteredByCountry.reduce((s, c) => s + c.gmv, 0);
  const filteredOrders = filteredByCountry.reduce((s, c) => s + c.orders, 0);
  const filteredAOV    = filteredOrders > 0 ? filteredGMV / filteredOrders : 0;

  const lastMonth = filteredMonthlyTotal?.[filteredMonthlyTotal.length - 1];
  const prevMonth = filteredMonthlyTotal?.[filteredMonthlyTotal.length - 2];
  const lastMoM   = lastMonth && prevMonth && prevMonth.gmv > 0
    ? ((lastMonth.gmv - prevMonth.gmv) / prevMonth.gmv * 100) : null;

  // ── Vertical breakdown (respects period + country filters) ──────
  const filteredVCM = filterByPeriod(byVerticalCountryMonth || [])
    .filter(r => selected.includes(r.country));

  const verticalGMV = {};
  filteredVCM.forEach(r => {
    verticalGMV[r.vertical] = (verticalGMV[r.vertical] || 0) + r.gmv;
  });
  const retailGMV    = verticalGMV['Retail']    || 0;
  const mfcGMV       = verticalGMV['MFC']       || 0;
  const groceriesGMV = verticalGMV['Groceries'] || 0;

  return (
    <div className={dark ? 'dark' : ''}>
      <Head><title>Glovo Beauty Africa</title></Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

        {/* ── Header ────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                <span className="text-sm font-black text-black">G</span>
              </div>
              <div>
                <h1 className="font-black text-gray-900 dark:text-white text-sm">
                  Beauty Africa · {verticalFilter === 'all' ? 'All Verticals' : verticalFilter}
                </h1>
                <p className="text-xs text-gray-400">
                  {filteredPeriods[0] || meta?.periodStart}
                  {' → '}
                  {filteredPeriods[filteredPeriods.length - 1] || meta?.periodEnd}
                  {' · '}
                  {meta?.totalRows?.toLocaleString()} rows
                  {' · '}
                  <span className="text-orange-400">⚠️ {currentPeriod} excluded</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <button
                onClick={fetchData}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => setDark(!dark)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {dark ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">

          {/* ── KPIs ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title={verticalFilter === 'all' ? 'Total Beauty GMV' : `${verticalFilter} GMV`}
              value={fmt(filteredGMV)}
              subtitle={`${filteredPeriods[0] || meta?.periodStart} → ${filteredPeriods[filteredPeriods.length - 1] || meta?.periodEnd}`}
              trend={lastMoM}
              icon="💄"
              accent="yellow"
              delay={0}
            />
            <KPICard
              title="Total Orders"
              value={filteredOrders.toLocaleString()}
              subtitle={verticalFilter === 'all' ? 'All verticals' : verticalFilter}
              icon="📦"
              accent="green"
              delay={80}
            />
            <KPICard
              title="Avg Order Value"
              value={`€${filteredAOV.toFixed(2)}`}
              subtitle={verticalFilter === 'all' ? 'All verticals' : verticalFilter}
              icon="🛒"
              accent="blue"
              delay={160}
            />
            <KPICard
              title="Active Markets"
              value={`${filteredByCountry.length} / 6`}
              subtitle={filteredByCountry.map(c => c.country).join(' · ')}
              icon="🌍"
              accent="gray"
              delay={240}
            />
          </div>

          {/* ── Vertical summary strip ─────────────────────────────── */}
          {verticalFilter === 'all' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between border-l-4 border-yellow-400">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Retail GMV</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(retailGMV)}</p>
                  <p className="text-xs text-gray-400">
                    {filteredGMV > 0 ? (retailGMV / filteredGMV * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                <span className="text-3xl">🏪</span>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between border-l-4 border-green-500">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">MFC GMV</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(mfcGMV)}</p>
                  <p className="text-xs text-gray-400">
                    {filteredGMV > 0 ? (mfcGMV / filteredGMV * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                <span className="text-3xl">🏭</span>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between border-l-4 border-blue-500">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Groceries GMV</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(groceriesGMV)}</p>
                  <p className="text-xs text-gray-400">
                    {filteredGMV > 0 ? (groceriesGMV / filteredGMV * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
                <span className="text-3xl">🛒</span>
              </div>
            </div>
          )}

          {/* ── Filters ───────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-6">

            {/* Country filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Markets:</span>
              {COUNTRIES.map(c => (
                <button
                  key={c}
                  onClick={() => toggle(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selected.includes(c)
                      ? 'text-black shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                  style={selected.includes(c) ? { background: COUNTRY_META[c]?.color } : {}}
                >
                  {COUNTRY_META[c]?.flag} {c}
                </button>
              ))}
              <button
                onClick={() => setSelected(COUNTRIES)}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-400 ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                All
              </button>
            </div>

            {/* Period filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Period:</span>
              {PERIOD_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setPeriodFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    periodFilter === f.value
                      ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Vertical filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Vertical:</span>
              {VERTICAL_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setVerticalFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    verticalFilter === f.value
                      ? 'bg-yellow-400 text-black shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Charts Row 1 ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GMVTrendChart
              byCountryMonth={filteredByCountryMonth}
              selectedCountries={selected}
            />
            <MonthlyTotalChart monthlyTotal={filteredMonthlyTotal} />
          </div>

          {/* ── Charts Row 2 ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CountryShareChart
              byCountry={filteredByCountry.filter(c => selected.includes(c.country))}
            />
            <EvolutionChart
              byCountryMonth={filteredByCountryMonth}
              selectedCountries={selected}
            />
          </div>

          {/* ── Retail vs MFC (always shows both verticals) ───────── */}
          <VerticalComparisonChart
            byVerticalCountryMonth={filterByPeriod(byVerticalCountryMonth || [])
              .filter(r => selected.includes(r.country))}
            selectedCountries={selected}
          />

          {/* ── Country Table ───────────────────────────────────────── */}
          <CountryTable
            byCountry={filteredByCountry}
            byCountryMonth={filterByPeriod(getCountryMonthSource())}
            allByCountryMonth={(byCountryMonth || []).filter(r => selected.includes(r.country))}
            filteredPeriods={filteredPeriods}
            totalGMV={filteredGMV}
            totalOrders={filteredOrders}
          />

          {/* ── Partners ──────────────────────────────────────────── */}
          <PartnersTable byPartnerMonth={filteredPartnerMonth} />

          {/* ── Insights ──────────────────────────────────────────── */}
          <InsightsPanel
            summary={summary}
            byCountry={filteredByCountry}
            growth={growth}
            monthlyTotal={filteredMonthlyTotal}
          />

          <p className="text-center text-xs text-gray-300 dark:text-gray-700 pb-4">
            Glovo Q-Commerce Africa · Beauty · Internal use only
          </p>
        </main>
      </div>
    </div>
  );
}