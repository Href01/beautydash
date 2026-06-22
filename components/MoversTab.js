import { useState, useMemo, useEffect } from 'react';
import { cls, fmtEur, fmtNum, DeltaBadge, Sparkline } from './ui';

const METRICS = [
  { key: 'gmv',    label: 'GMV',    fmt: (v) => fmtEur(v, true) },
  { key: 'orders', label: 'Orders', fmt: (v) => fmtNum(v, true) },
  { key: 'aov',    label: 'AOV',    fmt: (v) => fmtEur(v) },
];

const CAP = 12;  // collapsed list length

// One store's value for a given week (or null if not active that week).
function valueAt(store, week, metric) {
  const rec = store.weekly.find(w => w.week === week);
  return rec ? rec[metric] : null;
}

function MoverRow({ s, fmt, rank, onOpenStore }) {
  return (
    <div onClick={() => onOpenStore?.(s.store)}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-yellow-50/50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer">
      <span className="w-5 text-xs font-bold text-gray-300 dark:text-gray-600 tabular-nums">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{s.store}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          {fmt(s.prev)} → {fmt(s.curr)}
        </div>
      </div>
      <Sparkline data={s.spark} w={64} h={22} color={s.delta >= 0 ? '#10b981' : '#f43f5e'} />
      <div className="w-16 text-right">
        <DeltaBadge value={s.delta} />
      </div>
    </div>
  );
}

export default function MoversTab({ stores, week, prevWeek, onOpenStore }) {
  const [metric, setMetric] = useState('gmv');
  const [showAllRisers, setShowAllRisers]   = useState(false);
  const [showAllFallers, setShowAllFallers] = useState(false);
  const m = METRICS.find(x => x.key === metric);

  // collapse back to Top 12 whenever the metric or week changes
  useEffect(() => { setShowAllRisers(false); setShowAllFallers(false); }, [metric, week, prevWeek]);

  const { risers, fallers, fresh, churned } = useMemo(() => {
    const rows = [];
    const fresh = [], churned = [];

    stores.forEach(s => {
      const curr = valueAt(s, week, metric);
      const prev = prevWeek ? valueAt(s, prevWeek, metric) : null;
      const spark = s.weekly.slice(-8).map(w => w[metric]);

      if ((curr == null || curr === 0) && prev > 0) {
        churned.push({ store: s.store, prev });
        return;
      }
      if (curr > 0 && (prev == null || prev === 0)) {
        fresh.push({ store: s.store, curr });
        return;
      }
      if (curr == null || prev == null || prev === 0) return;

      const delta = (curr - prev) / prev * 100;
      rows.push({ store: s.store, curr, prev, delta, spark });
    });

    const sorted = [...rows].sort((a, b) => b.delta - a.delta);
    return {
      risers:  sorted.filter(r => r.delta > 0),
      fallers: sorted.filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta),
      fresh:   fresh.sort((a, b) => b.curr - a.curr),
      churned: churned.sort((a, b) => b.prev - a.prev),
    };
  }, [stores, week, prevWeek, metric]);

  if (!prevWeek) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500">
        No prior week to compare against. Pick a later week.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* metric toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mr-1">Rank by</span>
        {METRICS.map(x => (
          <button key={x.key} onClick={() => setMetric(x.key)}
            className={cls(
              'px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors',
              metric === x.key
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Risers */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <div className="flex items-center gap-2 px-2 mb-2">
            <span className="text-emerald-500 text-lg">▲</span>
            <h3 className="font-black text-gray-900 dark:text-white">Top Risers</h3>
            <span className="text-xs text-gray-400">WoW {m.label}</span>
          </div>
          {risers.length ? (showAllRisers ? risers : risers.slice(0, CAP)).map((s, i) => <MoverRow key={s.store} s={s} fmt={m.fmt} rank={i + 1} onOpenStore={onOpenStore} />)
            : <div className="px-4 py-8 text-center text-sm text-gray-400">No risers this week</div>}
          {risers.length > CAP && (
            <button onClick={() => setShowAllRisers(v => !v)}
              className="w-full mt-1 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              {showAllRisers ? 'Show less' : `Show all ${risers.length}`}
            </button>
          )}
        </div>

        {/* Fallers */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <div className="flex items-center gap-2 px-2 mb-2">
            <span className="text-rose-500 text-lg">▼</span>
            <h3 className="font-black text-gray-900 dark:text-white">Top Fallers</h3>
            <span className="text-xs text-gray-400">WoW {m.label}</span>
          </div>
          {fallers.length ? (showAllFallers ? fallers : fallers.slice(0, CAP)).map((s, i) => <MoverRow key={s.store} s={s} fmt={m.fmt} rank={i + 1} onOpenStore={onOpenStore} />)
            : <div className="px-4 py-8 text-center text-sm text-gray-400">No fallers this week</div>}
          {fallers.length > CAP && (
            <button onClick={() => setShowAllFallers(v => !v)}
              className="w-full mt-1 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              {showAllFallers ? 'Show less' : `Show all ${fallers.length}`}
            </button>
          )}
        </div>
      </div>

      {/* New + churned strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 px-2">
            New / Returning ({fresh.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {fresh.length ? fresh.slice(0, 20).map(s => (
              <span key={s.store} className="text-xs bg-white dark:bg-gray-900 px-2.5 py-1 rounded-lg text-gray-700 dark:text-gray-300 border border-emerald-100 dark:border-emerald-900/40">
                {s.store} · {m.fmt(s.curr)}
              </span>
            )) : <span className="text-sm text-gray-400 px-2">None</span>}
          </div>
        </div>
        <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-2 px-2">
            Went Silent ({churned.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {churned.length ? churned.slice(0, 20).map(s => (
              <span key={s.store} className="text-xs bg-white dark:bg-gray-900 px-2.5 py-1 rounded-lg text-gray-700 dark:text-gray-300 border border-rose-100 dark:border-rose-900/40">
                {s.store} · was {m.fmt(s.prev)}
              </span>
            )) : <span className="text-sm text-gray-400 px-2">None</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
