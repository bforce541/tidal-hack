import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  runMvpUrl,
  downloadUrl,
  fetchPreview,
  type PreviewResponse,
} from "@/lib/api";
import { Loader2, FileSpreadsheet, FileUp, ArrowLeft } from "lucide-react";

type RunPair = "2007,2015" | "2015,2022";

const RUN_OPTIONS: { value: RunPair; label: string }[] = [
  { value: "2007,2015", label: "2007 → 2015" },
  { value: "2015,2022", label: "2015 → 2022" },
];

interface SummaryCounts {
  matched?: number;
  new?: number;
  missing?: number;
  ambiguous?: number;
  anomalies_prev?: number;
  anomalies_later?: number;
}
interface Summary {
  counts?: SummaryCounts;
  match_rate_pct?: number;
}

interface RunResult {
  job_id: string;
  summary?: Summary;
  download_url?: string;
  error?: boolean;
  message?: string;
}

const NUMERIC_KEYS = new Set([
  "prev_idx",
  "later_idx",
  "prev_year",
  "later_year",
  "score",
  "prev_distance_raw_m",
  "later_distance_raw_m",
  "prev_distance_corrected_m",
  "later_distance_corrected_m",
  "delta_distance_m",
  "prev_depth_percent",
  "later_depth_percent",
  "prev_length_mm",
  "later_length_mm",
  "prev_width_mm",
  "later_width_mm",
  "depth_rate",
  "length_rate",
  "width_rate",
  "years",
]);

function formatCell(val: unknown): string {
  if (val == null || val === "") return "—";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

export default function Mvp() {
  const [file, setFile] = useState<File | null>(null);
  const [runs, setRuns] = useState<RunPair>("2015,2022");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const loadPreview = useCallback(async (jobId: string) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const data = await fetchPreview(jobId);
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (result && !result.error && result.job_id) {
      loadPreview(result.job_id);
    } else {
      setPreview(null);
    }
  }, [result?.job_id, result?.error, loadPreview]);

  const handleRun = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setPreview(null);
    const form = new FormData();
    form.append("file", file);
    form.append("runs", runs);
    try {
      const res = await fetch(runMvpUrl(), { method: "POST", body: form });
      const data: RunResult = await res.json();
      setResult(data);
    } catch (e) {
      setResult({
        error: true,
        job_id: "",
        message: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith(".xlsx") || f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
      setFile(f);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const summary = result?.summary;
  const counts = summary?.counts;
  const matchRate = summary?.match_rate_pct ?? 0;
  const success = result && !result.error && summary;
  const matchedColumns = preview?.matched_preview?.length
    ? Object.keys(preview.matched_preview[0])
    : [];
  const navigate = useNavigate();

  return (
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
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            PipeAlign — ILI Alignment MVP
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload an ILI Excel, select run pair, run alignment + matching, then review results and download the full workbook.
          </p>
        </div>

        {/* (1) Input Card */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-medium">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                Excel file
              </span>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive ? "border-primary/50 bg-muted/30" : "border-muted-foreground/25 bg-muted/10"
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  id="mvp-file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="mvp-file" className="cursor-pointer flex flex-col items-center gap-2">
                  <FileUp className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Drop file here or click to upload
                  </span>
                </label>
                {file && (
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {file.name}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                Run pair
              </span>
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
              disabled={!file || loading}
              className="gap-2 rounded-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running pipeline…
                </>
              ) : (
                "Run MVP"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error state */}
        {result?.error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-destructive">{result.message}</p>
              {result.job_id && (
                <p className="text-xs text-muted-foreground mt-1.5">job_id: {result.job_id}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* (2) Results Summary */}
        {success && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Results summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Matched", value: counts?.matched ?? 0 },
                { label: "New", value: counts?.new ?? 0 },
                { label: "Missing", value: counts?.missing ?? 0 },
                { label: "Ambiguous", value: counts?.ambiguous ?? 0 },
                { label: "Match rate", value: `${matchRate}%` },
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
            <p className="text-xs text-muted-foreground max-w-xl">
              Matches are conservative by design to avoid false continuity. Full details in Excel.
            </p>
          </div>
        )}

        {/* (3) Results Viewer + Artifacts (tabs) */}
        {success && result.job_id && (
          <Card className="border border-border/80 bg-card shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base font-medium">Results viewer &amp; artifacts</CardTitle>
                <a
                  href={downloadUrl(result.job_id)}
                  download="output.xlsx"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="gap-2 rounded-lg">
                    <FileSpreadsheet className="h-4 w-4" />
                    Download Excel
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="matched" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto gap-0">
                  <TabsTrigger value="matched" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                    Matched preview
                  </TabsTrigger>
                  <TabsTrigger value="exceptions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                    Exceptions
                  </TabsTrigger>
                  <TabsTrigger value="artifacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                    Artifacts
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="matched" className="mt-4">
                  {previewLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading preview…
                    </div>
                  ) : preview?.matched_preview?.length ? (
                    <div className="space-y-3">
                      <div className="overflow-x-auto overflow-y-auto max-h-[400px] rounded-md border border-border/80">
                        <Table>
                          <TableHeader>
                            <TableRow className="sticky top-0 z-10 bg-muted/80 backdrop-blur border-b hover:bg-muted/80">
                              {matchedColumns.map((col) => (
                                <TableHead
                                  key={col}
                                  className={`whitespace-nowrap font-mono text-xs ${
                                    NUMERIC_KEYS.has(col) ? "text-right" : "text-left"
                                  }`}
                                >
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview.matched_preview.map((row, i) => (
                              <TableRow key={i}>
                                {matchedColumns.map((col) => (
                                  <TableCell
                                    key={col}
                                    className={`font-mono text-xs whitespace-nowrap ${
                                      NUMERIC_KEYS.has(col) ? "text-right" : "text-left"
                                    }`}
                                  >
                                    {formatCell(row[col])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Showing first 50 matches. Download Excel for full data.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-6">
                      No matched rows to preview. Download Excel for full data.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="exceptions" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <Card className="border border-border/80 bg-muted/10">
                      <CardContent className="p-4">
                        <p className="text-xl font-semibold tabular-nums text-foreground">
                          {counts?.new ?? 0}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                          New
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Detected in later run only.
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border border-border/80 bg-muted/10">
                      <CardContent className="p-4">
                        <p className="text-xl font-semibold tabular-nums text-foreground">
                          {counts?.missing ?? 0}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                          Missing
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Present in earlier run only.
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border border-border/80 bg-muted/10">
                      <CardContent className="p-4">
                        <p className="text-xl font-semibold tabular-nums text-foreground">
                          {counts?.ambiguous ?? 0}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                          Ambiguous
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Multiple plausible candidates.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  {preview?.ambiguous_preview?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        First 25 ambiguous rows (preview)
                      </p>
                      <div className="overflow-x-auto rounded-md border border-border/80">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              {Object.keys(preview.ambiguous_preview[0]).map((col) => (
                                <TableHead
                                  key={col}
                                  className="whitespace-nowrap font-mono text-xs text-left"
                                >
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview.ambiguous_preview.slice(0, 15).map((row, i) => (
                              <TableRow key={i}>
                                {Object.keys(preview.ambiguous_preview[0]).map((col) => (
                                  <TableCell
                                    key={col}
                                    className="font-mono text-xs whitespace-nowrap"
                                  >
                                    {formatCell(row[col])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="artifacts" className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Use the Download Excel button above to get the full workbook.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
