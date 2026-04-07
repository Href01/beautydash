export const COUNTRIES = ['MA', 'KE', 'TN', 'CI', 'UG', 'NG'];

export const COUNTRY_META = {
  MA: { name: 'Morocco',     flag: '🇲🇦', color: '#FFC244' },
  KE: { name: 'Kenya',       flag: '🇰🇪', color: '#00A082' },
  TN: { name: 'Tunisia',     flag: '🇹🇳', color: '#3B82F6' },
  CI: { name: 'Ivory Coast', flag: '🇨🇮', color: '#8B5CF6' },
  UG: { name: 'Uganda',      flag: '🇺🇬', color: '#EC4899' },
  NG: { name: 'Nigeria',     flag: '🇳🇬', color: '#F97316' },
};

export const COUNTRY_STATUS = {
  MA: { label: 'Mature',   color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',     insight: 'Flat penetration — audit para catalogues' },
  KE: { label: 'Growing',  color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', insight: 'Strong growth — investigate Oct-25 spike' },
  TN: { label: 'Volatile', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300', insight: '+99bps YoY — stabilize, expand para' },
  CI: { label: 'Sleeping', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', insight: 'Highest AOV — no replenishment partner yet' },
  UG: { label: 'Nascent',  color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',    insight: 'Build partner shortlist from scratch' },
  NG: { label: 'Risk',     color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',        insight: 'Lowest AOV — fix pricing and SKU mix' },
};

// Vertical colors — distinct from country colors
export const VERTICAL_COLORS = {
  Retail:    '#F59E0B', // amber-500 (distinct from MA #FFC244)
  MFC:       '#00A082', // teal
  Groceries: '#3B82F6', // blue-500
};

export function fmt(v) {
  if (v >= 1000000) return `€${(v/1000000).toFixed(2)}M`;
  if (v >= 1000)    return `€${(v/1000).toFixed(1)}K`;
  return `€${v.toFixed(0)}`;
}

export function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

export function trendColor(v) {
  if (v === null || v === undefined) return 'text-gray-400';
  if (v > 0) return 'text-emerald-500';
  if (v < 0) return 'text-red-400';
  return 'text-gray-400';
}