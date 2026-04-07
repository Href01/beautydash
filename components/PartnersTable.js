import { fmt, fmtPct, trendColor, COUNTRY_META } from '../lib/constants';

const CVR_BENCHMARK = 10; // 10% target from strategy

export default function PartnersTable({ byPartnerMonth, cvrByPartnerMonth }) {
  if (!byPartnerMonth?.length) return null;

  // ── Aggregate GMV/orders per partner+country ──────────────────
  const map = {};
  byPartnerMonth.forEach(r => {
    const key = `${r.country}__${r.partner}`;
    if (!map[key]) map[key] = { country: r.country, partner: r.partner, gmv: 0, orders: 0, periods: [] };
    map[key].gmv    += r.gmv;
    map[key].orders += r.orders;
    map[key].periods.push({ period: r.period, gmv: r.gmv, orders: r.orders });
  });

  // ── Aggregate CVR data per partner+country ────────────────────
  const cvrMap = {};
  (cvrByPartnerMonth || []).forEach(r => {
    const key = `${r.country}__${r.partner}`;
    if (!cvrMap[key]) cvrMap[key] = { sessions: 0, orders_created: 0, periods: [] };
    cvrMap[key].sessions       += r.sessions;
    cvrMap[key].orders_created += r.orders_created;
    cvrMap[key].periods.push({ period: r.period, sessions: r.sessions, orders_created: r.orders_created, cvr: r.cvr });
  });

  const partners = Object.values(map).map(p => {
    p.periods.sort((a, b) => a.period.localeCompare(b.period));
    const last    = p.periods[p.periods.length - 1];
    const prev    = p.periods[p.periods.length - 2];
    const momGMV  = last && prev && prev.gmv > 0
      ? (last.gmv - prev.gmv) / prev.gmv * 100
      : null;

    const key     = `${p.country}__${p.partner}`;
    const cvrd    = cvrMap[key];
    // blended CVR across full filtered period
    const cvr     = cvrd && cvrd.sessions > 0
      ? cvrd.orders_created / cvrd.sessions * 100
      : null;
    const sessions = cvrd ? cvrd.sessions : null;

    // MoM CVR: compare last two periods
    let momCVR = null;
    if (cvrd && cvrd.periods.length >= 2) {
      cvrd.periods.sort((a, b) => a.period.localeCompare(b.period));
      const cLast = cvrd.periods[cvrd.periods.length - 1];
      const cPrev = cvrd.periods[cvrd.periods.length - 2];
      if (cPrev.cvr > 0) momCVR = ((cLast.cvr - cPrev.cvr) / cPrev.cvr) * 100;
    }

    return { country: p.country, partner: p.partner, gmv: p.gmv, orders: p.orders, aov: p.orders > 0 ? p.gmv / p.orders : 0, momGMV, cvr, sessions, momCVR };
  }).sort((a, b) => b.gmv - a.gmv);

  const totalGMV    = partners.reduce((s, p) => s + p.gmv, 0);
  const hasCVR      = partners.some(p => p.cvr !== null);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Top Partners</h2>
          <p className="text-xs text-gray-400 mt-0.5">Retail · selected countries & period · ranked by GMV</p>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3 text-left w-8">#</th>
              <th className="px-5 py-3 text-left">Partner</th>
              <th className="px-5 py-3 text-left">Country</th>
              <th className="px-5 py-3 text-right">GMV</th>
              <th className="px-5 py-3 text-right">% Total</th>
              <th className="px-5 py-3 text-right">Orders</th>
              <th className="px-5 py-3 text-right">AOV</th>
              <th className="px-5 py-3 text-right">Last MoM</th>
              {hasCVR && <th className="px-5 py-3 text-right">Sessions</th>}
              {hasCVR && <th className="px-5 py-3 text-right">CVR</th>}
              {hasCVR && <th className="px-5 py-3 text-right">MoM CVR</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {partners.map((p, i) => {
              const meta   = COUNTRY_META[p.country] || {};
              const gmvPct = totalGMV > 0 ? p.gmv / totalGMV * 100 : 0;
              const cvrGood = p.cvr !== null && p.cvr >= CVR_BENCHMARK;
              const cvrColor = p.cvr === null ? '' : cvrGood ? 'text-green-500' : 'text-red-400';
              return (
                <tr key={`${p.country}__${p.partner}`} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <td className="px-5 py-3 text-xs font-bold text-gray-300 dark:text-gray-600">
                    {i + 1}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                    {p.partner}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span>{meta.flag || '🌍'}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{p.country}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">
                    {fmt(p.gmv)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(gmvPct, 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">
                        {gmvPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                    {p.orders.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-700 dark:text-gray-200">
                    €{p.aov.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.momGMV !== null ? (
                      <span className={`text-xs font-bold ${trendColor(p.momGMV)}`}>{fmtPct(p.momGMV)}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  {hasCVR && (
                    <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">
                      {p.sessions !== null ? p.sessions.toLocaleString() : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {hasCVR && (
                    <td className="px-5 py-3 text-right">
                      {p.cvr !== null ? (
                        <span className={`text-xs font-bold ${cvrColor}`}>
                          {p.cvr.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )}
                  {hasCVR && (
                    <td className="px-5 py-3 text-right">
                      {p.momCVR !== null ? (
                        <span className={`text-xs font-bold ${trendColor(p.momCVR)}`}>{fmtPct(p.momCVR)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
