import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectionsChart } from "@/components/analysis/ProjectionsChart";
import { AgentDrawer } from "@/components/analysis/AgentDrawer";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchProjectVisual, pipelineOutputUrl, requestProject } from "@/lib/api";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

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

export default function Projections() {
  const location = useLocation();
  const jobId = (location.state as { jobId?: string } | null)?.jobId;
  const [points, setPoints] = useState<{ points: Awaited<ReturnType<typeof fetchProjectVisual>>["points"]; years: number[] } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState<string | null>(null);

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

  const projectionRows = useMemo(() => {
    if (!points) return { y2030: [] as ProjectionTableRow[], y2040: [] as ProjectionTableRow[] };
    const rows = points.points
      .filter((p) => p.year === 2030 || p.year === 2040)
      .map((p) => ({
        anomaly_id: p.anomaly_id,
        year: p.year,
        depth: p.depth,
        growth_rate: p.growth_rate,
        flags: p.flags,
      }))
      .sort((a, b) => b.depth - a.depth);
    return {
      y2030: rows.filter((r) => r.year === 2030),
      y2040: rows.filter((r) => r.year === 2040),
    };
  }, [points]);

  useEffect(() => {
    const y2030Count = projectionRows.y2030.length;
    const y2040Count = projectionRows.y2040.length;
    const top2030 = projectionRows.y2030[0];
    const top2040 = projectionRows.y2040[0];
    window.dispatchEvent(new CustomEvent("mvp:state", {
      detail: {
        loading,
        result: points ? { status: "ok" } : null,
        projections: {
          hasData: Boolean(points),
          jobId,
          years: points?.years ?? [],
          count2030: y2030Count,
          count2040: y2040Count,
          top2030: top2030 ? {
            anomaly_id: top2030.anomaly_id,
            depth: top2030.depth,
            growth_rate: top2030.growth_rate,
            flags: top2030.flags,
          } : null,
          top2040: top2040 ? {
            anomaly_id: top2040.anomaly_id,
            depth: top2040.depth,
            growth_rate: top2040.growth_rate,
            flags: top2040.flags,
          } : null,
        },
      },
    }));
  }, [jobId, loading, points, projectionRows.y2030, projectionRows.y2040]);
  const content = !jobId ? (
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
  ) : loading ? (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Future Projections loading</p>
          <p className="text-xs text-muted-foreground text-center">
            Generating 2030 & 2040 projection data…
          </p>
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/mvp">
            <ArrowLeft className="h-4 w-4" />
            Back to Run Pipeline
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Future Projections (2030 / 2040)</h1>
        {downloadUrl && (
          <a href={downloadUrl} download target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download Projections
            </Button>
          </a>
        )}
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
        {!error && points && (
          <div className="space-y-6">
            <ProjectionsChart points={points.points} years={points.years} />

            <Card className="border border-border/80 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Projected Anomalies (2030)</CardTitle>
              </CardHeader>
              <CardContent>
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
                      {projectionRows.y2030.length > 0 ? projectionRows.y2030.map((row) => (
                        <TableRow key={`2030-${row.anomaly_id}`}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{row.anomaly_id}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{formatProjectionNumber(row.depth)}</TableCell>
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

            <Card className="border border-border/80 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Projected Anomalies (2040)</CardTitle>
              </CardHeader>
              <CardContent>
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
                      {projectionRows.y2040.length > 0 ? projectionRows.y2040.map((row) => (
                        <TableRow key={`2040-${row.anomaly_id}`}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{row.anomaly_id}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{formatProjectionNumber(row.depth)}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{formatProjectionNumber(row.growth_rate)}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{row.flags.length ? row.flags.join(", ") : "—"}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground py-4">No 2040 projection rows.</TableCell>
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

  return (
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
        <main className="flex-1 min-w-0">
          {content}
        </main>
      </div>
    </AnalysisProvider>
  );
}
