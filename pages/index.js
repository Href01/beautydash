import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import KPICard from '../components/KPICard';
import CountryTable from '../components/CountryTable';
import PartnersTable from '../components/PartnersTable';
import InsightsPanel from '../components/InsightsPanel';
import { GMVTrendChart, MonthlyTotalChart, EvolutionChart, VerticalComparisonChart } from '../components/Charts';
import { fmt, fmtPct, trendColor, COUNTRIES, COUNTRY_META, VERTICAL_COLORS } from '../lib/constants';

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
  const filteredCVRMonth       = filterByPeriod(partners?.cvrByPartnerMonth || [])
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
  const lastMoM        = lastMonth && prevMonth && prevMonth.gmv > 0
    ? ((lastMonth.gmv - prevMonth.gmv) / prevMonth.gmv * 100) : null;
  const lastMoMOrders  = lastMonth && prevMonth && prevMonth.orders > 0
    ? ((lastMonth.orders - prevMonth.orders) / prevMonth.orders * 100) : null;
  const lastMoMAOV     = lastMonth && prevMonth && prevMonth.aov > 0
    ? ((lastMonth.aov - prevMonth.aov) / prevMonth.aov * 100) : null;

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

  // ── Vertical MoM ────────────────────────────────────────────────
  const verticalMoM = {};
  ['Retail', 'MFC', 'Groceries'].forEach(v => {
    const rows    = filteredVCM.filter(r => r.vertical === v);
    const periods = [...new Set(rows.map(r => r.period))].sort();
    if (periods.length >= 2) {
      const lastP  = periods[periods.length - 1];
      const prevP  = periods[periods.length - 2];
      const lastG  = rows.filter(r => r.period === lastP).reduce((s, r) => s + r.gmv, 0);
      const prevG  = rows.filter(r => r.period === prevP).reduce((s, r) => s + r.gmv, 0);
      verticalMoM[v] = prevG > 0 ? (lastG - prevG) / prevG * 100 : null;
    } else {
      verticalMoM[v] = null;
    }
  });

  // ── Filter label for chart subtitles ────────────────────────────
  const periodLabel = periodFilter === 'all' && meta?.periodStart
    ? `${meta.periodStart}–${meta.periodEnd}`
    : (PERIOD_FILTERS.find(f => f.value === periodFilter)?.label || periodFilter);
  const filterLabel = [
    verticalFilter !== 'all' ? verticalFilter : 'All verticals',
    selected.length < COUNTRIES.length ? selected.join(', ') : 'All markets',
    periodLabel,
  ].join(' · ');

  // ── Market × Vertical heatmap data ──────────────────────────────
  const HEATMAP_VERTICALS = ['Retail', 'MFC', 'Groceries'];
  const heatmapRaw = {};
  filteredVCM.forEach(r => {
    if (!heatmapRaw[r.country]) heatmapRaw[r.country] = { Retail: 0, MFC: 0, Groceries: 0 };
    if (HEATMAP_VERTICALS.includes(r.vertical)) heatmapRaw[r.country][r.vertical] += r.gmv;
  });
  const heatmapRows = COUNTRIES
    .filter(c => selected.includes(c))
    .map(c => ({ country: c, ...(heatmapRaw[c] || { Retail: 0, MFC: 0, Groceries: 0 }) }))
    .sort((a, b) => (b.Retail + b.MFC + b.Groceries) - (a.Retail + a.MFC + a.Groceries));
  const heatmapMax = {
    Retail:    Math.max(...heatmapRows.map(r => r.Retail),    1),
    MFC:       Math.max(...heatmapRows.map(r => r.MFC),       1),
    Groceries: Math.max(...heatmapRows.map(r => r.Groceries), 1),
  };

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
              <Link href="/mfc" className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 font-bold hover:bg-green-500/20 transition-colors">
                MFC Deep Dive →
              </Link>
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
              <button onClick={() => setSelected(COUNTRIES)}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                All
              </button>
            </div>

            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

            {/* Period */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Period:</span>
              {PERIOD_FILTERS.map(f => (
                <button key={f.value} onClick={() => setPeriodFilter(f.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    periodFilter === f.value
                      ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {f.value === 'all' && meta?.periodStart
                    ? `All (${meta.periodStart}–${meta.periodEnd})`
                    : f.label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

            {/* Vertical */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Vertical:</span>
              {VERTICAL_FILTERS.map(f => (
                <button key={f.value} onClick={() => setVerticalFilter(f.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    verticalFilter === f.value
                      ? 'bg-yellow-400 text-black shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

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
              trend={lastMoMOrders}
              icon="📦"
              accent="green"
              delay={80}
            />
            <KPICard
              title="Avg Order Value"
              value={`€${filteredAOV.toFixed(2)}`}
              subtitle={verticalFilter === 'all' ? 'All verticals' : verticalFilter}
              trend={lastMoMAOV}
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
              {[
                { label: 'Retail GMV',    gmv: retailGMV,    v: 'Retail',    icon: '🏪', border: 'border-amber-500' },
                { label: 'MFC GMV',       gmv: mfcGMV,       v: 'MFC',       icon: '🏭', border: 'border-teal-500'  },
                { label: 'Groceries GMV', gmv: groceriesGMV, v: 'Groceries', icon: '🛒', border: 'border-blue-500'  },
              ].map(({ label, gmv, v, icon, border }) => (
                <div key={v} className={`bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between border-l-4 ${border}`}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(gmv)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">
                        {filteredGMV > 0 ? (gmv / filteredGMV * 100).toFixed(1) : 0}% of total
                      </p>
                      {verticalMoM[v] !== null && verticalMoM[v] !== undefined && (
                        <span className={`text-xs font-bold ${trendColor(verticalMoM[v])}`}>
                          {fmtPct(verticalMoM[v])} MoM
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-3xl">{icon}</span>
                </div>
              ))}
            </div>
          )}


          {/* ── Key Insights (moved up — first thing stakeholders see) ── */}
          <InsightsPanel
            summary={summary}
            byCountry={filteredByCountry}
            totalGMV={filteredGMV}
            growth={growth}
            monthlyTotal={filteredMonthlyTotal}
          />

          {/* ── Market × Vertical Heatmap ─────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Market × Vertical GMV</h3>
                <p className="text-xs text-gray-400 mt-0.5">{filterLabel} · intensity = share of column max</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wider">
                    <th className="px-5 py-3 text-left text-gray-400">Market</th>
                    {HEATMAP_VERTICALS.map(v => (
                      <th key={v} className="px-5 py-3 text-right" style={{ color: VERTICAL_COLORS[v] }}>{v}</th>
                    ))}
                    <th className="px-5 py-3 text-right text-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {heatmapRows.map(row => {
                    const meta  = COUNTRY_META[row.country] || {};
                    const total = row.Retail + row.MFC + row.Groceries;
                    return (
                      <tr key={row.country} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span>{meta.flag || '🌍'}</span>
                            <span className="font-bold text-gray-900 dark:text-white">{row.country}</span>
                            <span className="text-xs text-gray-400">{meta.name}</span>
                          </div>
                        </td>
                        {HEATMAP_VERTICALS.map(v => {
                          const val      = row[v];
                          const opacity  = heatmapMax[v] > 0 ? val / heatmapMax[v] : 0;
                          const color    = VERTICAL_COLORS[v];
                          return (
                            <td key={v} className="px-5 py-3 text-right">
                              <div
                                className="inline-flex items-center justify-end px-3 py-1 rounded-lg font-bold text-sm"
                                style={{ background: `${color}${Math.round(opacity * 200).toString(16).padStart(2, '0')}`, color: opacity > 0.6 ? '#fff' : '' }}
                              >
                                {val > 0 ? fmt(val) : <span className="text-gray-300 font-normal text-xs">—</span>}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-5 py-3 text-right font-bold text-gray-700 dark:text-gray-200">
                          {total > 0 ? fmt(total) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Charts Row 1 ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GMVTrendChart
              byCountryMonth={filteredByCountryMonth}
              selectedCountries={selected}
              filterLabel={filterLabel}
            />
            <MonthlyTotalChart monthlyTotal={filteredMonthlyTotal} filterLabel={filterLabel} />
          </div>

          {/* ── Evolution Chart (full width) ──────────────────────── */}
          <EvolutionChart
            byCountryMonth={filteredByCountryMonth}
            selectedCountries={selected}
            filterLabel={filterLabel}
          />

          {/* ── Retail vs MFC (always shows both verticals) ───────── */}
          <VerticalComparisonChart
            byVerticalCountryMonth={filterByPeriod(byVerticalCountryMonth || [])
              .filter(r => selected.includes(r.country))}
            selectedCountries={selected}
            verticalFilter={verticalFilter}
          />

          {/* ── Country Table ───────────────────────────────────────── */}
          <CountryTable
            byCountry={filteredByCountry}
            byCountryMonth={filterByPeriod(getCountryMonthSource())}
            allByCountryMonth={(verticalFilter === 'all'
              ? (byCountryMonth || [])
              : (byVerticalCountryMonth || []).filter(r => r.vertical === verticalFilter)
            ).filter(r => selected.includes(r.country))}
            filteredPeriods={filteredPeriods}
            totalGMV={filteredGMV}
            totalOrders={filteredOrders}
          />

          {/* ── Partners ──────────────────────────────────────────── */}
          <PartnersTable byPartnerMonth={filteredPartnerMonth} cvrByPartnerMonth={filteredCVRMonth} />


          <p className="text-center text-xs text-gray-300 dark:text-gray-700 pb-4">
            Glovo Q-Commerce Africa · Beauty · Internal use only
          </p>
        </main>
      </div>
    </div>
  );
}