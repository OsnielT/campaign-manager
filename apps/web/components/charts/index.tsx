"use client";

// Thin Recharts wrappers themed with the app's CSS variables so charts match the
// design system. All are client-only (Recharts needs the DOM).

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const AXIS = "var(--text-muted)";
const GRID = "var(--border-subtle)";

/** Tiny inline trend line, no axes — for KPI cards. */
export function Sparkline({ data, color = "var(--accent)", height = 36 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return <div style={{ height }} />;
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
  padding: "6px 10px",
};

/** Conversions-over-time area chart. */
export function AreaTrend({ data, height = 220 }: { data: { date: string; conversions: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="convFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={28}
          tickFormatter={(d: string) => {
            const dt = new Date(d);
            return `${dt.getMonth() + 1}/${dt.getDate()}`;
          }}
        />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--text-secondary)" }} cursor={{ stroke: GRID }} />
        <Area type="monotone" dataKey="conversions" stroke="var(--accent)" strokeWidth={2} fill="url(#convFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal 3-stage funnel (Records → Activations → Conversions). */
export function FunnelBars({ data, height = 220 }: { data: { stage: string; value: number }[]; height?: number }) {
  const colors = ["var(--accent)", "var(--warning)", "var(--success)"];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="stage" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} tickLine={false} axisLine={false} width={90} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-raised)" }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false} barSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Small categorical bar chart (campaign status mix). */
export function MiniBar({ data, height = 220 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-raised)" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false} barSize={38}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
