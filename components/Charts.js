import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fmt, COUNTRY_META } from '../lib/constants';

// ── Tooltip ────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, isPctChart }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-xl text-xs min-w-[140px]">
      <p className="font-bold text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      {payload.map((entry, i) => {
        const isPct    = isPctChart || entry.unit === '%';
        const isOrders = entry.name === 'Orders';
        const val      = entry.value;
        const formatted = isPct
          ? val === null || val === undefined
            ? '—'
            : `${val > 0 ? '+' : ''}${Number(val).toFixed(1)}%`
          : isOrders
          ? Number(val).toLocaleString()
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

const axisStyle = { fontSize: 11, fill: '#9CA3AF' };
const gridStyle = { strokeDasharray: '3 3', stroke: '#374151', opacity: 0.25 };

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
      <p className="text-xs text-gray-400 mb-5">Monthly retail beauty GMV</p>
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
      <p className="text-xs text-gray-400 mb-5">All countries combined</p>
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
      <p className="text-xs text-gray-400 mb-5">Total GMV all periods</p>
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

  // Filter to only periods in the current period filter
  const allPeriods = growth.countryMoM[firstCountry].map(m => m.period);
  const periods    = filteredPeriods?.length
    ? allPeriods.filter(p => filteredPeriods.includes(p))
    : allPeriods;

  const data = periods.map((period) => {
    const point = { period };
    selectedCountries.forEach(c => {
      const m     = growth.countryMoM[c]?.find(x => x.period === period);
      point[c]    = m?.momGMV ?? null;
    });
    return point;
  }).slice(1); // skip first — no MoM for first period

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