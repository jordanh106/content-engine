import React from "react";
import { Tooltip, CartesianGrid, XAxis, YAxis, Legend } from "recharts";

/**
 * Chart theming layer for Recharts.
 *
 * Replaces Recharts' default white tooltip + harsh grid + default legend with
 * premium editorial styling. Use these instead of the raw Recharts components.
 *
 * Brand chart colors:
 */
export const chartColors = {
  teal: "#0d9488",
  tealLight: "#2dd4bf",
  emerald: "#10b981",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  rose: "#e11d48",
  violet: "#8b5cf6",
  pink: "#ec4899",
  slate: "#475569",
} as const;

export const chartPalette = [
  chartColors.teal,
  chartColors.sky,
  chartColors.emerald,
  chartColors.amber,
  chartColors.rose,
  chartColors.violet,
  chartColors.pink,
];

const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: "#0f172a",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  boxShadow: "0 12px 32px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.12)",
};
const tooltipLabelStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 4,
  letterSpacing: "0.02em",
};
const tooltipItemStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  padding: 0,
};

const cursorStyle = { stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "3 3" };

/** Premium dark tooltip. Drop in place of the default `<Tooltip />`. */
export const ChartTooltip: React.FC<React.ComponentProps<typeof Tooltip>> = (props) => (
  <Tooltip
    {...props}
    contentStyle={{ ...tooltipContentStyle, ...(props.contentStyle as object) }}
    labelStyle={{ ...tooltipLabelStyle, ...(props.labelStyle as object) }}
    itemStyle={{ ...tooltipItemStyle, ...(props.itemStyle as object) }}
    cursor={props.cursor ?? cursorStyle}
  />
);

/** Subtle horizontal grid lines only. Drop in place of `<CartesianGrid />`. */
export const ChartGrid: React.FC<React.ComponentProps<typeof CartesianGrid>> = (props) => (
  <CartesianGrid
    {...props}
    stroke={props.stroke ?? "#f1f5f9"}
    strokeDasharray={props.strokeDasharray ?? "3 3"}
    vertical={props.vertical ?? false}
  />
);

const axisDefaults = {
  tick: { fontSize: 11, fill: "#64748b", fontVariantNumeric: "tabular-nums" as const },
  tickLine: false as const,
  axisLine: false as const,
  stroke: "#cbd5e1",
};

/** Themed X axis — no axis line, no tick lines, 11px tabular labels. */
export const ChartXAxis: React.FC<React.ComponentProps<typeof XAxis>> = (props) => (
  <XAxis {...axisDefaults} {...props} tick={{ ...axisDefaults.tick, ...(props.tick as object) }} />
);
/** Themed Y axis — no axis line, no tick lines, 11px tabular labels. */
export const ChartYAxis: React.FC<React.ComponentProps<typeof YAxis>> = (props) => (
  <YAxis {...axisDefaults} {...props} tick={{ ...axisDefaults.tick, ...(props.tick as object) }} />
);

/** Themed legend — small, muted, top-aligned. */
export const ChartLegend: React.FC<React.ComponentProps<typeof Legend>> = (props) => (
  <Legend
    {...props}
    iconType={props.iconType ?? "circle"}
    iconSize={props.iconSize ?? 8}
    wrapperStyle={{ fontSize: 11, color: "#64748b", paddingBottom: 8, ...(props.wrapperStyle as object) }}
  />
);

/** Common line-chart prop bundle — pass to LineChart spread to inherit smooth animation defaults. */
export const lineChartDefaults = {
  margin: { top: 8, right: 12, bottom: 4, left: 4 },
};
