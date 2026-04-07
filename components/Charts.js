import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fmt, COUNTRY_META, VERTICAL_COLORS } from '../lib/constants';

// ── Shared Tooltip ─────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, isPctChart }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-xl text-xs min-w-[140px]">
      <p className="font-bold text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      {payload.map((entry, i) => {
        const isPct     = isPctChart || entry.unit === '%';
        const val       = entry.value;
        const formatted = isPct
          ? val === null || val === undefined ? '—' : `${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(1)}%`
          : fmt(val || 0);
        return (
          <div key={i} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
              <span className="text-gray-500 dark:text-gray-400">{entry.name}</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white">{formatted}</span>
          </div>
        );
      })}
    </div>
  );
};

const PctTooltip = (props) => <ChartTooltip {...props} isPctChart={true} />;
const axisStyle  = { fontSize: 11, fill: '#9CA3AF' };
const gridStyle  = { strokeDasharray: '3 3', stroke: '#374151', opacity: 0.25 };

// ── GMV Trend by Country ───────────────────────────────────────
export function GMVTrendChart({ byCountryMonth, selectedCountries, filterLabel }) {
  const map = {};
  byCountryMonth.forEach(r => {
    if (!selectedCountries.includes(r.country)) return;
    if (!map[r.period]) map[r.period] = { period: r.period };
    map[r.period][r.country] = r.gmv;
  });
  const data = Object.values(map).sort((a, b) => a.period.localeCompare(b.period));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-gray-900 dark:text-white mb-0.5">GMV Trend by Country</h3>
      <p className="text-xs text-gray-400 mb-5">{filterLabel || 'Monthly beauty GMV · selected vertical'}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmt} tick={axisStyle} tickLine={false} axisLine={false} width={65} />
          <Tooltip content={<ChartTooltip />} />
          <Legend formatter={v => `${COUNTRY_META[v]?.flag || ''} ${v}`} wrapperStyle={{ fontSize: 12 }} />
          {selectedCountries.map(c => (
            <Line key={c} type="monotone" dataKey={c} name={c}
              stroke={COUNTRY_META[c]?.color} strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Monthly Total GMV ──────────────────────────────────────────
export function MonthlyTotalChart({ monthlyTotal, filterLabel }) {
  const data = monthlyTotal.map(m => ({ period: m.period, GMV: m.gmv }));
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-gray-900 dark:text-white mb-0.5">Total Monthly GMV</h3>
      <p className="text-xs text-gray-400 mb-5">{filterLabel || 'All countries combined · selected vertical'}</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmt} tick={axisStyle} tickLine={false} axisLine={false} width={65} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="GMV" fill="#FFC244" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Country Share Chart ────────────────────────────────────────
export function CountryShareChart({ byCountry }) {
  const data = [...byCountry].sort((a, b) => b.gmv - a.gmv).map(c => ({
    name: `${COUNTRY_META[c.country]?.flag || ''} ${c.country}`,
    GMV:  c.gmv,
  }));
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-gray-900 dark:text-white mb-0.5">GMV by Country</h3>
      <p className="text-xs text-gray-400 mb-5">Total GMV · selected vertical + period</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 70, left: 10, bottom: 5 }}>
          <CartesianGrid {...gridStyle} horizontal={false} />
          <XAxis type="number" tickFormatter={fmt} tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 13 }} tickLine={false} axisLine={false} width={55} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="GMV" fill="#00A082" radius={[0, 6, 6, 0]}
            label={{ position: 'right', formatter: v => fmt(v), fontSize: 11, fill: '#9CA3AF' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Evolution Chart (MoM GMV%, Orders%, AOV trend) ────────────
const METRICS = [
  { key: 'gmv',    label: 'GMV %',    isPct: true  },
  { key: 'orders', label: 'Orders %', isPct: true  },
  { key: 'aov',    label: 'AOV',      isPct: false },
];

export function EvolutionChart({ byCountryMonth, selectedCountries, filterLabel }) {
  const [metric, setMetric] = useState('gmv');
  const isPct = METRICS.find(m => m.key === metric)?.isPct;

  const periods = [...new Set(byCountryMonth.map(r => r.period))].sort();

  // Per-country sorted rows for fast lookup
  const rowsByCountry = {};
  selectedCountries.forEach(c => {
    rowsByCountry[c] = byCountryMonth
      .filter(r => r.country === c)
      .sort((a, b) => a.period.localeCompare(b.period));
  });

  const data = periods.map((period, i) => {
    const point = { period };
    const prevPeriod = periods[i - 1];
    selectedCountries.forEach(c => {
      const cur  = rowsByCountry[c].find(r => r.period === period);
      const prev = prevPeriod ? rowsByCountry[c].find(r => r.period === prevPeriod) : null;
      if (metric === 'aov') {
        point[c] = cur?.aov ?? null;
      } else {
        const curVal  = cur?.[metric] ?? null;
        const prevVal = prev?.[metric] ?? null;
        point[c] = curVal !== null && prevVal && prevVal > 0
          ? (curVal - prevVal) / prevVal * 100
          : null;
      }
    });
    return point;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-bold text-gray-900 dark:text-white">Monthly Evolution</h3>
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                metric === m.key
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        {filterLabel || (metric === 'aov'
          ? 'Average order value by country · selected vertical'
          : `MoM ${metric === 'gmv' ? 'GMV' : 'orders'} growth % · selected vertical`)}
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={isPct ? v => `${Number(v).toFixed(0)}%` : v => `€${Number(v).toFixed(2)}`}
            tick={axisStyle} tickLine={false} axisLine={false} width={isPct ? 50 : 65}
          />
          {isPct && <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1} />}
          <Tooltip content={isPct ? <PctTooltip /> : <ChartTooltip />} />
          <Legend formatter={v => `${COUNTRY_META[v]?.flag || ''} ${v}`} wrapperStyle={{ fontSize: 12 }} />
          {selectedCountries.map(c => (
            <Line key={c} type="monotone" dataKey={c} name={c}
              stroke={COUNTRY_META[c]?.color} strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Penetration Trend Chart ────────────────────────────────────

export function PenetrationTrendChart({ beautyByCountryMonth, qcomByCountryMonth, globalQcomByMonth, selectedCountries, filterLabel }) {
  // Africa penetration per country: beauty GMV / Africa Qcom GMV
  const qcomMap = {};
  qcomByCountryMonth.forEach(r => {
    if (!qcomMap[r.period]) qcomMap[r.period] = {};
    qcomMap[r.period][r.country] = (qcomMap[r.period][r.country] || 0) + r.gmv;
  });

  const beautyMap = {};
  beautyByCountryMonth.forEach(r => {
    if (!beautyMap[r.period]) beautyMap[r.period] = {};
    beautyMap[r.period][r.country] = (beautyMap[r.period][r.country] || 0) + r.gmv;
  });

  // Global share: total beauty Africa GMV / total global Qcom GMV
  const globalQcomMap = {};
  (globalQcomByMonth || []).forEach(r => { globalQcomMap[r.period] = r.gmv; });

  const beautyTotalMap = {};
  beautyByCountryMonth.forEach(r => {
    beautyTotalMap[r.period] = (beautyTotalMap[r.period] || 0) + r.gmv;
  });

  const periods = [...new Set([
    ...Object.keys(qcomMap),
    ...Object.keys(beautyMap),
  ])].sort();

  const data = periods.map(period => {
    const point = { period };
    selectedCountries.forEach(c => {
      const beauty = beautyMap[period]?.[c] || 0;
      const qcom   = qcomMap[period]?.[c]   || 0;
      point[c] = qcom > 0 ? parseFloat((beauty / qcom * 100).toFixed(2)) : null;
    });
    // Global share line
    const totalBeauty = beautyTotalMap[period] || 0;
    const totalGlobal = globalQcomMap[period]  || 0;
    point['_global'] = totalGlobal > 0 ? parseFloat((totalBeauty / totalGlobal * 100).toFixed(3)) : null;
    return point;
  }).filter(p => selectedCountries.some(c => p[c] !== null));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-bold text-gray-900 dark:text-white">Beauty Penetration</h3>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        {filterLabel || 'Beauty GMV as % of total Q-Commerce · by country'}
        {globalQcomByMonth?.length > 0 && (
          <span className="ml-2 text-gray-300">· dashed = global share</span>
        )}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={v => `${v}%`}
            tick={axisStyle} tickLine={false} axisLine={false} width={50}
            domain={[0, 'auto']}
          />
          <Tooltip
            formatter={(v, name) => {
              if (name === '_global') return [`${v?.toFixed(3)}%`, 'Global share'];
              return [`${v?.toFixed(2)}%`, `${COUNTRY_META[name]?.flag || ''} ${name} (Africa penet.)`];
            }}
            labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend
            formatter={v => v === '_global' ? '🌐 Global share' : `${COUNTRY_META[v]?.flag || ''} ${v}`}
            wrapperStyle={{ fontSize: 12 }}
          />
          {selectedCountries.map(c => (
            <Line key={c} type="monotone" dataKey={c} name={c}
              stroke={COUNTRY_META[c]?.color} strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} connectNulls />
          ))}
          {globalQcomByMonth?.length > 0 && (
            <Line type="monotone" dataKey="_global" name="_global"
              stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 3"
              dot={false} activeDot={{ r: 3 }} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Vertical Comparison Chart ──────────────────────────────────

export function VerticalComparisonChart({ byVerticalCountryMonth, selectedCountries, verticalFilter = 'all' }) {
  // byVerticalCountryMonth is already filtered by period + country in the parent
  // Discover verticals present in data (no hardcoding)
  const verticals = [...new Set(byVerticalCountryMonth.map(r => r.vertical))].sort();

  // Monthly totals per vertical — derived from country-filtered data
  const monthlyMap = {};
  byVerticalCountryMonth.forEach(r => {
    if (!monthlyMap[r.period]) {
      monthlyMap[r.period] = { period: r.period };
      verticals.forEach(v => { monthlyMap[r.period][v] = 0; });
    }
    monthlyMap[r.period][r.vertical] = (monthlyMap[r.period][r.vertical] || 0) + r.gmv;
  });
  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.period.localeCompare(b.period));

  // Total per vertical for header KPIs
  const totalByVertical = {};
  verticals.forEach(v => {
    totalByVertical[v] = byVerticalCountryMonth.filter(r => r.vertical === v).reduce((s, r) => s + r.gmv, 0);
  });
  const grandTotal = Object.values(totalByVertical).reduce((s, v) => s + v, 0);

  // Country breakdown — same source, group by country
  const countryMap = {};
  byVerticalCountryMonth
    .filter(r => selectedCountries.includes(r.country))
    .forEach(r => {
      if (!countryMap[r.country]) {
        countryMap[r.country] = { name: `${COUNTRY_META[r.country]?.flag || ''} ${r.country}` };
        verticals.forEach(v => { countryMap[r.country][v] = 0; });
      }
      if (countryMap[r.country][r.vertical] !== undefined)
        countryMap[r.country][r.vertical] += r.gmv;
    });
  const countryData = Object.values(countryMap).sort((a, b) => {
    const aSum = verticals.reduce((s, v) => s + (a[v] || 0), 0);
    const bSum = verticals.reduce((s, v) => s + (b[v] || 0), 0);
    return bSum - aSum;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header with per-vertical KPI pills */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-0.5">Vertical Comparison</h3>
          <p className="text-xs text-gray-400">
            {verticalFilter === 'all' ? 'All verticals · select a vertical to highlight' : `Highlighting ${verticalFilter} · others dimmed for context`}
          </p>
        </div>
        <div className="flex gap-6 flex-shrink-0">
          {verticals.map(v => {
            const color    = VERTICAL_COLORS[v] || '#9CA3AF';
            const pct      = grandTotal > 0 ? (totalByVertical[v] / grandTotal * 100).toFixed(1) : '0.0';
            const isActive = verticalFilter === 'all' || verticalFilter === v;
            return (
              <div key={v} className="text-right transition-opacity" style={{ opacity: isActive ? 1 : 0.35 }}>
                <p className="text-xs font-bold mb-0.5" style={{ color }}>{v}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(totalByVertical[v] || 0)}</p>
                <p className="text-xs text-gray-400">{pct}% of GMV</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-gray-100 dark:divide-gray-700">

        {/* Monthly trend — lines for easy comparison */}
        <div className="p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Monthly GMV trend</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmt} tick={axisStyle} tickLine={false} axisLine={false} width={65} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {verticals.map(v => {
                const isActive = verticalFilter === 'all' || verticalFilter === v;
                return (
                  <Line key={v} type="monotone" dataKey={v}
                    stroke={VERTICAL_COLORS[v] || '#9CA3AF'}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    strokeOpacity={isActive ? 1 : 0.25}
                    dot={false} activeDot={{ r: 4 }} connectNulls />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Country breakdown — horizontal stacked bars */}
        <div className="p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            GMV by country · all periods
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={countryData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid {...gridStyle} horizontal={false} />
              <XAxis type="number" tickFormatter={fmt} tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 13 }} tickLine={false} axisLine={false} width={55} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {verticals.map((v, i) => {
                const isActive = verticalFilter === 'all' || verticalFilter === v;
                return (
                  <Bar key={v} dataKey={v} fill={VERTICAL_COLORS[v] || '#9CA3AF'} stackId="a"
                    fillOpacity={isActive ? 1 : 0.25}
                    radius={i === verticals.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}