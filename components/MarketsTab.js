import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { cls, fmtEur, fmtNum, fmtPct, fmtMin, wow, DeltaBadge, Sparkline, COUNTRY_META } from './ui';

const TREND_METRICS = [
  { key: 'gmv',    label: 'GMV',    fmt: (v) => fmtEur(v, true) },
  { key: 'orders', label: 'Orders', fmt: (v) => fmtNum(v, true) },
  { key: 'aov',    label: 'AOV',    fmt: (v) => fmtEur(v) },
  { key: 'stores', label: 'Active stores', fmt: (v) => fmtNum(v) },
];

function recAt(series, week) { return series.find(w => w.week === week); }

function MarketCard({ code, curr, prev, share, spark, onClick }) {
  const meta = COUNTRY_META[code] || { name: code, flag: '', color: '#999' };
  return (
    <button onClick={onClick}
      className="text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.flag}</span>
          <span className="font-black text-gray-900 dark:text-white">{meta.name}</span>
        </div>
        <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
          style={{ background: meta.color + '22', color: meta.color }}>
          {fmtPct(share, 0)}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
            {fmtEur(curr?.gmv || 0, true)}
          </div>
          <div className="mt-1"><DeltaBadge value={prev ? wow(curr?.gmv, prev.gmv) : null} /></div>
        </div>
        <Sparkline data={spark} w={84} h={30} color={meta.color} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
        <Mini label="Orders" value={fmtNum(curr?.orders || 0, true)} />
        <Mini label="AOV"    value={fmtEur(curr?.aov || 0)} />
        <Mini label="Stores" value={fmtNum(curr?.stores || 0)} />
      </div>
    </button>
  );
}

function Mini({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">{value}</div>
    </div>
  );
}

const SCALES = [
  { key: 'abs',   label: 'Absolute', hint: 'real values' },
  { key: 'log',   label: 'Log',      hint: 'compress the gap MA↔CI' },
  { key: 'index', label: 'Index 100', hint: 'compare growth shape, ignore size' },
];

