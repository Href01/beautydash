import { useMemo } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, CartesianGrid, ReferenceLine, ReferenceArea, Label,
} from 'recharts';
import { cls, fmtEur, fmtNum, fmtPct, fmtMin, COUNTRY_META } from './ui';

const WINDOW = 12;  // weeks for growth window

function recAt(series, week) { return series.find(w => w.week === week); }

// ── Panel 1: Growth × Size quadrant ───────────────────────────
function QuadrantTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-gray-700">
      <div className="font-black mb-1" style={{ color: p.color }}>{COUNTRY_META[p.code]?.name || p.code}</div>
      <div className="space-y-0.5 tabular-nums">
        <div>GMV <b>{fmtEur(p.x)}</b></div>
        <div>{WINDOW}w growth <b className={p.y >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{p.y >= 0 ? '+' : ''}{p.y.toFixed(0)}%</b></div>
        <div>Active stores <b>{p.z}</b></div>
      </div>
    </div>
  );
}

function Quadrant({ rows }) {
  const data = rows.filter(r => r.curr && r.growth != null)
    .map(r => ({ code: r.code, x: r.curr.gmv, y: r.growth, z: r.curr.stores,
                 color: COUNTRY_META[r.code]?.color || '#999' }));

  // axis bounds (padded) so the growing / shrinking zones fill the plot
  const xs = data.map(d => d.x), ys = data.map(d => d.y);
  const xMin = Math.min(...xs) * 0.6, xMax = Math.max(...xs) * 1.6;
  const yPad = Math.max(10, Math.max(...ys.map(Math.abs)) * 0.25);
  const yMax = Math.max(...ys) + yPad, yMin = Math.min(...ys, 0) - yPad;

  const Dot = (props) => {
    const { cx, cy, payload } = props;
    const r = Math.max(8, Math.min(30, Math.sqrt(payload.z) * 2));
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={payload.color} fillOpacity={0.22} stroke={payload.color} strokeWidth={2} />
        <text x={cx} y={cy} dy={4} textAnchor="middle" fontSize={11} fontWeight={800} fill={payload.color}>{payload.code}</text>
      </g>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-black text-gray-900 dark:text-white">Growth × Size</h3>
          <p className="text-xs text-gray-400">Where each market sits: size, momentum & partner base</p>
        </div>
        {/* bubble-size legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 shrink-0 pt-1">
          <span className="inline-block w-2 h-2 rounded-full border border-gray-400" />
          <span className="inline-block w-3.5 h-3.5 rounded-full border border-gray-400" />
          <span>= stores</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, left: 6, bottom: 18 }}>
          {/* growing (green) vs shrinking (red) zones */}
          <ReferenceArea y1={0} y2={yMax} x1={xMin} x2={xMax} fill="#10b981" fillOpacity={0.05} />
          <ReferenceArea y1={yMin} y2={0} x1={xMin} x2={xMax} fill="#f43f5e" fillOpacity={0.05} />
          <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
          <XAxis type="number" dataKey="x" name="GMV" scale="log" domain={[xMin, xMax]}
            tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => fmtEur(v, true)}
            tickLine={false} axisLine={false}>
            <Label value="Market size — weekly GMV (log)" position="bottom" offset={4}
              style={{ fontSize: 10, fill: '#9ca3af', fontWeight: 700 }} />
          </XAxis>
          <YAxis type="number" dataKey="y" name="Growth" domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => v + '%'}
            tickLine={false} axisLine={false}>
            <Label value={`${WINDOW}w growth`} angle={-90} position="insideLeft" offset={16}
              style={{ fontSize: 10, fill: '#9ca3af', fontWeight: 700, textAnchor: 'middle' }} />
          </YAxis>
          <ZAxis type="number" dataKey="z" range={[60, 600]} />
          <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<QuadrantTooltip />} />
          <Scatter data={data} shape={<Dot />} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-[10px] font-semibold mt-1">
        <span className="text-emerald-600 dark:text-emerald-400">▲ above line = growing</span>
        <span className="text-rose-500">below line = shrinking ▼</span>
      </div>
    </div>
  );
}

