import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  uploadFile,
  runPipeline,
  runPipelineAll,
  pipelineOutputUrl,
  pipelinePreviewUrl,
  fetchProjectVisual,
  type PipelineRunResponse,
  type PipelineRunAllResponse,
  type VisualPoint,
} from "@/lib/api";
import { HistoricalGrowthChart } from "@/components/analysis/HistoricalGrowthChart";
import { ResultsTab } from "@/components/analysis/ResultsTab";
import { Loader2, FileDown, ArrowLeft, Upload, ChevronDown } from "lucide-react";
import { AnalysisProvider } from "@/context/AnalysisContext";
import { AgentDrawer } from "@/components/analysis/AgentDrawer";

type RunPair = "2007,2015" | "2015,2022" | "ALL";

const RUN_OPTIONS: { value: RunPair; label: string }[] = [
  { value: "2007,2015", label: "2007 → 2015" },
  { value: "2015,2022", label: "2015 → 2022" },
  { value: "ALL", label: "Run all (2007→2015 + 2015→2022)" },
];

const PREFERRED_MATCH_COLUMNS = [
  "2015 Anomaly ID",
  "2022 Anomaly ID",
  "2015 Distance (Aligned, m)",
  "2022 Distance (m)",
  "Distance Difference (m)",
  "2015 Depth (%)",
  "2022 Depth (%)",
  "Match Quality",
  "Needs Review",
];

function formatCell(val: string | number | null | undefined): string {
  if (val == null || val === "") return "—";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(3);
  return String(val);
}

