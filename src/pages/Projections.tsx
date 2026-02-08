import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchProjectVisual, pipelineOutputUrl, requestProject, requestMlProject, type MlProjectResponse } from "@/lib/api";
import { ArrowLeft, Download, Loader2, Sparkles } from "lucide-react";
import { ProjectionsVideoPlayer } from "@/components/analysis/ProjectionsVideoPlayer";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { AgentDrawer } from "@/components/analysis/AgentDrawer";

const DELTA_BIN_RANGES: { label: string; lo: number; hi: number }[] = [
  { label: "< -20", lo: -Infinity, hi: -20 },
  { label: "-20 to -10", lo: -20, hi: -10 },
  { label: "-10 to -5", lo: -10, hi: -5 },
  { label: "-5 to -1", lo: -5, hi: -1 },
  { label: "-1 to 1", lo: -1, hi: 1 },
  { label: "1 to 5", lo: 1, hi: 5 },
  { label: "5 to 10", lo: 5, hi: 10 },
  { label: "10 to 20", lo: 10, hi: 20 },
  { label: "20+", lo: 20, hi: Infinity },
];

type ProjectionTableRow = {
  anomaly_id: string;
  year: number;
  depth: number;
  growth_rate: number | null;
  flags: string[];
};

function formatProjectionNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDepthPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(2)}%`;
}

const HIGH_RISK_DEPTH = 60;

function computeSummary(depths: number[]): {
  mean: number | null;
  median: number | null;
  p90: number | null;
  high_risk_count: number;
} {
  if (depths.length === 0)
    return { mean: null, median: null, p90: null, high_risk_count: 0 };
  const sorted = [...depths].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const p90Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  const p90 = sorted[p90Idx] ?? null;
  const high_risk_count = depths.filter((d) => d >= HIGH_RISK_DEPTH).length;
  return {
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    p90: p90 != null ? Math.round(p90 * 100) / 100 : null,
    high_risk_count,
  };
}

export default function Projections() {
  const location = useLocation();
  const jobId = (location.state as { jobId?: string } | null)?.jobId;
  const [points, setPoints] = useState<{ points: Awaited<ReturnType<typeof fetchProjectVisual>>["points"]; years: number[] } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState<string | null>(null);
  const [mlPredictions, setMlPredictions] = useState<MlProjectResponse | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);
  const autoLoadMlDoneRef = useRef(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoSessionKey, setVideoSessionKey] = useState(0);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    setError(null);
    Promise.all([
      fetchProjectVisual(jobId),
      requestProject({ job_id: jobId, target_years: [2030, 2040] }),
    ])
      .then(([visualRes, projectRes]) => {
        setPoints({ points: visualRes.points, years: visualRes.years });
        setDownloadUrl(pipelineOutputUrl(projectRes.download_url));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load projection data");
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    const state = location.state as { jobId?: string; autoLoadMl?: boolean } | null;
    if (!jobId || !state?.autoLoadMl || autoLoadMlDoneRef.current) return;
    autoLoadMlDoneRef.current = true;
    setMlError(null);
    setMlLoading(true);
    requestMlProject({ job_id: jobId, target_years: [2030, 2040] })
      .then(setMlPredictions)
      .catch((err) => setMlError(err instanceof Error ? err.message : "2030 projections could not be loaded"))
      .finally(() => setMlLoading(false));
  }, [jobId, location.state]);

  useEffect(() => {
    // Reset the video UI when predictions load/refresh.
    setVideoOpen(false);
  }, [mlPredictions]);

  const handleShowMlPredictions = () => {
    if (!jobId || mlLoading) return;
    setMlError(null);
    setMlLoading(true);
    requestMlProject({ job_id: jobId, target_years: [2030, 2040] })
      .then(setMlPredictions)
      .catch((err) => setMlError(err instanceof Error ? err.message : "2030 projections could not be loaded"))
      .finally(() => setMlLoading(false));
  };

  const projectionRows = useMemo(() => {
    if (!points) return [] as ProjectionTableRow[];
    return points.points
      .filter((p) => p.year === 2030)
      .map((p) => ({
        anomaly_id: p.anomaly_id,
        year: p.year,
        depth: p.depth,
        growth_rate: p.growth_rate,
        flags: p.flags,
      }))
      .sort((a, b) => b.depth - a.depth);
  }, [points]);

  // --- Baseline year and depth-by-year (from existing points only) ---
  const historicalYears = useMemo(() => {
    if (!points?.years?.length) return [];
    return points.years.filter((y) => y < 2030).sort((a, b) => a - b);
  }, [points]);
  const baselineYear = useMemo(() => {
    const h = historicalYears;
    return h.length > 0 ? h[0]! : null;
  }, [historicalYears]);

  const getDepthByYear = useMemo(() => {
    if (!points?.points?.length) return (_y: number) => new Map<string, number>();
    const byYear = new Map<number, Map<string, number>>();
    for (const p of points.points) {
      if (!byYear.has(p.year)) byYear.set(p.year, new Map());
      byYear.get(p.year)!.set(p.anomaly_id, p.depth);
    }
    return (year: number) => byYear.get(year) ?? new Map<string, number>();
  }, [points]);

  const averageDepthByYear = useMemo(() => {
    if (!points?.points?.length || !points?.years?.length) return [];
    const sortedYears = [...points.years].filter((y) => y <= 2030).sort((a, b) => a - b);
    return sortedYears.map((year) => {
      const depths = points.points.filter((p) => p.year === year).map((p) => p.depth);
      const mean = depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;
      return { year, mean: Math.round(mean * 100) / 100, count: depths.length };
    });
  }, [points]);

  const deltasBaselineTo2030 = useMemo(() => {
    if (baselineYear == null) return [];
    const baseMap = getDepthByYear(baselineYear);
    const map2030 = getDepthByYear(2030);
    const ids = [...baseMap.keys()].filter((id) => map2030.has(id));
    return ids.map((id) => ({
      id,
      depthBaseline: baseMap.get(id)!,
      depth2030: map2030.get(id)!,
      delta: map2030.get(id)! - baseMap.get(id)!,
    }));
  }, [baselineYear, getDepthByYear]);

  const deltaBaseline2030Bins = useMemo(() => {
    return DELTA_BIN_RANGES.map(({ label, lo, hi }) => ({
      label,
      count: deltasBaselineTo2030.filter((x) => x.delta >= lo && x.delta < hi).length,
    }));
  }, [deltasBaselineTo2030]);

  const summary2030ForTakeaways =
    mlPredictions?.ml_summary?.["2030"] ?? computeSummary(projectionRows.map((r) => r.depth));
  const summaryBaseline = useMemo(() => {
    if (baselineYear == null) return null;
    const depths = [...getDepthByYear(baselineYear).values()];
    return depths.length ? computeSummary(depths) : null;
  }, [baselineYear, getDepthByYear]);

  const keyTakeaways = useMemo(() => {
    const bullets: string[] = [];
    const base = summaryBaseline;
    const s30 = summary2030ForTakeaways;
    if (base && s30?.mean != null && base.mean != null) {
      const diff = Math.round((s30.mean - base.mean) * 100) / 100;
      bullets.push(`Average depth ${diff >= 0 ? "increased" : "changed"} by ${Math.abs(diff).toFixed(1)} points from baseline to 2030.`);
    } else if (baselineYear != null) {
      bullets.push(`Baseline (${baselineYear}) and 2030 data available; average depth in 2030: ${s30?.mean != null ? `${s30.mean.toFixed(1)}%` : "—"}.`);
    } else {
      bullets.push("2030 projection is available; add historical runs to see change over time.");
    }
    if (base && s30) {
      bullets.push(`High-risk anomalies (≥60%): ${base.high_risk_count} → ${s30.high_risk_count}.`);
    }
    if (base?.p90 != null && s30?.p90 != null) {
      bullets.push(`Top 10% depth (p90): ${base.p90.toFixed(1)}% → ${s30.p90.toFixed(1)}%.`);
    }
    return bullets.slice(0, 3);
  }, [summaryBaseline, summary2030ForTakeaways, baselineYear]);

  useEffect(() => {
    const top2030 = projectionRows[0];
    const year2030Summary = mlPredictions?.ml_summary?.["2030"] ?? null;
    window.dispatchEvent(new CustomEvent("mvp:state", {
      detail: {
        loading: loading || mlLoading,
        result: points ? { status: "ok" } : null,
        projections: {
          hasData: Boolean(points),
          jobId,
          years: points?.years ?? [],
          count2030: projectionRows.length,
          count2040: 0,
          top2030: top2030 ? {
            anomaly_id: top2030.anomaly_id,
            depth: top2030.depth,
            growth_rate: top2030.growth_rate,
            flags: top2030.flags,
          } : null,
          top2040: null,
          mlLoaded: Boolean(mlPredictions),
          mlMean2030: year2030Summary?.mean ?? null,
          mlMedian2030: year2030Summary?.median ?? null,
          mlP90_2030: year2030Summary?.p90 ?? null,
          mlHighRisk2030: year2030Summary?.high_risk_count ?? null,
          keyTakeaways,
        },
      },
    }));
  }, [jobId, keyTakeaways, loading, mlLoading, mlPredictions, points, projectionRows]);

  const withAgentLayout = (content: JSX.Element) => (
    <AnalysisProvider>
      <div className="min-h-screen bg-background flex">
        <aside className="w-72 shrink-0 border-r bg-sidebar text-sidebar-foreground">
          <div className="border-b border-sidebar-border px-4 py-3">
            <p className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/60">
              Piper
            </p>
          </div>
          <div className="p-3">
            <AgentDrawer />
          </div>
        </aside>
        <main className="flex-1 min-w-0">{content}</main>
      </div>
    </AnalysisProvider>
  );
  if (!jobId) {
    return withAgentLayout(
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No job selected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Open Future Projections from the Run Pipeline page after running the pipeline.
            </p>
            <Button asChild variant="default" className="gap-2">
              <Link to="/mvp">
                <ArrowLeft className="h-4 w-4" />
                Back to Run Pipeline
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return withAgentLayout(
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Loading Future Projections</p>
            <p className="text-xs text-muted-foreground text-center">
              Generating 2030 projection data…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return withAgentLayout(
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/mvp">
            <ArrowLeft className="h-4 w-4" />
            Back to Run Pipeline
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Future Projections (2030)</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!jobId || mlLoading}
            onClick={handleShowMlPredictions}
          >
            {mlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Show 2030 projections
          </Button>
          {downloadUrl && (
            <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download Projections
              </Button>
            </a>
          )}
        </div>
      </header>
      <main className="p-6 max-w-4xl mx-auto">
        {error && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/mvp">Back to Run Pipeline</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {mlError && (
          <Card className="border-destructive/50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-destructive">{mlError}</p>
            </CardContent>
          </Card>
        )}
        {!error && points && (
          <div className="space-y-8">
            {/* 2030 Projection Summary — executive summary at top */}
            <Card className="border border-border/80 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">2030 Projection Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Most anomalies are expected to remain in lower depth ranges by 2030, with gradual shifts toward higher depths over time.</li>
                  <li>A small but growing subset of anomalies move into higher-risk categories, helping identify areas that may need earlier attention.</li>
                  <li>These projections extend observed historical patterns to support planning and prioritization for the next decade.</li>
                </ul>
              </CardContent>
            </Card>

            {mlPredictions && (
              <Card className="border border-border/80 bg-muted/30">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      2030 Projection
                    </CardTitle>
                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={[
                          "font-mono tracking-wide",
                          "hover:animate-pulse motion-reduce:hover:animate-none",
                          // Custom "VIEW" pill color (from reference).
                          "bg-[#5d6b78] text-white",
                          "hover:bg-[#54626f]",
                          "border border-transparent",
                          "shadow-sm",
                          "data-[state=open]:bg-[#54626f]",
                        ].join(" ")}
                        onClick={() => {
                          setVideoOpen((o) => {
                            const next = !o;
                            if (next) setVideoSessionKey((k) => k + 1);
                            return next;
                          });
                        }}
                      >
                        {videoOpen ? "HIDE" : "VIEW"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {videoOpen ? (
                    <div className="space-y-1">
                      <ProjectionsVideoPlayer
                        key={videoSessionKey}
                        src="/future-projections.mp4"
                        trimEndSeconds={2.24}
                        yearJumps={[
                          { year: 2007, seconds: 0.7 },
                          { year: 2015, seconds: 2.7 },
                          { year: 2022, seconds: 4.7 },
                          { year: 2030, seconds: 6.7 },
                        ]}
                        autoPreview
                      />
                      <div className="flex justify-end">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Powered by Gemini
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/80 bg-background p-3">
                      <p className="text-sm text-muted-foreground">
                        Click <span className="font-mono">VIEW</span> to open the projection timeline video.
                      </p>
                    </div>
                  )}
                  <div className="rounded-md border bg-background p-3 max-w-xs">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Mean depth (2030)</p>
                    <p className="text-xl font-mono font-semibold">
                      {mlPredictions.ml_predictions["2030"] != null
                        ? `${formatProjectionNumber(mlPredictions.ml_predictions["2030"])}%`
                        : "—"}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Projections are generated by extending historical depth progression patterns forward to 2030 for planning purposes.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Key Takeaways */}
            {keyTakeaways.length > 0 && (
              <Card className="border border-border/80 bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Key takeaways</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {keyTakeaways.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Change from baseline → 2030 */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Change from {baselineYear ?? "baseline"} → 2030
                </h2>
                <p className="text-sm text-muted-foreground/90 mt-1">
                  These charts show how anomaly depth evolves from the earliest available inspection year to the 2030 projection, extending observed patterns for planning.
                </p>
              </div>

              {/* Chart A: Projected average depth over time */}
              {averageDepthByYear.length > 0 && (
                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">Projected average depth over time</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="h-[240px] flex items-end gap-1">
                      {averageDepthByYear.map(({ year, mean, count }) => (
                        <div
                          key={year}
                          className="flex-1 flex flex-col items-center gap-1"
                          title={`${year}: ${mean}% (n=${count})`}
                        >
                          <div
                            className={`w-full rounded-t min-h-[4px] ${year === 2030 ? "bg-[#0B1F33]" : "bg-muted-foreground/35"}`}
                            style={{ height: `${Math.min(100, (mean / 100) * 200)}px` }}
                          />
                          <span className={`text-[10px] ${year === 2030 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{year}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground/90">
                      This chart shows how average anomaly depth has changed over past inspection years and how that trend extends toward 2030.
                      The gradual upward movement reflects long-term progression rather than sudden change, supporting forward-looking maintenance planning.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Chart C: Δ Depth baseline → 2030 */}
              {deltasBaselineTo2030.length > 0 && (
                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">Change per anomaly ({baselineYear ?? "baseline"} → 2030)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="h-[220px] overflow-auto">
                      <div className="space-y-1.5">
                        {deltaBaseline2030Bins.map((b, i) => {
                          const isPositiveGrowth = DELTA_BIN_RANGES[i] && DELTA_BIN_RANGES[i].lo >= 1;
                          return (
                            <div key={b.label} className="flex items-center gap-2">
                              <span className={`w-24 text-xs shrink-0 ${isPositiveGrowth ? "text-foreground/90" : "text-muted-foreground"}`}>{b.label}</span>
                              <div className="flex-1 min-w-0 h-5 bg-muted/50 rounded overflow-hidden">
                                <div
                                  className={`h-full rounded ${isPositiveGrowth ? "bg-[#0B1F33]" : "bg-muted-foreground/35"}`}
                                  style={{ width: `${Math.min(100, (b.count / Math.max(1, Math.max(...deltaBaseline2030Bins.map((x) => x.count)))) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono w-6 text-right text-muted-foreground">{b.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground/90 pt-1">
                      Positive values indicate projected deepening by 2030.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Projected Anomalies (2030) — main table */}
            <Card className="border border-border/80 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Projected Anomalies (2030)</CardTitle>
                <p className="text-xs text-muted-foreground font-normal">Sorted by projected depth (highest first).</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This table lists individual anomalies projected to 2030, ordered by estimated depth.
                  Higher values indicate anomalies that may warrant closer review or earlier intervention.
                  {projectionRows.some((r) => r.depth >= HIGH_RISK_DEPTH) && (
                    <> Anomalies marked as high risk exceed commonly used planning thresholds.</>
                  )}
                </p>
                <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-md border border-border/80">
                  <Table>
                    <TableHeader>
                      <TableRow className="sticky top-0 z-10 bg-muted/80 backdrop-blur border-b">
                        <TableHead className="whitespace-nowrap font-mono text-xs text-left">Anomaly ID</TableHead>
                        <TableHead className="whitespace-nowrap font-mono text-xs text-left">Projected Depth (%)</TableHead>
                        <TableHead className="whitespace-nowrap font-mono text-xs text-left">Growth Rate</TableHead>
                        <TableHead className="whitespace-nowrap font-mono text-xs text-left">Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectionRows.length > 0 ? projectionRows.map((row) => (
                        <TableRow key={`2030-${row.anomaly_id}`}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{row.anomaly_id}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {formatDepthPercent(row.depth)}
                            {row.depth >= HIGH_RISK_DEPTH && (
                              <span className="ml-1.5 inline-flex items-center rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">High risk</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{formatProjectionNumber(row.growth_rate)}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{row.flags.length ? row.flags.join(", ") : "—"}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground py-4">No 2030 projection rows.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