// ── Panel 2: Fragility (concentration) ────────────────────────
function Fragility({ rows }) {
  const data = [...rows].filter(r => r.curr).sort((a, b) => b.curr.top3Share - a.curr.top3Share);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
      <h3 className="font-black text-gray-900 dark:text-white">Fragility</h3>
      <p className="text-xs text-gray-400 mb-3">Top-3 store GMV share · &gt;70% = dependent on a few partners</p>
      <div className="space-y-2.5">
        {data.map(r => {
          const v = r.curr.top3Share;
          const fragile = v >= 70;
          const color = COUNTRY_META[r.code]?.color || '#999';
          return (
            <div key={r.code} className="flex items-center gap-3">
              <span className="w-7 text-sm font-bold text-gray-700 dark:text-gray-300">{r.code}</span>
              <div className="flex-1 h-5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                <div className="h-full rounded-full" style={{ width: `${v}%`, background: color, opacity: fragile ? 1 : 0.55 }} />
                <span className="absolute inset-0 flex items-center px-2 text-[11px] font-bold tabular-nums text-gray-700 dark:text-gray-200">
                  {fmtPct(v, 0)}
                </span>
              </div>
              <span className="w-16 text-right text-[11px] text-gray-400 tabular-nums">HHI {r.curr.hhi}</span>
              {fragile && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">FRAGILE</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel 3: Store base health (new vs churned) ───────────────
function StoreHealth({ rows }) {
  const data = [...rows].filter(r => r.curr).sort((a, b) => b.curr.stores - a.curr.stores);
  const maxFlow = Math.max(1, ...data.map(r => Math.max(r.curr.newStores, r.curr.churnedStores)));
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
      <h3 className="font-black text-gray-900 dark:text-white">Store base health</h3>
      <p className="text-xs text-gray-400 mb-3">New vs churned this week · net = base momentum</p>
      <div className="space-y-2.5">
        {data.map(r => {
          const { newStores: nw, churnedStores: ch, stores } = r.curr;
          const net = nw - ch;
          return (
            <div key={r.code} className="flex items-center gap-2 text-sm">
              <span className="w-7 font-bold text-gray-700 dark:text-gray-300">{r.code}</span>
              <span className="w-10 text-xs text-gray-400 tabular-nums">{stores}</span>
              {/* churned (left) */}
              <div className="flex-1 flex justify-end">
                <div className="h-4 rounded-l bg-rose-400/80" style={{ width: `${ch / maxFlow * 100}%` }} />
              </div>
              <span className="w-6 text-center text-[11px] font-bold tabular-nums text-gray-400">{ch ? `−${ch}` : '0'}</span>
              {/* new (right) */}
              <div className="flex-1 flex justify-start">
                <div className="h-4 rounded-r bg-emerald-500/80" style={{ width: `${nw / maxFlow * 100}%` }} />
              </div>
              <span className="w-6 text-[11px] font-bold tabular-nums text-gray-400">{nw ? `+${nw}` : '0'}</span>
              <span className={cls('w-10 text-right text-xs font-bold tabular-nums',
                net > 0 ? 'text-emerald-600 dark:text-emerald-400' : net < 0 ? 'text-rose-500' : 'text-gray-400')}>
                {net > 0 ? '+' : ''}{net}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-3 px-9">
        <span>← churned</span><span>net</span><span>new →</span>
      </div>
    </div>
  );
}

// ── Panel 4: Ops quality comparison ───────────────────────────
const OPS = [
  { key: 'cancelRate',  label: 'Cancel %',  fmt: (v) => fmtPct(v), warn: 8 },
  { key: 'oosRate',     label: 'OOS %',     fmt: (v) => fmtPct(v), warn: 6 },
  { key: 'negRate',     label: 'Neg %',     fmt: (v) => fmtPct(v), warn: 12 },
  { key: 'deliveryDur', label: 'Delivery',  fmt: (v) => fmtMin(v), warn: 35 },
];
function OpsQuality({ rows }) {
  const data = [...rows].filter(r => r.curr).sort((a, b) => b.curr.gmv - a.curr.gmv);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 lg:col-span-2">
      <h3 className="font-black text-gray-900 dark:text-white">Ops quality by market</h3>
      <p className="text-xs text-gray-400 mb-3">Red = above warning threshold · friction that suppresses demand</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-2 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">Market</th>
              <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">GMV</th>
              {OPS.map(o => <th key={o.key} className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">{o.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.code} className="border-b border-gray-50 dark:border-gray-800/50">
                <td className="px-2 py-2 font-semibold text-gray-900 dark:text-white">
                  {COUNTRY_META[r.code]?.flag} {r.code}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtEur(r.curr.gmv, true)}</td>
                {OPS.map(o => {
                  const v = r.curr[o.key];
                  const bad = v >= o.warn;
                  return (
                    <td key={o.key} className={cls('px-3 py-2 text-right tabular-nums',
                      bad ? 'text-rose-500 dark:text-rose-400 font-bold' : 'text-gray-700 dark:text-gray-300')}>
                      {o.fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MarketIntel({ markets, countries, week, weeks }) {
  const rows = useMemo(() => {
    const wi = weeks.indexOf(week);
    const baseWeek = wi >= WINDOW ? weeks[wi - WINDOW] : weeks[0];
    return countries.map(c => {
      const series = markets[c] || [];
      const curr = recAt(series, week);
      const base = recAt(series, baseWeek);
      const growth = base && base.gmv > 0 && curr ? (curr.gmv - base.gmv) / base.gmv * 100 : null;
      return { code: c, curr, growth };
    });
  }, [markets, countries, week, weeks]);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-black text-gray-900 dark:text-white">Market Intelligence</h2>
        <span className="text-xs text-gray-400">why each market behaves the way it does</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Quadrant rows={rows} />
        <Fragility rows={rows} />
        <StoreHealth rows={rows} />
        <OpsQuality rows={rows} />
      </div>
    </div>
  );
}
