import { useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { cls, fmtEur, fmtNum, fmtPct, fmtMin, wow, DeltaBadge } from './ui';

const CHARTS = [
  { key: 'gmv',         label: 'GMV',           color: '#FFC244', fmt: (v) => fmtEur(v, true), type: 'area' },
  { key: 'orders',      label: 'Orders',        color: '#00A082', fmt: (v) => fmtNum(v, true), type: 'area' },
  { key: 'aov',         label: 'AOV',           color: '#3B82F6', fmt: (v) => fmtEur(v),       type: 'line' },
  { key: 'cancelRate',  label: 'Cancel %',      color: '#f43f5e', fmt: (v) => fmtPct(v),       type: 'line', invert: true },
  { key: 'oosRate',     label: 'Out-of-stock %',color: '#f97316', fmt: (v) => fmtPct(v),       type: 'line', invert: true },
  { key: 'deliveryDur', label: 'Delivery (min)',color: '#8b5cf6', fmt: (v) => fmtMin(v),       type: 'line', invert: true },
];

function KpiStat({ label, value, deltaValue, invert }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">{value}</div>
      <div className="mt-0.5"><DeltaBadge value={deltaValue} invert={invert} /></div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-gray-700">
      <div className="text-gray-400 mb-0.5">{label}</div>
      <div className="font-bold">{fmt(payload[0].value)}</div>
    </div>
  );
}

export default function DrilldownTab({ stores, week, storeName, onStoreChange }) {
  const sorted = useMemo(
    () => [...stores].sort((a, b) => {
      const ga = a.weekly.find(w => w.week === week)?.gmv || 0;
      const gb = b.weekly.find(w => w.week === week)?.gmv || 0;
      return gb - ga;
    }), [stores, week]);

  // default to top store when nothing (or an invalid store) is selected
  useEffect(() => {
    if (sorted.length && !sorted.find(s => s.store === storeName)) {
      onStoreChange(sorted[0].store);
    }
  }, [sorted, storeName, onStoreChange]);

  const store = sorted.find(s => s.store === storeName);
  const data = useMemo(() => (store ? store.weekly.slice(-26) : []), [store]);

  const kpis = useMemo(() => {
    if (!store) return null;
    const last = store.weekly[store.weekly.length - 1];
    const prev = store.weekly[store.weekly.length - 2];
    return { last, prev };
  }, [store]);

  if (!store) return <div className="text-center py-20 text-gray-400">No stores.</div>;

  const { last, prev } = kpis;

  return (
    <div className="space-y-5">
      {/* store picker */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Store</span>
        <select
          value={storeName || ''} onChange={e => onStoreChange(e.target.value)}
          className="px-3.5 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-yellow-400 focus:outline-none text-gray-900 dark:text-white min-w-[240px]">
          {sorted.map(s => <option key={s.store} value={s.store}>{s.store}</option>)}
        </select>
        <span className="text-xs text-gray-400">{store.weekly.length} weeks of history</span>
      </div>

      {/* latest-week KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiStat label="GMV"         value={fmtEur(last.gmv, true)} deltaValue={wow(last.gmv, prev?.gmv)} />
        <KpiStat label="Orders"      value={fmtNum(last.orders)}    deltaValue={wow(last.orders, prev?.orders)} />
        <KpiStat label="AOV"         value={fmtEur(last.aov)}       deltaValue={wow(last.aov, prev?.aov)} />
        <KpiStat label="Cancel %"    value={fmtPct(last.cancelRate)} deltaValue={wow(last.cancelRate, prev?.cancelRate)} invert />
        <KpiStat label="OOS %"       value={fmtPct(last.oosRate)}    deltaValue={wow(last.oosRate, prev?.oosRate)} invert />
        <KpiStat label="Delivery"    value={fmtMin(last.deliveryDur)} deltaValue={wow(last.deliveryDur, prev?.deliveryDur)} invert />
      </div>
      <div className="text-xs text-gray-400 -mt-2">Latest full week: {last.week}</div>

      {/* trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {CHARTS.map(c => (
          <div key={c.key} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">{c.label}</h3>
              <span className="text-xs tabular-nums text-gray-400">latest {c.fmt(last[c.key])}</span>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              {c.type === 'area' ? (
                <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8884" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={Math.ceil(data.length / 6)} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<ChartTooltip fmt={c.fmt} />} />
                  <Area type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} fill={`url(#g-${c.key})`} />
                </AreaChart>
              ) : (
                <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8884" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={Math.ceil(data.length / 6)} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<ChartTooltip fmt={c.fmt} />} />
                  <Line type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
