import { useState, useEffect } from 'react';
import Head from 'next/head';
import KPICard from '../components/KPICard';
import CountryTable from '../components/CountryTable';
import InsightsPanel from '../components/InsightsPanel';
import { GMVTrendChart, MonthlyTotalChart, CountryShareChart, GrowthChart } from '../components/Charts';
import { fmt, COUNTRIES, COUNTRY_META } from '../lib/constants';

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [dark, setDark]       = useState(true);
  const [selected, setSelected] = useState(COUNTRIES);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/data')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (c) => setSelected(prev =>
    prev.includes(c) ? (prev.length > 1 ? prev.filter(x => x !== c) : prev) : [...prev, c]
  );

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

  const { summary, byCountry, byCountryMonth, monthlyTotal, growth, meta } = data;
  const lastMonth = monthlyTotal?.[monthlyTotal.length - 1];
  const prevMonth = monthlyTotal?.[monthlyTotal.length - 2];
  const lastMoM   = lastMonth && prevMonth && prevMonth.gmv > 0
    ? ((lastMonth.gmv - prevMonth.gmv) / prevMonth.gmv * 100) : null;

  return (
    <div className={dark ? 'dark' : ''}>
      <Head><title>Glovo Beauty Africa</title></Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                <span className="text-sm font-black text-black">G</span>
              </div>
              <div>
                <h1 className="font-black text-gray-900 dark:text-white text-sm">Beauty Africa · Retail</h1>
                <p className="text-xs text-gray-400">{meta?.periodStart} → {meta?.periodEnd} · {meta?.totalRows?.toLocaleString()} rows</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <button onClick={fetchData} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                ↻ Refresh
              </button>
              <button onClick={() => setDark(!dark)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                {dark ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Retail GMV"  value={fmt(summary.totalGMV)}              subtitle={`${meta?.periodStart} → ${meta?.periodEnd}`} trend={lastMoM} icon="💄" accent="yellow" delay={0} />
            <KPICard title="Total Orders"       value={summary.totalOrders.toLocaleString()} subtitle="Delivered retail beauty"                     icon="📦" accent="green"  delay={80} />
            <KPICard title="Avg Order Value"    value={`€${summary.aov.toFixed(2)}`}        subtitle="Retail vertical"                              icon="🛒" accent="blue"   delay={160} />
            <KPICard title="Active Markets"     value={`${summary.countries} / 6`}          subtitle={byCountry.map(c => c.country).join(' · ')}    icon="🌍" accent="gray"   delay={240} />
          </div>

          {/* Country filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Markets:</span>
            {COUNTRIES.map(c => (
              <button key={c} onClick={() => toggle(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selected.includes(c) ? 'text-black shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}
                style={selected.includes(c) ? { background: COUNTRY_META[c]?.color } : {}}>
                {COUNTRY_META[c]?.flag} {c}
              </button>
            ))}
            <button onClick={() => setSelected(COUNTRIES)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-400 ml-1">
              All
            </button>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GMVTrendChart byCountryMonth={byCountryMonth} selectedCountries={selected} />
            <MonthlyTotalChart monthlyTotal={monthlyTotal} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CountryShareChart byCountry={byCountry.filter(c => selected.includes(c.country))} />
            <GrowthChart growth={growth} selectedCountries={selected} />
          </div>

          {/* Table */}
          <CountryTable byCountry={byCountry} growth={growth} totalGMV={summary.totalGMV} totalOrders={summary.totalOrders} />

          {/* Insights */}
          <InsightsPanel summary={summary} byCountry={byCountry} growth={growth} monthlyTotal={monthlyTotal} />

          <p className="text-center text-xs text-gray-300 dark:text-gray-700 pb-4">
            Glovo Q-Commerce Africa · Beauty Retail · Internal use only
          </p>
        </main>
      </div>
    </div>
  );
}