export default function MarketsTab({ markets, countries, week, weeks, onOpenMarket }) {
  const [metric, setMetric] = useState('gmv');
  const [scale, setScale]   = useState('abs');
  const [hidden, setHidden] = useState({});   // { country: true } to hide a line
  const m = TREND_METRICS.find(x => x.key === metric);

  function toggleCountry(c) {
    setHidden(h => ({ ...h, [c]: !h[c] }));
  }

  const prevWeek = useMemo(() => {
    const i = weeks.indexOf(week);
    return i > 0 ? weeks[i - 1] : null;
  }, [weeks, week]);

  // per-country snapshot for the selected week + GMV share
  const cards = useMemo(() => {
    const rows = countries.map(c => {
      const series = markets[c] || [];
      const curr = recAt(series, week);
      const prev = prevWeek ? recAt(series, prevWeek) : null;
      const wi = series.findIndex(w => w.week === week);
      const spark = (wi >= 0 ? series.slice(Math.max(0, wi - 11), wi + 1) : []).map(w => w.gmv);
      return { code: c, curr, prev, spark, gmv: curr?.gmv || 0 };
    });
    const total = rows.reduce((s, r) => s + r.gmv, 0) || 1;
    rows.forEach(r => { r.share = r.gmv / total * 100; });
    return rows.sort((a, b) => b.gmv - a.gmv);
  }, [markets, countries, week, prevWeek]);

  const totalGmv = cards.reduce((s, r) => s + r.gmv, 0);

  // merged trend series: one row per week, a key per country, last 26 weeks
  const trend = useMemo(() => {
    const byWeek = {};
    countries.forEach(c => (markets[c] || []).forEach(r => {
      (byWeek[r.week] = byWeek[r.week] || { week: r.week })[c] = r[metric];
    }));
    let rows = Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week)).slice(-26);

    if (scale === 'index') {
      // rebase each country to 100 at its first value in the window
      const base = {};
      countries.forEach(c => {
        const first = rows.find(r => r[c] != null && r[c] > 0);
        if (first) base[c] = first[c];
      });
      rows = rows.map(r => {
        const o = { week: r.week };
        countries.forEach(c => { if (r[c] != null && base[c]) o[c] = r[c] / base[c] * 100; });
        return o;
      });
    } else if (scale === 'log') {
      // log can't plot 0 → drop zeros so the line breaks cleanly
      rows = rows.map(r => {
        const o = { week: r.week };
        countries.forEach(c => { if (r[c] != null && r[c] > 0) o[c] = r[c]; });
        return o;
      });
    }
    return rows;
  }, [markets, countries, metric, scale]);

  const fmtY = scale === 'index'
    ? (v) => Math.round(v)
    : (v) => metric === 'gmv' || metric === 'aov' ? fmtEur(v, true) : fmtNum(v, true);

  return (
    <div className="space-y-6">
      {/* market-share bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">GMV share · week of {week}</span>
          <span className="text-xs text-gray-400">total {fmtEur(totalGmv, true)}</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {cards.filter(c => c.gmv > 0).map(c => (
            <div key={c.code} title={`${c.code} ${fmtPct(c.share, 0)}`}
              style={{ width: `${c.share}%`, background: COUNTRY_META[c.code]?.color || '#999' }} />
          ))}
        </div>
      </div>

      {/* market cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <MarketCard key={c.code} {...c} onClick={() => onOpenMarket?.(c.code)} />
        ))}
      </div>

      {/* multi-market trend */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h3 className="font-black text-gray-900 dark:text-white">Trend by market</h3>
            <p className="text-xs text-gray-400">{SCALES.find(s => s.key === scale)?.hint} · click a market to isolate</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TREND_METRICS.map(x => (
              <button key={x.key} onClick={() => setMetric(x.key)}
                className={cls('px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  metric === x.key
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700')}>
                {x.label}
              </button>
            ))}
          </div>
        </div>

        {/* scale toggle + custom clickable legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
            {SCALES.map(s => (
              <button key={s.key} onClick={() => setScale(s.key)}
                className={cls('px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                  scale === s.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {countries.map(c => {
              const off = hidden[c];
              const color = COUNTRY_META[c]?.color || '#999';
              return (
                <button key={c} onClick={() => toggleCountry(c)}
                  className={cls('flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-opacity',
                    off ? 'opacity-35' : 'opacity-100', 'hover:bg-gray-100 dark:hover:bg-gray-800')}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className={cls('text-gray-700 dark:text-gray-300', off && 'line-through')}>{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={trend} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#8884" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={Math.ceil(trend.length / 8)} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={52}
              scale={scale === 'log' ? 'log' : 'auto'} domain={scale === 'log' ? ['auto', 'auto'] : undefined}
              allowDataOverflow={scale === 'log'} tickFormatter={fmtY} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v, name) => [scale === 'index' ? Math.round(v) + ' (idx)' : m.fmt(v), name]} />
            {scale === 'index' && <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="5 4" />}
            {countries.map(c => {
              const color = COUNTRY_META[c]?.color || '#999';
              // dots with labels at first / middle / last
              const CustomDot = (props) => {
                const { cx, cy, index, value } = props;
                const len = trend.length;
                const show = index === 0 || index === Math.floor(len / 2) || index === len - 1;
                if (!show || value == null) return null;
                const label = scale === 'index' ? Math.round(value) : fmtY(value);
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
                    <text x={cx} y={cy - 9} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>{label}</text>
                  </g>
                );
              };
              return (
                <Line key={c} type="monotone" dataKey={c} name={c} hide={!!hidden[c]}
                  stroke={color} strokeWidth={2.25}
                  dot={<CustomDot />} activeDot={{ r: 4 }} connectNulls />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
