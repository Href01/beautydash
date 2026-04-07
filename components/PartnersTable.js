import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fmt, fmtPct, trendColor, COUNTRY_META } from '../lib/constants';

const CVR_BENCHMARK = 10;
const MAX_SELECT    = 5;
const STORE_COLORS  = ['#FFC244', '#00A082', '#3B82F6', '#F97316', '#EC4899'];

const METRICS = [
  { key: 'gmv',      label: 'GMV',      fmt: v => fmt(v),              pct: false },
  { key: 'orders',   label: 'Orders',   fmt: v => v?.toLocaleString(), pct: false },
  { key: 'aov',      label: 'AOV',      fmt: v => `€${v?.toFixed(2)}`, pct: false },
  { key: 'sessions', label: 'Sessions', fmt: v => v?.toLocaleString(), pct: false },
  { key: 'cvr',      label: 'CVR %',    fmt: v => `${v?.toFixed(1)}%`, pct: true  },
];

function shortLabel(period) {
  const [y, m] = period.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${y.slice(2)}`;
}

export default function PartnersTable({ byPartnerMonth, cvrByPartnerMonth }) {
  const [selected, setSelected] = useState(new Set());
  const [metric, setMetric]     = useState('cvr');

  if (!byPartnerMonth?.length) return null;

  // ── Aggregate GMV/orders per partner+country ──────────────────
  const map = {};
  byPartnerMonth.forEach(r => {
    const key = `${r.country}__${r.partner}`;
    if (!map[key]) map[key] = { country: r.country, partner: r.partner, gmv: 0, orders: 0, byPeriod: {} };
    map[key].gmv    += r.gmv;
    map[key].orders += r.orders;
    if (!map[key].byPeriod[r.period]) map[key].byPeriod[r.period] = { gmv: 0, orders: 0 };
    map[key].byPeriod[r.period].gmv    += r.gmv;
    map[key].byPeriod[r.period].orders += r.orders;
  });

  // ── Aggregate CVR data per partner+country ────────────────────
  const cvrMap = {};
  (cvrByPartnerMonth || []).forEach(r => {
    const key = `${r.country}__${r.partner}`;
    if (!cvrMap[key]) cvrMap[key] = { sessions: 0, orders_created: 0, byPeriod: {} };
    cvrMap[key].sessions       += r.sessions;
    cvrMap[key].orders_created += r.orders_created;
    cvrMap[key].byPeriod[r.period] = {
      sessions:       r.sessions,
      orders_created: r.orders_created,
      cvr:            r.cvr,
    };
  });

  const partners = Object.values(map).map(p => {
    const periods = Object.keys(p.byPeriod).sort();
    const last    = p.byPeriod[periods[periods.length - 1]];
    const prev    = p.byPeriod[periods[periods.length - 2]];
    const momGMV  = last && prev && prev.gmv > 0
      ? (last.gmv - prev.gmv) / prev.gmv * 100
      : null;

    const key   = `${p.country}__${p.partner}`;
    const cvrd  = cvrMap[key];
    const cvr   = cvrd && cvrd.sessions > 0
      ? cvrd.orders_created / cvrd.sessions * 100
      : null;
    const cvrPeriodCount = cvrd ? Object.keys(cvrd.byPeriod).length : 0;
    const sessions = cvrd && cvrPeriodCount > 0
      ? Math.round(cvrd.sessions / cvrPeriodCount)
      : null;

    let momCVR = null;
    if (cvrd) {
      const cPeriods = Object.keys(cvrd.byPeriod).sort();
      if (cPeriods.length >= 2) {
        const cLast = cvrd.byPeriod[cPeriods[cPeriods.length - 1]];
        const cPrev = cvrd.byPeriod[cPeriods[cPeriods.length - 2]];
        momCVR = Math.round((cLast.cvr - cPrev.cvr) * 100);
      }
    }

    return { country: p.country, partner: p.partner, gmv: p.gmv, orders: p.orders,
      aov: p.orders > 0 ? p.gmv / p.orders : 0, momGMV, cvr, sessions, momCVR };
  }).sort((a, b) => b.gmv - a.gmv);

  const totalGMV = partners.reduce((s, p) => s + p.gmv, 0);
  const hasCVR   = partners.some(p => p.cvr !== null);

  // ── Toggle partner selection ──────────────────────────────────
  function togglePartner(key) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); }
      else if (next.size < MAX_SELECT) { next.add(key); }
      return next;
    });
  }

  // ── Build chart data for selected partners ────────────────────
  const selectedList = [...selected];
  const colorOf      = key => STORE_COLORS[selectedList.indexOf(key) % STORE_COLORS.length];

  const chartData = useMemo(() => {
    if (!selected.size) return [];

    // collect all periods across selected stores
    const periodSet = new Set();
    selected.forEach(key => {
      const [country, ...rest] = key.split('__');
      const partner = rest.join('__');
      const gmvPeriods = Object.keys(map[key]?.byPeriod || {});
      const cvrPeriods = Object.keys(cvrMap[key]?.byPeriod || {});
      [...gmvPeriods, ...cvrPeriods].forEach(p => periodSet.add(p));
    });

    return [...periodSet].sort().map(period => {
      const row = { period, label: shortLabel(period) };
      selected.forEach(key => {
        const gmvEntry = map[key]?.byPeriod[period];
        const cvrEntry = cvrMap[key]?.byPeriod[period];
        row[`${key}__gmv`]      = gmvEntry?.gmv      ?? null;
        row[`${key}__orders`]   = gmvEntry?.orders    ?? null;
        row[`${key}__aov`]      = gmvEntry && gmvEntry.orders > 0
          ? gmvEntry.gmv / gmvEntry.orders : null;
        row[`${key}__sessions`] = cvrEntry?.sessions  ?? null;
        row[`${key}__cvr`]      = cvrEntry?.cvr       ?? null;
      });
      return row;
    });
  }, [selected, metric, byPartnerMonth, cvrByPartnerMonth]);

  const activeMetric = METRICS.find(m => m.key === metric);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Top Partners</h2>
          <p className="text-xs text-gray-400 mt-0.5">Retail · selected countries & period · ranked by GMV · Sessions & CVR averaged per month</p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 ? (
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Clear selection ({selected.size})
            </button>
          ) : (
            <span className="text-xs text-gray-400 italic">
              Click up to {MAX_SELECT} rows to compare trends
            </span>
          )}
          {hasCVR && (
            <span className="text-xs text-gray-400">
              CVR benchmark: <span className="font-bold text-gray-600 dark:text-gray-300">{CVR_BENCHMARK}%</span>
            </span>
          )}
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {partners.length} partners
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3 text-left w-8"></th>
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">Partner</th>
              <th className="px-4 py-3 text-left">Country</th>
              <th className="px-4 py-3 text-right">GMV</th>
              <th className="px-4 py-3 text-right">% Total</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">AOV</th>
              <th className="px-4 py-3 text-right">GMV MoM</th>
              {hasCVR && <th className="px-4 py-3 text-right">Avg Sessions/mo</th>}
              {hasCVR && <th className="px-4 py-3 text-right">CVR</th>}
              {hasCVR && <th className="px-4 py-3 text-right">CVR Δ bps</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {partners.map((p, i) => {
              const key      = `${p.country}__${p.partner}`;
              const isSelected = selected.has(key);
              const selIdx   = selectedList.indexOf(key);
              const color    = isSelected ? colorOf(key) : null;
              const meta     = COUNTRY_META[p.country] || {};
              const gmvPct   = totalGMV > 0 ? p.gmv / totalGMV * 100 : 0;
              const cvrGood  = p.cvr !== null && p.cvr >= CVR_BENCHMARK;
              const cvrColor = p.cvr === null ? '' : cvrGood ? 'text-green-500' : 'text-red-400';
              const canSelect = !isSelected && selected.size >= MAX_SELECT;

              return (
                <tr
                  key={key}
                  onClick={() => togglePartner(key)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-gray-50 dark:bg-gray-700/50'
                      : canSelect
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                  }`}
                >
                  {/* Checkbox / color swatch */}
                  <td className="px-4 py-3">
                    {isSelected ? (
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ background: color }}
                      />
                    ) : (
                      <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-300 dark:text-gray-600">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                    {p.partner}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span>{meta.flag || '🌍'}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{p.country}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{fmt(p.gmv)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(gmvPct, 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">
                        {gmvPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.orders.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-200">€{p.aov.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.momGMV !== null
                      ? <span className={`text-xs font-bold ${trendColor(p.momGMV)}`}>{fmtPct(p.momGMV)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  {hasCVR && (
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {p.sessions !== null ? p.sessions.toLocaleString() : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {hasCVR && (
                    <td className="px-4 py-3 text-right">
                      {p.cvr !== null
                        ? <span className={`text-xs font-bold ${cvrColor}`}>{p.cvr.toFixed(1)}%</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {hasCVR && (
                    <td className="px-4 py-3 text-right">
                      {p.momCVR !== null
                        ? <span className={`text-xs font-bold ${trendColor(p.momCVR)}`}>{p.momCVR > 0 ? '+' : ''}{p.momCVR} bps</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Comparison Chart ── */}
      {selected.size > 0 && chartData.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-6">
          {/* metric toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedList.map(key => {
                const partner = key.split('__').slice(1).join('__');
                return (
                  <span
                    key={key}
                    className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                    style={{ background: colorOf(key) + '22', color: colorOf(key) }}
                  >
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorOf(key) }} />
                    {partner}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-1">
              {METRICS.filter(m => m.key !== 'sessions' || hasCVR).filter(m => m.key !== 'cvr' || hasCVR).map(m => (
                <button
                  key={m.key}
                  onClick={e => { e.stopPropagation(); setMetric(m.key); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    metric === m.key
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={v => activeMetric.fmt(v)}
                width={60}
              />
              <Tooltip
                formatter={(value, name) => {
                  const partner = name.replace(`__${metric}`, '').split('__').slice(1).join('__');
                  return [activeMetric.fmt(value), partner];
                }}
                labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              {metric === 'cvr' && (
                <ReferenceLine y={CVR_BENCHMARK} stroke="#ef4444" strokeDasharray="4 4"
                  label={{ value: '10% target', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              )}
              {selectedList.map(key => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={`${key}__${metric}`}
                  stroke={colorOf(key)}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colorOf(key) }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
