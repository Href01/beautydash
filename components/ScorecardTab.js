import { useState, useMemo } from 'react';
import { cls, fmtEur, fmtNum, fmtPct, fmtMin, wow, DeltaBadge, Sparkline } from './ui';

// Column definitions. `invert` = lower is better (rates, durations).
const COLS = [
  { key: 'gmv',         label: 'GMV',        fmt: (v) => fmtEur(v),       align: 'right', wow: true },
  { key: 'orders',      label: 'Orders',     fmt: (v) => fmtNum(v),       align: 'right', wow: true },
  { key: 'aov',         label: 'AOV',        fmt: (v) => fmtEur(v),       align: 'right' },
  { key: 'cancelRate',  label: 'Cancel %',   fmt: (v) => fmtPct(v),       align: 'right', invert: true, warn: 8 },
  { key: 'oosRate',     label: 'OOS %',      fmt: (v) => fmtPct(v),       align: 'right', invert: true, warn: 10 },
  { key: 'negRate',     label: 'Neg %',      fmt: (v) => fmtPct(v),       align: 'right', invert: true, warn: 12 },
  { key: 'deliveryDur', label: 'Delivery',   fmt: (v) => fmtMin(v),       align: 'right', invert: true, warn: 40 },
];

function rec(store, week) { return store.weekly.find(w => w.week === week); }

export default function ScorecardTab({ stores, week, prevWeek, onOpenStore }) {
  const [sort, setSort]   = useState({ key: 'gmv', dir: 'desc' });
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const out = [];
    stores.forEach(s => {
      const r = rec(s, week);
      if (!r || (r.gmv === 0 && r.orders === 0)) return;
      const p = prevWeek ? rec(s, prevWeek) : null;
      // GMV trend over the last 12 weeks up to & including the selected week
      const wi = s.weekly.findIndex(w => w.week === week);
      const spark = (wi >= 0 ? s.weekly.slice(Math.max(0, wi - 11), wi + 1) : []).map(w => w.gmv);
      out.push({
        store: s.store,
        ...r,
        spark,
        gmvWow:    p ? wow(r.gmv, p.gmv) : null,
        ordersWow: p ? wow(r.orders, p.orders) : null,
      });
    });
    const q = query.trim().toLowerCase();
    const filtered = q ? out.filter(r => r.store.toLowerCase().includes(q)) : out;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return filtered.sort((a, b) => (a[sort.key] > b[sort.key] ? dir : a[sort.key] < b[sort.key] ? -dir : 0));
  }, [stores, week, prevWeek, sort, query]);

  const totals = useMemo(() => {
    const gmv = rows.reduce((s, r) => s + r.gmv, 0);
    const orders = rows.reduce((s, r) => s + r.orders, 0);
    return { gmv, orders, aov: orders ? gmv / orders : 0, count: rows.length };
  }, [rows]);

  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  function cellColor(col, v) {
    if (!col.warn) return '';
    return v >= col.warn ? 'text-rose-500 dark:text-rose-400 font-bold' : 'text-gray-700 dark:text-gray-300';
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400"><b className="text-gray-900 dark:text-white">{totals.count}</b> stores</span>
          <span className="text-gray-400">GMV <b className="text-gray-900 dark:text-white">{fmtEur(totals.gmv, true)}</b></span>
          <span className="text-gray-400">Orders <b className="text-gray-900 dark:text-white">{fmtNum(totals.orders, true)}</b></span>
          <span className="text-gray-400">AOV <b className="text-gray-900 dark:text-white">{fmtEur(totals.aov)}</b></span>
        </div>
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search store…"
          className="px-3.5 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-yellow-400 focus:outline-none text-gray-900 dark:text-white w-48"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 w-8">#</th>
                <th className="text-left px-2 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Store</th>
                {COLS.map(c => (
                  <th key={c.key} onClick={() => toggleSort(c.key)}
                    className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 text-right cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap">
                    {c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 text-right whitespace-nowrap">12w GMV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.store} onClick={() => onOpenStore?.(r.store)}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-yellow-50/50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer group">
                  <td className="px-4 py-2.5 text-gray-300 dark:text-gray-600 tabular-nums text-xs">{i + 1}</td>
                  <td className="px-2 py-2.5 font-semibold text-gray-900 dark:text-white whitespace-nowrap group-hover:text-yellow-600 dark:group-hover:text-yellow-400">{r.store}</td>
                  {COLS.map(c => (
                    <td key={c.key} className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      <div className={cls('flex items-center justify-end gap-1.5', cellColor(c, r[c.key]) || 'text-gray-700 dark:text-gray-300')}>
                        <span>{c.fmt(r[c.key])}</span>
                        {c.wow && (
                          <span className="w-12 text-left">
                            <DeltaBadge value={c.key === 'gmv' ? r.gmvWow : r.ordersWow} />
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end">
                      <Sparkline data={r.spark} w={88} h={24}
                        color={r.spark.length > 1 && r.spark[r.spark.length - 1] >= r.spark[0] ? '#10b981' : '#f43f5e'} />
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={COLS.length + 3} className="px-4 py-12 text-center text-gray-400">No stores match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
