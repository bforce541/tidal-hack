import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { VisualPoint } from "@/lib/api";

const MEDIAN_BLACK = "#0a0a0a";
const GRID_STROKE = "rgba(0,0,0,0.06)";
const AXIS_STROKE = "rgba(0,0,0,0.2)";

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

interface HistoricalGrowthChartProps {
  points: VisualPoint[];
  years: number[];
  runLabel: string;
}

export function HistoricalGrowthChart({ points, years, runLabel }: HistoricalGrowthChartProps) {
  const chartData = useMemo(() => {
    const byYear = new Map<number, number[]>();
    for (const y of years) byYear.set(y, []);
    for (const p of points) {
      const arr = byYear.get(p.year);
      if (arr) arr.push(p.depth);
    }
    return years.map((year) => ({
      year,
      depth: median(byYear.get(year) ?? []),
    }));
  }, [points, years]);

  if (chartData.length === 0) {
    return (
      <div className="rounded border border-border/80 bg-white p-8 text-center text-sm text-muted-foreground">
        No match data to display.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded border border-border/80 bg-white p-4 animate-in fade-in duration-300">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="2 2" stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="year"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 11, fill: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
                tickLine={{ stroke: AXIS_STROKE }}
              />
              <YAxis
                domain={[0, "auto"]}
                tick={{ fontSize: 11, fill: AXIS_STROKE }}
                axisLine={{ stroke: AXIS_STROKE }}
                tickLine={{ stroke: AXIS_STROKE }}
                label={{ value: "Depth %", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: AXIS_STROKE } }}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Median depth"]}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Line
                type="monotone"
                dataKey="depth"
                stroke={MEDIAN_BLACK}
                strokeWidth={2}
                dot={{ r: 4, fill: MEDIAN_BLACK }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-2xs text-muted-foreground">
        Median depth % ({runLabel}). Hover for values.
      </p>
    </div>
  );
}
