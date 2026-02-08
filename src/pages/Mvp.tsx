import { useState, useCallback, useEffect, useMemo } from "react";
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
import { Loader2, FileDown, ArrowLeft, Upload, ChevronDown, Sparkles, Check } from "lucide-react";
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
  const [historicalVisual, setHistoricalVisual] = useState<{
    points: VisualPoint[];
    years: number[];
  } | null>(null);
  const [historicalVisualLoading, setHistoricalVisualLoading] = useState(false);

  const runsList = useMemo(() => (runs === "2007,2015" ? [2007, 2015] : [2015, 2022]), [runs]);
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

  useEffect(() => {
    const handler = () => {
      if (jobId) navigate("/mvp/projections", { state: { jobId, autoLoadMl: true } });
    };
    window.addEventListener("mvp:open-projections", handler as EventListener);
    return () => window.removeEventListener("mvp:open-projections", handler as EventListener);
  }, [jobId, navigate]);

  // Ensure body scroll is not locked when entering this page (e.g. after Sheet/drawer or client nav)
  useEffect(() => {
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const hasResult = success || successRunAll;
  const step1Active = !file;
  const step2Active = !!file && !hasResult;
  const step3Active = hasResult;

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
    <div className="flex flex-col">
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

      <main className="flex-1 w-full py-6 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {/* Section 1 — Page header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Analyze Inline Inspection Data
              </h1>
              <p className="text-sm text-gray-600 max-w-2xl">
                Upload an ILI Excel file, choose a run pair, then generate matched anomalies and a 2030 planning projection.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Downloads</span>
              {(() => {
                const activeResult = success && result ? result : (successRunAll && resultRunAll?.runs?.find((r) => r.status === "ok")) ?? null;
                const matchesUrl = activeResult?.outputs?.matches_csv;
                const summaryUrl = activeResult?.outputs?.summary_txt;
                return (
                  <>
                    <a
                      href={matchesUrl ? pipelineOutputUrl(matchesUrl) : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={!matchesUrl ? "pointer-events-none" : ""}
                    >
                      <Button variant="outline" size="sm" className="gap-1.5" disabled={!matchesUrl}>
                        <FileDown className="h-3.5 w-3.5" />
                        Download matches (CSV)
                      </Button>
                    </a>
                    <a
                      href={summaryUrl ? pipelineOutputUrl(summaryUrl) : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={!summaryUrl ? "pointer-events-none" : ""}
                    >
                      <Button variant="outline" size="sm" className="gap-1.5" disabled={!summaryUrl}>
                        <FileDown className="h-3.5 w-3.5" />
                        Download full summary
                      </Button>
                    </a>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Section 2 — Stepper */}
          <div className="flex items-center gap-2 sm:gap-4 py-4 border-b border-gray-200 mb-6">
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${step1Active ? "border-primary bg-primary text-primary-foreground" : "border-gray-300 bg-white text-gray-600"}`}>1</span>
              <span className="text-sm font-medium text-foreground">Upload file</span>
            </div>
            <div className="h-px flex-1 min-w-[16px] bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${step2Active || step3Active ? "border-primary bg-primary text-primary-foreground" : "border-gray-300 bg-white text-gray-600"}`}>2</span>
              <span className="text-sm font-medium text-foreground">Select run pair</span>
            </div>
            <div className="h-px flex-1 min-w-[16px] bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${step3Active ? "border-primary bg-primary text-primary-foreground" : "border-gray-300 bg-white text-gray-600"}`}>3</span>
              <span className="text-sm font-medium text-foreground">Analyze & review</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
            {/* Left column */}
            <div className="space-y-6">
              {/* Section 3 — Main Input card */}
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Input</CardTitle>
                  <p className="text-sm text-gray-600 mt-0.5">Choose your file and the inspection years to compare.</p>
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
                  <div className="space-y-2">
                    <Button
                      onClick={handleRun}
                      disabled={loading || !file}
                      className="gap-2 rounded-lg w-full sm:w-auto min-w-[140px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing…
                        </>
                      ) : (
                        "Run analysis"
                      )}
                    </Button>
                    <p className="text-sm text-gray-600">Typically runs in under a minute depending on file size.</p>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-gray-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">What happens next</p>
                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                      <li>Matches anomalies across runs</li>
                      <li>Summarizes what changed</li>
                      <li>Creates a 2030 planning projection view</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4 — What you'll get tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: "Matched anomalies", desc: "See which anomalies persisted and how they changed between runs.", key: "matched" },
                  { title: "Change summary", desc: "Quick counts and a readable overview of what shifted.", key: "summary" },
                  { title: "2030 projection", desc: "Planning view showing expected depth distribution by 2030.", key: "projection" },
                ].map(({ title, desc, key }) => (
                  <Card key={key} className={`border border-gray-200 bg-white shadow-sm ${hasResult ? "ring-1 ring-primary/20" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{title}</p>
                          <p className="text-xs text-gray-600 mt-1">{desc}</p>
                        </div>
                        {hasResult && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-destructive">{error}</p>
                  </CardContent>
                </Card>
              )}

              {resultRunAll && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">Results</h2>
                  <p className="text-sm text-gray-600">Run all — 2007→2015 + 2015→2022. Preview and downloads per run below.</p>
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
                        downloads={resultRunAll.runs[0]?.status === "ok" && resultRunAll.runs[0]?.outputs ? [{ label: "Download matches CSV", url: resultRunAll.runs[0].outputs.matches_csv, kind: "primary" }, ...(resultRunAll.runs[0].outputs.comparison_csv ? [{ label: "Download comparison CSV", url: resultRunAll.runs[0].outputs.comparison_csv, kind: "secondary" as const }] : []), { label: "Download Full Summary", url: resultRunAll.runs[0].outputs.summary_txt, kind: "secondary" }] : []}
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
                        downloads={resultRunAll.runs[1]?.status === "ok" && resultRunAll.runs[1]?.outputs ? [{ label: "Download matches CSV", url: resultRunAll.runs[1].outputs.matches_csv, kind: "primary" }, ...(resultRunAll.runs[1].outputs.comparison_csv ? [{ label: "Download comparison CSV", url: resultRunAll.runs[1].outputs.comparison_csv, kind: "secondary" as const }] : []), { label: "Download Full Summary", url: resultRunAll.runs[1].outputs.summary_txt, kind: "secondary" }] : []}
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
                  {resultRunAll.runs.some((r) => r.status === "ok") && jobId && (
                    <div className="pt-6 border-t border-gray-200 space-y-2">
                      <Button
                        variant="default"
                        size="lg"
                        className="w-full gap-2 bg-black hover:bg-black/90 text-white font-medium py-3"
                        onClick={() => navigate("/mvp/projections", { state: { jobId, autoLoadMl: true } })}
                      >
                        <Sparkles className="h-4 w-4" />
                        Show ML Predictions
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Opens the 2030 planning view with projected anomaly depth.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {success && result && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Results</h2>
                    <p className="text-sm text-gray-600 mt-0.5">Preview of matched anomalies and a short summary of what was found.</p>
                  </div>
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
                        className="border border-gray-200 bg-white shadow-sm overflow-hidden"
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

                  <section className="space-y-2">
                    <h3 className="text-base font-semibold text-foreground">
                      Median Depth Trend
                    </h3>
                    <p className="text-sm text-gray-600">
                      Individual anomaly growth varies significantly; see matches table for details.
                    </p>
                    {historicalVisualLoading ? (
                      <div className="flex items-center gap-2 rounded border border-gray-200 bg-white p-8 text-sm text-muted-foreground">
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
                      <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-muted-foreground">
                        No match data for chart.
                      </div>
                    ) : null}
                  </section>

                  <Card className="border border-gray-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">Matches preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {matchesRows.length > 0 ? (
                        <>
                          <div className="overflow-x-auto overflow-y-auto max-h-[320px] rounded-md border border-gray-200">
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

                  <Card className="border border-gray-200 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">Quick Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-600">
                        <li>
                          Compared {prevYear} → {laterYear} inspection runs and matched anomalies across runs.
                        </li>
                        <li>
                          Found {(result.metrics.matched ?? 0) + (result.metrics.new_or_unmatched ?? 0)} anomalies in {laterYear}; matched {result.metrics.matched ?? "(not available)"} to {prevYear} (match rate {result.metrics.match_rate != null ? `${result.metrics.match_rate}%` : "(not available)"}).
                        </li>
                        <li>
                          Identified {result.metrics.new_or_unmatched ?? "(not available)"} anomalies that appear new in {laterYear}.
                        </li>
                        {(() => {
                          const medianMatch = summaryText && /median\s+offset[^\d]*([\d.]+)\s*m/i.exec(summaryText);
                          if (medianMatch?.[1]) {
                            return (
                              <li>
                                Alignment quality check: median offset ~ {medianMatch[1]} m.
                              </li>
                            );
                          }
                          return null;
                        })()}
                      </ul>
                    </CardContent>
                  </Card>

                  {jobId && (
                    <div className="space-y-2 pt-2">
                      <Button
                        variant="default"
                        size="lg"
                        className="w-full gap-2 bg-black hover:bg-black/90 text-white font-medium py-3"
                        onClick={() => navigate("/mvp/projections", { state: { jobId, autoLoadMl: true } })}
                      >
                        <Sparkles className="h-4 w-4" />
                        Show ML Predictions
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Opens the 2030 planning view with projected anomaly depth.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 5 — Side panel */}
            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Input requirements</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Excel format (.xlsx)</li>
                    <li>Includes anomaly depth (%) and distance values</li>
                    <li>Contains run year information</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">How this helps</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Supports maintenance prioritization</li>
                    <li>Highlights areas trending worse</li>
                    <li>Provides a forward-looking planning snapshot</li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="border border-gray-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Tips</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li>If results look sparse, try a different run pair.</li>
                    <li>Larger files may take longer to process.</li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );

  return (
    <AnalysisProvider>
      <div className="min-h-dvh bg-background flex">
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
        <main className="flex-1 min-w-0 min-h-0">
          {content}
        </main>
      </div>
    </AnalysisProvider>
  );
}
