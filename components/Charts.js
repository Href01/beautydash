import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fmt, COUNTRY_META } from '../lib/constants';

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
export function GMVTrendChart({ byCountryMonth, selectedCountries }) {
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
      <p className="text-xs text-gray-400 mb-5">Monthly beauty GMV · selected vertical</p>
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
export function MonthlyTotalChart({ monthlyTotal }) {
  const data = monthlyTotal.map(m => ({ period: m.period, GMV: m.gmv }));
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-gray-900 dark:text-white mb-0.5">Total Monthly GMV</h3>
      <p className="text-xs text-gray-400 mb-5">All countries combined · selected vertical</p>
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

// ── MoM Growth Chart ───────────────────────────────────────────
export function GrowthChart({ growth, selectedCountries, filteredPeriods }) {
  if (!growth?.countryMoM) return null;
  const firstCountry = selectedCountries[0];
  if (!growth.countryMoM[firstCountry]) return null;

  const allPeriods = growth.countryMoM[firstCountry].map(m => m.period);
  const periods    = filteredPeriods?.length
    ? allPeriods.filter(p => filteredPeriods.includes(p))
    : allPeriods;

  const data = periods.map(period => {
    const point = { period };
    selectedCountries.forEach(c => {
      const m  = growth.countryMoM[c]?.find(x => x.period === period);
      point[c] = m?.momGMV ?? null;
    });
    return point;
  }).filter(point => selectedCountries.some(c => point[c] !== null));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-gray-900 dark:text-white mb-0.5">MoM Growth % by Country</h3>
      <p className="text-xs text-gray-400 mb-5">Month-over-month GMV growth</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={v => `${v}%`} tick={axisStyle} tickLine={false} axisLine={false} width={50} />
          <ReferenceLine y={0} stroke="#6B7280" strokeWidth={1} />
          <Tooltip content={<PctTooltip />} />
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

// ── Vertical Comparison Chart ──────────────────────────────────
const VERTICAL_COLORS = { Retail: '#FFC244', MFC: '#00A082', Groceries: '#3B82F6' };

export function VerticalComparisonChart({ byVerticalCountryMonth, selectedCountries }) {
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
          <p className="text-xs text-gray-400">All verticals · ignores vertical filter</p>
        </div>
        <div className="flex gap-6 flex-shrink-0">
          {verticals.map(v => {
            const color = VERTICAL_COLORS[v] || '#9CA3AF';
            const pct   = grandTotal > 0 ? (totalByVertical[v] / grandTotal * 100).toFixed(1) : '0.0';
            return (
              <div key={v} className="text-right">
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
              {verticals.map(v => (
                <Line key={v} type="monotone" dataKey={v}
                  stroke={VERTICAL_COLORS[v] || '#9CA3AF'} strokeWidth={2.5}
                  dot={false} activeDot={{ r: 4 }} connectNulls />
              ))}
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
              {verticals.map((v, i) => (
                <Bar key={v} dataKey={v} fill={VERTICAL_COLORS[v] || '#9CA3AF'} stackId="a"
                  radius={i === verticals.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}