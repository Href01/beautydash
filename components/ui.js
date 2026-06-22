// Shared formatting + tiny UI primitives for the stores dashboard.

export function cls(...xs) { return xs.filter(Boolean).join(' '); }

export function fmtEur(v, compact = false) {
  if (v == null || isNaN(v)) return '—';
  if (compact && Math.abs(v) >= 1000) {
    return '€' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
  }
  return '€' + Math.round(v).toLocaleString('en-US');
}

export function fmtNum(v, compact = false) {
  if (v == null || isNaN(v)) return '—';
  if (compact && Math.abs(v) >= 1000) {
    return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
  }
  return Math.round(v).toLocaleString('en-US');
}

export function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return v.toFixed(digits) + '%';
}

export function fmtMin(v) {
  if (v == null || isNaN(v)) return '—';
  return v.toFixed(0) + 'm';
}

// Percentage change between two values; null when prior is 0/undefined.
export function wow(curr, prev) {
  if (prev == null || prev === 0) return null;
  return (curr - prev) / prev * 100;
}

// Coloured WoW delta pill. `invert` flips colours for "lower is better" metrics.
export function DeltaBadge({ value, invert = false, suffix = '%', size = 'sm' }) {
  if (value == null) {
    return <span className="text-xs text-gray-400 dark:text-gray-600">new</span>;
  }
  const up = value > 0;
  const good = invert ? !up : up;
  const color = value === 0
    ? 'text-gray-400 dark:text-gray-500'
    : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400';
  const arrow = value === 0 ? '' : up ? '▲' : '▼';
  const pad = size === 'lg' ? 'text-sm' : 'text-xs';
  return (
    <span className={cls('font-bold tabular-nums', pad, color)}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// Minimal inline SVG sparkline.
export function Sparkline({ data, w = 96, h = 28, color = '#FFC244', strokeWidth = 1.75 }) {
  const pts = (data || []).filter(v => v != null && !isNaN(v));
  if (pts.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const step = w / (pts.length - 1);
  const path = pts.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = pts[pts.length - 1], first = pts[0];
  const trendUp = last >= first;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(pts.length - 1) * step} cy={h - ((last - min) / range) * (h - 4) - 2}
              r="2.5" fill={trendUp ? '#10b981' : '#f43f5e'} />
    </svg>
  );
}

export const COUNTRY_META = {
  MA: { name: 'Morocco',     flag: '🇲🇦', color: '#FFC244' },
  KE: { name: 'Kenya',       flag: '🇰🇪', color: '#00A082' },
  NG: { name: 'Nigeria',     flag: '🇳🇬', color: '#F97316' },
  CI: { name: 'Ivory Coast', flag: '🇨🇮', color: '#8B5CF6' },
  UG: { name: 'Uganda',      flag: '🇺🇬', color: '#EC4899' },
  TN: { name: 'Tunisia',     flag: '🇹🇳', color: '#3B82F6' },
};
