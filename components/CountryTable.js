import { fmt, fmtPct, trendColor, COUNTRY_META, COUNTRY_STATUS } from '../lib/constants';

function getSmartInsight(row, g, gmvPct, byCountryMonth, byCountry, filteredPeriods) {
  const signals = [];

  // ── GMV share signals ──────────────────────────────────────────
  if (gmvPct > 45) signals.push({ p: 10, text: `Dominant market — ${gmvPct.toFixed(0)}% of portfolio GMV` });
  if (gmvPct < 5)  signals.push({ p: 7,  text: `Smallest market — ${gmvPct.toFixed(1)}% share, room to scale` });

  // ── Growth signals ─────────────────────────────────────────────
  if (g) {
    if (g.growth >  150) signals.push({ p: 9, text: `Hyper-growth +${g.growth.toFixed(0)}% over period — sustain momentum` });
    else if (g.growth > 60)  signals.push({ p: 8, text: `Strong growth +${g.growth.toFixed(0)}% — investigate drivers` });
    else if (g.growth < -30) signals.push({ p: 9, text: `Sharp decline ${fmtPct(g.growth)} — flag for action` });
    else if (g.growth < 0)   signals.push({ p: 6, text: `Mild decline ${fmtPct(g.growth)} — monitor closely` });
    else if (Math.abs(g.growth) < 5) signals.push({ p: 5, text: `Flat growth (${fmtPct(g.growth)}) — audit catalogue & partners` });
  }

  // ── AOV rank signals ───────────────────────────────────────────
  const sorted = [...byCountry].sort((a, b) => b.aov - a.aov);
  const aovRank = sorted.findIndex(c => c.country === row.country);
  if (aovRank === 0) signals.push({ p: 6, text: `Highest AOV (€${row.aov.toFixed(2)}) — premium positioning` });
  if (aovRank === sorted.length - 1 && sorted.length > 2)
    signals.push({ p: 6, text: `Lowest AOV (€${row.aov.toFixed(2)}) — fix pricing or SKU mix` });

  // ── Recent momentum vs overall trend ──────────────────────────
  if (byCountryMonth && filteredPeriods?.length >= 4) {
    const recent = filteredPeriods.slice(-3);
    const countryRows = byCountryMonth.filter(r => r.country === row.country);
    const recentRows  = countryRows.filter(r => recent.includes(r.period));
    if (recentRows.length >= 2) {
      const first = recentRows[0].gmv;
      const last  = recentRows[recentRows.length - 1].gmv;
      const recentGrowth = first > 0 ? (last - first) / first * 100 : null;
      if (recentGrowth !== null && g) {
        if (recentGrowth > g.growth + 30)
          signals.push({ p: 8, text: `Accelerating — last 3M trend (+${recentGrowth.toFixed(0)}%) ahead of period avg` });
        else if (recentGrowth < g.growth - 30 && g.growth > 0)
          signals.push({ p: 8, text: `Decelerating — last 3M trend (${fmtPct(recentGrowth)}) below period avg` });
      }
    }
  }

  if (!signals.length) return '—';
  signals.sort((a, b) => b.p - a.p);
  return signals[0].text;
}

export default function CountryTable({ byCountry, byCountryMonth, allByCountryMonth, filteredPeriods, totalGMV, totalOrders }) {
  if (!byCountry?.length) return null;

  const firstPeriod = filteredPeriods?.[0];
  const lastPeriod  = filteredPeriods?.[filteredPeriods.length - 1];

  // YoY: full 2024 vs full 2025 from unfiltered-by-period data
  const getYoY = (country) => {
    if (!allByCountryMonth) return null;
    const rows = allByCountryMonth.filter(r => r.country === country);
    const gmv2024 = rows.filter(r => r.period.startsWith('2024')).reduce((s, r) => s + r.gmv, 0);
    const gmv2025 = rows.filter(r => r.period.startsWith('2025')).reduce((s, r) => s + r.gmv, 0);
    if (!gmv2024 && !gmv2025) return null;
    return {
      gmv2024,
      gmv2025,
      growth: gmv2024 > 0 ? ((gmv2025 - gmv2024) / gmv2024 * 100) : null,
    };
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Country Breakdown</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {firstPeriod} → {lastPeriod} · YoY growth: 2024 vs 2025
          </p>
        </div>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {byCountry.length} markets
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3 text-left">Country</th>
              <th className="px-5 py-3 text-right">GMV</th>
              <th className="px-5 py-3 text-right">% GMV</th>
              <th className="px-5 py-3 text-right">Orders</th>
              <th className="px-5 py-3 text-right">AOV</th>
              <th className="px-5 py-3 text-right">
                YoY Growth
                <span className="ml-1 text-gray-300 normal-case font-normal">(2024 vs 2025)</span>
              </th>
              <th className="px-5 py-3 text-left">Status & Insight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {[...byCountry].sort((a, b) => b.gmv - a.gmv).map(row => {
              const meta    = COUNTRY_META[row.country]  || {};
              const status  = COUNTRY_STATUS[row.country] || {};
              const g       = getYoY(row.country);
              const gmvPct  = totalGMV > 0 ? (row.gmv / totalGMV * 100) : 0;

              return (
                <tr key={row.country} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{meta.flag || '🌍'}</span>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{row.country}</p>
                        <p className="text-xs text-gray-400">{meta.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-gray-900 dark:text-white">
                    {fmt(row.gmv)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(gmvPct, 100)}%`, background: meta.color }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">
                        {gmvPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-300">
                    {row.orders.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right font-bold" style={{ color: meta.color }}>
                    €{row.aov.toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {g ? (
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-bold ${trendColor(g.growth)}`}>
                          {fmtPct(g.growth)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {fmt(g.gmv2024)} → {fmt(g.gmv2025)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${status.color} mb-1`}>
                      {status.label}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                      {getSmartInsight(row, g, gmvPct, byCountryMonth, byCountry, filteredPeriods)}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Summary row */}
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-900 font-bold text-sm">
              <td className="px-5 py-3 text-gray-700 dark:text-gray-300">Total</td>
              <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{fmt(totalGMV)}</td>
              <td className="px-5 py-3 text-right text-gray-500">100%</td>
              <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{totalOrders.toLocaleString()}</td>
              <td className="px-5 py-3 text-right text-gray-900 dark:text-white">
                €{totalOrders > 0 ? (totalGMV / totalOrders).toFixed(2) : '0.00'}
              </td>
              <td className="px-5 py-3" />
              <td className="px-5 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}