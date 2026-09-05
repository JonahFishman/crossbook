import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistoryPoint } from '../lib/api';

// Both series are the same measure (implied probability), so they share one y axis.
// Palette validated for colorblind separation and contrast against the dark surface.
const SERIES = [
  { key: 'KALSHI', label: 'Kalshi', color: '#d97706' },
  { key: 'POLYMARKET', label: 'Polymarket', color: '#2563eb' },
] as const;

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-edge bg-panel px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 text-muted">{new Date(label).toLocaleString()}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          <span className="text-muted">{SERIES.find((s) => s.key === p.dataKey)?.label}</span>
          <span className="ml-auto tabular-nums text-white">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function HistoryChart({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Not enough history yet. The poller records a snapshot every 5 minutes, so the chart fills in
        as it runs.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#272e38" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="fetchedAt"
            tickFormatter={time}
            stroke="#8b949e"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            stroke="#8b949e"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            // Wide enough for "100%"; at 44 with a negative left margin the top tick clipped.
            width={52}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#8b949e', strokeDasharray: '3 3' }} />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="plainline"
            formatter={(v) => (
              <span className="text-xs text-muted">{SERIES.find((s) => s.key === v)?.label ?? v}</span>
            )}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#161b22' }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
