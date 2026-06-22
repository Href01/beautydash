import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { cls, COUNTRY_META } from '../components/ui';
import MarketsTab from '../components/MarketsTab';
import MarketIntel from '../components/MarketIntel';
import MoversTab from '../components/MoversTab';
import ScorecardTab from '../components/ScorecardTab';
import DrilldownTab from '../components/DrilldownTab';

const TABS = [
  { key: 'markets',   label: 'Markets',   desc: 'Glovo performance by market', global: true },
  { key: 'movers',    label: 'Movers',    desc: 'Who jumped, who dropped' },
  { key: 'scorecard', label: 'Scorecard', desc: 'Full store health table' },
  { key: 'drilldown', label: 'Drilldown', desc: 'One store, every metric' },
];

export default function Home() {
  const [dark, setDark]       = useState(true);
  const [country, setCountry] = useState('MA');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [week, setWeek]       = useState(null);
  const [tab, setTab]         = useState('markets');
  const [store, setStore]     = useState(null);   // selected store for Drilldown
  const [markets, setMarkets] = useState(null);   // cross-country overview

  // jump to Drilldown for a given store (from Movers/Scorecard clicks)
  function openStore(name) { setStore(name); setTab('drilldown'); }
  // drill from a market card into that country's store scorecard
  function openMarket(code) { setCountry(code); setTab('scorecard'); }

  const activeTab = TABS.find(t => t.key === tab);
  const isGlobal = !!activeTab?.global;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // cross-country overview — fetched once
  useEffect(() => {
    fetch('/api/markets')
      .then(r => r.json())
      .then(d => { if (!d.error) setMarkets(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/stores?country=${country}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setWeek(d.meta.latestWeek);
        setStore(null);   // store list changes per country
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [country]);

  const weeks = data?.meta.weeks || [];
  const prevWeek = useMemo(() => {
    if (!week) return null;
    const i = weeks.indexOf(week);
    return i > 0 ? weeks[i - 1] : null;
  }, [week, weeks]);

  const countries = data?.meta.countries || ['MA'];

  return (
    <>
      <Head><title>Africa Beauty · Store Performance</title></Head>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b0d] text-gray-900 dark:text-white transition-colors">
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#0b0b0d]/80 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center text-lg">💄</div>
              <div>
                <h1 className="font-black text-base leading-none">Africa Beauty</h1>
                <p className="text-[11px] text-gray-400 leading-none mt-0.5">Store Performance · WoW</p>
              </div>
            </div>

            {/* Country pills — hidden on global (Markets) tab */}
            <div className={cls('items-center gap-1 ml-2 overflow-x-auto', isGlobal ? 'hidden' : 'flex')}>
              {countries.map(c => (
                <button key={c} onClick={() => setCountry(c)}
                  className={cls(
                    'px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors',
                    country === c
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}>
                  {COUNTRY_META[c]?.flag} {c}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Week selector */}
              {week && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 hidden sm:block">Week</span>
                  <select value={week} onChange={e => setWeek(e.target.value)}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-yellow-400 focus:outline-none tabular-nums">
                    {[...weeks].reverse().map(w => (
                      <option key={w} value={w}>{w}{w === data.meta.latestWeek ? ' (latest)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={() => setDark(d => !d)}
                className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {dark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* Tab nav */}
          <div className="max-w-[1400px] mx-auto px-6 flex gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cls(
                  'relative px-4 py-2.5 text-sm font-semibold transition-colors',
                  tab === t.key ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                )}>
                {t.label}
                {tab === t.key && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-yellow-400 rounded-full" />}
              </button>
            ))}
          </div>
        </header>

        {/* Body */}
        <main className="max-w-[1400px] mx-auto px-6 py-6">
          {/* ── Global Markets tab ── */}
          {isGlobal && (
            !markets || !week ? (
              <div className="flex items-center justify-center py-32 text-gray-400">
                <div className="animate-pulse">Loading markets…</div>
              </div>
            ) : (
              <div className="fade-up">
                <div className="mb-5 flex items-baseline gap-2">
                  <h2 className="text-2xl font-black">All markets</h2>
                  <span className="text-sm text-gray-400">{activeTab.desc} · week of {week}</span>
                </div>
                <MarketsTab markets={markets.markets} countries={markets.meta.countries}
                  week={week} weeks={markets.meta.weeks} onOpenMarket={openMarket} />
                <MarketIntel markets={markets.markets} countries={markets.meta.countries}
                  week={week} weeks={markets.meta.weeks} />
              </div>
            )
          )}

          {/* ── Per-country tabs ── */}
          {!isGlobal && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-32 text-gray-400">
                  <div className="animate-pulse">Loading {COUNTRY_META[country]?.name || country}…</div>
                </div>
              )}
              {error && (
                <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl p-6 text-center">
                  Failed to load: {error}
                </div>
              )}
              {!loading && !error && data && week && (
                <div className="fade-up">
                  <div className="mb-5 flex items-baseline gap-2">
                    <h2 className="text-2xl font-black">{COUNTRY_META[country]?.name || country}</h2>
                    <span className="text-sm text-gray-400">
                      {activeTab?.desc} · week of {week}
                      {prevWeek && tab === 'movers' && ` vs ${prevWeek}`}
                    </span>
                  </div>

                  {tab === 'movers'    && <MoversTab    stores={data.stores} week={week} prevWeek={prevWeek} onOpenStore={openStore} />}
                  {tab === 'scorecard' && <ScorecardTab stores={data.stores} week={week} prevWeek={prevWeek} onOpenStore={openStore} />}
                  {tab === 'drilldown' && <DrilldownTab stores={data.stores} week={week} storeName={store} onStoreChange={setStore} />}
                </div>
              )}
            </>
          )}
        </main>

        <footer className="max-w-[1400px] mx-auto px-6 py-6 text-xs text-gray-400 dark:text-gray-600">
          {data && `${data.meta.storeCount} stores · ${data.meta.weeks.length} weeks · updated ${new Date(data.meta.lastUpdated).toLocaleString()}`}
        </footer>
      </div>
    </>
  );
}
