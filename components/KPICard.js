import { trendColor, fmtPct } from '../lib/constants';

export default function KPICard({ title, value, subtitle, trend, icon, accent = 'yellow', delay = 0 }) {
  const borders = {
    yellow: 'border-yellow-400',
    green:  'border-green-500',
    blue:   'border-blue-400',
    gray:   'border-gray-300 dark:border-gray-600',
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border-l-4 ${borders[accent]} shadow-sm hover:shadow-md transition-all`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-400">
          {title}
        </p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">
        {value}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
        {trend !== undefined && trend !== null && (
          <span className={`text-xs font-bold ${trendColor(trend)}`}>
            {fmtPct(trend)} MoM
          </span>
        )}
      </div>
    </div>
  );
}