export default function Mvp() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [runs, setRuns] = useState<RunPair>("2015,2022");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineRunResponse | null>(null);
  const [resultRunAll, setResultRunAll] = useState<PipelineRunAllResponse | null>(null);
  const [runAllTab, setRunAllTab] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [previewLimit, setPreviewLimit] = useState(25);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [historicalVisual, setHistoricalVisual] = useState<{
    points: VisualPoint[];
    years: number[];
  } | null>(null);
  const [historicalVisualLoading, setHistoricalVisualLoading] = useState(false);

  const runsList = runs === "2007,2015" ? [2007, 2015] : [2015, 2022];
  const [prevYear, laterYear] = runsList[0] < runsList[1] ? [runsList[0], runsList[1]] : [runsList[1], runsList[0]];
  const isRunAll = runs === "ALL";
  const success = result?.status === "ok" && result.outputs && !resultRunAll;
  const successRunAll = resultRunAll?.status === "ok";
  const jobId =
    result?.job_id ??
    (resultRunAll?.runs?.[1]?.status === "ok" ? resultRunAll.runs[1].job_id : null) ??
    (resultRunAll?.runs?.[0]?.status === "ok" ? resultRunAll.runs[0].job_id : null) ??
    null;
  const matchesRows = result?.preview?.matches_rows ?? [];
  const summaryText = result?.preview?.summary_text ?? "";
  const preferredCols = matchesRows.length > 0
    ? PREFERRED_MATCH_COLUMNS.filter((c) => c in (matchesRows[0] || {}))
    : [];
  const columns =
    preferredCols.length > 0
      ? preferredCols
      : matchesRows.length > 0 && matchesRows[0]
        ? Object.keys(matchesRows[0])
        : [];

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mvp:state", {
      detail: {
        hasFile: Boolean(file),
        runs,
        loading,
        result,
        preview: result?.preview ?? null,
      },
    }));
  }, [file, runs, loading, result]);

  useEffect(() => {
    if (!resultRunAll?.runs?.length) return;
    const failed = resultRunAll.runs.findIndex((r) => r.status !== "ok");
    if (failed === 0) setRunAllTab("0");
    else if (failed === 1) setRunAllTab("1");
    else setRunAllTab("0");
  }, [resultRunAll]);

  useEffect(() => {
    const jobId = result?.job_id;
    if (!jobId || !result?.status || result.status !== "ok") {
      setHistoricalVisual(null);
      return;
    }
    setHistoricalVisualLoading(true);
    fetchProjectVisual(jobId)
      .then((res) => {
        const historicalYears = [prevYear, laterYear];
        const historicalPoints = res.points.filter((p) =>
          historicalYears.includes(p.year)
        );
        setHistoricalVisual({
          points: historicalPoints,
          years: historicalYears,
        });
      })
      .catch(() => setHistoricalVisual(null))
      .finally(() => setHistoricalVisualLoading(false));
  }, [result?.job_id, result?.status, prevYear, laterYear]);

  const handleRun = useCallback(async () => {
    setError(null);
    setResult(null);
    setResultRunAll(null);
    setPreviewLimit(25);
    if (!file) {
      setError("Please upload an Excel file.");
      return;
    }
    setLoading(true);
    try {
      const { storedPath } = await uploadFile(file);
      if (isRunAll) {
        const data = await runPipelineAll({ inputPath: storedPath });
        setResultRunAll(data);
      } else {
        const data = await runPipeline({
          inputPath: storedPath,
          runs: runsList,
        });
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [file, runsList, isRunAll]);

  useEffect(() => {
    const handler = () => void handleRun();
    window.addEventListener("mvp:run", handler as EventListener);
    return () => window.removeEventListener("mvp:run", handler as EventListener);
  }, [handleRun]);

  const handleOpenFutureProjections = useCallback(() => {
    if (!jobId || loadingFuture) return;
    setLoadingFuture(true);
    window.setTimeout(() => {
      navigate("/mvp/projections", { state: { jobId } });
      setLoadingFuture(false);
    }, 3000);
  }, [jobId, loadingFuture, navigate]);

  useEffect(() => {
    const handler = () => handleOpenFutureProjections();
    window.addEventListener("mvp:open-projections", handler as EventListener);
    return () => window.removeEventListener("mvp:open-projections", handler as EventListener);
  }, [handleOpenFutureProjections]);

  const handleViewMore = async () => {
    if (!result || previewLimit >= 100) return;
    setLoadingMore(true);
    try {
      const res = await fetch(pipelinePreviewUrl(100, prevYear, laterYear));
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();
      setResult((prev) => prev ? { ...prev, preview: { ...prev.preview, matches_rows: data.matches_rows } } : null);
      setPreviewLimit(100);
    } catch {
      setError("Failed to load more rows");
    } finally {
      setLoadingMore(false);
    }
  };

  const content = (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/50 px-6 h-12 flex items-center justify-between shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          PipeAlign
        </span>
        <div className="w-16" />
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full py-8 px-6 space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Analyze
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload your ILI Excel file, choose run years, then analyze. Download matches (CSV) and summary (plain text).
          </p>
        </div>

        <Card className="border border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Upload ILI Excel (.xlsx)
              </Label>
              <div className="mt-2 flex items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background hover:bg-accent hover:text-accent-foreground">
                    <Upload className="h-4 w-4" />
                    Choose file
                  </span>
                </label>
                {file && (
                  <span className="text-sm text-muted-foreground">
                    {file.name}
                    {file.size > 0 && (
                      <span className="ml-1 font-mono text-2xs">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                Run pair
              </Label>
              <Select value={runs} onValueChange={(v) => setRuns(v as RunPair)} disabled={loading}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRun}
              disabled={loading || !file}
              className="gap-2 rounded-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {resultRunAll && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Run all — 2007→2015 + 2015→2022
            </h2>
            <Tabs value={runAllTab} onValueChange={setRunAllTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="0">2007 → 2015</TabsTrigger>
                <TabsTrigger value="1">2015 → 2022</TabsTrigger>
                <TabsTrigger value="2">Continued issues</TabsTrigger>
              </TabsList>
              <TabsContent value="0" className="mt-4">
                <ResultsTab
                  title="2007 → 2015"
                  subtitle={resultRunAll.runs[0]?.status === "ok" && resultRunAll.runs[0]?.metrics ? "Matched / New / Match rate" : undefined}
                  status={resultRunAll.runs[0]?.status === "ok" ? "ok" : resultRunAll.runs[0] ? "error" : "pending"}
                  metrics={resultRunAll.runs[0]?.status === "ok" && resultRunAll.runs[0]?.metrics ? { matched: resultRunAll.runs[0].metrics.matched, new_or_unmatched: resultRunAll.runs[0].metrics.new_or_unmatched, match_rate: resultRunAll.runs[0].metrics.match_rate } : undefined}
                  downloads={resultRunAll.runs[0]?.status === "ok" && resultRunAll.runs[0]?.outputs ? [{ label: "Download matches CSV", url: resultRunAll.runs[0].outputs.matches_csv, kind: "primary" }, ...(resultRunAll.runs[0].outputs.comparison_csv ? [{ label: "Download comparison CSV", url: resultRunAll.runs[0].outputs.comparison_csv, kind: "secondary" as const }] : []), { label: "Download summary", url: resultRunAll.runs[0].outputs.summary_txt, kind: "secondary" }] : []}
                  previewTable={(() => {
                    const rows0 = resultRunAll.runs[0]?.preview?.matches_rows ?? [];
                    const first0 = rows0[0];
                    const cols0 = first0 && rows0.length ? (PREFERRED_MATCH_COLUMNS.filter((c) => c in first0).length > 0 ? PREFERRED_MATCH_COLUMNS.filter((c) => c in first0) : Object.keys(first0)) : [];
                    return { columns: cols0, rows: rows0 };
                  })()}
                  previewText={resultRunAll.runs[0]?.preview?.summary_text ?? ""}
                  errorMessage={resultRunAll.runs[0]?.status !== "ok" ? resultRunAll.runs[0]?.detail : undefined}
                />
              </TabsContent>
              <TabsContent value="1" className="mt-4">
                <ResultsTab
                  title="2015 → 2022"
                  subtitle={resultRunAll.runs[1]?.status === "ok" && resultRunAll.runs[1]?.metrics ? "Matched / New / Match rate" : undefined}
                  status={resultRunAll.runs[1]?.status === "ok" ? "ok" : resultRunAll.runs[1] ? "error" : "pending"}
                  metrics={resultRunAll.runs[1]?.status === "ok" && resultRunAll.runs[1]?.metrics ? { matched: resultRunAll.runs[1].metrics.matched, new_or_unmatched: resultRunAll.runs[1].metrics.new_or_unmatched, match_rate: resultRunAll.runs[1].metrics.match_rate } : undefined}
                  downloads={resultRunAll.runs[1]?.status === "ok" && resultRunAll.runs[1]?.outputs ? [{ label: "Download matches CSV", url: resultRunAll.runs[1].outputs.matches_csv, kind: "primary" }, ...(resultRunAll.runs[1].outputs.comparison_csv ? [{ label: "Download comparison CSV", url: resultRunAll.runs[1].outputs.comparison_csv, kind: "secondary" as const }] : []), { label: "Download summary", url: resultRunAll.runs[1].outputs.summary_txt, kind: "secondary" }] : []}
                  previewTable={(() => {
                    const rows1 = resultRunAll.runs[1]?.preview?.matches_rows ?? [];
                    const first1 = rows1[0];
                    const cols1 = first1 && rows1.length ? (PREFERRED_MATCH_COLUMNS.filter((c) => c in first1).length > 0 ? PREFERRED_MATCH_COLUMNS.filter((c) => c in first1) : Object.keys(first1)) : [];
                    return { columns: cols1, rows: rows1 };
                  })()}
                  previewText={resultRunAll.runs[1]?.preview?.summary_text ?? ""}
                  errorMessage={resultRunAll.runs[1]?.status !== "ok" ? resultRunAll.runs[1]?.detail : undefined}
                />
              </TabsContent>
              <TabsContent value="2" className="mt-4">
                {(() => {
                  const bothOk = resultRunAll.runs.length >= 2 && resultRunAll.runs.every((r) => r.status === "ok");
                  const co = resultRunAll.continued_outputs;
                  const hasContinued = co && (co.continued_txt || co.continued_csv || co.continued_xlsx);
                  const cp = resultRunAll.continued_preview;
                  return (
                    <ResultsTab
                      title="Continued issues"
                      subtitle={bothOk && hasContinued ? "Issues tracked across 2007 → 2015 → 2022" : undefined}
                      status={bothOk && hasContinued ? "ok" : "error"}
                      metrics={undefined}
                      downloads={bothOk && co ? [...(co.continued_txt ? [{ label: "Download continued issues (TXT)", url: co.continued_txt, kind: "secondary" as const }] : []), ...(co.continued_csv ? [{ label: "Download continued issues (CSV)", url: co.continued_csv, kind: "primary" as const }] : [])] : []}
                      previewTable={{ columns: cp?.continued_rows?.[0] ? Object.keys(cp.continued_rows[0]) : [], rows: cp?.continued_rows ?? [] }}
                      previewText={cp?.continued_text ?? ""}
                      emptyMessage={!bothOk || !hasContinued ? "Continued issues not available until both runs succeed." : undefined}
                    />
                  );
                })()}
              </TabsContent>
            </Tabs>
            {resultRunAll.runs.some((r) => r.status === "ok") && (
              <div className="space-y-2 pt-4 border-t border-border/80">
                <Button
                  variant="default"
                  size="lg"
                  className="gap-2 bg-black hover:bg-black/90 text-white font-medium px-6 py-3"
                  disabled={!jobId || loadingFuture}
                  onClick={handleOpenFutureProjections}
                >
                  {loadingFuture ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  View Future Projections (2030 / 2040)
                </Button>
                <p className="text-xs text-muted-foreground">
                  Opens a new page to generate and download 2030 & 2040 projections.
                </p>
              </div>
            )}
          </div>
        )}

        {success && result && (
          <div className="space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Metrics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Matched", value: result.metrics.matched },
                { label: "New / unmatched", value: result.metrics.new_or_unmatched },
                { label: "Missing", value: result.metrics.missing },
                { label: "Ambiguous", value: result.metrics.ambiguous },
                { label: "Match rate", value: `${result.metrics.match_rate}%` },
              ].map(({ label, value }) => (
                <Card
                  key={label}
                  className="border border-border/80 bg-muted/20 shadow-sm overflow-hidden"
                >
                  <CardContent className="p-4">
                    <p className="text-2xl font-semibold tabular-nums text-foreground">
                      {value}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                      {label}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Downloads
              </h2>
              <div className="flex flex-wrap gap-3">
                <a
                  href={pipelineOutputUrl(result.outputs.matches_csv)}
                  download={`matches_${prevYear}_${laterYear}.csv`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="default" size="sm" className="gap-2">
                    <FileDown className="h-3.5 w-3.5" />
                    Download Matches
                  </Button>
                </a>
                <a
                  href={pipelineOutputUrl(result.outputs.summary_txt)}
                  download={`summary_${prevYear}_${laterYear}.txt`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileDown className="h-3.5 w-3.5" />
                    Download Summary
                  </Button>
                </a>
              </div>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Growth Between Runs
              </h2>
              <p className="text-sm text-muted-foreground">
                Depth % at each inspection ({prevYear} → {laterYear})
              </p>
              {historicalVisualLoading ? (
                <div className="flex items-center gap-2 rounded border border-border/80 bg-white p-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading chart…
                </div>
              ) : historicalVisual && historicalVisual.points.length > 0 ? (
                <HistoricalGrowthChart
                  points={historicalVisual.points}
                  years={historicalVisual.years}
                  runLabel={`${prevYear} → ${laterYear}`}
                />
              ) : historicalVisual ? (
                <div className="rounded border border-border/80 bg-white p-8 text-center text-sm text-muted-foreground">
                  No match data for chart.
                </div>
              ) : null}
            </section>

            <Card className="border border-border/80 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Matches preview</CardTitle>
              </CardHeader>
              <CardContent>
                {matchesRows.length > 0 ? (
                  <>
                    <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-md border border-border/80">
                      <Table>
                        <TableHeader>
                          <TableRow className="sticky top-0 z-10 bg-muted/80 backdrop-blur border-b">
                            {columns.map((col) => (
                              <TableHead key={col} className="whitespace-nowrap font-mono text-xs text-left">
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {matchesRows.map((row, i) => (
                            <TableRow key={i}>
                              {columns.map((col) => (
                                <TableCell key={col} className="font-mono text-xs whitespace-nowrap">
                                  {formatCell(row[col])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {previewLimit < 100 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 gap-1 text-muted-foreground"
                        onClick={handleViewMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        View more (up to 100 rows)
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No matches to preview.</p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button
                variant="default"
                size="lg"
                className="gap-2 bg-black hover:bg-black/90 text-white font-medium px-6 py-3"
                disabled={!jobId || loadingFuture}
                onClick={handleOpenFutureProjections}
              >
                {loadingFuture ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                View Future Projections (2030 / 2040)
              </Button>
              <p className="text-xs text-muted-foreground">
                Opens a new page to generate and download 2030 & 2040 projections.
              </p>
            </div>

            <Card className="border border-border/80 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Summary preview</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words overflow-auto max-h-[240px] rounded-md border border-border/80 p-3 bg-muted/20">
                  {summaryText || "No summary."}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      {loadingFuture && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center px-6">
          <Card className="w-full max-w-md border-white/15 bg-zinc-900 text-white shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-cyan-300" />
              <p className="text-base font-semibold tracking-wide">Future predecitions loading</p>
              <p className="text-xs text-zinc-300 text-center">
                Preparing future projections and loading visual summaries...
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <AnalysisProvider>
      <div className="min-h-screen bg-background flex">
        <aside className="w-72 shrink-0 border-r bg-sidebar text-sidebar-foreground">
          <div className="border-b border-sidebar-border px-4 py-3">
            <p className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/60">
              Analysis Agent
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
