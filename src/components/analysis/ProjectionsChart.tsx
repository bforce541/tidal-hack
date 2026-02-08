import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts";
import type { VisualPoint } from "@/lib/api";

const MEDIAN_BLACK = "#0a0a0a";
const NEUTRAL_GRAY = "#71717a";
const HIGH_GROWTH_RED = "#b91c1c";
const GRID_STROKE = "rgba(0,0,0,0.06)";
const AXIS_STROKE = "rgba(0,0,0,0.2)";
const HIGH_RISK_DEPTH = 60;

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function buildHistogramData(points: VisualPoint[], year: number): { bin: string; count: number; min: number }[] {
  const depths = points.filter((p) => p.year === year).map((p) => p.depth);
  if (depths.length === 0) return [];
  const bins = [[0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 101]];
  return bins.map(([lo, hi]) => ({
    bin: `${lo}-${hi === 101 ? "100" : hi}`,
    min: lo,
    count: depths.filter((d) => d >= lo && d < hi).length,
  }));
}

interface ProjectionsChartProps {
  points: VisualPoint[];
  years: number[];
}

export function ProjectionsChart({ points, years }: ProjectionsChartProps) {
  const [histogramYear, setHistogramYear] = useState(2030);

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

  const histogramData = useMemo(() => buildHistogramData(points, histogramYear), [points, histogramYear]);
  const depthsAtYear = useMemo(() => points.filter((p) => p.year === histogramYear).map((p) => p.depth), [points, histogramYear]);
  const medianDepth = useMemo(() => median(depthsAtYear), [depthsAtYear]);
  const medianBin = useMemo(() => {
    const bins = [[0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 101]];
    const b = bins.find(([lo, hi]) => medianDepth >= lo && medianDepth < hi);
    return b ? `${b[0]}-${b[1] === 101 ? "100" : b[1]}` : null;
  }, [medianDepth]);

  if (points.length === 0 || chartData.length === 0) {
    return (
      <div className="rounded border border-border/80 bg-white p-8 text-center text-sm text-muted-foreground">
        No projection data to display.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trajectory: median only */}
      <div className="rounded border border-border/80 bg-white p-4 animate-in fade-in duration-300">
        <h3 className="text-sm font-semibold text-foreground mb-1">Projected average depth over time</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Historical points are shown for context; future points extend the trend for planning.
        </p>
        <div className="h-[260px]">
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
                label={{ value: "Year", position: "insideBottom", offset: -4, style: { fontSize: 10, fill: AXIS_STROKE } }}
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

      {/* Histogram: one toggle */}
      {histogramData.length > 0 && (
        <div className="rounded border border-border/80 bg-white p-4">
          <p className="text-xs text-muted-foreground mb-2">
            Shows how projected depths are distributed across anomalies in the selected year.
          </p>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Risk distribution (projected depth)
            </span>
            <div className="flex rounded border border-border/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setHistogramYear(2030)}
                className={`px-2.5 py-1 text-xs ${histogramYear === 2030 ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                2030
              </button>
              <button
                type="button"
                onClick={() => setHistogramYear(2040)}
                className={`px-2.5 py-1 text-xs border-l border-border/80 ${histogramYear === 2040 ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                2040
              </button>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="bin" tick={{ fontSize: 9, fill: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} tickLine={{ stroke: AXIS_STROKE }} />
                <YAxis tick={{ fontSize: 10, fill: AXIS_STROKE }} axisLine={{ stroke: AXIS_STROKE }} tickLine={{ stroke: AXIS_STROKE }} />
                <Bar dataKey="count" fill={NEUTRAL_GRAY} fillOpacity={0.7} radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {histogramData.map((entry) => (
                    <Cell
                      key={entry.bin}
                      fill={entry.min >= HIGH_RISK_DEPTH ? HIGH_GROWTH_RED : NEUTRAL_GRAY}
                      fillOpacity={entry.min >= HIGH_RISK_DEPTH ? 0.5 : 0.7}
                    />
                  ))}
                </Bar>
                {medianBin && <ReferenceLine x={medianBin} stroke={MEDIAN_BLACK} strokeWidth={1} strokeDasharray="4 2" />}
                <ReferenceLine x="60-70" stroke={HIGH_GROWTH_RED} strokeWidth={1} strokeDasharray="2 2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-2xs text-muted-foreground">
            <span className="font-medium">Median</span>: {medianDepth.toFixed(0)}% (dashed line) · <span className="font-medium">High-risk</span>: ≥{HIGH_RISK_DEPTH}% (red bars)
          </p>
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        Linear extrapolations from prior inspections. For prioritization support only.
      </p>
    </div>
  );
}
