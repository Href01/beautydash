import { fmt, fmtPct } from '../lib/constants';

export default function InsightsPanel({ summary, byCountry, totalGMV, growth, monthlyTotal }) {
  if (!summary || !byCountry?.length) return null;

  const filteredTotal = totalGMV || byCountry.reduce((s, c) => s + c.gmv, 0);
  const sorted     = [...byCountry].sort((a, b) => b.gmv - a.gmv);
  const top        = sorted[0];
  const topPct     = top ? (top.gmv / filteredTotal * 100).toFixed(1) : 0;
  const lowestAOV  = [...byCountry].filter(c => c.orders > 0).sort((a, b) => a.aov - b.aov)[0];
  const bestGrowth = growth?.periodComparison?.filter(g => g.gmvGrowth !== null)?.sort((a, b) => b.gmvGrowth - a.gmvGrowth)[0];
  const last       = monthlyTotal?.[monthlyTotal.length - 1];
  const first      = monthlyTotal?.[0];
  const totalGrowth = first?.gmv > 0 ? ((last?.gmv - first?.gmv) / first?.gmv * 100).toFixed(1) : null;

  const insights = [
    {
      type: '⚠️ Risk', border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/10',
      title: `${top?.country} concentration: ${topPct}% of beauty GMV`,
      text: `${top?.country} represents ${topPct}% of total retail GMV. One partner churn puts the entire region at risk.`,
      action: 'Set max 60% single-market concentration target by end 2026.',
    },
    {
      type: '🚀 Opportunity', border: 'border-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      title: 'CI highest AOV but lowest volume',
      text: 'Ivory Coast shows premium spending — highest retail AOV in region — but order volume is critically low.',
      action: 'Onboard 1 replenishment-first local hero in CI within 4 weeks.',
    },
    {
      type: '🔴 Alert', border: 'border-red-400', bg: 'bg-red-50 dark:bg-red-900/10',
      title: `NG AOV €${lowestAOV?.aov?.toFixed(2)} — lowest in region`,
      text: 'Nigeria has strong order volume but weakest AOV. Wrong SKU mix or underpricing.',
      action: 'Audit NG partner pricing. Push higher value replenishment SKUs.',
    },
    bestGrowth ? {
      type: '📈 Growth', border: 'border-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10',
      title: `${bestGrowth.country} leading at ${fmtPct(bestGrowth.gmvGrowth)} since ${bestGrowth.firstPeriod}`,
      text: `${bestGrowth.country} grew from ${fmt(bestGrowth.firstGMV)} to ${fmt(bestGrowth.lastGMV)}.`,
      action: 'Investigate growth drivers and replicate in other markets.',
    } : null,
    {
      type: '🎯 Action', border: 'border-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/10',
      title: 'Replenishment threshold not enforced',
      text: 'Several partners are below 50% replenishment rate. Flormar MA at 4%.',
      action: 'Set 50% replenishment as mandatory onboarding condition.',
    },
    totalGrowth ? {
      type: '📊 Trend', border: 'border-green-400', bg: 'bg-green-50 dark:bg-green-900/10',
      title: `Overall GMV ${parseFloat(totalGrowth) > 0 ? 'grew' : 'declined'} ${fmtPct(parseFloat(totalGrowth))}`,
      text: `From ${fmt(first?.gmv || 0)} (${first?.period}) to ${fmt(last?.gmv || 0)} (${last?.period}).`,
      action: parseFloat(totalGrowth) > 0 ? 'Maintain momentum — scale best markets.' : 'Immediate partner review required.',
    } : null,
  ].filter(Boolean);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">Key Insights</h2>
          <p className="text-xs text-gray-400 mt-0.5">{insights.length} findings from your data</p>
        </div>
        <span className="px-3 py-1 bg-yellow-400 text-black text-xs font-black rounded-full">
          {insights.filter(i => i.type.includes('Alert') || i.type.includes('Risk')).length} URGENT
        </span>
      </div>
      <div className="p-6 grid gap-3">
        {insights.map((insight, i) => (
          <div key={i} className={`border-l-4 ${insight.border} ${insight.bg} rounded-r-xl p-4`}>
            <p className="text-xs font-bold text-gray-400 mb-1">{insight.type}</p>
            <p className="font-bold text-gray-900 dark:text-white text-sm mb-1">{insight.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{insight.text}</p>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">→ {insight.action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}