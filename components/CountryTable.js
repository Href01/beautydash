import { fmt, fmtPct, trendColor, COUNTRY_META, COUNTRY_STATUS } from '../lib/constants';

export default function CountryTable({ byCountry, growth, totalGMV, totalOrders }) {
  if (!byCountry?.length) return null;

  const getGrowth = (country) => growth?.periodComparison?.find(g => g.country === country);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Country Breakdown</h2>
          <p className="text-xs text-gray-400 mt-0.5">Retail vertical · all periods</p>
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
              <th className="px-5 py-3 text-right">Growth</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Insight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {[...byCountry].sort((a, b) => b.gmv - a.gmv).map(row => {
              const meta   = COUNTRY_META[row.country]  || {};
              const status = COUNTRY_STATUS[row.country] || {};
              const g      = getGrowth(row.country);
              const gmvPct = totalGMV > 0 ? (row.gmv / totalGMV * 100) : 0;

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
                        <div className="h-full rounded-full" style={{ width: `${Math.min(gmvPct, 100)}%`, background: meta.color }} />
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
                      <span className={`text-xs font-bold ${trendColor(g.gmvGrowth)}`}>
                        {fmtPct(g.gmvGrowth)}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400 max-w-[200px]">
                    {status.insight}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}